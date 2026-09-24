'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  CreditCard,
  LifeBuoy,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Wallet as WalletIcon,
  Plus,
} from 'lucide-react';
import type { OnboardingStage, UserRole } from '@/lib/db/models/User';
import AddCreditsModal from '@/components/wallet/AddCreditsModal';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Databases', href: '/database', icon: Database },
  { label: 'Billing & Credits', href: '/billing', icon: CreditCard },
  { label: 'Developer Support', href: '/support', icon: LifeBuoy },
  { label: 'Account Settings', href: '/account', icon: Settings },
];

interface Props {
  stage?: OnboardingStage;
  role?: UserRole;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function CustomerSidebar({ mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [balancePaise, setBalancePaise] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lioran_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }

    // Fetch live wallet balance
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.balancePaise === 'number') {
          setBalancePaise(d.balancePaise);
        }
      })
      .catch(() => {});
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

  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
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
            onClick={() => {
              if (isMobile && onMobileClose) onMobileClose();
            }}
            title={!isMobile && collapsed ? item.label : undefined}
            className={`sidebar-link ${active ? 'active' : ''} ${
              !isMobile && collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                active ? 'text-[var(--primary)]' : 'text-[var(--muted)] group-hover:text-[var(--ink)]'
              }`}
            />
            {(isMobile || !collapsed) && (
              <span className="text-xs font-medium truncate">{item.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:flex h-screen sticky top-0 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] flex-col z-20 transition-all duration-200 select-none ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header & Toggle */}
        <div className="h-14 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--border)]">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] font-bold flex items-center justify-center shadow-xs">
                <Database className="w-4 h-4 text-[var(--on-primary)]" />
              </div>
              <span className="text-base font-normal font-serif tracking-tight text-[var(--text-primary)]">
                Lioran<span className="text-[var(--primary)] italic">DB</span>
              </span>
            </Link>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] font-bold flex items-center justify-center mx-auto shadow-xs">
              <Database className="w-4 h-4 text-[var(--on-primary)]" />
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-card)] transition-colors ${
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
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-card)] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <NavLinks />

        {/* Compact Wallet Credits Section */}
        {!collapsed ? (
          <div className="p-3 mx-2 mb-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <WalletIcon className="w-3 h-3 text-[var(--primary)]" />
                Credits
              </span>
              <AddCreditsModal
                buttonText="+ Add"
                className="text-[11px] font-mono text-[var(--primary)] hover:underline cursor-pointer bg-transparent border-0 p-0 shadow-none font-semibold"
                onSuccess={(newBal) => setBalancePaise(newBal)}
              />
            </div>
            <p className="font-serif text-base font-bold text-[var(--text-primary)]">
              {balancePaise !== null
                ? `₹${(balancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                : '...'}
            </p>
          </div>
        ) : (
          <div className="py-2 flex justify-center border-t border-[var(--border)]">
            <AddCreditsModal
              buttonText=""
              className="p-2 rounded-lg text-[var(--primary)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer bg-transparent border-0 shadow-none"
              onSuccess={(newBal) => setBalancePaise(newBal)}
            />
          </div>
        )}

        {/* Sticky Bottom Actions */}
        <div className="p-3 border-t border-[var(--border)] mt-auto bg-[var(--sidebar-bg)]">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg cursor-pointer ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-red-500" />
            {!collapsed && <span className="text-xs font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="relative w-64 max-w-[80vw] bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col h-full z-50 select-none shadow-2xl">
            <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)]">
              <Link
                href="/dashboard"
                onClick={onMobileClose}
                className="flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] font-bold flex items-center justify-center">
                  <Database className="w-4 h-4 text-[var(--on-primary)]" />
                </div>
                <span className="text-base font-normal font-serif tracking-tight text-[var(--text-primary)]">
                  Lioran<span className="text-[var(--primary)] italic">DB</span>
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

            <NavLinks isMobile />

            <div className="p-3 mx-3 mb-2 rounded-xl bg-[var(--surface-card)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                  <WalletIcon className="w-3 h-3 text-[var(--primary)]" />
                  Credits
                </span>
                <AddCreditsModal
                  buttonText="+ Add"
                  className="text-[11px] font-mono text-[var(--primary)] hover:underline cursor-pointer bg-transparent border-0 p-0 shadow-none font-semibold"
                  onSuccess={(newBal) => setBalancePaise(newBal)}
                />
              </div>
              <p className="font-serif text-base font-bold text-[var(--text-primary)]">
                {balancePaise !== null
                  ? `₹${(balancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : '...'}
              </p>
            </div>

            <div className="p-3 border-t border-[var(--border)] mt-auto bg-[var(--sidebar-bg)]">
              <button
                onClick={handleLogout}
                className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-500/10 px-3.5 rounded-lg cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                <span className="text-xs font-medium">Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
