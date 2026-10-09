import { Document, Model, Schema, model, models, Types } from '../adapter';

export type NotificationType =
  | 'EMAIL_VERIFIED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'TERMS_REQUIRED'
  | 'DATABASE_READY'
  | 'PROVISIONING_COMPLETE'
  | 'INSTANCE_CREATED'
  | 'INSTANCE_DELETED'
  | 'SERVICE_DELETED'
  | 'PAYMENT_DUE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'SERVICE_SUSPENDED'
  | 'SERVICE_RESUMED'
  | 'SUPPORT_REPLY'
  | 'GENERAL';

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification: Model<INotification> =
  models.Notification ||
  model<INotification>('Notification', NotificationSchema);

export default Notification;
