'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  Activity,
  CreditCard,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import type { OnboardingStage, UserRole } from '@/lib/db/models/User';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Databases', href: '/database', icon: Database },
  { label: 'Billing & Invoices', href: '/billing', icon: CreditCard },
  { label: 'Account', href: '/account', icon: Settings },
];

interface Props {
  stage?: OnboardingStage;
  role?: UserRole;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function CustomerSidebar({ mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lioran_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [estimatedPaise, setEstimatedPaise] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/billing/estimate')
      .then((r) => r.json())
      .then((d) => {
        if (mounted && typeof d.totalEstimatedPaise === 'number') {
          setEstimatedPaise(d.totalEstimatedPaise);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('lioran_sidebar_collapsed', String(next));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`sticky top-0 z-40 hidden h-dvh min-h-0 shrink-0 flex-col self-start overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 select-none md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header & Toggle */}
        <div className="h-14 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--border)]">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-[6px] bg-[var(--surface-soft)] text-[var(--text-strong)] font-bold flex items-center justify-center border border-[var(--border)] shadow-xs overflow-hidden shrink-0">
                <img src="/favicon.ico" alt="LCS" className="w-4 h-4 object-contain" />
              </div>
              <span className="text-base font-bold tracking-tight text-[var(--text-strong)] font-sans">
                LCS
              </span>
            </Link>
          ) : (
            <div className="w-7 h-7 rounded-[6px] bg-[var(--surface-soft)] text-[var(--text-strong)] font-bold flex items-center justify-center mx-auto border border-[var(--border)] shadow-xs overflow-hidden">
              <img src="/favicon.ico" alt="LCS" className="w-4 h-4 object-contain" />
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors ${
              collapsed ? 'hidden' : 'block'
            }`}
            aria-label="Toggle sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {collapsed && (
          <div className="flex shrink-0 justify-center border-b border-[var(--border)] py-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-2">
          {NAV_ITEMS.map((item) => {
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
                  collapsed ? 'justify-center px-0' : 'px-3.5'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? 'text-[var(--on-primary)]' : 'text-[var(--muted)] group-hover:text-[var(--ink)]'
                  }`}
                />
                {!collapsed && (
                  <span className="text-xs font-semibold truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Current Month Estimated Usage Pill */}
        {!collapsed && estimatedPaise !== null && (
          <div className="mx-2 mb-2 shrink-0 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <Activity className="w-3 h-3 text-[var(--primary)]" />
                Month Estimate
              </span>
              <span className="badge badge-default text-[9px] py-0 px-1">
                POSTPAID
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-[var(--text-primary)]">
              ₹{(estimatedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Sticky Bottom Actions */}
        <div className="mt-auto shrink-0 border-t border-[var(--border)] bg-[var(--sidebar-bg)] p-3">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`sidebar-link w-full text-left text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] rounded-[7px] cursor-pointer ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
            {!collapsed && <span className="text-xs font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex h-dvh overflow-hidden overscroll-y-none md:hidden">
          <div
            className="fixed inset-0 touch-none bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          <aside className="relative z-50 flex h-full min-h-0 w-64 max-w-[80vw] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-2xl select-none">
            <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)]">
              <Link
                href="/dashboard"
                onClick={onMobileClose}
                className="flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-[6px] bg-[var(--surface-soft)] text-[var(--text-strong)] font-bold flex items-center justify-center border border-[var(--border)] shadow-xs overflow-hidden shrink-0">
                  <img src="/favicon.ico" alt="LCS" className="w-4 h-4 object-contain" />
                </div>
                <span className="text-base font-bold tracking-tight text-[var(--text-strong)] font-sans">
                  LCS
                </span>
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-card)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-2">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`sidebar-link ${active ? 'active' : ''} px-3.5`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-[var(--on-primary)]' : 'text-[var(--muted)] group-hover:text-[var(--ink)]'
                      }`}
                    />
                    <span className="text-xs font-medium truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {estimatedPaise !== null && (
              <div className="mx-3 mb-2 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                    <Activity className="w-3 h-3 text-[var(--primary)]" />
                    Month Estimate
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted)] font-mono">
                    Postpaid
                  </span>
                </div>
                <p className="font-serif text-sm font-bold text-[var(--text-primary)]">
                  ₹{(estimatedPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <div className="mt-auto shrink-0 border-t border-[var(--border)] bg-[var(--sidebar-bg)] p-3">
              <button
                onClick={handleLogout}
                className="sidebar-link w-full text-left text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] px-3.5 rounded-[7px] cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                <span className="text-xs font-medium">Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
