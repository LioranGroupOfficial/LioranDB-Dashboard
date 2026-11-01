import { z } from 'zod';
import { LioranDBAdminError } from './errors';
import {
  SharedHostingStatusSchema,
  SharedHostingStorageSchema,
  TenantSchema,
  TenantUsageSchema,
  type RustSharedHostingStatus,
  type RustSharedHostingStorage,
  type RustTenant,
  type RustTenantUsage,
} from './tenant-types';

export const FREE_SHARED_PLAN_ID = 'free';
export const FREE_SHARED_STORAGE_BYTES = 512 * 1024 * 1024;
export const FREE_SHARED_MEMORY_BYTES = 512 * 1024 * 1024;
export const FREE_SHARED_CPU_CORES = 2;
export const FREE_SHARED_MAX_TENANTS = 10;

const TENANT_PHYSICAL_DATABASE_PATTERN = /^tenant_[a-z0-9]+__(.+)$/i;

export function isTenantPhysicalDatabaseName(value: string | undefined): boolean {
  return Boolean(value?.trim() && TENANT_PHYSICAL_DATABASE_PATTERN.test(value.trim()));
}

/**
 * Rust resolves tenant connection paths from logical names. Older Dashboard
 * records and older Rust responses may contain the namespaced physical name,
 * so normalize that representation only at the Dashboard/Rust boundary.
 */
export function getSharedTenantLogicalDatabaseName(
  tenant: Pick<RustTenant, 'database_name' | 'logical_database_name' | 'physical_database_name' | 'connection'>,
  fallback?: string,
): string {
  const candidates = [
    tenant.logical_database_name,
    tenant.connection?.database,
    tenant.database_name,
    fallback,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && !isTenantPhysicalDatabaseName(value)) return value;
  }

  const physical = tenant.physical_database_name || tenant.database_name;
  const match = physical.trim().match(TENANT_PHYSICAL_DATABASE_PATTERN);
  if (match?.[1]) return match[1];

  throw new Error('SHARED_LOGICAL_DATABASE_NAME_UNAVAILABLE');
}

export function getSharedTenantPhysicalDatabaseName(
  tenant: Pick<RustTenant, 'database_name' | 'physical_database_name'>,
): string | undefined {
  const reported = tenant.physical_database_name?.trim();
  if (reported) return reported;
  const databaseName = tenant.database_name?.trim();
  return databaseName && isTenantPhysicalDatabaseName(databaseName) ? databaseName : undefined;
}

export function getSharedRecordLogicalDatabaseName(record: {
  sharedLogicalDatabaseName?: string;
  databaseName: string;
  name?: string;
}): string {
  const candidates = [record.sharedLogicalDatabaseName, record.databaseName, record.name];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && !isTenantPhysicalDatabaseName(value)) return value;
  }
  const match = record.databaseName.trim().match(TENANT_PHYSICAL_DATABASE_PATTERN);
  if (match?.[1]) return match[1];
  throw new Error('SHARED_LOGICAL_DATABASE_NAME_UNAVAILABLE');
}

export function parseControlPlanePayload<T>(schema: z.ZodType<T>, payload: unknown, resource: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new LioranDBAdminError(`Control plane returned an invalid ${resource} response.`, {
      code: 'INVALID_CONTROL_PLANE_RESPONSE',
      statusCode: 502,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function parseSharedHostingStatus(payload: unknown): RustSharedHostingStatus {
  return parseControlPlanePayload(SharedHostingStatusSchema, payload, 'shared-hosting status');
}

export function parseSharedHostingStorage(payload: unknown): RustSharedHostingStorage {
  return parseControlPlanePayload(SharedHostingStorageSchema, payload, 'shared-hosting storage');
}

export function parseTenant(payload: unknown): RustTenant {
  return parseControlPlanePayload(TenantSchema, payload, 'tenant');
}

export function parseTenantUsage(payload: unknown): RustTenantUsage {
  return parseControlPlanePayload(TenantUsageSchema, payload, 'tenant usage');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    const precision = kib < 10 ? 2 : kib < 100 ? 1 : 0;
    return `${Number(kib.toFixed(precision))} KiB`;
  }
  const mib = bytes / (1024 * 1024);
  const precision = mib < 10 ? 2 : mib < 100 ? 1 : 0;
  return `${Number(mib.toFixed(precision))} MiB`;
}

export function tenantStatusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}
