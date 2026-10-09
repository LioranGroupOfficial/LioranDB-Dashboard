import { Document, Model, Schema, model, models, Types } from '../adapter';

export interface IEmailVerification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  lastSentAt: Date;
}

const EmailVerificationSchema = new Schema<IEmailVerification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attemptCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailVerification: Model<IEmailVerification> =
  models.EmailVerification ||
  model<IEmailVerification>('EmailVerification', EmailVerificationSchema);

export default EmailVerification;
