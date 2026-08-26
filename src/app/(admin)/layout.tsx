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
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      <AdminSidebar email={user.email} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader email={user.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
