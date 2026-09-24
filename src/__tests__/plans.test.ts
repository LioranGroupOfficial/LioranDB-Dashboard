import {
  PLANS,
  getPlan,
  getAllPlans,
  calculatePlanPrice,
  formatPaiseToRupees,
  REGISTRATION_FEE_PAISE,
  REGISTRATION_FEE_RUPEES,
  BACKUP_ADDON_MONTHLY_PAISE,
  BACKUP_ADDON_MONTHLY_RUPEES,
} from '@/lib/plans';

describe('LioranDB Plans & Pricing Configuration', () => {
  test('Registration fee is configured as exactly ₹100 / 10,000 paise', () => {
    expect(REGISTRATION_FEE_RUPEES).toBe(100);
    expect(REGISTRATION_FEE_PAISE).toBe(10000);
  });

  test('Backup add-on is configured as ₹500 / 50,000 paise', () => {
    expect(BACKUP_ADDON_MONTHLY_RUPEES).toBe(500);
    expect(BACKUP_ADDON_MONTHLY_PAISE).toBe(50000);
  });

  test('Developer Shared plan specifications', () => {
    const plan = getPlan('developer_shared');
    expect(plan).toBeDefined();
    expect(plan?.priceRupees).toBe(299);
    expect(plan?.pricePaise).toBe(29900);
    expect(plan?.type).toBe('shared');
    expect(plan?.documentLimit).toBe(50000);
    expect(plan?.backupIncluded).toBe(false);
    expect(plan?.optionalBackupAllowed).toBe(true);
  });

  test('Starter Dedicated plan specifications', () => {
    const plan = getPlan('starter');
    expect(plan).toBeDefined();
    expect(plan?.priceRupees).toBe(1499);
    expect(plan?.pricePaise).toBe(149900);
    expect(plan?.type).toBe('dedicated');
    expect(plan?.documentLimit).toBe(100000);
    expect(plan?.backupIncluded).toBe(false);
    expect(plan?.optionalBackupAllowed).toBe(true);
  });

  test('Growth Dedicated includes backups and charges ₹0 for backup add-on', () => {
    const plan = getPlan('growth');
    expect(plan).toBeDefined();
    expect(plan?.priceRupees).toBe(2499);
    expect(plan?.pricePaise).toBe(249900);
    expect(plan?.type).toBe('dedicated');
    expect(plan?.documentLimit).toBe(500000);
    expect(plan?.backupIncluded).toBe(true);

    const priceWithBackup = calculatePlanPrice('growth', true);
    expect(priceWithBackup.backupPriceRupees).toBe(0);
    expect(priceWithBackup.backupPricePaise).toBe(0);
    expect(priceWithBackup.totalPriceRupees).toBe(2499);
    expect(priceWithBackup.totalPricePaise).toBe(249900);
  });

  test('Pro Dedicated includes backups and charges ₹0 for backup add-on', () => {
    const plan = getPlan('pro');
    expect(plan).toBeDefined();
    expect(plan?.priceRupees).toBe(5000);
    expect(plan?.pricePaise).toBe(500000);
    expect(plan?.type).toBe('dedicated');
    expect(plan?.documentLimit).toBe(1000000);
    expect(plan?.backupIncluded).toBe(true);

    const priceWithBackup = calculatePlanPrice('pro', true);
    expect(priceWithBackup.backupPriceRupees).toBe(0);
    expect(priceWithBackup.totalPriceRupees).toBe(5000);
  });

  test('Starter Dedicated with optional backup calculates ₹1,999 / 199,900 paise', () => {
    const priceWithBackup = calculatePlanPrice('starter', true);
    expect(priceWithBackup.basePriceRupees).toBe(1499);
    expect(priceWithBackup.backupPriceRupees).toBe(500);
    expect(priceWithBackup.totalPriceRupees).toBe(1999);
    expect(priceWithBackup.totalPricePaise).toBe(199900);
    expect(priceWithBackup.backupAddon).toBe(true);
  });

  test('Developer Shared with optional backup calculates ₹799 / 79,900 paise', () => {
    const priceWithBackup = calculatePlanPrice('developer_shared', true);
    expect(priceWithBackup.basePriceRupees).toBe(299);
    expect(priceWithBackup.backupPriceRupees).toBe(500);
    expect(priceWithBackup.totalPriceRupees).toBe(799);
    expect(priceWithBackup.totalPricePaise).toBe(79900);
  });

  test('formatPaiseToRupees correctly formats integer paise to INR string', () => {
    const formatted = formatPaiseToRupees(10000);
    expect(formatted).toContain('100');
  });
});

