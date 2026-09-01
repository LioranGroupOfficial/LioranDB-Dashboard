'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Database,
  BarChart3,
  CreditCard,
  LifeBuoy,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
} from 'lucide-react';
import type { OnboardingStage, UserRole } from '@/lib/db/models/User';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requireStage?: OnboardingStage[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Application & Form',
    href: '/application',
    icon: FileText,
    requireStage: ['APPLICATION_REQUIRED', 'APPLICATION_PENDING', 'APPLICATION_REJECTED', 'APPLICATION_APPROVED'],
  },
  {
    label: 'Managed Database',
    href: '/database',
    icon: Database,
    requireStage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'],
  },
  {
    label: 'Metrics & Usage',
    href: '/usage',
    icon: BarChart3,
    requireStage: ['ACTIVE'],
  },
  {
    label: 'Billing & Invoices',
    href: '/billing',
    icon: CreditCard,
    requireStage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'],
  },
  { label: 'Developer Support', href: '/support', icon: LifeBuoy },
  { label: 'Account Settings', href: '/account', icon: Settings },
];

interface Props {
  stage: OnboardingStage;
  role: UserRole;
}

export default function CustomerSidebar({ stage, role }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('lioran_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('lioran_sidebar_collapsed', String(next));
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.requireStage) return true;
    return item.requireStage.includes(stage);
  });

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
      {/* Brand Header & Toggle */}
      <div className="h-14 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--border)]">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-[var(--accent)] text-black font-bold flex items-center justify-center">
              <Database className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              Lioran<span className="text-[var(--accent)]">DB</span>
            </span>
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

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visibleItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
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

