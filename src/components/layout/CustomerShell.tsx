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
    <div data-customer-shell="" className="fixed inset-0 flex h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-[var(--background)]">
      <CustomerSidebar
        stage={stage}
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CustomerHeader
          email={email}
          userId={userId}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
        />
        <main className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable] ${mobileOpen ? 'overflow-y-hidden md:overflow-y-auto' : 'overflow-y-auto'}`}>
          <div className="mx-auto w-full min-w-0 max-w-6xl p-3.5 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

