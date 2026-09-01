import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

let cachedTransporter: Transporter | null = null;

function buildTransportOptions(port: number, secure: boolean) {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS || '';
  const pass = rawPass.replace(/^["'](.*)["']$/, '$1').trim();

  return {
    host,
    port,
    secure,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2' as const,
    },
  };
}

function createTransporter(forceFallback = false): Transporter | null {
  if (cachedTransporter && !forceFallback) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS || '';
  const pass = rawPass.replace(/^["'](.*)["']$/, '$1').trim();

  if (!host || !user || !pass) {
    if (isDev) {
      console.info('[Email] SMTP credentials not configured. Using console transport.');
      return null;
    }
    throw new Error('SMTP credentials not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  const configuredPort = Number(process.env.SMTP_PORT || 465);

  let port = configuredPort;
  // Port 465 is STRICT SSL/TLS (secure: true).
  // Port 587 / 25 is STARTTLS (secure: false). Never set secure: true on port 587 as it causes "wrong version number" SSL error.
  let secure = port === 465;

  if (forceFallback) {
    // If port 465 failed, fall back to port 587 STARTTLS. If 587 failed, fall back to 465 SSL.
    port = configuredPort === 465 ? 587 : 465;
    secure = port === 465;
    console.info(`[Email] Switching to alternate SMTP port ${port} (secure: ${secure})...`);
  }

  const transporter = nodemailer.createTransport(buildTransportOptions(port, secure));
  cachedTransporter = transporter;
  return transporter;
}

const fromName = process.env.SMTP_FROM_NAME || 'LioranDB';
const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'liorandb@liorandb.com';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, html, text } = params;
  let transporter = createTransporter(false);

  if (!transporter) {
    console.info(`\n📧 [DEV EMAIL CONSOLE]\nTo: ${to}\nSubject: ${subject}\n---\n${text || 'HTML content'}\n---\n`);
    return;
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.info(`[Email Sent] MessageId: ${info.messageId} To: ${to}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Email Attempt 1 Failed]: ${errorMsg}. Retrying with alternate secure port fallback...`);

    // Invalidate cached transport and retry with fallback port configuration
    cachedTransporter = null;
    const retryTransporter = createTransporter(true);

    if (retryTransporter) {
      try {
        const retryInfo = await retryTransporter.sendMail(mailOptions);
        console.info(`[Email Retry Succeeded] MessageId: ${retryInfo.messageId} To: ${to}`);
        return;
      } catch (retryErr: unknown) {
        const retryErrMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error(`[Email Retry Failed]: ${retryErrMsg}`);
        if (!isDev) {
          throw retryErr;
        }
      }
    }

    if (isDev) {
      console.info(`📧 [DEV EMAIL FALLBACK]\nTo: ${to}\nSubject: ${subject}\n---\n${text || 'HTML content'}\n---\n`);
      return;
    }
    throw err;
  }
}
