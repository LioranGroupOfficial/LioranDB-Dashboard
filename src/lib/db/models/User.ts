import mongoose, { Document, Model, Schema } from 'mongoose';

export type UserRole = 'customer' | 'admin' | 'support';

export type OnboardingStage =
  | 'EMAIL_VERIFICATION'
  | 'APPLICATION_REQUIRED'
  | 'APPLICATION_PENDING'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'TERMS_REQUIRED'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'SUSPENDED';

export interface IUserProfile {
  fullName?: string;
  company?: string;
  phone?: string;
  country?: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  profile: IUserProfile;
  onboardingStage: OnboardingStage;
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
    onboardingStage: {
      type: String,
      enum: [
        'EMAIL_VERIFICATION',
        'APPLICATION_REQUIRED',
        'APPLICATION_PENDING',
        'APPLICATION_APPROVED',
        'APPLICATION_REJECTED',
        'TERMS_REQUIRED',
        'PROVISIONING',
        'ACTIVE',
        'SUSPENDED',
      ],
      default: 'EMAIL_VERIFICATION',
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
