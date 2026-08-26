import mongoose, { Document, Model, Schema } from 'mongoose';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type TicketCategory =
  | 'SUPPORT_REQUEST'
  | 'BUG_REPORT'
  | 'FEATURE_REQUEST'
  | 'BILLING_REQUEST'
  | 'OTHER';

export interface ISupportTicket extends Document {
  userId: mongoose.Types.ObjectId;
  ticketNumber: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: mongoose.Types.ObjectId;
  url?: string;
  environment?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketNumber: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['SUPPORT_REQUEST', 'BUG_REPORT', 'FEATURE_REQUEST', 'BILLING_REQUEST', 'OTHER'],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    url: { type: String, trim: true },
    environment: { type: String },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ userId: 1, status: 1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });

const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
