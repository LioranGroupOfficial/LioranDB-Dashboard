import { Document, Model, Schema, model, models, Types } from '../adapter';

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';

export interface IInvoiceLineItem {
  instanceId?: Types.ObjectId;
  instanceName: string;
  planId: string;
  planName: string;
  hourlyRatePaise: number;
  billableHours: number;
  usageAmountPaise: number;
  backupAmountPaise: number;
  discountPaise: number;
  subtotalPaise: number;
  description?: string;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  issueDate: Date;
  dueDate: Date;
  lineItems: IInvoiceLineItem[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency?: string;
  status: InvoiceStatus;
  paidAt?: Date;
  paymentId?: string;
  paymentTransactionReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    instanceId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase' },
    instanceName: { type: String, required: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    hourlyRatePaise: { type: Number, required: true },
    billableHours: { type: Number, required: true, default: 0 },
    usageAmountPaise: { type: Number, required: true, default: 0 },
    backupAmountPaise: { type: Number, required: true, default: 0 },
    discountPaise: { type: Number, required: true, default: 0 },
    subtotalPaise: { type: Number, required: true, default: 0 },
    description: { type: String },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    billingPeriod: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    issueDate: { type: Date, required: true, default: () => new Date() },
    dueDate: { type: Date, required: true },
    lineItems: [InvoiceLineItemSchema],
    subtotalPaise: { type: Number, required: true, default: 0 },
    discountPaise: { type: Number, required: true, default: 0 },
    taxPaise: { type: Number, required: true, default: 0 },
    totalPaise: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'PAID', 'OVERDUE', 'VOID'],
      default: 'OPEN',
      index: true,
    },
    paidAt: { type: Date },
    paymentId: { type: String },
    paymentTransactionReference: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    notes: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

InvoiceSchema.index({ customerId: 1, status: 1 });
InvoiceSchema.index({ status: 1, dueDate: 1 });

const Invoice: Model<IInvoice> = models.Invoice || model<IInvoice>('Invoice', InvoiceSchema);

export default Invoice;
