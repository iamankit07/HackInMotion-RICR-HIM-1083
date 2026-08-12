import { useId } from 'react';

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
