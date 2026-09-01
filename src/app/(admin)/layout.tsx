import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/guards';
import AdminShell from '@/components/layout/AdminShell';

export const metadata: Metadata = {
  title: {
    default: 'Admin Control Center',
    template: '%s — Admin | LioranDB',
  },
  description: 'LioranDB Infrastructure Administration & Provisioning Center',
  robots: { index: false, follow: false },
};

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
