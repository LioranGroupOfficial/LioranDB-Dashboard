const APP_URL = process.env.APP_URL || 'https://app.liorandb.com';

function baseLayout(content: string, previewText = 'LioranDB Notification'): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <title>LioranDB</title>
  <style type="text/css">
    :root {
      color-scheme: dark only;
      supported-color-schemes: dark only;
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
      background-color: #090B0E !important;
      color: #FFFFFF !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      width: 100% !important;
      height: 100% !important;
    }
    a {
      color: #DFD0B8;
      text-decoration: none;
    }
    /* Dark mode enforcement across clients */
    @media (prefers-color-scheme: dark) {
      body, .email-bg {
        background-color: #090B0E !important;
      }
      .email-card {
        background-color: #13171F !important;
      }
    }
  </style>
</head>
<body bgcolor="#090B0E" style="margin: 0; padding: 0; background-color: #090B0E; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #090B0E;">
    ${previewText}
  </div>

  <!-- Full Width Background Table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#090B0E" class="email-bg" style="background-color: #090B0E; width: 100%; min-width: 100%; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #13171F; border: 1px solid #232A38; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" class="email-card">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 20px 28px; border-bottom: 1px solid #232A38;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Lioran<span style="color: #DFD0B8;">DB</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 3px 8px; font-size: 10px; font-family: monospace; font-weight: 700; color: #DFD0B8; background-color: #1C222E; border: 1px solid #2E3748; border-radius: 2px;">
                      MANAGED HOSTING
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 28px 24px 28px; color: #FFFFFF;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px 24px 28px; border-top: 1px solid #232A38; background-color: #0E1117; border-radius: 0 0 4px 4px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #64748B; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; color: #64748B; font-size: 12px;">
                      &copy; ${new Date().getFullYear()} LioranDB. All rights reserved.
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px;">
                      <a href="${APP_URL}" style="color: #DFD0B8; text-decoration: none; font-weight: 500;">app.liorandb.com</a> &nbsp;&bull;&nbsp; <a href="https://liorandb.com" style="color: #DFD0B8; text-decoration: none; font-weight: 500;">liorandb.com</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #475569;">
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

export function verificationOTPTemplate(otp: string, expiryMinutes = 10): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Verify your email address
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Thank you for creating a LioranDB account. Enter the verification code below to verify your email address and activate your account.
    </p>

    <!-- OTP Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #090B0E; border: 1px solid #232A38; border-radius: 4px;">
      <tr>
        <td align="center" style="padding: 24px 16px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748B; margin-bottom: 8px;">
            One-Time Verification Code
          </div>
          <div style="font-family: 'SF Mono', Consolas, 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #DFD0B8; line-height: 1.2;">
            ${otp}
          </div>
          <div style="font-size: 12px; color: #64748B; margin-top: 10px;">
            Valid for ${expiryMinutes} minutes
          </div>
        </td>
      </tr>
    </table>

    <!-- Notice Box -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; background-color: #171C26; border-left: 3px solid #DFD0B8; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #94A3B8;">
          If you did not request this account creation, you can safely ignore this email.
        </td>
      </tr>
    </table>
  `, `Your LioranDB verification code is ${otp}`);
}

export function passwordResetTemplate(resetUrl: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Reset your password
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      We received a request to reset the password for your LioranDB account. Click the button below to choose a new password.
    </p>

    <table border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Reset Password &rarr;
          </a>
        </td>
      </tr>
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #171C26; border-left: 3px solid #DFD0B8; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #94A3B8;">
          This password reset link expires in 1 hour. If you did not make this request, your account remains secure and no action is required.
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748B; word-break: break-all;">
      Or paste this URL in your browser:<br />
      <span style="color: #DFD0B8;">${resetUrl}</span>
    </p>
  `, 'Reset your LioranDB account password');
}

export function passwordChangedTemplate(): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Password Changed Successfully
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      The password for your LioranDB account was recently changed.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #171C26; border-left: 3px solid #3B82F6; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #94A3B8;">
          If you performed this action, no further steps are needed. If you did not make this change, please contact our security team immediately at <a href="mailto:support@liorandb.com" style="color: #DFD0B8; font-weight: 600;">support@liorandb.com</a>.
        </td>
      </tr>
    </table>
  `, 'Your LioranDB password was changed');
}

export function applicationReceivedTemplate(applicantName: string, applicationId: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Hosting Application Received
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      We have received your LioranDB Managed Hosting application. Our engineering and architecture team will review your deployment requirements.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #090B0E; border: 1px solid #232A38; border-radius: 4px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; color: #94A3B8;">
          <span style="color: #64748B;">Application ID:</span> <strong style="color: #FFFFFF; font-family: monospace;">${applicationId}</strong>
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            Open Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB hosting application has been received');
}

export function applicationApprovedTemplate(applicantName: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #4ADE80; letter-spacing: -0.02em;">
      Application Approved
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Great news! Your LioranDB Managed Hosting application has been reviewed and approved.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #064E3B; border-left: 3px solid #4ADE80; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #D1FAE5;">
          Please sign in to accept the hosting terms &amp; agreements. Once accepted, your cluster provisioning will begin automatically.
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/onboarding/legal" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            Complete Onboarding &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB application is approved');
}

export function applicationRejectedTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #F87171; letter-spacing: -0.02em;">
      Application Status Update
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Thank you for your interest in LioranDB Managed Hosting. After review, we are unable to approve your application at this time.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #450A0A; border-left: 3px solid #EF4444; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #FECACA;">
          <strong>Feedback from review team:</strong><br />
          ${reason}
        </td>
      </tr>
    </table>
    <p style="margin: 16px 0 20px 0; font-size: 13px; color: #94A3B8;">
      You can modify your requirements and reapply directly from your dashboard.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/application" target="_blank" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            Update Application &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Update on your LioranDB application');
}

export function termsCompletedTemplate(applicantName: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Agreements Accepted
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      You have successfully accepted the LioranDB Managed Hosting Service Agreements. Your cluster is now in the provisioning queue.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            Go to Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'LioranDB agreements accepted');
}

export function databaseProvisionedTemplate(
  applicantName: string,
  dbName: string,
  host: string
): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #4ADE80; letter-spacing: -0.02em;">
      Your Managed Database is Ready
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Your dedicated LioranDB database cluster has been provisioned and is online.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #090B0E; border: 1px solid #232A38; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #64748B;">Database:</td>
              <td align="right" style="padding: 4px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #FFFFFF;">${dbName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #64748B;">Host Endpoint:</td>
              <td align="right" style="padding: 4px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #DFD0B8;">${host}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/database" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            View Connection Credentials &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB cluster is ready');
}

export function suspensionTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #F87171; letter-spacing: -0.02em;">
      Database Service Suspended
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Your LioranDB Managed Hosting service has been suspended.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #450A0A; border-left: 3px solid #EF4444; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #FECACA;">
          <strong>Reason:</strong> ${reason}
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${APP_URL}/support" target="_blank" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            Contact Support &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'LioranDB service suspended');
}

export function supportReplyTemplate(
  customerName: string,
  ticketSubject: string,
  replyBody: string,
  ticketUrl: string
): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      New Reply on Support Ticket
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      Hi ${customerName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
      The LioranDB engineering support team has replied to your ticket: <strong style="color: #FFFFFF;">${ticketSubject}</strong>
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #171C26; border-left: 3px solid #DFD0B8; border-radius: 0 4px 4px 0;">
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; line-height: 1.6; color: #E2E8F0;">
          ${replyBody}
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 4px; background-color: #DFD0B8;">
          <a href="${ticketUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 700; color: #090B0E; text-decoration: none; border-radius: 4px;">
            View Ticket &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, `New reply: ${ticketSubject}`);
}
