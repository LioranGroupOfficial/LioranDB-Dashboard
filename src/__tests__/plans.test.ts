import {
  PLANS,
  getPlan,
  getAllPlans,
  calculatePlanPrice,
  formatPaiseToRupees,
  formatPaiseToInr,
  BACKUP_MONTHLY_PAISE,
  BACKUP_MONTHLY_RUPEES,
} from '@/lib/plans';

describe('LioranDB Usage-Based Plans & Pricing Configuration', () => {
  test('Backup add-on is configured as ₹200 / 20,000 paise per month', () => {
    expect(BACKUP_MONTHLY_RUPEES).toBe(200);
    expect(BACKUP_MONTHLY_PAISE).toBe(20000);
  });

  test('Shared plan specifications', () => {
    const plan = getPlan('shared');
    expect(plan).toBeDefined();
    expect(plan?.name).toBe('Shared');
    expect(plan?.hourlyRateRupees).toBe(1);
    expect(plan?.hourlyRatePaise).toBe(100);
    expect(plan?.type).toBe('shared');
    expect(plan?.documentLimit).toBe(1000);
    expect(plan?.opsPerSecondLimit).toBe(3000);
    expect(plan?.backupIncluded).toBe(false);
    expect(plan?.optionalBackupAllowed).toBe(true);
    expect(plan?.isSelfService).toBe(true);
  });

  test('Dedicated plan specifications', () => {
    const plan = getPlan('dedicated');
    expect(plan).toBeDefined();
    expect(plan?.name).toBe('Dedicated');
    expect(plan?.hourlyRateRupees).toBe(8);
    expect(plan?.hourlyRatePaise).toBe(800);
    expect(plan?.type).toBe('dedicated');
    expect(plan?.backupIncluded).toBe(false);
    expect(plan?.optionalBackupAllowed).toBe(true);
    expect(plan?.isSelfService).toBe(true);
  });

  test('High Capacity Enterprise plan specifications', () => {
    const plan = getPlan('high-capacity');
    expect(plan).toBeDefined();
    expect(plan?.name).toBe('High Capacity');
    expect(plan?.hourlyRateRupees).toBe(250);
    expect(plan?.hourlyRatePaise).toBe(25000);
    expect(plan?.isSelfService).toBe(false);
    expect(plan?.contactEmail).toBe('support@liorandb.com');
  });

  test('calculatePlanPrice calculates hourly rate and optional backup', () => {
    const sharedWithoutBackup = calculatePlanPrice('shared', false);
    expect(sharedWithoutBackup.hourlyRateRupees).toBe(1);
    expect(sharedWithoutBackup.hourlyRatePaise).toBe(100);
    expect(sharedWithoutBackup.backupMonthlyRupees).toBe(0);
    expect(sharedWithoutBackup.backupMonthlyPaise).toBe(0);

    const sharedWithBackup = calculatePlanPrice('shared', true);
    expect(sharedWithBackup.hourlyRateRupees).toBe(1);
    expect(sharedWithBackup.hourlyRatePaise).toBe(100);
    expect(sharedWithBackup.backupMonthlyRupees).toBe(200);
    expect(sharedWithBackup.backupMonthlyPaise).toBe(20000);

    const dedicatedWithBackup = calculatePlanPrice('dedicated', true);
    expect(dedicatedWithBackup.hourlyRateRupees).toBe(8);
    expect(dedicatedWithBackup.hourlyRatePaise).toBe(800);
    expect(dedicatedWithBackup.backupMonthlyRupees).toBe(200);
    expect(dedicatedWithBackup.backupMonthlyPaise).toBe(20000);
  });

  test('formatPaiseToRupees and formatPaiseToInr format integer paise accurately', () => {
    expect(formatPaiseToRupees(100)).toContain('1');
    expect(formatPaiseToRupees(800)).toContain('8');
    expect(formatPaiseToRupees(20000)).toContain('200');
    expect(formatPaiseToInr(100)).toContain('1.00');
    expect(formatPaiseToInr(68240)).toContain('682.40');
  });
});

