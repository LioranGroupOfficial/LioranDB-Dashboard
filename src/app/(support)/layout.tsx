import type { Metadata } from 'next';
import { requireAnyRole } from '@/lib/auth/guards';
import SupportShell from '@/components/layout/SupportShell';

export const metadata: Metadata = {
  title: {
    default: 'Support Engineering Console',
    template: '%s — Support | LioranDB',
  },
  description: 'LioranDB Developer Support & Application Review Console',
  robots: { index: false, follow: false },
};

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAnyRole(['admin', 'support']);

  return (
    <SupportShell email={user.email}>
      {children}
    </SupportShell>
  );
}
