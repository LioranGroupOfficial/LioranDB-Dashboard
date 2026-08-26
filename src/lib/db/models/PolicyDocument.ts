import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPolicyDocument extends Document {
  slug: string;
  title: string;
  version: string;
  effectiveAt: Date;
  contentHash: string;
  content: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PolicyDocumentSchema = new Schema<IPolicyDocument>(
  {
    slug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    version: { type: String, required: true },
    effectiveAt: { type: Date, required: true },
    contentHash: { type: String, required: true },
    content: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

PolicyDocumentSchema.index({ slug: 1, version: 1 }, { unique: true });
PolicyDocumentSchema.index({ slug: 1, active: 1 });

const PolicyDocument: Model<IPolicyDocument> =
  mongoose.models.PolicyDocument ||
  mongoose.model<IPolicyDocument>('PolicyDocument', PolicyDocumentSchema);

export default PolicyDocument;
