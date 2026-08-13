import { useId, useState } from 'react';

const CONTROL =
  'ease-lakshya w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink transition ' +
  'placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-saffron/30';

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {children({ id, invalid: Boolean(error) })}

      {error ? (
        <p className="text-[0.8125rem] text-clay">{error}</p>
      ) : (
        hint && <p className="text-[0.8125rem] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

export function Input({ invalid, className = '', ...props }) {
  return (
    <input
      className={[CONTROL, invalid ? 'border-clay' : 'border-line focus:border-saffron', className].join(' ')}
      {...props}
    />
  );
}

/**
 * A password box you can look inside.
 *
 * Typing a password blind on a phone keyboard is where most failed sign-ins
 * come from, so the eye is there from the start rather than after a mistake.
 * It reverts to hidden on submit — the value should not stay on screen.
 */
export function PasswordInput({ invalid, className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={[
          CONTROL,
          'pr-11',
          invalid ? 'border-clay' : 'border-line focus:border-saffron',
          className,
        ].join(' ')}
        {...props}
      />

      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        // Not in the tab order: someone tabbing from the password field expects
        // the submit button next, not a toggle.
        tabIndex={-1}
        className="ease-lakshya absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition hover:bg-sunk hover:text-ink"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.65 3.42M6.5 7.1A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.83-.4 4-1.02"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.1 10.1a2.7 2.7 0 0 0 3.8 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Textarea({ invalid, className = '', ...props }) {
  return (
    <textarea
      rows={3}
      className={[
        CONTROL,
        'resize-y',
        invalid ? 'border-clay' : 'border-line focus:border-saffron',
        className,
      ].join(' ')}
      {...props}
    />
  );
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select
      className={[CONTROL, invalid ? 'border-clay' : 'border-line focus:border-saffron', className].join(' ')}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * The confidence and weekday pickers. Reads better than a select for a small
 * fixed set, and gives a bigger tap target on a phone.
 */
export function ChoiceGroup({ options, value, onChange, multiple = false, className = '' }) {
  const isSelected = (option) => (multiple ? value.includes(option.value) : value === option.value);

  const toggle = (option) => {
    if (!multiple) {
      return onChange(option.value);
    }

    return onChange(
      value.includes(option.value)
        ? value.filter((entry) => entry !== option.value)
        : [...value, option.value],
    );
  };

  return (
    <div className={['flex flex-wrap gap-2', className].join(' ')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option)}
          aria-pressed={isSelected(option)}
          className={[
            'ease-lakshya rounded-full border px-3.5 py-2 text-sm transition duration-200',
            isSelected(option)
              ? 'border-ink bg-ink text-paper'
              : 'border-line text-ink-soft hover:border-line-strong hover:text-ink',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
