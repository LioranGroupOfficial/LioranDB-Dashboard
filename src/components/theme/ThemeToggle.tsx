'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center opacity-70 shrink-0 ${className}`}>
        <Sun className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer select-none shrink-0 ${className}`}
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--slate)] animate-in spin-in-180 duration-200" />
      )}
    </button>
  );
}

