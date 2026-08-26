import mongoose from 'mongoose';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required to run seed-dev.');
  process.exit(1);
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const POLICIES = [
  {
    slug: 'managed-hosting-terms',
    title: 'LioranDB Managed Hosting Terms of Service',
    version: '1.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING SERVICE AGREEMENT (v1.0)

1. PROVISION OF SERVICES
LioranDB agrees to provide managed database hosting services in accordance with the specifications of the selected subscription plan. The customer is granted a non-exclusive, revocable right to connect to and store data in the managed instance.

2. SERVICE LEVEL OBJECTIVES & BENCHMARK CHARACTERISTICS
Managed instances target a 99.9% monthly availability baseline. Benchmark performance characteristics (e.g. ~35,000 reads/sec, ~10,000 writes/sec) represent laboratory baseline performance and do not constitute absolute throughput guarantees. Performance is dependent on workload, indexing, schema design, and client concurrency.

3. PRICING & BILLING
Managed hosting is billed at the standard rate of ₹5,000 (INR) per month per instance, due on the 1st day of each month in the Asia/Kolkata timezone. Failure to maintain payment status may result in service suspension.

4. CREDENTIALS & SECURITY RESPONSIBILITY
Customers must change temporary credentials immediately upon instance activation. Customers are solely responsible for safeguarding database credentials and connection URIs.

5. TERMINATION & SUSPENSION
LioranDB reserves the right to suspend or terminate services in the event of terms violations, acceptable use breaches, or delinquent billing accounts.`,
  },
  {
    slug: 'privacy-policy',
    title: 'LioranDB Privacy Policy',
    version: '1.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING PRIVACY POLICY (v1.0)

1. DATA COLLECTION
We collect necessary account registration information (email, contact name, company name, country, and phone number) to deliver hosting services, verify identities, and facilitate support interactions.

2. LOGGING & AUDIT TRAIL
We maintain an append-only audit trail recording administrative actions, logins, policy acceptances, and credential events with timestamp, actor identity, and originating IP address for security compliance.

3. DATABASE WORKLOAD DATA
Customer database contents are stored in isolated managed deployments. LioranDB does not access, inspect, or sell customer application data stored within managed database collections.

4. DATA RETENTION
Upon account termination, customer database storage volumes and backups are retained for 30 days prior to permanent, irrecoverable deletion.`,
  },
  {
    slug: 'acceptable-use-policy',
    title: 'LioranDB Acceptable Use Policy',
    version: '1.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB MANAGED HOSTING ACCEPTABLE USE POLICY (v1.0)

1. PROHIBITED USES
Customer managed database instances may not be utilized to:
(a) Facilitate denial-of-service (DoS/DDoS) attacks or network scanning.
(b) Store or disseminate illegal content, unauthorized proprietary data, or malicious code.
(c) Attempt unauthorized intrusion or penetration of the LioranDB control plane or underlying compute nodes.

2. RESOURCE GOVERNANCE
Customers agree not to intentionally disrupt shared cluster infrastructure or exceed allocated compute and IOPS allocations in a manner detrimental to network stability.

3. ENFORCEMENT
Violations of this Acceptable Use Policy will result in immediate suspension without prior notice.`,
  },
  {
    slug: 'refund-cancellation-policy',
    title: 'LioranDB Refund & Cancellation Policy',
    version: '1.0',
    effectiveAt: new Date('2026-01-01'),
    active: true,
    content: `LIORANDB REFUND AND CANCELLATION POLICY (v1.0)

1. MONTHLY SUBSCRIPTION CANCELLATIONS
Customers may cancel their managed hosting subscription at any time via the dashboard or by contacting support. Cancellations take effect at the conclusion of the current monthly billing period.

2. REFUND TERMS
Hosting fees are billed in advance on a monthly basis and are non-refundable once the monthly billing cycle has commenced, except where mandated by applicable consumer protection laws.

3. PRO-RATED BILLING
New deployments provisioned mid-month are calculated based on the standard monthly rate effective until the subsequent 1st-of-month renewal.`,
  },
];

async function seedDev() {
  console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI!);

  const PolicyDocumentSchema = new mongoose.Schema(
    {
      slug: { type: String, required: true, index: true },
      title: { type: String, required: true },
      version: { type: String, required: true },
      effectiveAt: { type: Date, required: true },
      contentHash: { type: String, required: true },
      content: { type: String, required: true },
      active: { type: Boolean, default: true, index: true },
    },
    { timestamps: true }
  );

  const PolicyDocument =
    mongoose.models.PolicyDocument ||
    mongoose.model('PolicyDocument', PolicyDocumentSchema);

  console.log(`Seeding legal policy documents...`);
  for (const pol of POLICIES) {
    const contentHash = sha256(pol.content);
    await PolicyDocument.findOneAndUpdate(
      { slug: pol.slug, version: pol.version },
      {
        ...pol,
        contentHash,
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✓ Seeded policy: ${pol.slug} (v${pol.version})`);
  }

  await mongoose.disconnect();
  console.log('✅ Dev seed complete.');
}

seedDev().catch((err) => {
  console.error('Seed dev error:', err);
  process.exit(1);
});

