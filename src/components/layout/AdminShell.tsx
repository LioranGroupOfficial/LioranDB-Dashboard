'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminHeader from '@/components/layout/AdminHeader';

interface Props {
  children: React.ReactNode;
  email: string;
}

export default function AdminShell({ children, email }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen h-[100dvh] w-screen overflow-hidden flex flex-row bg-[var(--background)]">
      <AdminSidebar
        email={email}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col h-screen h-[100dvh] min-w-0 overflow-hidden">
        <AdminHeader
          email={email}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

