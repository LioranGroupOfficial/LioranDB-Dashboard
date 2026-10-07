export type PlanType = 'shared' | 'dedicated';

export interface PlanConfig {
  id: string;
  name: string;
  hourlyRateRupees: number;
  hourlyRatePaise: number;
  priceRupees?: number;
  pricePaise?: number;
  type: PlanType;
  purpose: string;
  resourceModel: string;
  documentGuideline: string;
  documentLimit?: number;
  maxDocuments?: number;
  opsLimitGuideline: string;
  opsPerSecondLimit?: number;
  maxOpsPerSec?: number;
  backupIncluded: boolean;
  optionalBackupAllowed: boolean;
  backupPriceMonthlyRupees: number;
  backupPriceMonthlyPaise: number;
  isSelfService: boolean;
  selfService?: boolean;
  contactEmail?: string;
  badge?: string;
  description?: string;
}

export const BACKUP_MONTHLY_RUPEES = 200;
export const BACKUP_MONTHLY_PAISE = 20000;
export const SUPPORT_CONTACT_EMAIL = 'support@liorandb.com';

export const PLANS: Record<string, PlanConfig> = {
  shared: {
    id: 'shared',
    name: 'Shared',
    hourlyRateRupees: 1,
    hourlyRatePaise: 100,
    priceRupees: 1,
    pricePaise: 100,
    type: 'shared',
    purpose: 'Developers, MVPs, prototypes, small applications, early-stage startups, and testing.',
    resourceModel: 'Shared infrastructure',
    documentGuideline: 'Up to 1,000 documents',
    documentLimit: 1000,
    maxDocuments: 1000,
    opsLimitGuideline: 'Up to 3,000 ops/sec (~1,500 writes/sec & ~2,000 reads/sec target workload)',
    opsPerSecondLimit: 3000,
    maxOpsPerSec: 3000,
    backupIncluded: false,
    optionalBackupAllowed: true,
    backupPriceMonthlyRupees: BACKUP_MONTHLY_RUPEES,
    backupPriceMonthlyPaise: BACKUP_MONTHLY_PAISE,
    isSelfService: true,
    selfService: true,
    badge: 'Popular for Devs',
    description: 'Cost-effective entry point for lightweight applications with zero upfront commitment.',
  },
  dedicated: {
    id: 'dedicated',
    name: 'Dedicated',
    hourlyRateRupees: 8,
    hourlyRatePaise: 800,
    priceRupees: 8,
    pricePaise: 800,
    type: 'dedicated',
    purpose: 'Production workloads requiring dedicated managed database resources and predictable performance.',
    resourceModel: 'Dedicated managed database instance',
    documentGuideline: 'Custom production capacity',
    opsLimitGuideline: 'Dedicated compute throughput',
    backupIncluded: false,
    optionalBackupAllowed: true,
    backupPriceMonthlyRupees: BACKUP_MONTHLY_RUPEES,
    backupPriceMonthlyPaise: BACKUP_MONTHLY_PAISE,
    isSelfService: true,
    selfService: true,
    badge: 'Production Ready',
    description: 'Fully isolated managed database compute designed for high availability and production systems.',
  },
  'high-capacity': {
    id: 'high-capacity',
    name: 'High Capacity',
    hourlyRateRupees: 250,
    hourlyRatePaise: 25000,
    priceRupees: 250,
    pricePaise: 25000,
    type: 'dedicated',
    purpose: 'High-throughput and specialized mission-critical workloads.',
    resourceModel: 'Custom cluster architecture / Enterprise compute',
    documentGuideline: 'Enterprise scale',
    opsLimitGuideline: 'Custom high-throughput capacity',
    backupIncluded: true,
    optionalBackupAllowed: false,
    backupPriceMonthlyRupees: 0,
    backupPriceMonthlyPaise: 0,
    isSelfService: false,
    selfService: false,
    contactEmail: SUPPORT_CONTACT_EMAIL,
    badge: 'Enterprise',
    description: 'Contact LioranDB for provisioning specialized high-throughput clusters.',
  },
};

export const DEFAULT_PLAN_ID = 'shared';

export function getPlan(planId: string): PlanConfig | undefined {
  if (!planId) return undefined;
  if (PLANS[planId]) return PLANS[planId];
  // Backward-compatibility aliases
  if (planId === 'developer_shared') return PLANS.shared;
  if (planId === 'starter' || planId === 'growth' || planId === 'pro' || planId === 'managed-v1') {
    return PLANS.dedicated;
  }
  if (planId === 'high_capacity' || planId === 'enterprise') return PLANS['high-capacity'];
  return undefined;
}

export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

export function getSelfServicePlans(): PlanConfig[] {
  return Object.values(PLANS).filter((p) => p.isSelfService);
}

export interface PlanPriceBreakdown {
  planId: string;
  planName: string;
  hourlyRateRupees: number;
  hourlyRatePaise: number;
  backupAddon: boolean;
  backupMonthlyRupees: number;
  backupMonthlyPaise: number;
}

export function calculatePlanPrice(planId: string, backupAddon: boolean = false): PlanPriceBreakdown {
  const plan = getPlan(planId);
  if (!plan) {
    throw new Error(`Invalid plan id: ${planId}`);
  }

  const backupMonthlyPaise = backupAddon && plan.optionalBackupAllowed ? BACKUP_MONTHLY_PAISE : 0;
  const backupMonthlyRupees = backupMonthlyPaise / 100;

  return {
    planId: plan.id,
    planName: plan.name,
    hourlyRateRupees: plan.hourlyRateRupees,
    hourlyRatePaise: plan.hourlyRatePaise,
    backupAddon: backupAddon && plan.optionalBackupAllowed,
    backupMonthlyRupees,
    backupMonthlyPaise,
  };
}

export function formatPaiseToRupees(paise: number, showDecimals: boolean = true): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals && paise % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatPaiseToInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatRupees(rupees: number, showDecimals: boolean = true): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals && rupees % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}
