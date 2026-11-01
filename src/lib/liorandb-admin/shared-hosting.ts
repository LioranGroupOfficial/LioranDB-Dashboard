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
