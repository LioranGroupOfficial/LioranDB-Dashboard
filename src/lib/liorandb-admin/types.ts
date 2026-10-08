export type ServerHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'RESETTING' | 'MAINTENANCE';

export interface LioranDBServerStatus {
  status: ServerHealthStatus;
  version: string;
  uptimeSeconds: number;
  storageBytes: number;
  documentCount: number;
  activeConnections: number;
  opsPerSec: number;
  lastBackupAt?: string;
  engine: string;
}

export type DatabaseUserRole = 'readWrite' | 'read' | 'admin' | 'dbAdmin';
export type DatabaseUserStatus = 'ACTIVE' | 'DISABLED';

export interface LioranDBUser {
  username: string;
  role: DatabaseUserRole | string;
  status: DatabaseUserStatus;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface CreateUserParams {
  username: string;
  role?: DatabaseUserRole | string;
}

export interface CreateUserResult {
  username: string;
  role: string;
  status: DatabaseUserStatus;
  generatedPassword: string;
  createdAt: string;
}

export interface ResetPasswordResult {
  username: string;
  newGeneratedPassword: string;
  rotatedAt: string;
}

export interface RotateRootResult {
  rootUsername: string;
  newGeneratedPassword: string;
  rotatedAt: string;
}

export interface ResetInstanceParams {
  confirmation: string;
  targetInstanceName: string;
  idempotencyKey?: string;
}

export interface ResetInstanceResult {
  instanceId: string;
  rootUsername: string;
  newGeneratedRootPassword: string;
  resetCompletedAt: string;
  status: 'ACTIVE' | 'READY';
  message: string;
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
