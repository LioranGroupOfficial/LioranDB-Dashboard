/**
 * Migration Script: Migrate legacy database instances and users to usage-based postpaid billing
 *
 * Usage: npx tsx scripts/migrate-to-usage-billing.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  connectToDatabase,
  disconnectFromDatabase,
  User,
  ManagedDatabase,
  BillingInterval,
  Coupon,
} from '../src/lib/db';
import { PLANS } from '../src/lib/plans';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await connectToDatabase();

  // 1. Update all verified customer onboarding stages to ACTIVE
  console.log('Updating verified users onboarding stage...');
  const userResult = await User.updateMany(
    { emailVerified: true, onboardingStage: { $ne: 'ACTIVE' } },
    { onboardingStage: 'ACTIVE' }
  );
  console.log(`✓ Updated ${userResult.modifiedCount} user accounts to ACTIVE stage.`);

  // 2. Migrate existing database instances
  console.log('Migrating database instances to usage-based plans...');
  const instances = await ManagedDatabase.find();
  let migratedInstances = 0;

  for (const inst of instances) {
    let modified = false;

    // Map old plan IDs
    let planId = inst.planId || 'shared';
    if (!PLANS[planId]) {
      planId = planId.toLowerCase().includes('dedicat') ? 'dedicated' : 'shared';
      inst.planId = planId;
      modified = true;
    }

    const plan = PLANS[planId];
    if (!inst.hourlyRatePaise) {
      inst.hourlyRatePaise = plan.hourlyRatePaise;
      modified = true;
    }

    if (inst.backupMonthlyPaise === undefined) {
      inst.backupMonthlyPaise = 20000;
      modified = true;
    }

    // Set billingStartedAt if active
    if (inst.status === 'ACTIVE' && !inst.billingStartedAt) {
      inst.billingStartedAt = inst.provisionedAt || inst.createdAt || new Date();
      modified = true;

      // Ensure billing interval exists
      const existingInterval = await BillingInterval.findOne({
        instanceId: inst._id,
        endedAt: null,
      });

      if (!existingInterval) {
        await BillingInterval.create({
          instanceId: inst._id,
          customerId: inst.customerId || inst.userId,
          planId: inst.planId,
          planName: plan.name,
          hourlyRatePaise: inst.hourlyRatePaise,
          startedAt: inst.billingStartedAt,
          backupEnabled: Boolean(inst.backupEnabled),
          backupMonthlyPaise: inst.backupMonthlyPaise || 20000,
        });
      }
    }

    // Ensure databaseUsers array exists
    if (!inst.databaseUsers || !Array.isArray(inst.databaseUsers)) {
      inst.databaseUsers = [];
      modified = true;
    }

    if (modified) {
      await inst.save();
      migratedInstances++;
    }
  }
  console.log(`✓ Migrated ${migratedInstances} database instances to usage-based metadata.`);

  // 3. Seed starter discount coupons if none exist
  const couponCount = await Coupon.countDocuments();
  if (couponCount === 0) {
    console.log('Seeding initial promotional coupons...');
    await Coupon.create([
      {
        code: 'WELCOME100',
        discountPercentage: 100,
        description: '100% off first month compute trial',
        scope: 'ALL',
        enabled: true,
        maxRedemptions: 1000,
      },
      {
        code: 'LAUNCH20',
        discountPercentage: 20,
        description: '20% off all usage plans',
        scope: 'ALL',
        enabled: true,
      },
    ]);
    console.log('✓ Seeded WELCOME100 and LAUNCH20 coupons.');
  }

  console.log('✅ Migration to usage-based billing completed successfully.');
  await disconnectFromDatabase();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
