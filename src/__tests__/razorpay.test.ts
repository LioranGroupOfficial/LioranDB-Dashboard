import crypto from 'crypto';
import { verifyRazorpaySignature, verifyWebhookSignature } from '@/lib/razorpay';

describe('Razorpay Signature & HMAC Verification', () => {
  const mockSecret = 'test_secret_1234567890abcdef';

  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = mockSecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = mockSecret;
  });

  test('Valid HMAC SHA256 payment signature passes verification', () => {
    const orderId = 'order_9A33XWu170gUtm';
    const paymentId = 'pay_29Ae07wUr9Z6OK';
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

  test('Tampered signature fails verification', () => {
    const orderId = 'order_9A33XWu170gUtm';
    const paymentId = 'pay_29Ae07wUr9Z6OK';
    const invalidSignature = 'invalid_tampered_signature_12345';

    const isValid = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: invalidSignature,
    });

    expect(isValid).toBe(false);
  });

  test('Valid webhook signature passes verification', () => {
    const webhookBody = JSON.stringify({ event: 'payment.captured', entity: { id: 'pay_123' } });
    const validSignature = crypto
      .createHmac('sha256', mockSecret)
      .update(webhookBody)
      .digest('hex');

    const isValid = verifyWebhookSignature(webhookBody, validSignature);
    expect(isValid).toBe(true);
  });
});

