import { z } from 'zod';

const numericLike = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number);

export const TenantStatusSchema = z.enum([
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'QUOTA_EXCEEDED',
  'DELETING',
  'FAILED',
]);

export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantConnectionSchema = z.object({
  uri: z.string().min(1),
  grpc_endpoint: z.string().min(1),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const TenantSchema = z.object({
  tenant_id: z.string().min(1),
  external_owner_id: z.string().min(1),
  database_id: z.string().min(1),
  database_name: z.string().min(1),
  // New Rust responses expose the namespace mapping explicitly. Older
  // responses only returned database_name, so both fields remain optional.
  logical_database_name: z.string().min(1).optional(),
  physical_database_name: z.string().min(1).optional(),
  plan: z.string().min(1),
  status: TenantStatusSchema,
  storage_quota_bytes: numericLike,
  storage_used_bytes: numericLike,
  created_at: numericLike,
  updated_at: numericLike,
  connection: TenantConnectionSchema.nullable().optional(),
});

export type RustTenant = z.infer<typeof TenantSchema>;

export const SharedHostingStatusSchema = z.object({
  enabled: z.boolean(),
  plan: z.string(),
  max_tenants: numericLike,
  occupied_slots: numericLike,
  available_slots: numericLike,
  default_storage_quota_bytes: numericLike,
  default_requests_per_second: numericLike,
  burst_requests_per_second: numericLike,
  max_concurrent_requests_per_tenant: numericLike,
  resources: z.object({
    type: z.string(),
    memory_limit_bytes: numericLike,
    cpu_limit_cores: numericLike,
  }),
});

export type RustSharedHostingStatus = z.infer<typeof SharedHostingStatusSchema>;

export const SharedHostingStorageSchema = z.object({
  logical_tenant_storage_bytes: numericLike,
  logical_quota_bytes: numericLike,
  physical_instance_accounted_bytes: numericLike,
  freshness: z.string(),
});

export type RustSharedHostingStorage = z.infer<typeof SharedHostingStorageSchema>;

export const TenantUsageSchema = z.object({
  tenant_id: z.string().min(1),
  storage_used_bytes: numericLike,
  storage_quota_bytes: numericLike,
  remaining_bytes: numericLike,
  percentage: z.number(),
  reads_total: numericLike,
  writes_total: numericLike,
  requests_per_second: numericLike,
  active_requests: numericLike,
  rejected_requests_total: numericLike,
  measured_at_unix_ms: numericLike,
  freshness: z.string(),
});

export type RustTenantUsage = z.infer<typeof TenantUsageSchema>;

export const CreateTenantInputSchema = z.object({
  external_owner_id: z.string().trim().min(1).max(128),
  plan: z.literal('free').default('free'),
  database_name: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Database name may contain lowercase letters, numbers, underscores, and hyphens.')
    .optional(),
  storage_quota_bytes: z.number().int().positive().optional(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

export const PatchTenantInputSchema = z.object({
  storage_quota_bytes: z.number().int().positive(),
});

export type PatchTenantInput = z.infer<typeof PatchTenantInputSchema>;

export interface TenantCredentialRotation {
  tenant_id: string;
  credentials: {
    user_id?: string;
    username: string;
    password: string;
  };
}

export interface CreateTenantResult {
  tenant: RustTenant;
  credentials?: { username: string; password: string };
  instance?: { type: string; memory_limit_bytes: number; cpu_limit_cores: number };
}

export interface TenantActionResult {
  tenant?: RustTenant;
  tenant_id?: string;
  reset?: boolean;
  deleted?: boolean;
  slot_released?: boolean;
}

export interface SharedHostingSnapshot {
  status: RustSharedHostingStatus;
  storage: RustSharedHostingStorage;
  measuredAt: string;
}
