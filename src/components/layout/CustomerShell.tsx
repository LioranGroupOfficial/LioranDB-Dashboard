'use client';

import { useState } from 'react';
import CustomerSidebar from '@/components/layout/CustomerSidebar';
import CustomerHeader from '@/components/layout/CustomerHeader';
import type { OnboardingStage, UserRole } from '@/lib/db/models/User';

interface Props {
  children: React.ReactNode;
  email: string;
  userId: string;
  stage: OnboardingStage;
  role: UserRole;
}

export default function CustomerShell({ children, email, userId, stage, role }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen h-[100dvh] w-screen overflow-hidden flex flex-row bg-[var(--background)]">
      <CustomerSidebar
        stage={stage}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col h-screen h-[100dvh] min-w-0 overflow-hidden">
        <CustomerHeader
          email={email}
          userId={userId}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 max-w-6xl mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

