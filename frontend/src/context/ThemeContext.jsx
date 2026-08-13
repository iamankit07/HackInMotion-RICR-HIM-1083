import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'lakshya-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext(null);

/**
 * Three states, not two: light, dark, or follow the machine.
 *
 * Warm paper is the default look, and it is what the stylesheet paints when no
 * theme is forced. Someone whose whole laptop is in dark mode gets dark without
 * having to ask, and the moment they touch the toggle their choice is stored
 * and outranks the operating system from then on.
 */

function readPreference() {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [system, setSystem] = useState(systemTheme);

  // Keep following the machine while no explicit choice has been made — someone
  // switching their laptop to dark at night should see this switch with it.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const update = (event) => setSystem(event.matches ? 'dark' : 'light');

    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const theme = preference === 'system' ? system : preference;

  useEffect(() => {
    const root = document.documentElement;

    if (preference === 'system') {
      // No attribute at all, so the stylesheet's own light default and its
      // prefers-color-scheme rule decide.
      delete root.dataset.theme;
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      root.dataset.theme = preference;
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      followsSystem: preference === 'system',
      toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
      followSystem: () => setPreference('system'),
    }),
    [theme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
