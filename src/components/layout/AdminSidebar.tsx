'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Server,
  CreditCard,
  LifeBuoy,
  Shield,
  Scale,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
} from 'lucide-react';

const NAV = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Applications', href: '/admin/applications', icon: FileText },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Provisioning', href: '/admin/provisioning', icon: Server },
  { label: 'Billing & Payments', href: '/admin/billing', icon: CreditCard },
  { label: 'Support Tickets', href: '/admin/support', icon: LifeBuoy },
  { label: 'Audit Log', href: '/admin/audit', icon: Shield },
  { label: 'Policies', href: '/admin/policies', icon: Scale },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lioran_admin_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('lioran_admin_sidebar_collapsed', String(next));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside
      className={`h-screen sticky top-0 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col z-20 transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--border)]">
        {!collapsed ? (
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-[var(--accent)] text-black font-bold flex items-center justify-center">
              <Database className="w-4 h-4 text-black" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                Lioran<span className="text-[var(--accent)]">DB</span>
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded-sm bg-amber-950 text-amber-300 border border-amber-800 font-mono ml-1.5 font-bold">
                ADMIN
              </span>
            </div>
          </Link>
        ) : (
          <div className="w-7 h-7 rounded-sm bg-[var(--accent)] text-black font-bold flex items-center justify-center mx-auto">
            <Database className="w-4 h-4 text-black" />
          </div>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors ${
            collapsed ? 'hidden' : 'block'
          }`}
          aria-label="Toggle sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {collapsed && (
        <div className="py-2 flex justify-center border-b border-[var(--border)]">
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`sidebar-link ${active ? 'active' : ''} ${
                collapsed ? 'justify-center px-0' : 'px-3'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              />
              {!collapsed && (
                <span className="text-xs font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sticky Bottom Actions */}
      <div className="p-2 border-t border-[var(--border)] mt-auto bg-[var(--surface)]">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={`sidebar-link w-full text-left text-red-400/90 hover:text-red-300 hover:bg-red-950/30 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0 text-red-400" />
          {!collapsed && <span className="text-xs font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

