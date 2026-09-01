import { requireUser } from '@/lib/auth/guards';
import CustomerShell from '@/components/layout/CustomerShell';
import { connectToDatabase, User } from '@/lib/db';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await requireUser();

  // Fetch full user data server-side
  await connectToDatabase();
  const user = await User.findById(sessionUser.userId).select('-passwordHash').lean();

  return (
    <CustomerShell
      email={sessionUser.email}
      userId={sessionUser.userId}
      stage={user?.onboardingStage || 'EMAIL_VERIFICATION'}
      role={sessionUser.role}
    >
      {children}
    </CustomerShell>
  );
}


