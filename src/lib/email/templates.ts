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
      background-color: #001e2b !important;
      color: #FFFFFF !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      width: 100% !important;
      height: 100% !important;
    }
    a {
      color: #00ed64;
      text-decoration: none;
    }
    /* Dark mode enforcement across clients */
    @media (prefers-color-scheme: dark) {
      body, .email-bg {
        background-color: #001e2b !important;
      }
      .email-card {
        background-color: #002838 !important;
      }
    }
  </style>
</head>
<body bgcolor="#001e2b" style="margin: 0; padding: 0; background-color: #001e2b; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #001e2b;">
    ${previewText}
  </div>

  <!-- Full Width Background Table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#001e2b" class="email-bg" style="background-color: #001e2b; width: 100%; min-width: 100%; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #002838; border: 1px solid #1c3b4a; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" class="email-card">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 20px 28px; border-bottom: 1px solid #1c3b4a;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Lioran<span style="color: #00ed64;">DB</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-family: monospace; font-weight: 700; color: #00ed64; background-color: #063446; border: 1px solid #1c3b4a; border-radius: 9999px;">
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
            <td style="padding: 20px 28px 24px 28px; border-top: 1px solid #1c3b4a; background-color: #001824; border-radius: 0 0 12px 12px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #93a1a1; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; color: #93a1a1; font-size: 12px;">
                      &copy; ${new Date().getFullYear()} LioranDB. All rights reserved.
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px;">
                      <a href="${APP_URL}" style="color: #00ed64; text-decoration: none; font-weight: 500;">app.liorandb.com</a> &nbsp;&bull;&nbsp; <a href="https://liorandb.com" style="color: #00ed64; text-decoration: none; font-weight: 500;">liorandb.com</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #586e75;">
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
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Thank you for creating a LioranDB account. Enter the verification code below to verify your email address and activate your account.
    </p>

    <!-- OTP Card -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #001e2b; border: 1px solid #1c3b4a; border-radius: 12px;">
      <tr>
        <td align="center" style="padding: 24px 16px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #93a1a1; margin-bottom: 8px;">
            One-Time Verification Code
          </div>
          <div style="font-family: 'Source Code Pro', Consolas, 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #00ed64; line-height: 1.2;">
            ${otp}
          </div>
          <div style="font-size: 12px; color: #93a1a1; margin-top: 10px;">
            Valid for ${expiryMinutes} minutes
          </div>
        </td>
      </tr>
    </table>

    <!-- Notice Box -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; background-color: #063446; border-left: 3px solid #00ed64; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #c0f4d8;">
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
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      We received a request to reset the password for your LioranDB account. Click the button below to choose a new password.
    </p>

    <table border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 26px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Reset Password &rarr;
          </a>
        </td>
      </tr>
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #063446; border-left: 3px solid #00ed64; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #c0f4d8;">
          This password reset link expires in 1 hour. If you did not make this request, your account remains secure and no action is required.
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0 0 0; font-size: 12px; color: #93a1a1; word-break: break-all;">
      Or paste this URL in your browser:<br />
      <span style="color: #00ed64;">${resetUrl}</span>
    </p>
  `, 'Reset your LioranDB account password');
}

export function passwordChangedTemplate(): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
      Password Changed Successfully
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      The password for your LioranDB account was recently changed.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #063446; border-left: 3px solid #00ed64; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #c0f4d8;">
          If you performed this action, no further steps are needed. If you did not make this change, please contact our security team immediately at <a href="mailto:support@liorandb.com" style="color: #00ed64; font-weight: 600;">support@liorandb.com</a>.
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
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      We have received your LioranDB Managed Hosting application. Our engineering and architecture team will review your deployment requirements.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #001e2b; border: 1px solid #1c3b4a; border-radius: 12px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; color: #93a1a1;">
          <span style="color: #586e75;">Application ID:</span> <strong style="color: #FFFFFF; font-family: monospace;">${applicationId}</strong>
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
            Open Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB hosting application has been received');
}

export function applicationApprovedTemplate(applicantName: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #00ed64; letter-spacing: -0.02em;">
      Application Approved
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Great news! Your LioranDB Managed Hosting application has been reviewed and approved.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #063446; border-left: 3px solid #00ed64; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #c0f4d8;">
          Please sign in to accept the hosting terms &amp; agreements. Once accepted, your cluster provisioning will begin automatically.
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/onboarding/legal" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
            Complete Onboarding &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB application is approved');
}

export function applicationRejectedTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ff6b6b; letter-spacing: -0.02em;">
      Application Status Update
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Thank you for your interest in LioranDB Managed Hosting. After review, we are unable to approve your application at this time.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #3b111a; border-left: 3px solid #ff6b6b; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #fed7d7;">
          <strong>Feedback from review team:</strong><br />
          ${reason}
        </td>
      </tr>
    </table>
    <p style="margin: 16px 0 20px 0; font-size: 13px; color: #93a1a1;">
      You can modify your requirements and reapply directly from your dashboard.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/application" target="_blank" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
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
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      You have successfully accepted the LioranDB Managed Hosting Service Agreements. Your cluster is now in the provisioning queue.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
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
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #00ed64; letter-spacing: -0.02em;">
      Your Managed Database is Ready
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Your dedicated LioranDB database cluster has been provisioned and is online.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #001e2b; border: 1px solid #1c3b4a; border-radius: 12px;">
      <tr>
        <td style="padding: 16px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #93a1a1;">Database:</td>
              <td align="right" style="padding: 4px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #FFFFFF;">${dbName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #93a1a1;">Host Endpoint:</td>
              <td align="right" style="padding: 4px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #00ed64;">${host}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/database" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
            View Connection Credentials &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, 'Your LioranDB cluster is ready');
}

export function suspensionTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ff6b6b; letter-spacing: -0.02em;">
      Database Service Suspended
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${applicantName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Your LioranDB Managed Hosting service has been suspended.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #3b111a; border-left: 3px solid #ff6b6b; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; line-height: 1.5; color: #fed7d7;">
          <strong>Reason:</strong> ${reason}
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${APP_URL}/support" target="_blank" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
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
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      Hi ${customerName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #93a1a1;">
      The LioranDB engineering support team has replied to your ticket: <strong style="color: #FFFFFF;">${ticketSubject}</strong>
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; background-color: #063446; border-left: 3px solid #00ed64; border-radius: 0 8px 8px 0;">
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; line-height: 1.6; color: #E2E8F0;">
          ${replyBody}
        </td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9999px; background-color: #00ed64;">
          <a href="${ticketUrl}" target="_blank" style="display: inline-block; padding: 10px 22px; font-size: 13px; font-weight: 700; color: #001e2b; text-decoration: none; border-radius: 9999px;">
            View Ticket &rarr;
          </a>
        </td>
      </tr>
    </table>
  `, `New reply: ${ticketSubject}`);
}
