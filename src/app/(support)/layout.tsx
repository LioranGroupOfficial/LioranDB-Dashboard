import { requireAnyRole } from '@/lib/auth/guards';
import SupportSidebar from '@/components/layout/SupportSidebar';
import AdminHeader from '@/components/layout/AdminHeader';

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAnyRole(['admin', 'support']);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      <SupportSidebar email={user.email} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader email={user.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

