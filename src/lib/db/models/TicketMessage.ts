import { Document, Model, Schema, model, models, Types } from '../adapter';
import type { UserRole } from './User';

export interface ITicketMessage extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  authorId: Types.ObjectId;
  authorRole: UserRole;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: {
      type: String,
      enum: ['customer', 'admin', 'support'],
      required: true,
    },
    body: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

TicketMessageSchema.index({ ticketId: 1, createdAt: 1 });
TicketMessageSchema.index({ ticketId: 1, isInternal: 1 });

const TicketMessage: Model<ITicketMessage> =
  models.TicketMessage ||
  model<ITicketMessage>('TicketMessage', TicketMessageSchema);

export default TicketMessage;
