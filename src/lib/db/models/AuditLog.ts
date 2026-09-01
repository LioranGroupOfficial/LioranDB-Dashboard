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
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_REVIEWED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_WITHDRAWN'
  | 'POLICY_ACCEPTED'
  | 'DATABASE_PROVISIONED'
  | 'DATABASE_SUSPENDED'
  | 'DATABASE_RESUMED'
  | 'CREDENTIALS_ROTATED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RESUMED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_SUBMITTED_FOR_VERIFICATION'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_VERIFICATION_REJECTED'
  | 'PAYMENT_MARKED_PAID'
  | 'ROLE_CHANGED'
  | 'TICKET_CREATED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_RESOLVED'
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

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
