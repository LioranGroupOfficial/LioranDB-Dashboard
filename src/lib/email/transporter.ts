import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    if (isDev) {
      // Development: log emails to console
      console.info('[Email] SMTP not configured. Using development console transport.');
      return null;
    }
    throw new Error('SMTP credentials not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  const port = Number(portStr || 465);

  // Port 465 is direct SSL/TLS (secure: true).
  // Port 587, 25, 2525 use opportunistic or enforced STARTTLS (secure: false).
  let secure: boolean;
  if (port === 465) {
    secure = true;
  } else if (port === 587 || port === 25 || port === 2525) {
    secure = false;
  } else {
    secure = process.env.SMTP_SECURE === 'true';
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  });
}

const fromName = process.env.SMTP_FROM_NAME || 'LioranDB';
const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@liorandb.com';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, html, text } = params;
  const transporter = createTransporter();

  if (!transporter) {
    // Dev fallback: log to console
    console.info(`\n📧 [DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n---\n${text || 'HTML email (see html property)'}\n---\n`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isDev) {
      console.warn(`\n⚠️ [Email Delivery Failed]: ${errorMsg}`);
      console.info(`📧 [DEV EMAIL FALLBACK]\nTo: ${to}\nSubject: ${subject}\n---\n${text || 'HTML email (see html property)'}\n---\n`);
      return;
    }
    throw err;
  }
}
