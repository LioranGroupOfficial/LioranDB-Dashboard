import { requireUser, isAccountVerified } from '@/lib/auth/guards';
import { connectToDatabase, User, IUser } from '@/lib/db';
import { redirect } from 'next/navigation';
import VerifyAccountClient from './VerifyAccountClient';

export const metadata = {
  title: 'Verify Account — LioranDB Cloud',
  description: 'Complete one-time ₹30 account verification payment to activate your LioranDB Cloud account.',
};

export default async function VerifyAccountPage() {
  const sessionUser = await requireUser();

  await connectToDatabase();
  const dbUser = await User.findById(sessionUser.userId).select('-passwordHash').lean<IUser>();

  if (!dbUser) {
    redirect('/login');
  }

  // 1. Email verification must come BEFORE account verification
  if (!dbUser.emailVerified) {
    redirect('/verify-email');
  }

  // 2. If already verified, direct to dashboard
  if (isAccountVerified(dbUser)) {
    redirect('/dashboard');
  }

  return (
    <VerifyAccountClient
      userEmail={dbUser.email}
      isEmailVerified={dbUser.emailVerified}
    />
  );
}
