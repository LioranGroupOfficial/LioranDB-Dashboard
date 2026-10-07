import crypto from 'crypto';
import PolicyDocument from '../db/models/PolicyDocument';

export const REQUIRED_POLICIES = [
  'managed-hosting-terms',
  'privacy-policy',
  'acceptable-use-policy',
  'refund-cancellation-policy',
] as const;

export const DEFAULT_POLICIES = [
  {
    slug: 'managed-hosting-terms',
    title: 'LioranDB Managed Hosting Terms of Service',
    version: '2.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING SERVICE AGREEMENT (v2.0)

1. PROVISION OF SERVICES
LioranDB agrees to provide managed database hosting services under a postpaid usage-based model. The customer is granted a non-exclusive, revocable right to connect to and store data in their managed instance.

2. SERVICE LEVEL OBJECTIVES & BENCHMARK CHARACTERISTICS
Managed instances target a 99.9% monthly availability baseline. Shared instances support up to 1,000 documents and 3,000 operations/sec overall. Dedicated instances provide dedicated hardware allocations. High Capacity workloads require manual provisioning via LioranDB support.

3. PRICING & USAGE-BASED BILLING
Compute usage is billed postpaid on an hourly basis (Shared at ₹1/hour, Dedicated at ₹8/hour). Optional managed backups are billed at ₹200/month prorated to active instance duration. Billing starts strictly when an instance transitions to ACTIVE status and ceases when terminated. Invoices are generated at the end of each billing cycle in Asia/Kolkata timezone.

4. CREDENTIALS & SECURITY RESPONSIBILITY
Customers must safeguard database connection URIs and user credentials. LioranDB does not store customer database passwords in plaintext.

5. TERMINATION & SUSPENSION
Customers may terminate instances at any time to halt billing immediately. LioranDB reserves the right to suspend or terminate services in the event of acceptable use breaches or delinquent unpaid invoices.`,
  },
  {
    slug: 'privacy-policy',
    title: 'LioranDB Privacy Policy',
    version: '2.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING PRIVACY POLICY (v2.0)

1. DATA COLLECTION
We collect necessary account registration information (email, contact name, company name, country, and phone number) to deliver hosting services, verify identities, and facilitate support interactions.

2. LOGGING & AUDIT TRAIL
We maintain an append-only audit trail recording administrative actions, logins, policy acceptances, and credential events with timestamp, actor identity, and originating IP address for security compliance.

3. DATABASE WORKLOAD DATA
Customer database contents are stored in isolated managed deployments. LioranDB does not access, inspect, or sell customer application data stored within managed database collections.

4. DATA RETENTION
Upon instance termination, billing ceases immediately and compute instances are decommissioned. Customer invoices and audit logs are retained for accounting and compliance records.`,
  },
  {
    slug: 'acceptable-use-policy',
    title: 'LioranDB Acceptable Use Policy',
    version: '2.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING ACCEPTABLE USE POLICY (v2.0)

1. PROHIBITED USES
Customer managed database instances may not be utilized to:
(a) Facilitate denial-of-service (DoS/DDoS) attacks or network scanning.
(b) Store or disseminate illegal content, unauthorized proprietary data, or malicious code.
(c) Attempt unauthorized intrusion or penetration of the LioranDB control plane or underlying compute nodes.

2. RESOURCE GOVERNANCE
Customers agree not to intentionally disrupt shared cluster infrastructure or exceed allocated plan limits in a manner detrimental to network stability.

3. ENFORCEMENT
Violations of this Acceptable Use Policy will result in immediate suspension without prior notice.`,
  },
  {
    slug: 'refund-cancellation-policy',
    title: 'LioranDB Billing & Cancellation Policy',
    version: '2.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB POSTPAID USAGE & CANCELLATION POLICY (v2.0)

1. USAGE-BASED BILLING & ACCUMULATION
All compute and optional backup charges accumulate based on exact active running duration (seconds accumulated server-side). There are no upfront registration fees or prepayment requirements for standard self-service plans.

2. INSTANCE TERMINATION
Customers can terminate database instances at any moment through the dashboard. Terminating an instance immediately halts further usage accumulation and closes the active billing interval.

3. INVOICE SETTLEMENT
At the end of each monthly billing cycle, an itemized invoice is generated reflecting exact hourly usage and applied promotional discounts. Customers have a 15-day settlement window to pay invoices via Razorpay or configured payment methods.`,
  },
];

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function ensureDefaultPolicies() {
  const existingCount = await PolicyDocument.countDocuments({
    slug: { $in: REQUIRED_POLICIES as unknown as string[] },
    active: true,
  });

  if (existingCount >= REQUIRED_POLICIES.length) {
    return;
  }

  for (const pol of DEFAULT_POLICIES) {
    const contentHash = sha256(pol.content);
    await PolicyDocument.findOneAndUpdate(
      { slug: pol.slug, version: pol.version },
      {
        ...pol,
        contentHash,
      },
      { upsert: true, returnDocument: 'after' }
    );
  }
}
