const VARIANTS = {
  primary:
    'bg-ink text-paper hover:-translate-y-px hover:shadow-[var(--shadow-lift)] active:translate-y-0',
  accent:
    'bg-saffron text-on-accent hover:-translate-y-px hover:shadow-[var(--shadow-lift)] active:translate-y-0',
  outline: 'border border-line-strong text-ink hover:border-ink hover:bg-sunk',
  // Ghost is the quietest button, but it still has to look like one. With no
  // resting border or fill it reads as plain text and people only discover it
  // by accidentally hovering, so it keeps a faint outline of its own.
  ghost:
    'border border-line bg-sunk/50 text-ink-soft hover:border-line-strong hover:bg-sunk hover:text-ink',
  danger: 'border border-clay/40 text-clay hover:bg-clay-soft',
};

const SIZES = {
  sm: 'h-8 px-3 text-[0.8125rem]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'ease-lakshya inline-flex items-center justify-center gap-2 rounded-full font-medium',
        'transition duration-200 disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
