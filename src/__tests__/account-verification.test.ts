import crypto from 'crypto';
import { isAccountVerified } from '@/lib/auth/guards';
import { verifyRazorpaySignature, verifyWebhookSignature } from '@/lib/razorpay';
import { AccountVerificationRequiredError, createApiError } from '@/lib/errors';
import type { IUser } from '@/lib/db/models/User';

describe('Mandatory ₹30 Account Verification System', () => {
  const mockSecret = 'test_secret_account_verification_123';

  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = mockSecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = mockSecret;
  });

  describe('isAccountVerified Guard Logic & Migration Safety', () => {
    test('Newly registered unpaid customer is not verified', () => {
      const newUser = {
        role: 'customer' as const,
        emailVerified: true,
        accountVerification: {
          feePaid: false,
          amountPaid: 0,
          currency: 'INR' as const,
          paidAt: null,
          razorpayOrderId: null,
          razorpayPaymentId: null,
          verificationMethod: null,
          status: 'UNPAID' as const,
        },
      } as unknown as IUser;

      expect(isAccountVerified(newUser)).toBe(false);
    });

    test('Customer with accountVerification.feePaid = true is verified', () => {
      const verifiedUser = {
        role: 'customer' as const,
        emailVerified: true,
        accountVerification: {
          feePaid: true,
          amountPaid: 30,
          currency: 'INR' as const,
          paidAt: new Date(),
          razorpayOrderId: 'order_123',
          razorpayPaymentId: 'pay_123',
          verificationMethod: 'RAZORPAY' as const,
          status: 'VERIFIED' as const,
        },
      } as unknown as IUser;

      expect(isAccountVerified(verifiedUser)).toBe(true);
    });

    test('Existing migrated customer with accountRegistrationPaid = true is preserved', () => {
      const migratedUser = {
        role: 'customer' as const,
        emailVerified: true,
        accountRegistrationPaid: true,
        accountRegistrationPaidAt: new Date('2025-01-01'),
      } as unknown as IUser;

      expect(isAccountVerified(migratedUser)).toBe(true);
    });

    test('Admin and support roles bypass account verification payment requirement', () => {
      const adminUser = {
        role: 'admin' as const,
        emailVerified: true,
        accountVerification: { feePaid: false },
      } as unknown as IUser;

      const supportUser = {
        role: 'support' as const,
        emailVerified: true,
        accountVerification: { feePaid: false },
      } as unknown as IUser;

      expect(isAccountVerified(adminUser)).toBe(true);
      expect(isAccountVerified(supportUser)).toBe(true);
    });

    test('Null or undefined user returns false', () => {
      expect(isAccountVerified(null)).toBe(false);
      expect(isAccountVerified(undefined)).toBe(false);
    });
  });

  describe('Razorpay Signature & Verification Security', () => {
    test('Valid payment signature passes verification', () => {
      const orderId = 'order_ver_30_inr_test';
      const paymentId = 'pay_ver_30_inr_test';
      const validSignature = crypto
        .createHmac('sha256', mockSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      expect(isValid).toBe(true);
    });

    test('Invalid or tampered payment signature is rejected', () => {
      const orderId = 'order_ver_30_inr_test';
      const paymentId = 'pay_ver_30_inr_test';
      const invalidSignature = 'tampered_signature_payload';

      const isValid = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: invalidSignature,
      });

      expect(isValid).toBe(false);
    });

    test('Valid webhook signature verification passes', () => {
      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_123',
              amount: 3000,
              currency: 'INR',
              status: 'captured',
              notes: { type: 'ACCOUNT_VERIFICATION' },
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac('sha256', mockSecret)
        .update(webhookPayload)
        .digest('hex');

      const isValid = verifyWebhookSignature(webhookPayload, validSignature);
      expect(isValid).toBe(true);
    });
  });

  describe('AccountVerificationRequiredError & API Formatting', () => {
    test('Throws error with code ACCOUNT_VERIFICATION_REQUIRED and status 403', () => {
      const error = new AccountVerificationRequiredError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('ACCOUNT_VERIFICATION_REQUIRED');
      expect(error.redirectTo).toBe('/verify-account');
    });

    test('createApiError serializes AccountVerificationRequiredError with structured redirect', async () => {
      const error = new AccountVerificationRequiredError('Complete the one-time ₹30 account verification payment.');
      const response = createApiError(error);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json).toEqual({
        error: 'ACCOUNT_VERIFICATION_REQUIRED',
        message: 'Complete the one-time ₹30 account verification payment.',
        redirectTo: '/verify-account',
      });
    });
  });
});
