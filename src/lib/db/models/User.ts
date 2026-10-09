import { Document, Model, Schema, model, models, Types } from '../adapter';

export type UserRole = 'customer' | 'admin' | 'support';

export type OnboardingStage =
  | 'EMAIL_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED';

export interface IAccountVerification {
  feePaid: boolean;
  amountPaid: number;
  currency: 'INR';
  paidAt: Date | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  verificationMethod: 'RAZORPAY' | null;
  status: 'UNPAID' | 'PENDING' | 'VERIFIED';
}

export interface IUserProfile {
  fullName?: string;
  company?: string;
  phone?: string;
  country?: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  profile: IUserProfile;
  onboardingStage: OnboardingStage;
  accountVerification: IAccountVerification;
  accountRegistrationPaid?: boolean;
  accountRegistrationPaidAt?: Date;
  razorpayCustomerId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    fullName: { type: String, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const AccountVerificationSchema = new Schema<IAccountVerification>(
  {
    feePaid: { type: Boolean, default: false },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    paidAt: { type: Date, default: null },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    verificationMethod: { type: String, default: null },
    status: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'VERIFIED'],
      default: 'UNPAID',
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['customer', 'admin', 'support'],
      default: 'customer',
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    profile: { type: UserProfileSchema, default: () => ({}) },
    accountVerification: {
      type: AccountVerificationSchema,
      default: () => ({
        feePaid: false,
        amountPaid: 0,
        currency: 'INR',
        paidAt: null,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        verificationMethod: null,
        status: 'UNPAID',
      }),
    },
    accountRegistrationPaid: { type: Boolean, default: false },
    accountRegistrationPaidAt: { type: Date },
    razorpayCustomerId: { type: String },
    onboardingStage: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'ACTIVE', 'SUSPENDED'],
      default: 'EMAIL_VERIFICATION',
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> = models.User || model<IUser>('User', UserSchema);

export default User;
