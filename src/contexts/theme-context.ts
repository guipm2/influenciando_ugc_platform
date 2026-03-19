import { createContext } from 'react';

export type Theme = 'dark';

export type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkModeAvailable: boolean;
  effectiveTheme: Theme;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
