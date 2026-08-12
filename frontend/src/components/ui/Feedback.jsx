import { Button } from './Button.jsx';

export function Spinner({ className = '' }) {
  return (
    <svg className={['h-5 w-5 animate-spin text-saffron', className].join(' ')} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted" role="status">
      <Spinner />
      {label}
    </div>
  );
}

const NOTICE_TONES = {
  error: 'border-clay/30 bg-clay-soft text-clay',
  warn: 'border-amber/40 bg-amber/10 text-ink',
  info: 'border-line bg-sunk text-ink-soft',
  success: 'border-teal/30 bg-teal-soft text-teal',
};

/**
 * The one place errors get shown. Anything the API sends back as a message is
 * written to be read by a student, so it is displayed as-is.
 */
export function Notice({ tone = 'error', title, children, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className={['grain-free rounded-xl border px-4 py-3 text-sm', NOTICE_TONES[tone]].join(' ')} role="alert">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children && <div className="[&_p]:mt-1 first:[&_p]:mt-0">{children}</div>}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="grain-free flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <Rings />
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** The target motif, used wherever a screen has nothing to show yet. */
function Rings() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" className="text-line-strong">
      <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="26" cy="26" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="26" cy="26" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="26" cy="26" r="2.5" fill="var(--saffron)" />
    </svg>
  );
}
