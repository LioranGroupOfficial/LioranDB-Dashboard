import { requireUser } from '@/lib/auth/guards';
import CustomerSidebar from '@/components/layout/CustomerSidebar';
import CustomerHeader from '@/components/layout/CustomerHeader';
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
    <div className="h-screen w-screen overflow-hidden flex flex-row bg-[var(--background)]">
      <CustomerSidebar
        stage={user?.onboardingStage || 'EMAIL_VERIFICATION'}
        role={sessionUser.role}
      />
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <CustomerHeader
          email={sessionUser.email}
          userId={sessionUser.userId}
        />
        <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

