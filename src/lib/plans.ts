export type PlanType = 'shared' | 'dedicated';

export interface PlanConfig {
  id: string;
  name: string;
  priceRupees: number;
  pricePaise: number;
  type: PlanType;
  purpose: string;
  resourceModel: string;
  cpu: string;
  memory: string;
  memoryMb: number;
  documentGuideline: string;
  documentLimit: number;
  backupIncluded: boolean;
  optionalBackupAllowed: boolean;
  backupPriceRupees: number;
  backupPricePaise: number;
  isSharedNotice?: string;
  badge?: string;
}

export const REGISTRATION_FEE_RUPEES = 100;
export const REGISTRATION_FEE_PAISE = 10000;
export const BACKUP_ADDON_MONTHLY_RUPEES = 500;
export const BACKUP_ADDON_MONTHLY_PAISE = 50000;

export const PLANS: Record<string, PlanConfig> = {
  developer_shared: {
    id: 'developer_shared',
    name: 'Developer Shared',
    priceRupees: 299,
    pricePaise: 29900,
    type: 'shared',
    purpose: 'Individual developers, testing, side projects and small development workloads.',
    resourceModel: 'Shared infrastructure with other developers.',
    cpu: 'Shared vCPU',
    memory: 'Shared RAM',
    memoryMb: 512,
    documentGuideline: 'Up to 50,000 documents',
    documentLimit: 50000,
    backupIncluded: false,
    optionalBackupAllowed: true,
    backupPriceRupees: BACKUP_ADDON_MONTHLY_RUPEES,
    backupPricePaise: BACKUP_ADDON_MONTHLY_PAISE,
    isSharedNotice: 'CPU and RAM are shared with other workloads and not guaranteed dedicated resources.',
  },
  starter: {
    id: 'starter',
    name: 'Starter Dedicated',
    priceRupees: 1499,
    pricePaise: 149900,
    type: 'dedicated',
    purpose: 'Small applications, production backends, and predictable performance.',
    resourceModel: 'Dedicated 1 vCPU, 1 GB RAM instance.',
    cpu: '1 vCPU',
    memory: '1 GB RAM',
    memoryMb: 1024,
    documentGuideline: 'Up to 100,000 documents',
    documentLimit: 100000,
    backupIncluded: false,
    optionalBackupAllowed: true,
    backupPriceRupees: BACKUP_ADDON_MONTHLY_RUPEES,
    backupPricePaise: BACKUP_ADDON_MONTHLY_PAISE,
    badge: 'Popular',
  },
  growth: {
    id: 'growth',
    name: 'Growth Dedicated',
    priceRupees: 2499,
    pricePaise: 249900,
    type: 'dedicated',
    purpose: 'Growing businesses, APIs, and mission-critical production data.',
    resourceModel: 'Dedicated 2 vCPU, 2 GB RAM instance.',
    cpu: '2 vCPU',
    memory: '2 GB RAM',
    memoryMb: 2048,
    documentGuideline: 'Up to 500,000 documents',
    documentLimit: 500000,
    backupIncluded: true,
    optionalBackupAllowed: false,
    backupPriceRupees: 0,
    backupPricePaise: 0,
    badge: 'Recommended',
  },
  pro: {
    id: 'pro',
    name: 'Pro Dedicated',
    priceRupees: 5000,
    pricePaise: 500000,
    type: 'dedicated',
    purpose: 'High-scale workloads requiring heavy throughput and dedicated resources.',
    resourceModel: 'Dedicated 2 vCPU, 4 GB RAM instance.',
    cpu: '2 vCPU',
    memory: '4 GB RAM',
    memoryMb: 4096,
    documentGuideline: 'Up to 1,000,000 documents',
    documentLimit: 1000000,
    backupIncluded: true,
    optionalBackupAllowed: false,
    backupPriceRupees: 0,
    backupPricePaise: 0,
  },
};

export const DEFAULT_PLAN_ID = 'starter';

export function getPlan(planId: string): PlanConfig | undefined {
  return PLANS[planId] || (planId === 'managed-v1' ? PLANS.starter : undefined);
}

export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

export interface PlanPriceBreakdown {
  planId: string;
  planName: string;
  basePriceRupees: number;
  basePricePaise: number;
  backupAddon: boolean;
  backupPriceRupees: number;
  backupPricePaise: number;
  totalPriceRupees: number;
  totalPricePaise: number;
  isDailyBackupIncluded: boolean;
}

export function calculatePlanPrice(planId: string, backupAddon: boolean = false): PlanPriceBreakdown {
  const plan = getPlan(planId);
  if (!plan) {
    throw new Error(`Invalid plan id: ${planId}`);
  }

  // Growth & Pro include backups already; never add backup price
  const effectivelyHasBackup = plan.backupIncluded || backupAddon;
  const backupPricePaise = plan.backupIncluded
    ? 0
    : backupAddon && plan.optionalBackupAllowed
    ? BACKUP_ADDON_MONTHLY_PAISE
    : 0;

  const backupPriceRupees = Math.floor(backupPricePaise / 100);
  const totalPricePaise = plan.pricePaise + backupPricePaise;
  const totalPriceRupees = plan.priceRupees + backupPriceRupees;

  return {
    planId: plan.id,
    planName: plan.name,
    basePriceRupees: plan.priceRupees,
    basePricePaise: plan.pricePaise,
    backupAddon: effectivelyHasBackup,
    backupPriceRupees,
    backupPricePaise,
    totalPriceRupees,
    totalPricePaise,
    isDailyBackupIncluded: plan.backupIncluded,
  };
}

export function formatPaiseToRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatRupees(rupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

