/**
 * LioranDB Rust Server Control Plane Types
 *
 * Maps directly to the Rust Server API schemas defined in:
 *   - db/crates/liorandb-server/src/control_plane.rs
 *   - db/crates/liorandb-server/src/http.rs
 *   - db/crates/liorandb-server/src/system.rs
 */

export type ServerHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNREACHABLE'
  | 'AUTHENTICATION_FAILED'
  | 'RESETTING'
  | 'MAINTENANCE'
  | 'READY';

export interface ApiEnvelope<T> {
  request_id: string;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface RustStorageUsage {
  engine_accounted_bytes: number;
  memory?: Record<string, unknown>;
}

export interface RustEngineStatus {
  status: string;
  components?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export interface RustAdminStatusData {
  actor_role?: 'ADMIN' | 'SUPER_ADMIN';
  instance_id: string;
  server_version?: string;
  version?: string;
  uptime_ms?: number;
  uptime_seconds?: number;
  state?: string;
  status?: string;
  node_id?: number;
  storage_usage?: RustStorageUsage;
  database_count?: number;
  total_databases?: number;
  collection_count?: number;
  total_collections?: number;
  document_count?: number;
  total_documents?: number;
  user_count?: number;
  memory_bytes_used?: number;
  active_connections?: number;
  backup_status?: unknown;
  engine_status?: RustEngineStatus | Record<string, unknown>;
}

export interface RustPermissionGrant {
  permission: string;
  scope: unknown;
}

export interface RustUserSafeView {
  user_id?: string;
  id?: string;
  username: string;
  role?: string;
  roles?: string[];
  created_at_ms?: number;
  updated_at_ms?: number;
  enabled?: boolean;
  is_active?: boolean;
  must_change_password?: boolean;
  permissions?: RustPermissionGrant[];
  metadata?: Record<string, string>;
}

export interface RustGeneratedCredential {
  user_id: string;
  username: string;
  password: string;
}

export interface RustCreateUserResponse {
  user: RustUserSafeView;
  generated_password?: string;
}

export interface RustResetInstanceResponse {
  instance_id: string;
  state: string;
  bootstrap_credential: RustGeneratedCredential;
}

/**
 * Authoritative Rust Server Clean-State Verification Schema
 * Primary Path: GET /v1/admin/instance/clean-state
 */
export interface RustCleanStateResponse {
  instance_id: string;
  engine_readiness?: boolean | string;
  engine_state?: string;
  state?: string;
  is_clean: boolean;
  verification_complete?: boolean;
  verification?: {
    complete?: boolean;
    checks?: Record<string, unknown> | string[];
    [key: string]: unknown;
  };
  customer_database_count?: number;
  customer_collection_count?: number;
  customer_document_count?: number;
  customer_user_count?: number;
  residual_customer_resources?: string[] | Array<Record<string, unknown> | string> | Record<string, unknown>;
  failure_reasons?: string[];
  reasons?: string[];
  system_databases?: string[];
  system_users?: string[];
}

export type CleanVerificationStatus =
  | 'VERIFIED_CLEAN'
  | 'DIRTY_RESIDUAL_RESOURCES'
  | 'IDENTITY_MISMATCH'
  | 'ENGINE_NOT_READY'
  | 'VERIFICATION_INCOMPLETE'
  | 'CLEAN_STATE_API_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'COMMUNICATION_ERROR';

export type HostingNodeCleanStatus =
  | 'CLEAN'
  | 'DIRTY'
  | 'NOT_VERIFIED'
  | 'PENDING_VERIFICATION'
  | 'UNKNOWN';

// ==========================================
// Dashboard High-Level Types
// ==========================================

export interface LioranDBServerStatus {
  status: ServerHealthStatus | string;
  instanceId?: string;
  version: string;
  uptimeSeconds: number;
  storageBytes: number;
  memoryBytesUsed?: number;
  databaseCount: number;
  collectionCount: number;
  documentCount?: number;
  activeConnections?: number;
  opsPerSec?: number;
  userCount: number;
  state: string;
  engine?: string;
  lastBackupAt?: string;
  rawEngineStatus?: unknown;
}

export type DatabaseUserRole = 'read_write' | 'read_only' | 'write_only' | 'admin' | 'readWrite' | 'read' | 'dbAdmin';
export type DatabaseUserStatus = 'ACTIVE' | 'DISABLED';

export interface LioranDBUser {
  userId?: string;
  username: string;
  role: string;
  roles: string[];
  status: DatabaseUserStatus;
  enabled: boolean;
  mustChangePassword: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface CreateUserParams {
  username: string;
  password?: string;
  role?: string;
  roles?: string[];
  mustChangePassword?: boolean;
}

export interface CreateUserResult {
  userId?: string;
  username: string;
  role: string;
  roles: string[];
  status: DatabaseUserStatus;
  generatedPassword?: string;
  createdAt: string;
}

export interface ResetPasswordResult {
  userId?: string;
  username: string;
  newGeneratedPassword: string;
  rotatedAt: string;
}

export interface RotateRootResult {
  userId?: string;
  rootUsername: string;
  newGeneratedPassword: string;
  rotatedAt: string;
}

export interface ResetInstanceParams {
  confirmation?: string;
  instanceId?: string;
  idempotencyKey?: string;
}

export interface ResetInstanceResult {
  instanceId: string;
  rootUsername: string;
  newGeneratedRootPassword: string;
  state: string;
  collectionsRemoved?: number;
  documentsRemoved?: number;
  usersRemoved?: number;
  resetCompletedAt: string;
  status: 'ACTIVE' | 'READY';
  message: string;
}

export interface CleanStateResult {
  isClean: boolean;
  verificationStatus: CleanVerificationStatus;
  reasons: string[];
  reason?: string;
  instanceId?: string;
  status?: LioranDBServerStatus; // Backward-compatible alias for serverStatus
  serverStatus?: LioranDBServerStatus;
  authoritativeCleanData?: RustCleanStateResponse;
  customerDatabaseCount?: number;
  customerCollectionCount?: number;
  customerDocumentCount?: number;
  customerUserCount?: number;
  residualCustomerUserCount?: number;
  verificationComplete?: boolean;
}

export interface PurgeAndResetTenantResult {
  success: boolean;
  instanceId: string;
  verifiedClean: boolean;
  preResetMemoryBytes?: number;
  postResetMemoryBytes?: number;
  reclaimedMemoryBytes?: number;
  collectionsRemoved?: number;
  documentsRemoved?: number;
  usersRemoved?: number;
  rotatedRootPassword?: string;
  resetCompletedAt?: string;
  error?: string;
}

export interface BackupResult {
  backupId: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
  sizeBytes?: number;
  timestamp: string;
  message: string;
}

export interface RestartResult {
  instanceId: string;
  status: 'RESTARTED';
  timestamp: string;
  message: string;
}

export interface LioranDBAdminRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  retries?: number;
}
