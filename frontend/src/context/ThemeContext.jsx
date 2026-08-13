import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'lakshya-theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

/**
 * Dark is the default look. Light is an explicit opt-in the visitor picks
 * with the toggle, not something derived from OS preference, so it stays
 * put across visits via localStorage.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
