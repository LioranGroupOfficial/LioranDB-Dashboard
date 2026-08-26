const APP_URL = process.env.APP_URL || 'https://app.liorandb.com';

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LioranDB</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #0B0D10; color: #F4F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .header { border-bottom: 1px solid #2A2F38; padding-bottom: 24px; margin-bottom: 32px; }
    .logo { font-size: 18px; font-weight: 600; color: #DFD0B8; letter-spacing: -0.02em; }
    .content { }
    .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #2A2F38; color: #6B7280; font-size: 13px; }
    .footer a { color: #9CA3AF; text-decoration: none; }
    h1 { font-size: 22px; font-weight: 600; color: #F4F4F2; margin-bottom: 12px; letter-spacing: -0.02em; }
    p { color: #9CA3AF; margin-bottom: 16px; }
    .otp-box { background: #161A20; border: 1px solid #2A2F38; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 0.2em; color: #DFD0B8; font-family: monospace; }
    .otp-expiry { font-size: 13px; color: #6B7280; margin-top: 8px; }
    .btn { display: inline-block; background: #DFD0B8; color: #0B0D10; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0; }
    .alert { background: #1C1F26; border-left: 3px solid #DFD0B8; border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 16px 0; color: #9CA3AF; font-size: 13px; }
    .status-approved { border-left-color: #4CAF50; }
    .status-rejected { border-left-color: #EF5350; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2A2F38; }
    .detail-label { color: #6B7280; font-size: 13px; }
    .detail-value { color: #F4F4F2; font-size: 13px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">LioranDB</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} LioranDB. All rights reserved.</p>
      <p><a href="${APP_URL}">app.liorandb.com</a> · <a href="https://liorandb.com">liorandb.com</a></p>
      <p style="margin-top:8px;font-size:12px;">This email was sent to you as part of your LioranDB account. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export function verificationOTPTemplate(otp: string, expiryMinutes = 10): string {
  return baseLayout(`
    <h1>Verify your email address</h1>
    <p>Use the code below to verify your email address. This code expires in ${expiryMinutes} minutes.</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">Expires in ${expiryMinutes} minutes</div>
    </div>
    <div class="alert">
      If you did not create a LioranDB account, you can safely ignore this email.
    </div>
  `);
}

export function passwordResetTemplate(resetUrl: string): string {
  return baseLayout(`
    <h1>Reset your password</h1>
    <p>You requested a password reset for your LioranDB account. Click the button below to set a new password.</p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <div class="alert">
      This link expires in 1 hour. If you did not request a password reset, please ignore this email. Your password will not be changed.
    </div>
    <p style="font-size:13px;margin-top:8px;">Or copy this link: <span style="color:#DFD0B8">${resetUrl}</span></p>
  `);
}

export function passwordChangedTemplate(): string {
  return baseLayout(`
    <h1>Your password was changed</h1>
    <p>The password for your LioranDB account was recently changed.</p>
    <div class="alert">
      If you made this change, no action is needed. If you did not change your password, please contact us immediately at <a href="mailto:support@liorandb.com" style="color:#DFD0B8">support@liorandb.com</a>.
    </div>
  `);
}

export function applicationReceivedTemplate(applicantName: string, applicationId: string): string {
  return baseLayout(`
    <h1>Application received</h1>
    <p>Hi ${applicantName},</p>
    <p>We've received your LioranDB Managed Hosting application. You'll see the review decision in your dashboard once it's complete.</p>
    <div class="alert">
      <strong>Reference:</strong> ${applicationId}
    </div>
    <p>Our team reviews applications manually. You'll be notified by email when a decision has been made.</p>
    <a href="${APP_URL}/dashboard" class="btn">View Dashboard</a>
  `);
}

export function applicationApprovedTemplate(applicantName: string): string {
  return baseLayout(`
    <h1>Your application has been approved</h1>
    <p>Hi ${applicantName},</p>
    <p>Congratulations — your LioranDB Managed Hosting application has been approved.</p>
    <p>The next step is to review and accept the required agreements to continue onboarding.</p>
    <a href="${APP_URL}/onboarding/legal" class="btn">Continue Onboarding</a>
    <div class="alert status-approved">
      Once you've accepted the agreements, your managed deployment will be provisioned and you'll receive further instructions.
    </div>
  `);
}

export function applicationRejectedTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1>Application update</h1>
    <p>Hi ${applicantName},</p>
    <p>We reviewed your LioranDB Managed Hosting application and we're unable to approve it at this time.</p>
    <div class="alert status-rejected">
      <strong>Reason from the review team:</strong><br />${reason}
    </div>
    <p>You're welcome to submit a new application addressing the feedback above.</p>
    <a href="${APP_URL}/application" class="btn">Submit New Application</a>
  `);
}

export function termsCompletedTemplate(applicantName: string): string {
  return baseLayout(`
    <h1>Agreements accepted</h1>
    <p>Hi ${applicantName},</p>
    <p>You've successfully accepted the LioranDB Managed Hosting agreements. Your managed deployment is now being prepared.</p>
    <a href="${APP_URL}/dashboard" class="btn">View Dashboard</a>
  `);
}

export function databaseProvisionedTemplate(
  applicantName: string,
  dbName: string,
  host: string
): string {
  return baseLayout(`
    <h1>Your managed database is ready</h1>
    <p>Hi ${applicantName},</p>
    <p>Your managed LioranDB deployment has been provisioned and is ready to use.</p>
    <div class="otp-box" style="text-align:left">
      <div class="detail-row"><span class="detail-label">Database</span><span class="detail-value">${dbName}</span></div>
      <div class="detail-row"><span class="detail-label">Host</span><span class="detail-value">${host}</span></div>
    </div>
    <p>Log in to your dashboard to view your connection details and temporary credentials.</p>
    <a href="${APP_URL}/database" class="btn">View Database</a>
    <div class="alert">
      Your temporary credentials are valid for a limited time and must be changed upon first use. Never share your database credentials.
    </div>
  `);
}

export function suspensionTemplate(applicantName: string, reason: string): string {
  return baseLayout(`
    <h1>Service suspended</h1>
    <p>Hi ${applicantName},</p>
    <p>Your LioranDB Managed Hosting service has been temporarily suspended.</p>
    <div class="alert status-rejected">
      <strong>Reason:</strong> ${reason}
    </div>
    <p>Please contact our support team to resolve this issue.</p>
    <a href="${APP_URL}/support" class="btn">Contact Support</a>
  `);
}

export function supportReplyTemplate(
  customerName: string,
  ticketSubject: string,
  replyBody: string,
  ticketUrl: string
): string {
  return baseLayout(`
    <h1>New reply on your support ticket</h1>
    <p>Hi ${customerName},</p>
    <p>The LioranDB support team has replied to your ticket: <strong>${ticketSubject}</strong></p>
    <div class="alert">
      ${replyBody}
    </div>
    <a href="${ticketUrl}" class="btn">View Ticket</a>
  `);
}
