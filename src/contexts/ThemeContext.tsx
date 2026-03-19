import { useEffect, useMemo, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme: Theme = 'dark';
  const effectiveTheme: Theme = 'dark';
  const isDarkModeAvailable = true;

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.add('dark');
  }, []);

  const setTheme = () => {
    // no-op: single dark theme
  };

  const toggleTheme = () => {
    // no-op: single dark theme
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDarkModeAvailable,
      effectiveTheme
    }),
    [theme, isDarkModeAvailable, effectiveTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
