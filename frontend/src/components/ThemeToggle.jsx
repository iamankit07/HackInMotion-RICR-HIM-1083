import { useTheme } from '../context/ThemeContext.jsx';

/** Icon shown is the theme a click switches *to*, matching the Button ghost style. */
export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light view' : 'Switch to dark view'}
      title={isDark ? 'Switch to light view' : 'Switch to dark view'}
      className={[
        'ease-lakshya inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        'border border-line-strong text-ink-soft transition duration-200',
        'hover:-translate-y-px hover:border-ink hover:bg-sunk hover:text-ink active:translate-y-0',
        className,
      ].join(' ')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.5v2.6" />
        <path d="M12 18.9v2.6" />
        <path d="M4.6 4.6l1.85 1.85" />
        <path d="M17.55 17.55l1.85 1.85" />
        <path d="M2.5 12h2.6" />
        <path d="M18.9 12h2.6" />
        <path d="M4.6 19.4l1.85-1.85" />
        <path d="M17.55 6.45l1.85-1.85" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 1 0 10.5 10.5Z" fill="currentColor" />
    </svg>
  );
}
