'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Applications', href: '/admin/applications' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Provisioning', href: '/admin/provisioning' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Audit Log', href: '/admin/audit' },
  { label: 'Policies', href: '/admin/policies' },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside
      className="w-56 shrink-0 border-r flex flex-col"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', minHeight: '100vh' }}
    >
      <div className="h-14 flex items-center px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <span className="text-base font-semibold" style={{ color: 'var(--accent)' }}>
            LioranDB
          </span>
          <span className="text-xs ml-2 badge badge-pending">Admin</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((item) => {
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${active ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link href="/dashboard" className="sidebar-link mb-1">
          <span className="text-xs">←</span>
          <span className="text-xs">Customer view</span>
        </Link>
        <button onClick={handleLogout} className="sidebar-link w-full text-left">
          Sign out
        </button>
      </div>
    </aside>
  );
}
