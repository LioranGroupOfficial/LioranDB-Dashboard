const APP_URL = process.env.APP_URL || 'https://app.liorandb.com';

/**
 * Base layout for all transactional and notification emails.
 * Strictly adheres to the light-mode paper-and-ink design system from DESIGN.md:
 * - Canvas: Pure paper (#FAFAFA outer canvas, #FFFFFF card)
 * - Ink: Pure black (#000000) headings/CTAs, near-black (#111111) lines/labels, body (#333333)
 * - Typography: Inter for UI/copy, JetBrains Mono for codes/keys/badges
 * - Elevation & Radius: 1.5px solid #111111 sketch border, 10px card radius, 7px button radius, 5px badge radius
 * - Monochrome: Zero color accents (no green, red, blue, or purple hues)
 * - Light-mode enforced: Protected against client-side dark mode auto-inversion
 */
export function baseLayout(content: string, previewText = 'LioranDB Notification'): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>LioranDB</title>
  <style type="text/css">
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    body, table, td, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #FAFAFA !important;
      color: #111111 !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      width: 100% !important;
      height: 100% !important;
    }
    a {
      color: #111111;
      text-decoration: underline;
    }
    /* Strictly enforce light mode aesthetic across email clients */
    @media (prefers-color-scheme: dark) {
      body, .email-bg {
        background-color: #FAFAFA !important;
        color: #111111 !important;
      }
      .email-card {
        background-color: #FFFFFF !important;
        border-color: #111111 !important;
      }
      .email-heading, h1, h2, h3 {
        color: #000000 !important;
      }
      .email-body, p, td, span, div {
        color: #333333 !important;
      }
      .email-ink {
        color: #111111 !important;
      }
      .email-muted {
        color: #666666 !important;
      }
      .email-btn {
        background-color: #000000 !important;
        color: #FFFFFF !important;
        border-color: #000000 !important;
      }
      .email-box {
        background-color: #FAFAFA !important;
        border-color: #111111 !important;
      }
      .email-callout {
        background-color: #F4F4F4 !important;
        border-left-color: #111111 !important;
        border-top-color: #E8E8E8 !important;
        border-right-color: #E8E8E8 !important;
        border-bottom-color: #E8E8E8 !important;
      }
      .email-footer {
        background-color: #FAFAFA !important;
        border-top-color: #E8E8E8 !important;
        color: #666666 !important;
      }
    }
  </style>
</head>
<body bgcolor="#FAFAFA" style="margin: 0; padding: 0; background-color: #FAFAFA; color: #111111; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #FAFAFA;">
    ${previewText}
  </div>

  <!-- Full Width Background Table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FAFAFA" class="email-bg" style="background-color: #FAFAFA; width: 100%; min-width: 100%; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <!-- Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FFFFFF" style="max-width: 560px; background-color: #FFFFFF; border: 1.5px solid #111111; border-radius: 10px; box-shadow: 2px 2px 0px rgba(0,0,0,0.08);" class="email-card">
          <!-- Header -->
          <tr>
            <td style="padding: 22px 28px 18px 28px; border-bottom: 1px solid #E8E8E8;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #000000; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      LioranDB
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 9px; font-size: 11px; font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; color: #111111; background-color: #FAFAFA; border: 1px solid #111111; border-radius: 5px;">
                      MANAGED HOSTING
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 28px 28px; color: #333333; font-size: 14px; line-height: 1.6;" class="email-content">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 28px 24px 28px; border-top: 1px solid #E8E8E8; background-color: #FAFAFA; border-radius: 0 0 9px 9px;" class="email-footer">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #666666; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; color: #666666; font-size: 12px;">
                      &copy; ${new Date().getFullYear()} LioranDB. All rights reserved.
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666;">
                      <a href="${APP_URL}" style="color: #111111; text-decoration: underline; font-weight: 500;">app.liorandb.com</a> &nbsp;&bull;&nbsp; <a href="https://liorandb.com" style="color: #111111; text-decoration: underline; font-weight: 500;">liorandb.com</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #999999;">
                      This is an automated system message. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Reusable helper: Primary Button adhering to DESIGN.md
 * Pure black background (#000000), white text (#FFFFFF), 2px solid #000000 outline, 7px radius.
 */
function renderPrimaryButton(url: string, label: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 16px 0;">
      <tr>
        <td align="center" style="border-radius: 7px; background-color: #000000;">
          <a href="${url}" target="_blank" class="email-btn" style="display: inline-block; padding: 11px 22px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 7px; background-color: #000000; border: 2px solid #000000; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Reusable helper: Callout / Notice adhering to DESIGN.md
 * Neutral paper background (#F4F4F4), 3px solid ink (#111111) left border, 7px right radius.
 */
function renderCallout(textHtml: string, title?: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-callout" style="margin: 20px 0; background-color: #F4F4F4; border-left: 3px solid #111111; border-top: 1px solid #E8E8E8; border-right: 1px solid #E8E8E8; border-bottom: 1px solid #E8E8E8; border-radius: 0 7px 7px 0;">
      <tr>
        <td style="padding: 13px 16px; font-size: 13px; line-height: 1.5; color: #333333;">
          ${title ? `<div style="font-weight: 700; color: #111111; margin-bottom: 4px; font-size: 11px; letter-spacing: 0.7px; text-transform: uppercase; font-family: 'JetBrains Mono', Consolas, monospace;">${title}</div>` : ''}
          ${textHtml}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Reusable helper: Key-Value Details table adhering to DESIGN.md
 */
function renderDetailsTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  const rowHtml = rows
    .map(
      (r, i) => `
    <tr>
      <td style="padding: 9px 0; font-size: 13px; color: #666666; ${i < rows.length - 1 ? 'border-bottom: 1px solid #E8E8E8;' : ''}">${r.label}:</td>
      <td align="right" style="padding: 9px 0; font-size: 13px; color: #000000; font-weight: 600; ${r.mono ? "font-family: 'JetBrains Mono', Consolas, monospace;" : ''} ${i < rows.length - 1 ? 'border-bottom: 1px solid #E8E8E8;' : ''}">${r.value}</td>
    </tr>
  `
    )
    .join('');

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-box" style="margin: 20px 0; background-color: #FAFAFA; border: 1.5px solid #111111; border-radius: 7px;">
      <tr>
        <td style="padding: 14px 18px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            ${rowHtml}
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function verificationOTPTemplate(otp: string, expiryMinutes = 10): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Verify your email address
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Thank you for creating a LioranDB account. Enter the verification code below to verify your email address and activate your account.
    </p>

    <!-- OTP Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-box" style="margin: 24px 0; background-color: #FAFAFA; border: 1.5px solid #111111; border-radius: 7px; box-shadow: 2px 2px 0px rgba(0,0,0,0.06);">
      <tr>
        <td align="center" style="padding: 24px 16px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #666666; font-family: 'JetBrains Mono', Consolas, monospace; margin-bottom: 10px;">
            One-Time Verification Code
          </div>
          <div style="font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #000000; line-height: 1.2;">
            ${otp}
          </div>
          <div style="font-size: 12px; color: #666666; margin-top: 10px;">
            Valid for ${expiryMinutes} minutes
          </div>
        </td>
      </tr>
    </table>

    ${renderCallout(
      'If you did not request this account creation, you can safely ignore this email.',
      'SECURITY NOTICE'
    )}
  `,
    `Your LioranDB verification code is ${otp}`
  );
}

export function passwordResetTemplate(resetUrl: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Reset your password
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      We received a request to reset the password for your LioranDB account. Click the button below to choose a new password.
    </p>

    ${renderPrimaryButton(resetUrl, 'Reset Password &rarr;')}

    ${renderCallout(
      'This password reset link expires in 1 hour. If you did not make this request, your account remains secure and no action is required.',
      'SECURITY NOTICE'
    )}

    <p style="margin: 20px 0 0 0; font-size: 12px; color: #666666; word-break: break-all;">
      Or paste this URL in your browser:<br />
      <a href="${resetUrl}" style="color: #111111; text-decoration: underline; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px;">${resetUrl}</a>
    </p>
  `,
    'Reset your LioranDB account password'
  );
}

export function passwordChangedTemplate(): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Password Changed Successfully
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      The password for your LioranDB account was recently changed.
    </p>
    ${renderCallout(
      'If you performed this action, no further steps are needed. If you did not make this change, please contact our security team immediately at <a href="mailto:support@liorandb.com" style="color: #111111; font-weight: 600; text-decoration: underline;">support@liorandb.com</a>.',
      'SECURITY NOTICE'
    )}
  `,
    'Your LioranDB password was changed'
  );
}

export function applicationReceivedTemplate(applicantName: string, applicationId: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Hosting Application Received
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      We have received your LioranDB Managed Hosting application. Our engineering and architecture team will review your deployment requirements.
    </p>

    ${renderDetailsTable([
      { label: 'Application ID', value: applicationId, mono: true },
    ])}

    ${renderPrimaryButton(`${APP_URL}/dashboard`, 'Open Dashboard &rarr;')}
  `,
    'Your LioranDB hosting application has been received'
  );
}

export function applicationApprovedTemplate(applicantName: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Application Approved
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Great news! Your LioranDB Managed Hosting application has been reviewed and approved.
    </p>

    ${renderCallout(
      'Please sign in to accept the hosting terms &amp; agreements. Once accepted, your cluster provisioning will begin automatically.',
      'STATUS: APPROVED'
    )}

    ${renderPrimaryButton(`${APP_URL}/onboarding/legal`, 'Complete Onboarding &rarr;')}
  `,
    'Your LioranDB application is approved'
  );
}

export function applicationRejectedTemplate(applicantName: string, reason: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Application Status Update
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Thank you for your interest in LioranDB Managed Hosting. After review, we are unable to approve your application at this time.
    </p>

    ${renderCallout(
      `<strong>Feedback from review team:</strong><br /><span style="font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px;">${reason}</span>`,
      'REVIEW DECISION'
    )}

    <p style="margin: 16px 0 20px 0; font-size: 13px; color: #666666;">
      You can modify your requirements and reapply directly from your dashboard.
    </p>

    ${renderPrimaryButton(`${APP_URL}/application`, 'Update Application &rarr;')}
  `,
    'Update on your LioranDB application'
  );
}

export function termsCompletedTemplate(applicantName: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Agreements Accepted
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      You have successfully accepted the LioranDB Managed Hosting Service Agreements. Your cluster is now in the provisioning queue.
    </p>

    ${renderPrimaryButton(`${APP_URL}/dashboard`, 'Go to Dashboard &rarr;')}
  `,
    'LioranDB agreements accepted'
  );
}

export function databaseProvisionedTemplate(
  applicantName: string,
  dbName: string,
  host: string
): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Your Managed Database is Ready
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Your dedicated LioranDB database cluster has been provisioned and is online.
    </p>

    ${renderDetailsTable([
      { label: 'Database', value: dbName, mono: true },
      { label: 'Host Endpoint', value: host, mono: true },
    ])}

    ${renderCallout(
      'Log in to your dashboard to view your connection details and temporary credentials. Never share your database credentials.',
      'ACCESS NOTICE'
    )}

    ${renderPrimaryButton(`${APP_URL}/database`, 'View Connection Credentials &rarr;')}
  `,
    'Your LioranDB cluster is ready'
  );
}

export function suspensionTemplate(applicantName: string, reason: string): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Database Service Suspended
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Your LioranDB Managed Hosting service has been suspended.
    </p>

    ${renderCallout(
      `<strong>Reason:</strong> ${reason}`,
      'SUSPENSION NOTICE'
    )}

    ${renderPrimaryButton(`${APP_URL}/support`, 'Contact Support &rarr;')}
  `,
    'LioranDB service suspended'
  );
}

export function supportReplyTemplate(
  customerName: string,
  ticketSubject: string,
  replyBody: string,
  ticketUrl: string
): string {
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      New Reply on Support Ticket
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hi ${customerName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      The LioranDB engineering support team has replied to your ticket: <strong style="color: #000000;">${ticketSubject}</strong>
    </p>

    ${renderCallout(
      replyBody,
      'SUPPORT TEAM RESPONSE'
    )}

    ${renderPrimaryButton(ticketUrl, 'View Ticket &rarr;')}
  `,
    `New reply: ${ticketSubject}`
  );
}

export interface PaymentReceiptParams {
  invoiceNumber: string;
  amountFormatted: string;
  transactionRef: string;
  dateFormatted: string;
  billingUrl?: string;
}

export function paymentReceiptTemplate(params: PaymentReceiptParams): string {
  const { invoiceNumber, amountFormatted, transactionRef, dateFormatted, billingUrl } = params;
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Payment Receipt
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Thank you! Your payment for invoice <strong style="color: #000000;">${invoiceNumber}</strong> has been processed successfully.
    </p>

    ${renderDetailsTable([
      { label: 'Invoice Number', value: invoiceNumber, mono: true },
      { label: 'Amount Paid', value: amountFormatted, mono: true },
      { label: 'Transaction Ref', value: transactionRef, mono: true },
      { label: 'Date', value: dateFormatted },
    ])}

    ${renderCallout(
      'A copy of this receipt has been recorded on your account ledger.',
      'RECEIPT CONFIRMATION'
    )}

    ${renderPrimaryButton(billingUrl || `${APP_URL}/billing`, 'View Billing & Invoices &rarr;')}
  `,
    `Payment Receipt: ${invoiceNumber}`
  );
}

export interface InvoiceGeneratedParams {
  customerName: string;
  invoiceNumber: string;
  amountFormatted: string;
  dueDateFormatted: string;
  billingUrl?: string;
}

export function invoiceGeneratedTemplate(params: InvoiceGeneratedParams): string {
  const { customerName, invoiceNumber, amountFormatted, dueDateFormatted, billingUrl } = params;
  return baseLayout(
    `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">
      Usage Invoice Generated
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Hello ${customerName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333333;">
      Your monthly usage invoice <strong style="color: #000000;">${invoiceNumber}</strong> has been generated and is now due for payment.
    </p>

    ${renderDetailsTable([
      { label: 'Invoice Number', value: invoiceNumber, mono: true },
      { label: 'Total Amount', value: amountFormatted, mono: true },
      { label: 'Due Date', value: dueDateFormatted },
    ])}

    ${renderCallout(
      'Please complete payment by the due date to ensure uninterrupted database service.',
      'PAYMENT DUE NOTICE'
    )}

    ${renderPrimaryButton(billingUrl || `${APP_URL}/billing`, 'View & Pay Invoice &rarr;')}
  `,
    `LioranDB Usage Invoice: ${invoiceNumber}`
  );
}
