import mongoose, { Document, Model, Schema } from 'mongoose';
import type { UserRole } from './User';

export type AuditAction =
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_DELETED'
  | 'EMAIL_VERIFIED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'POLICY_ACCEPTED'
  | 'DATABASE_PROVISIONED'
  | 'DATABASE_SUSPENDED'
  | 'DATABASE_RESUMED'
  | 'DATABASE_TERMINATED'
  | 'DATABASE_RESET'
  | 'DATABASE_USER_CREATED'
  | 'DATABASE_USER_DELETED'
  | 'DATABASE_USER_PASSWORD_RESET'
  | 'DATABASE_USER_DISABLED'
  | 'DATABASE_USER_ENABLED'
  | 'ROOT_CREDENTIAL_ROTATED'
  | 'INSTANCE_SUSPENDED'
  | 'INSTANCE_RESUMED'
  | 'INSTANCE_RESTARTED'
  | 'BACKUP_TRIGGERED'
  | 'INSTANCE_RESET_STARTED'
  | 'INSTANCE_RESET_COMPLETED'
  | 'INSTANCE_RESET_FAILED'
  | 'INSTANCE_TERMINATED'
  | 'SERVICE_SUSPENDED'
  | 'SERVICE_RESUMED'
  | 'SERVICE_DELETED'
  | 'CREDENTIALS_ROTATED'
  | 'CREDENTIALS_REVEALED'
  | 'CREDENTIALS_VIEWED'
  | 'COUPON_CREATED'
  | 'COUPON_UPDATED'
  | 'COUPON_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'INVOICE_PAID_WEBHOOK'
  | 'INVOICE_VOIDED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_VERIFIED'
  | 'ROLE_CHANGED'
  | 'TICKET_CREATED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_RESOLVED'
  | 'ACCOUNT_VERIFICATION_ORDER_CREATED'
  | 'ACCOUNT_VERIFICATION_PAYMENT_PENDING'
  | 'ACCOUNT_VERIFICATION_PAYMENT_SUCCEEDED'
  | 'ACCOUNT_VERIFICATION_PAYMENT_FAILED'
  | 'ACCOUNT_VERIFICATION_COMPLETED'
  | 'ACCOUNT_VERIFICATION_WEBHOOK_RECEIVED'
  | 'ACCOUNT_VERIFICATION_REFUNDED'
  | 'HOSTING_NODE_CREATED'
  | 'HOSTING_NODE_UPDATED'
  | 'HOSTING_NODE_DELETED'
  | 'ADMIN_ACTION';

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorRole?: UserRole | 'system';
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    entityType: { type: String, index: true },
    entityId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

if (mongoose.models.AuditLog) {
  delete (mongoose.models as Record<string, unknown>).AuditLog;
}

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
