import mongoose, { Document, Model, Schema } from 'mongoose';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type CompanyStage =
  | 'Idea'
  | 'Prototype'
  | 'Pre-revenue'
  | 'Early revenue'
  | 'Growth'
  | 'Established business'
  | 'Personal project'
  | 'Other';

export interface IHostingApplication extends Document {
  userId: mongoose.Types.ObjectId;
  version: number;
  fullName: string;
  workEmail: string;
  phone?: string;
  country: string;
  companyName: string;
  website?: string;
  description: string;
  stage: CompanyStage;
  githubUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  productUrl?: string;
  demoUrl?: string;
  whyLioranDB: string;
  appDescription: string;
  expectedDocumentCount: string;
  expectedMonthlyUsers: string;
  readTrafficLevel: string;
  writeTrafficLevel: string;
  estimatedStorage: string;
  isProduction: boolean;
  pricingResponse: 'yes' | 'discuss' | 'no';
  status: ApplicationStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HostingApplicationSchema = new Schema<IHostingApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    fullName: { type: String, required: true, trim: true },
    workEmail: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    country: { type: String, required: true },
    companyName: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    description: { type: String, required: true },
    stage: { type: String, required: true },
    githubUrl: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    twitterUrl: { type: String, trim: true },
    productUrl: { type: String, trim: true },
    demoUrl: { type: String, trim: true },
    whyLioranDB: { type: String, required: true },
    appDescription: { type: String, required: true },
    expectedDocumentCount: { type: String, required: true },
    expectedMonthlyUsers: { type: String, required: true },
    readTrafficLevel: { type: String, required: true },
    writeTrafficLevel: { type: String, required: true },
    estimatedStorage: { type: String, required: true },
    isProduction: { type: Boolean, required: true },
    pricingResponse: {
      type: String,
      enum: ['yes', 'discuss', 'no'],
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      default: 'DRAFT',
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

HostingApplicationSchema.index({ userId: 1, status: 1 });
HostingApplicationSchema.index({ status: 1, submittedAt: -1 });

const HostingApplication: Model<IHostingApplication> =
  mongoose.models.HostingApplication ||
  mongoose.model<IHostingApplication>('HostingApplication', HostingApplicationSchema);

export default HostingApplication;
