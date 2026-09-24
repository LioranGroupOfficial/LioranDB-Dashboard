/**
 * Migration Script: Migrate historical registration payments to prepaid wallet credits
 *
 * Usage: npx tsx scripts/migrate-registration-to-credits.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { connectToDatabase, User, Wallet, WalletTransaction, Payment } from '../src/lib/db';

async function migrate() {
  console.log('Connecting to database...');
  await connectToDatabase();

  const users = await User.find({ accountRegistrationPaid: true });
  console.log(`Found ${users.length} registered users to check.`);

  let migratedCount = 0;

  for (const user of users) {
    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      console.log(`Creating wallet for user ${user.email}...`);
      wallet = await Wallet.create({
        userId: user._id,
        balancePaise: 10000, // ₹100
        lifetimeCreditsAddedPaise: 10000,
        lifetimeCreditsUsedPaise: 0,
      });

      await WalletTransaction.create({
        userId: user._id,
        walletId: wallet._id,
        type: 'credit',
        category: 'topup',
        amountPaise: 10000,
        balanceBeforePaise: 0,
        balanceAfterPaise: 10000,
        description: 'Initial account activation credit migration (₹100)',
        idempotencyKey: `mig_initial_reg_${user._id}`,
      });

      migratedCount++;
    }
  }

  console.log(`Migration completed. ${migratedCount} wallets created/credited.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

