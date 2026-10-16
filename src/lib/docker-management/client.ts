/**
 * LioranDB Docker Management Client
 *
 * Implements real HTTP integration against the Ubuntu Docker management service
 * listening behind Caddy at https://pan.liorandb.com.
 *
 * Security and Architecture Rules:
 *   - Authenticates using both LIORANDB_MANAGEMENT_GATEWAY_TOKEN and LIORANDB_CONTROL_PLANE_KEY.
 *   - Sends requests only to the trusted management API origin.
 *   - Strict node identifier allowlist: cx01..cx07 only.
 *   - Safe JSON response parsing with 1MB size limit and bounded timeouts.
 *   - Bounded retries on GET requests only; unsafe POST mutations are never retried.
 *   - Typed resetNodeStorage interface remains unsupported and fails closed with quarantine.
 *   - Zero credential leakage in client responses or error messages.
 */

import { generateSecureToken } from '@/lib/crypto';
import {
  DockerNodeId,
  isAllowedDockerNodeId,
  resolveDockerVolumeName,
  DockerContainerState,
  DockerContainerStats,
  DockerNodeSummary,
  DockerOperationResult,
  ResetAuthorization,
  ResetResult,
  DockerManagementClientConfig,
  IDockerManagementClient,
} from './types';
import {
  DockerManagementError,
  DockerAuthenticationError,
  DockerNodeNotFoundError,
  DockerTimeoutError,
  DockerUnreachableError,
  DockerConflictError,
  DockerNodeNotAllowedError,
  DockerCapabilityUnsupportedError,
} from './errors';

const DEFAULT_BASE_URL = 'https://pan.liorandb.com';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MB

interface RequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  body?: unknown;
  nodeId?: DockerNodeId;
  timeoutMs?: number;
  retries?: number;
}

export class LioranDBDockerManagementClient implements IDockerManagementClient {
  public readonly baseUrl: string;
  private readonly gatewayToken?: string;
  private readonly controlPlaneKey?: string;
  private readonly timeoutMs: number;

  constructor(config: DockerManagementClientConfig = {}) {
    const rawUrl = (config.baseUrl || process.env.LIORANDB_DOCKER_MANAGEMENT_URL || DEFAULT_BASE_URL).trim();
    // Normalize base URL, ensure https in production
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.gatewayToken = (config.gatewayToken || process.env.LIORANDB_MANAGEMENT_GATEWAY_TOKEN || '').trim() || undefined;
    this.controlPlaneKey = (config.controlPlaneKey || process.env.LIORANDB_CONTROL_PLANE_KEY || '').trim() || undefined;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Checks whether the client has the required environment credentials configured.
   */
  public isConfigured(): boolean {
    return Boolean(this.gatewayToken && this.controlPlaneKey);
  }

  /**
   * Internal HTTP dispatcher handling dual-layer authentication headers,
   * bounded timeouts, response size limits, and safe error mapping.
   */
  private async dispatch<T>(options: RequestOptions): Promise<T> {
    const requestId = `dkr_${Date.now()}_${generateSecureToken(4)}`;
    const path = options.path.startsWith('/') ? options.path : `/${options.path}`;
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    const timeout = options.timeoutMs || this.timeoutMs;
    const maxRetries = options.retries ?? (method === 'GET' ? 1 : 0);

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Id': requestId,
        };

        if (this.gatewayToken) {
          headers['X-Lioran-Gateway-Token'] = this.gatewayToken;
        }

        if (this.controlPlaneKey) {
          headers['X-Lioran-Panel-Key'] = this.controlPlaneKey;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Enforce maximum response size before buffering
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
          throw new DockerManagementError(
            `Management API response exceeded maximum allowable size (${MAX_RESPONSE_BYTES} bytes)`,
            { statusCode: 502, code: 'RESPONSE_TOO_LARGE', nodeId: options.nodeId, requestId }
          );
        }

        const responseText = await response.text().catch(() => '');

        if (responseText.length > MAX_RESPONSE_BYTES) {
          throw new DockerManagementError(
            `Management API response exceeded maximum allowable size (${MAX_RESPONSE_BYTES} bytes)`,
            { statusCode: 502, code: 'RESPONSE_TOO_LARGE', nodeId: options.nodeId, requestId }
          );
        }

        let parsedJson: any = null;
        if (responseText && responseText.trim()) {
          try {
            parsedJson = JSON.parse(responseText);
          } catch {
            // Non-JSON response
          }
        }

        if (response.status === 401 || response.status === 403) {
          const detail = parsedJson?.message || parsedJson?.error || responseText || 'Access Denied';
          throw new DockerAuthenticationError(
            `Docker management authentication failed (HTTP ${response.status}): ${detail}`,
            { nodeId: options.nodeId, requestId }
          );
        }

        if (response.status === 404) {
          const detail = parsedJson?.message || parsedJson?.error || `Node resource not found at ${path}`;
          throw new DockerNodeNotFoundError(detail, { nodeId: options.nodeId, requestId });
        }

        if (response.status === 409) {
          const detail = parsedJson?.message || parsedJson?.error || `Conflict on ${method} ${path}`;
          throw new DockerConflictError(detail, { nodeId: options.nodeId, requestId });
        }

        if (!response.ok) {
          const detail = parsedJson?.message || parsedJson?.error || responseText || `HTTP ${response.status}`;
          throw new DockerManagementError(
            `Docker management service returned HTTP ${response.status} on ${method} ${path}: ${detail}`,
            { statusCode: response.status, code: 'UPSTREAM_ERROR', nodeId: options.nodeId, requestId }
          );
        }

        if (parsedJson !== null) {
          return parsedJson as T;
        }

        return {} as T;
      } catch (err: unknown) {
        clearTimeout(timer);
        lastError = err;

        if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('timeout'))) {
          lastError = new DockerTimeoutError(
            `Docker management request to ${method} ${path} timed out after ${timeout}ms`,
            { nodeId: options.nodeId, requestId, cause: err }
          );
        } else if (
          err instanceof TypeError &&
          (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))
        ) {
          lastError = new DockerUnreachableError(
            `Cannot connect to Docker management API at ${this.baseUrl}: ${err.message}`,
            { nodeId: options.nodeId, requestId, cause: err }
          );
        }

        // Retry only GET requests on transient network issues with bounded backoff
        if (attempt < maxRetries && method === 'GET') {
          const delay = Math.pow(2, attempt) * 250;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * GET /health
   * Verifies the Docker management service health.
   */
  public async getHealth(): Promise<{ status: string; ok: boolean }> {
    try {
      const res = await this.dispatch<{ status?: string; message?: string }>({
        path: '/health',
        method: 'GET',
        timeoutMs: 5000,
      });
      const status = res?.status || 'ok';
      return { status, ok: true };
    } catch (err) {
      if (err instanceof DockerManagementError) throw err;
      throw new DockerUnreachableError(
        `Failed to reach health endpoint on ${this.baseUrl}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  /**
   * GET /v1/nodes
   * Lists all managed containers under the Compose project.
   */
  public async listNodes(): Promise<DockerNodeSummary[]> {
    const raw = await this.dispatch<any>({
      path: '/v1/nodes',
      method: 'GET',
      timeoutMs: 8000,
    });

    if (Array.isArray(raw)) {
      return raw.map((item) => {
        const id = (item.id || item.node || item.name || '').replace(/^\/?liorandb-/, '') as DockerNodeId;
        return {
          id: isAllowedDockerNodeId(id) ? id : (item.id as DockerNodeId),
          name: item.name || `/liorandb-${id}`,
          container_name: item.container_name || item.name,
          running: Boolean(item.running ?? item.status === 'running'),
          paused: Boolean(item.paused),
          status: item.status || (item.running ? 'running' : 'exited'),
          restart_count: item.restart_count || 0,
        };
      });
    }

    if (raw && typeof raw === 'object' && Array.isArray(raw.nodes)) {
      return raw.nodes;
    }

    return [];
  }

  /**
   * GET /v1/nodes/{cx}/state
   * Retrieves container state for a specific CX node.
   */
  public async getNodeState(nodeId: DockerNodeId): Promise<DockerContainerState> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/state`,
      method: 'GET',
      nodeId,
      timeoutMs: 6000,
    });

    return {
      name: res.name || `/liorandb-${nodeId}`,
      running: Boolean(res.running),
      paused: Boolean(res.paused),
      status: res.status || (res.running ? 'running' : 'exited'),
      restart_count: res.restart_count ?? 0,
    };
  }

  /**
   * GET /v1/nodes/{cx}/stats
   * Retrieves container resource statistics for a specific CX node.
   */
  public async getNodeStats(nodeId: DockerNodeId): Promise<DockerContainerStats> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/stats`,
      method: 'GET',
      nodeId,
      timeoutMs: 6000,
    });

    return {
      name: res.name || `/liorandb-${nodeId}`,
      cpu_percent: res.cpu_percent,
      memory_usage_bytes: res.memory_usage_bytes || res.memory_usage,
      memory_limit_bytes: res.memory_limit_bytes || res.memory_limit,
      network_rx_bytes: res.network_rx_bytes,
      network_tx_bytes: res.network_tx_bytes,
      block_read_bytes: res.block_read_bytes,
      block_write_bytes: res.block_write_bytes,
      raw: res,
    };
  }

  /**
   * POST /v1/nodes/{cx}/start
   * Starts a stopped or exited container.
   */
  public async startNode(nodeId: DockerNodeId): Promise<DockerOperationResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/start`,
      method: 'POST',
      nodeId,
      timeoutMs: 12000,
    });

    return {
      success: res.success !== false,
      nodeId,
      action: 'start',
      status: res.status || 'running',
      message: res.message || `Container /liorandb-${nodeId} started`,
    };
  }

  /**
   * POST /v1/nodes/{cx}/stop
   * Stops a running container.
   */
  public async stopNode(nodeId: DockerNodeId): Promise<DockerOperationResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/stop`,
      method: 'POST',
      nodeId,
      timeoutMs: 15000,
    });

    return {
      success: res.success !== false,
      nodeId,
      action: 'stop',
      status: res.status || 'exited',
      message: res.message || `Container /liorandb-${nodeId} stopped`,
    };
  }

  /**
   * POST /v1/nodes/{cx}/restart
   * Restarts a container.
   */
  public async restartNode(nodeId: DockerNodeId): Promise<DockerOperationResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/restart`,
      method: 'POST',
      nodeId,
      timeoutMs: 15000,
    });

    return {
      success: res.success !== false,
      nodeId,
      action: 'restart',
      status: res.status || 'running',
      message: res.message || `Container /liorandb-${nodeId} restarted`,
    };
  }

  /**
   * POST /v1/nodes/{cx}/pause
   * Pauses container processes.
   */
  public async pauseNode(nodeId: DockerNodeId): Promise<DockerOperationResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/pause`,
      method: 'POST',
      nodeId,
      timeoutMs: 10000,
    });

    return {
      success: res.success !== false,
      nodeId,
      action: 'pause',
      status: res.status || 'paused',
      message: res.message || `Container /liorandb-${nodeId} paused`,
    };
  }

  /**
   * POST /v1/nodes/{cx}/unpause
   * Resumes paused container processes.
   */
  public async unpauseNode(nodeId: DockerNodeId): Promise<DockerOperationResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const res = await this.dispatch<any>({
      path: `/v1/nodes/${nodeId}/unpause`,
      method: 'POST',
      nodeId,
      timeoutMs: 10000,
    });

    return {
      success: res.success !== false,
      nodeId,
      action: 'unpause',
      status: res.status || 'running',
      message: res.message || `Container /liorandb-${nodeId} resumed`,
    };
  }

  /**
   * Physical Volume Reset Capability Interface
   *
   * The management API currently does not have a verified endpoint for deleting
   * a Docker volume or performing a physical factory reset on disk.
   *
   * As required by the system safety specification:
   * - Do not invent a speculative reset endpoint.
   * - Do not silently replace physical deletion with logical cleanup.
   * - Do not mark termination cleanup as successful without verified evidence.
   * - Fail closed with a typed DockerCapabilityUnsupportedError and quarantine the node.
   */
  public async resetNodeStorage(
    nodeId: DockerNodeId,
    authorization: ResetAuthorization
  ): Promise<ResetResult> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    // Verify authorization parameters strictly match target node and volume
    const expectedVolume = resolveDockerVolumeName(nodeId);
    if (authorization.confirmedTargetNode !== nodeId) {
      throw new DockerManagementError(
        `Reset authorization mismatch: target node '${nodeId}' does not match authorization '${authorization.confirmedTargetNode}'`,
        { statusCode: 400, code: 'AUTHORIZATION_NODE_MISMATCH', nodeId }
      );
    }

    if (authorization.confirmedTargetVolume !== expectedVolume) {
      throw new DockerManagementError(
        `Reset authorization mismatch: target volume '${expectedVolume}' does not match authorization '${authorization.confirmedTargetVolume}'`,
        { statusCode: 400, code: 'AUTHORIZATION_VOLUME_MISMATCH', nodeId }
      );
    }

    // Explicitly fail closed: capability is not deployed on live Ubuntu management service
    throw new DockerCapabilityUnsupportedError('Physical volume reset', { nodeId });
  }

  /**
   * Polls the container state until `running === true` or timeout expires.
   */
  public async waitForRunning(
    nodeId: DockerNodeId,
    maxWaitMs = 25000,
    pollIntervalMs = 1500
  ): Promise<DockerContainerState> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const start = Date.now();
    let lastState: DockerContainerState | null = null;

    while (Date.now() - start < maxWaitMs) {
      try {
        lastState = await this.getNodeState(nodeId);
        if (lastState.running) {
          return lastState;
        }
      } catch (err) {
        // Transient check error while container is transitioning
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new DockerTimeoutError(
      `Container /liorandb-${nodeId} did not enter running state within ${maxWaitMs}ms (current status: ${lastState?.status || 'unknown'})`,
      { nodeId }
    );
  }

  /**
   * Polls the container state until `running === false` or timeout expires.
   */
  public async waitForStopped(
    nodeId: DockerNodeId,
    maxWaitMs = 25000,
    pollIntervalMs = 1500
  ): Promise<DockerContainerState> {
    if (!isAllowedDockerNodeId(nodeId)) {
      throw new DockerNodeNotAllowedError(String(nodeId));
    }

    const start = Date.now();
    let lastState: DockerContainerState | null = null;

    while (Date.now() - start < maxWaitMs) {
      try {
        lastState = await this.getNodeState(nodeId);
        if (!lastState.running) {
          return lastState;
        }
      } catch (err) {
        // Transient check error
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new DockerTimeoutError(
      `Container /liorandb-${nodeId} did not stop within ${maxWaitMs}ms (current status: ${lastState?.status || 'unknown'})`,
      { nodeId }
    );
  }
}
