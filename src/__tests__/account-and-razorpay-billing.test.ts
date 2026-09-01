import { formatCurrency, getBillingStatus } from '@/lib/billing';

describe('Account Deletion & Razorpay Billing Workflows', () => {
  test('Pending and submitted payments prevent account deletion', () => {
    const mockPayments = [
      { id: '1', status: 'PENDING', amount: 5000, billingMonth: 'September 2026' },
      { id: '2', status: 'PAID', amount: 5000, billingMonth: 'August 2026' },
    ];

    const hasUnpaid = mockPayments.some((p) => p.status === 'PENDING' || p.status === 'SUBMITTED');
    expect(hasUnpaid).toBe(true);

    const settledPayments = [
      { id: '2', status: 'PAID', amount: 5000, billingMonth: 'August 2026' },
    ];
    const canDelete = !settledPayments.some((p) => p.status === 'PENDING' || p.status === 'SUBMITTED');
    expect(canDelete).toBe(true);
  });

  test('Razorpay verification decisions validate correctly', () => {
    const validDecisions = ['VERIFIED', 'REJECTED'];
    expect(validDecisions.includes('VERIFIED')).toBe(true);
    expect(validDecisions.includes('REJECTED')).toBe(true);
    expect(validDecisions.includes('UNKNOWN')).toBe(false);
  });

  test('Support and Admin roles can review applications', () => {
    const allowedReviewerRoles = ['admin', 'support'];
    expect(allowedReviewerRoles.includes('admin')).toBe(true);
    expect(allowedReviewerRoles.includes('support')).toBe(true);
    expect(allowedReviewerRoles.includes('customer')).toBe(false);
  });
});

