'use server';

import { connectToDatabase, User, EmailVerification, PasswordReset } from '../db';
import { hashPassword, verifyPassword } from '../auth/password';
import { generateOTP, sha256, generateSecureToken } from '../crypto';
import { getSession } from '../auth/session';
import {
  sendEmail,
  verificationOTPTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
} from '../email';
import { createAuditLog } from '../audit';
import { createNotification } from '../notifications';
import { ValidationError, ConflictError, AppError } from '../errors';
import type { SessionData } from '../auth/session';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ─── SIGNUP ──────────────────────────────────────────────────────────────────

export async function signupUser(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string
): Promise<{ userId: string; otp?: string }> {
  await connectToDatabase();

  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user (no enumeration: same response regardless)
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: 'customer',
    emailVerified: false,
    onboardingStage: 'EMAIL_VERIFICATION',
    profile: {},
  });

  // Generate and send OTP
  const devOtp = await _sendVerificationOTP(user._id.toString(), normalizedEmail);

  await createAuditLog({
    actorId: user._id.toString(),
    actorRole: 'customer',
    action: 'ACCOUNT_CREATED',
    entityType: 'User',
    entityId: user._id.toString(),
    ip,
    userAgent,
  });

  return {
    userId: user._id.toString(),
    otp: process.env.NODE_ENV === 'development' ? devOtp : undefined,
  };
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string
): Promise<SessionData> {
  await connectToDatabase();

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  // Constant-time response for non-existent users
  if (!user) {
    await hashPassword('dummy_compare_to_prevent_timing'); // prevent timing attack
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated. Please contact support.', 403);
  }

  // Update last login
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  const sessionData: SessionData = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  };

  // Persist session
  const session = await getSession();
  session.userId = sessionData.userId;
  session.email = sessionData.email;
  session.role = sessionData.role;
  session.emailVerified = sessionData.emailVerified;
  await session.save();

  await createAuditLog({
    actorId: user._id.toString(),
    actorRole: user.role,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user._id.toString(),
    ip,
    userAgent,
  });

  return sessionData;
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

export async function logoutUser(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

// ─── OTP VERIFICATION ────────────────────────────────────────────────────────

export async function _sendVerificationOTP(userId: string, email: string): Promise<string> {
  const otp = generateOTP();
  const otpHash = sha256(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate previous OTPs and create a new one
  await EmailVerification.findOneAndUpdate(
    { userId },
    {
      otpHash,
      expiresAt,
      attemptCount: 0,
      lastSentAt: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  await sendEmail({
    to: email,
    subject: 'Verify your LioranDB account',
    html: verificationOTPTemplate(otp, OTP_EXPIRY_MINUTES),
  });

  return otp; // Only used in dev mode
}

export async function verifyEmailOTP(
  userId: string,
  otp: string,
  ip?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string }> {
  await connectToDatabase();

  const record = await EmailVerification.findOne({ userId });

  if (!record) {
    return { success: false, message: 'No verification code found. Please request a new one.' };
  }

  if (record.expiresAt < new Date()) {
    return { success: false, message: 'Verification code has expired. Please request a new one.' };
  }

  if (record.attemptCount >= OTP_MAX_ATTEMPTS) {
    return {
      success: false,
      message: 'Maximum attempts exceeded. Please request a new verification code.',
    };
  }

  const otpHash = sha256(otp.trim());
  if (otpHash !== record.otpHash) {
    await EmailVerification.findByIdAndUpdate(record._id, {
      $inc: { attemptCount: 1 },
    });
    const remaining = OTP_MAX_ATTEMPTS - record.attemptCount - 1;
    return {
      success: false,
      message: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Maximum attempts exceeded. Please request a new verification code.',
    };
  }

  // Mark email as verified
  await User.findByIdAndUpdate(userId, {
    emailVerified: true,
    emailVerifiedAt: new Date(),
    onboardingStage: 'APPLICATION_REQUIRED',
  });

  // Remove verification record
  await EmailVerification.deleteOne({ userId });

  // Refresh session
  const session = await getSession();
  if (session.userId === userId) {
    session.emailVerified = true;
    await session.save();
  }

  await createAuditLog({
    actorId: userId,
    actorRole: 'customer',
    action: 'EMAIL_VERIFIED',
    entityType: 'User',
    entityId: userId,
    ip,
    userAgent,
  });

  await createNotification({
    userId,
    type: 'EMAIL_VERIFIED',
    title: 'Email verified',
    body: 'Your email address has been verified. You can now apply for managed hosting.',
    link: '/application',
  });

  return { success: true, message: 'Email verified successfully.' };
}

export async function resendVerificationOTP(
  userId: string,
  email: string
): Promise<{ success: boolean; message: string; cooldownSeconds?: number }> {
  await connectToDatabase();

  const existing = await EmailVerification.findOne({ userId });

  if (existing) {
    const secondsSinceLastSent = (Date.now() - existing.lastSentAt.getTime()) / 1000;
    if (secondsSinceLastSent < OTP_RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSent);
      return {
        success: false,
        message: `Please wait ${remaining} seconds before requesting another code.`,
        cooldownSeconds: remaining,
      };
    }
  }

  await _sendVerificationOTP(userId, email);
  return { success: true, message: 'A new verification code has been sent to your email.' };
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────

export async function requestPasswordReset(
  email: string,
  ip?: string
): Promise<void> {
  await connectToDatabase();

  // Always respond the same way to prevent email enumeration
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (user) {
    const token = generateSecureToken(32);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate old tokens (keep record for audit)
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

    const APP_URL = process.env.APP_URL || 'https://app.liorandb.com';
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your LioranDB password',
      html: passwordResetTemplate(resetUrl),
    });

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user._id.toString(),
      ip,
    });
  }
}

export async function resetPassword(
  token: string,
  newPassword: string,
  ip?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string }> {
  await connectToDatabase();

  const tokenHash = sha256(token);
  const resetRecord = await PasswordReset.findOne({
    tokenHash,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    return {
      success: false,
      message: 'This reset link is invalid or has expired. Please request a new one.',
    };
  }

  const user = await User.findById(resetRecord.userId);
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  const passwordHash = await hashPassword(newPassword);
  await User.findByIdAndUpdate(user._id, { passwordHash });

  // Mark token as used
  await PasswordReset.findByIdAndUpdate(resetRecord._id, { usedAt: new Date() });

  await sendEmail({
    to: user.email,
    subject: 'Your LioranDB password has been changed',
    html: passwordChangedTemplate(),
  });

  await createAuditLog({
    actorId: user._id.toString(),
    actorRole: user.role,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: user._id.toString(),
    ip,
    userAgent,
  });

  return { success: true, message: 'Password reset successful. You can now log in.' };
}
