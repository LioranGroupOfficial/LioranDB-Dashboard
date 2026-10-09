import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import argon2 from 'argon2';
import { connectToDatabase, disconnectFromDatabase, User } from '../src/lib/db';

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required to run seed-admin.');
  process.exit(1);
}

if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
  console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required in .env.local.');
  process.exit(1);
}

const ARGON2_OPTIONS = {
  type: 2 as const,
  memoryCost: 65536,
  timeCost: 2,
  parallelism: 1,
};

async function seedAdmin() {
  console.log(`Connecting to LioranDB via ${MONGODB_URI}...`);
  await connectToDatabase();

  const email = SEED_ADMIN_EMAIL!.toLowerCase().trim();
  const passwordHash = await argon2.hash(SEED_ADMIN_PASSWORD!, ARGON2_OPTIONS);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.emailVerified = true;
    existing.passwordHash = passwordHash;
    existing.onboardingStage = 'ACTIVE';
    existing.isActive = true;
    await existing.save();
    console.log(`✅ Admin account updated successfully for: ${email}`);
  } else {
    await User.create({
      email,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      onboardingStage: 'ACTIVE',
      isActive: true,
      profile: {
        fullName: 'LioranDB Administrator',
        company: 'LioranDB',
        country: 'India',
      },
    });
    console.log(`✅ Initial admin account created successfully for: ${email}`);
  }

  await disconnectFromDatabase();
  console.log('🎉 Done! You can now log in at http://localhost:3000/login');
}

seedAdmin().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
