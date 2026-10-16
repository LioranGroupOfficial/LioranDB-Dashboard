import {
  baseLayout,
  verificationOTPTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  applicationReceivedTemplate,
  applicationApprovedTemplate,
  applicationRejectedTemplate,
  termsCompletedTemplate,
  databaseProvisionedTemplate,
  suspensionTemplate,
  supportReplyTemplate,
  paymentReceiptTemplate,
  invoiceGeneratedTemplate,
} from '@/lib/email';

describe('Email Templates (DESIGN.md Light Mode)', () => {
  const FORBIDDEN_DARK_OR_COLORED_VALUES = [
    '#001e2b', // Old dark teal background
    '#002838', // Old dark container card
    '#063446', // Old dark notice box
    '#1c3b4a', // Old dark border
    '#00ed64', // Old green accent
    '#ff6b6b', // Old red accent
    '#3b111a', // Old dark red box
    'color-scheme: dark only',
    'content="dark only"',
  ];

  test('baseLayout enforces light mode metadata and paper-and-ink styling', () => {
    const html = baseLayout('<p>Test content</p>', 'Preview text');

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('content="light"');
    expect(html).toContain('color-scheme: light');
    expect(html).toContain('LioranDB');
    expect(html).toContain('MANAGED HOSTING');
    expect(html).toContain('Test content');
    expect(html).toContain('Preview text');

    // Canvas background should be paper
    expect(html).toContain('bgcolor="#FAFAFA"');
    expect(html).toContain('background-color: #FAFAFA');
    expect(html).toContain('background-color: #FFFFFF');

    // Forbidden dark theme colors must not be present
    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('verificationOTPTemplate renders light-mode OTP box and security notice', () => {
    const html = verificationOTPTemplate('849201', 10);

    expect(html).toContain('Verify your email address');
    expect(html).toContain('849201');
    expect(html).toContain('Valid for 10 minutes');
    expect(html).toContain('SECURITY NOTICE');
    expect(html).toContain('One-Time Verification Code');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('passwordResetTemplate renders reset CTA with 7px button radius', () => {
    const html = passwordResetTemplate('https://app.liorandb.com/reset-password?token=abc');

    expect(html).toContain('Reset your password');
    expect(html).toContain('Reset Password &rarr;');
    expect(html).toContain('https://app.liorandb.com/reset-password?token=abc');
    expect(html).toContain('border-radius: 7px');
    expect(html).toContain('background-color: #000000');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('passwordChangedTemplate renders confirmation notice in monochrome', () => {
    const html = passwordChangedTemplate();

    expect(html).toContain('Password Changed Successfully');
    expect(html).toContain('support@liorandb.com');
    expect(html).toContain('SECURITY NOTICE');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('applicationReceivedTemplate renders application reference in monospace', () => {
    const html = applicationReceivedTemplate('Alice Founder', 'APP-2026-X9');

    expect(html).toContain('Hosting Application Received');
    expect(html).toContain('Alice Founder');
    expect(html).toContain('APP-2026-X9');
    expect(html).toContain('Open Dashboard &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('applicationApprovedTemplate renders approved notice without colored accents', () => {
    const html = applicationApprovedTemplate('Bob Builder');

    expect(html).toContain('Application Approved');
    expect(html).toContain('Bob Builder');
    expect(html).toContain('STATUS: APPROVED');
    expect(html).toContain('Complete Onboarding &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('applicationRejectedTemplate renders review feedback cleanly in monochrome', () => {
    const html = applicationRejectedTemplate('Charlie', 'Incomplete compliance documents');

    expect(html).toContain('Application Status Update');
    expect(html).toContain('Charlie');
    expect(html).toContain('REVIEW DECISION');
    expect(html).toContain('Incomplete compliance documents');
    expect(html).toContain('Update Application &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('termsCompletedTemplate renders agreements accepted message', () => {
    const html = termsCompletedTemplate('Dev Lead');

    expect(html).toContain('Agreements Accepted');
    expect(html).toContain('Dev Lead');
    expect(html).toContain('Go to Dashboard &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('databaseProvisionedTemplate renders endpoint details and access notice', () => {
    const html = databaseProvisionedTemplate('Diana', 'prod-db-1', 'cx01.db.liorandb.com');

    expect(html).toContain('Your Managed Database is Ready');
    expect(html).toContain('Diana');
    expect(html).toContain('prod-db-1');
    expect(html).toContain('cx01.db.liorandb.com');
    expect(html).toContain('ACCESS NOTICE');
    expect(html).toContain('View Connection Credentials &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('suspensionTemplate renders suspension reason without red alerts', () => {
    const html = suspensionTemplate('Ethan', 'Overdue monthly invoice');

    expect(html).toContain('Database Service Suspended');
    expect(html).toContain('Ethan');
    expect(html).toContain('SUSPENSION NOTICE');
    expect(html).toContain('Overdue monthly invoice');
    expect(html).toContain('Contact Support &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('supportReplyTemplate renders support response message', () => {
    const html = supportReplyTemplate(
      'Fiona',
      'High latency during backups',
      'We have migrated your shard to node CX-02.',
      'https://app.liorandb.com/support/123'
    );

    expect(html).toContain('New Reply on Support Ticket');
    expect(html).toContain('Fiona');
    expect(html).toContain('High latency during backups');
    expect(html).toContain('We have migrated your shard to node CX-02.');
    expect(html).toContain('SUPPORT TEAM RESPONSE');
    expect(html).toContain('View Ticket &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('paymentReceiptTemplate renders payment receipt table and confirmation', () => {
    const html = paymentReceiptTemplate({
      invoiceNumber: 'INV-2026-004',
      amountFormatted: '₹5,000',
      transactionRef: 'pay_xyz789',
      dateFormatted: '16/10/2026',
    });

    expect(html).toContain('Payment Receipt');
    expect(html).toContain('INV-2026-004');
    expect(html).toContain('₹5,000');
    expect(html).toContain('pay_xyz789');
    expect(html).toContain('16/10/2026');
    expect(html).toContain('RECEIPT CONFIRMATION');
    expect(html).toContain('View Billing & Invoices &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });

  test('invoiceGeneratedTemplate renders usage invoice details and payment button', () => {
    const html = invoiceGeneratedTemplate({
      customerName: 'Gaurav',
      invoiceNumber: 'INV-2026-005',
      amountFormatted: '₹12,450',
      dueDateFormatted: '25/10/2026',
    });

    expect(html).toContain('Usage Invoice Generated');
    expect(html).toContain('Gaurav');
    expect(html).toContain('INV-2026-005');
    expect(html).toContain('₹12,450');
    expect(html).toContain('25/10/2026');
    expect(html).toContain('PAYMENT DUE NOTICE');
    expect(html).toContain('View & Pay Invoice &rarr;');

    for (const forbidden of FORBIDDEN_DARK_OR_COLORED_VALUES) {
      expect(html).not.toContain(forbidden);
    }
  });
});
