'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LifeBuoy,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  X,
} from 'lucide-react';

const NAV = [
  { label: 'Tickets Queue', href: '/support-console', icon: LifeBuoy },
  { label: 'Application Reviews', href: '/support-console/applications', icon: FileText },
];

interface Props {
  email: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function SupportSidebar({ email, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lioran_support_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('lioran_support_sidebar_collapsed', String(next));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
      {NAV.map((item) => {
        const active =
          item.href === '/support-console'
            ? pathname === '/support-console'
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
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
              }`}
            />
            {(isMobile || !collapsed) && (
              <span className="text-xs font-semibold truncate">{item.label}</span>
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
        {/* Brand Header */}
        <div className="h-14 shrink-0 flex items-center justify-between px-3.5 border-b border-[var(--border)]">
          {!collapsed ? (
            <Link href="/support-console" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-[var(--brand-green)] text-[var(--on-primary)] font-bold flex items-center justify-center shadow-sm shadow-[var(--brand-green)]/20">
                <Database className="w-4 h-4 text-[var(--on-primary)]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  Lioran<span className="text-[var(--accent)]">DB</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-[var(--info)] border border-sky-500/30 font-mono font-bold">
                  SUPPORT
                </span>
              </div>
            </Link>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[var(--brand-green)] text-[var(--on-primary)] font-bold flex items-center justify-center mx-auto shadow-sm shadow-[var(--brand-green)]/20">
              <Database className="w-4 h-4 text-[var(--on-primary)]" />
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors ${
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
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <NavLinks />

        {/* Sticky Bottom Actions */}
        <div className="p-3 border-t border-[var(--border)] mt-auto bg-[var(--sidebar-bg)]">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-full ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-red-500" />
            {!collapsed && <span className="text-xs font-semibold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col h-full z-50 select-none shadow-2xl">
            <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)]">
              <Link
                href="/support-console"
                onClick={onMobileClose}
                className="flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-[var(--brand-green)] text-[var(--on-primary)] font-bold flex items-center justify-center">
                  <Database className="w-4 h-4 text-[var(--on-primary)]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                    Lioran<span className="text-[var(--accent)]">DB</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-[var(--info)] border border-sky-500/30 font-mono font-bold">
                    SUPPORT
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <NavLinks isMobile />

            <div className="p-3 border-t border-[var(--border)] mt-auto bg-[var(--sidebar-bg)]">
              <button
                onClick={handleLogout}
                className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-500/10 px-3.5 rounded-full"
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                <span className="text-xs font-semibold">Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
