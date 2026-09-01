import { requireRole } from '@/lib/auth/guards';
import AdminShell from '@/components/layout/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole('admin');

  return (
    <AdminShell email={user.email}>
      {children}
    </AdminShell>
  );
}


