import { requireAnyRole } from '@/lib/auth/guards';
import SupportShell from '@/components/layout/SupportShell';

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



