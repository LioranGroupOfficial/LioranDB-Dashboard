import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

let cachedTransporter: Transporter | null = null;

function createTransporter(): Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
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

  const port = Number(portStr || 465);
  const secure = port === 465 || process.env.SMTP_SECURE === 'true';

  const transporter = nodemailer.createTransport({
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
      minVersion: 'TLSv1.2',
    },
  });

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
  let transporter = createTransporter();

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
    console.warn(`[Email Attempt 1 Failed]: ${errorMsg}. Retrying immediately with fresh connection...`);

    // Invalidate cached transport and retry once with a fresh direct connection
    cachedTransporter = null;
    const retryTransporter = createTransporter();

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
