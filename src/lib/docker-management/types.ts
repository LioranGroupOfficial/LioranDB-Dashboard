/**
 * LioranDB Docker Management Control Plane Types
 *
 * Defines the strict contract for interacting with the infrastructure-level
 * Docker Management API (https://pan.liorandb.com).
 *
 * This layer is strictly separated from the Rust database control plane:
 * - Docker Management: container lifecycle (start, stop, restart, pause, unpause, stats)
 * - Rust Control Plane: database users, permissions, readiness, logical engine reset
 */

export const ALLOWED_DOCKER_NODES = [
  'cx01',
  'cx02',
  'cx03',
  'cx04',
  'cx05',
  'cx06',
  'cx07',
] as const;

export type DockerNodeId = (typeof ALLOWED_DOCKER_NODES)[number];

/**
 * Strict allowlist validator for Docker node identifiers.
 */
export function isAllowedDockerNodeId(value: unknown): value is DockerNodeId {
  if (typeof value !== 'string') return false;
  return (ALLOWED_DOCKER_NODES as readonly string[]).includes(value.trim().toLowerCase());
}

/**
 * Extracts and normalizes an authoritative DockerNodeId from a node, instance, or identifier string.
 * Returns null if the target cannot be authoritatively mapped to cx01..cx07.
 */
export function extractDockerNodeId(input: unknown): DockerNodeId | null {
  if (!input) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim().toLowerCase();
    if (isAllowedDockerNodeId(trimmed)) return trimmed;

    // Pattern matches: "cx01", "cx1", "liorandb-cx01", "liorandb-cloud-cx01", "cx01.db.liorandb.com"
    const match = trimmed.match(/(?:^|[^a-z0-9])cx0?([1-7])(?:[^a-z0-9]|$)/i);
    if (match) {
      const canonical = `cx0${match[1]}` as DockerNodeId;
      if (isAllowedDockerNodeId(canonical)) return canonical;
    }
    return null;
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;

    // Check explicit dockerNodeId field if stored
    if (obj.dockerNodeId && isAllowedDockerNodeId(obj.dockerNodeId)) {
      return obj.dockerNodeId as DockerNodeId;
    }

    // Check serverIdentity (e.g. "cx01")
    if (obj.serverIdentity && typeof obj.serverIdentity === 'string') {
      const resolved = extractDockerNodeId(obj.serverIdentity);
      if (resolved) return resolved;
    }

    // Check slug (e.g. "liorandb-cloud-cx01")
    if (obj.slug && typeof obj.slug === 'string') {
      const resolved = extractDockerNodeId(obj.slug);
      if (resolved) return resolved;
    }

    // Check dbUrl or host (e.g. "cx01.db.liorandb.com")
    const host = (obj.dbUrl || obj.host) as string | undefined;
    if (host && typeof host === 'string') {
      const resolved = extractDockerNodeId(host);
      if (resolved) return resolved;
    }

    // Check controlPlaneEndpoint (e.g. "https://cx01.manage.db.liorandb.com")
    if (obj.controlPlaneEndpoint && typeof obj.controlPlaneEndpoint === 'string') {
      const resolved = extractDockerNodeId(obj.controlPlaneEndpoint);
      if (resolved) return resolved;
    }

    // Check name (e.g. "LioranDB Cloud CX01")
    if (obj.name && typeof obj.name === 'string') {
      const resolved = extractDockerNodeId(obj.name);
      if (resolved) return resolved;
    }
  }

  return null;
}

/**
 * Resolves the authoritative persistent volume name for a given node.
 * Strict 1:1 mapping derived from Compose project `liorandb-cloud`:
 *   cx01 -> cx01-data
 *   cx02 -> cx02-data
 *   ...
 *   cx07 -> cx07-data
 */
export function resolveDockerVolumeName(nodeId: DockerNodeId): string {
  if (!isAllowedDockerNodeId(nodeId)) {
    throw new Error(`Cannot resolve volume name: invalid Docker node ID '${String(nodeId)}'`);
  }
  return `${nodeId}-data`;
}

/**
 * Resolves the canonical container name under the Compose project.
 * e.g. cx01 -> "/liorandb-cx01"
 */
export function resolveDockerContainerName(nodeId: DockerNodeId): string {
  if (!isAllowedDockerNodeId(nodeId)) {
    throw new Error(`Cannot resolve container name: invalid Docker node ID '${String(nodeId)}'`);
  }
  return `/liorandb-${nodeId}`;
}

/**
 * Docker Container State Schema
 * Matches GET /v1/nodes/{cx}/state
 */
export interface DockerContainerState {
  name: string; // e.g. "/liorandb-cx01"
  running: boolean;
  paused: boolean;
  status: string; // "running" | "exited" | "paused" | "restarting" | "dead" | "created"
  restart_count?: number;
}

/**
 * Docker Container Stats Schema
 * Matches GET /v1/nodes/{cx}/stats
 */
export interface DockerContainerStats {
  name?: string;
  cpu_percent?: number;
  memory_usage_bytes?: number;
  memory_limit_bytes?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  block_read_bytes?: number;
  block_write_bytes?: number;
  raw?: unknown;
}

/**
 * Node item in GET /v1/nodes response
 */
export interface DockerNodeSummary {
  id: DockerNodeId;
  name: string;
  container_name?: string;
  running: boolean;
  paused?: boolean;
  status: string;
  restart_count?: number;
}

/**
 * Operation result from start, stop, restart, pause, unpause
 */
export interface DockerOperationResult {
  success: boolean;
  nodeId: DockerNodeId;
  action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause';
  status?: string;
  message?: string;
  state?: DockerContainerState;
}

/**
 * Strongly-typed authorization token for storage reset.
 * Required by the typed resetNodeStorage interface to prevent accidental
 * or arbitrary volume destruction.
 */
export interface ResetAuthorization {
  confirmedTargetNode: DockerNodeId;
  confirmedTargetVolume: string; // e.g. "cx01-data"
  confirmationToken: string;
  allocationId?: string;
  generationId?: string;
}

/**
 * Result of physical storage reset operation.
 */
export interface ResetResult {
  success: boolean;
  nodeId: DockerNodeId;
  volumeName: string;
  storageGeneration?: string;
  verifiedEmpty: boolean;
  message: string;
}

/**
 * Docker Management Client Configuration
 */
export interface DockerManagementClientConfig {
  baseUrl?: string;
  gatewayToken?: string;
  controlPlaneKey?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Interface representing the Docker management client contract.
 */
export interface IDockerManagementClient {
  getHealth(): Promise<{ status: string; ok: boolean }>;
  listNodes(): Promise<DockerNodeSummary[]>;
  getNodeState(nodeId: DockerNodeId): Promise<DockerContainerState>;
  getNodeStats(nodeId: DockerNodeId): Promise<DockerContainerStats>;

  startNode(nodeId: DockerNodeId): Promise<DockerOperationResult>;
  stopNode(nodeId: DockerNodeId): Promise<DockerOperationResult>;
  restartNode(nodeId: DockerNodeId): Promise<DockerOperationResult>;

  pauseNode(nodeId: DockerNodeId): Promise<DockerOperationResult>;
  unpauseNode(nodeId: DockerNodeId): Promise<DockerOperationResult>;

  resetNodeStorage(
    nodeId: DockerNodeId,
    authorization: ResetAuthorization
  ): Promise<ResetResult>;

  waitForRunning(
    nodeId: DockerNodeId,
    maxWaitMs?: number,
    pollIntervalMs?: number
  ): Promise<DockerContainerState>;

  waitForStopped(
    nodeId: DockerNodeId,
    maxWaitMs?: number,
    pollIntervalMs?: number
  ): Promise<DockerContainerState>;
}
