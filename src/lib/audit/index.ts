import { connectToDatabase, AuditLog } from '../db';
import type { AuditAction } from '../db/models/AuditLog';
import type { UserRole } from '../db/models/User';

interface CreateAuditLogParams {
  actorId?: string;
  actorRole?: UserRole | 'system';
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await connectToDatabase();
    await AuditLog.create({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  } catch (err) {
    // Audit log failure must not break the main operation
    console.error('[AuditLog] Failed to create audit log entry:', err);
  }
}
