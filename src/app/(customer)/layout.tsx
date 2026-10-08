import { requireUser, isAccountVerified } from '@/lib/auth/guards';
import { redirect } from 'next/navigation';
import CustomerShell from '@/components/layout/CustomerShell';
import { connectToDatabase, User, IUser } from '@/lib/db';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await requireUser();

  // Fetch full user data server-side
  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).select('-passwordHash').lean<IUser>();

  if (!user) {
    redirect('/login');
  }

  // 1. Email verification check
  if (!user.emailVerified) {
    redirect('/verify-email');
  }

  // 2. Mandatory ₹30 Account Payment Verification check (customers only)
  if (sessionUser.role === 'customer' && !isAccountVerified(user)) {
    redirect('/verify-account');
  }

  return (
    <CustomerShell
      email={sessionUser.email}
      userId={sessionUser.userId}
      stage={user.onboardingStage || 'ACTIVE'}
      role={sessionUser.role}
    >
      {children}
    </CustomerShell>
  );
}


