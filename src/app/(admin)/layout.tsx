import { requireRole } from '@/lib/auth/guards';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminHeader from '@/components/layout/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole('admin');

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-row bg-[var(--background)]">
      <AdminSidebar email={user.email} />
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <AdminHeader email={user.email} />
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

