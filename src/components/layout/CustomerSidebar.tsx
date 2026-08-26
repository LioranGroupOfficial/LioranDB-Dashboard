'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { OnboardingStage, UserRole } from '@/lib/db/models/User';

interface NavItem {
  label: string;
  href: string;
  requireStage?: OnboardingStage[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard' },
  {
    label: 'Managed Database',
    href: '/database',
    requireStage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'],
  },
  {
    label: 'Usage',
    href: '/usage',
    requireStage: ['ACTIVE'],
  },
  {
    label: 'Billing',
    href: '/billing',
    requireStage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'],
  },
  { label: 'Support', href: '/support' },
  { label: 'Account', href: '/account' },
];

const ALWAYS_SHOW_STAGES: OnboardingStage[] = [
  'EMAIL_VERIFICATION',
  'APPLICATION_REQUIRED',
  'APPLICATION_PENDING',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'TERMS_REQUIRED',
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
];

interface Props {
  stage: OnboardingStage;
  role: UserRole;
}

export default function CustomerSidebar({ stage, role }: Props) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.requireStage) return true;
    return item.requireStage.includes(stage);
  });

  return (
    <aside
      className="w-56 shrink-0 border-r flex flex-col"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        minHeight: '100vh',
      }}
    >
      <div
        className="h-14 flex items-center px-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-base font-semibold" style={{ color: 'var(--accent)' }}>
          LioranDB
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {visibleItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${active ? ' active' : ''}`}
            >
              <NavIcon href={item.href} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {(role === 'admin' || role === 'support') && (
          <Link
            href={role === 'admin' ? '/admin' : '/support-console'}
            className="sidebar-link mb-1"
          >
            <span className="text-xs">⚙</span>
            <span className="text-xs">{role === 'admin' ? 'Admin Panel' : 'Support Console'}</span>
          </Link>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}

function NavIcon({ href }: { href: string }) {
  const icons: Record<string, string> = {
    '/dashboard': '○',
    '/database': '◎',
    '/usage': '△',
    '/billing': '◇',
    '/support': '◈',
    '/account': '◉',
  };
  return (
    <span className="text-xs opacity-60" aria-hidden>
      {icons[href] || '·'}
    </span>
  );
}

function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <button onClick={handleLogout} className="sidebar-link w-full text-left">
      <span className="text-xs opacity-60" aria-hidden>←</span>
      <span>Sign out</span>
    </button>
  );
}
