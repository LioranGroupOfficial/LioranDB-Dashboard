import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayClient: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured');
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayClient;
}

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const razorpay = getRazorpayClient();
  const options = {
    amount: Math.round(params.amountPaise), // integer paise
    currency: params.currency || 'INR',
    receipt: params.receipt || `rcpt_${Date.now()}`,
    notes: params.notes || {},
  };

  const order = await razorpay.orders.create(options);
  return {
    id: order.id,
    amount: typeof order.amount === 'number' ? order.amount : Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export function verifyRazorpaySignature(params: VerifySignatureParams): boolean {
  const { orderId, paymentId, signature } = params;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }

  const expectedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant time comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(bodyString: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyString)
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  captured?: boolean;
  notes?: Record<string, string>;
  error_code?: string | null;
  error_description?: string | null;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
  const razorpay = getRazorpayClient();
  const payment = await razorpay.payments.fetch(paymentId);
  return payment as unknown as RazorpayPaymentEntity;
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrderResult> {
  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.fetch(orderId);
  return {
    id: order.id,
    amount: typeof order.amount === 'number' ? order.amount : Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}

export async function fetchRazorpayOrderPayments(orderId: string): Promise<{ items: RazorpayPaymentEntity[] }> {
  const razorpay = getRazorpayClient();
  const res = await razorpay.orders.fetchPayments(orderId);
  return res as unknown as { items: RazorpayPaymentEntity[] };
}
