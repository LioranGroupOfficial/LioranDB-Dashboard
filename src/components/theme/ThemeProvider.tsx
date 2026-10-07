'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(newTheme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (newTheme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        return (localStorage.getItem('lioran_theme') as Theme) || 'light';
      } catch {
        return 'light';
      }
    }
    return 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('lioran_theme', newTheme);
    } catch {}
  }

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
