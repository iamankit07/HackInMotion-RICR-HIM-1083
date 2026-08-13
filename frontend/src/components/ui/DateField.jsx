import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A date box with a calendar that belongs to this interface.
 *
 * The native control is kept underneath, so typing a date still works and a
 * phone still gets its own wheel picker — but its indicator is hidden, because
 * a browser-drawn icon renders near-black regardless of theme and disappears
 * against the dark palette. The calendar drawn here is the visible one.
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parses YYYY-MM-DD as a local date. `new Date(string)` would read it as UTC. */
function parseISO(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const toISO = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Monday-first offset, since the study-day pickers elsewhere start on Monday. */
const leadingBlanks = (date) => (date.getDay() + 6) % 7;

export function DateField({ id, value, onChange, min, max, invalid, className = '' }) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [cursor, setCursor] = useState(() => selected ?? new Date());
  const wrapRef = useRef(null);

  const minDate = parseISO(min);
  const maxDate = parseISO(max);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const outOfRange = (date) => (minDate && date < minDate) || (maxDate && date > maxDate);

  /** Opening lands on the chosen date's month rather than wherever it was last. */
  const openCalendar = () => {
    if (selected) setCursor(selected);
    setOpen(true);
  };

  /**
   * Touching the field should show the calendar without having to find the
   * icon. Only on pointer devices though: a phone opens its own date wheel on
   * tap, and ours underneath it means two pickers fighting over one field.
   */
  const openIfPointerDevice = () => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      openCalendar();
    }
  };

  const pick = (date) => {
    onChange({ target: { value: toISO(date) } });
    setOpen(false);
  };

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const shiftMonth = (by) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + by, 1));

  // Whole months outside the range are not worth navigating to.
  const prevDisabled = minDate && new Date(cursor.getFullYear(), cursor.getMonth(), 0) < minDate;
  const nextDisabled = maxDate && new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) > maxDate;

  return (
    <div ref={wrapRef} className={['relative', className].join(' ')}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        onFocus={openIfPointerDevice}
        onClick={openIfPointerDevice}
        className={[
          'ease-lakshya w-full rounded-xl border bg-surface px-3.5 py-2.5 pr-11 text-sm text-ink transition',
          'focus:outline-none focus:ring-2 focus:ring-saffron/30',
          '[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden',
          invalid ? 'border-clay' : 'border-line focus:border-saffron',
        ].join(' ')}
      />

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        aria-label={open ? 'Close calendar' : 'Open calendar'}
        aria-expanded={open}
        tabIndex={-1}
        className={[
          'ease-lakshya absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center',
          'rounded-lg transition hover:bg-sunk',
          open ? 'bg-sunk text-saffron' : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        <CalendarIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute left-0 top-full z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-lift)]"
        >
          <div className="flex items-center justify-between gap-2">
            <MonthButton onClick={() => shiftMonth(-1)} disabled={prevDisabled} label="Previous month">
              ‹
            </MonthButton>

            <p className="text-sm font-semibold text-ink">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>

            <MonthButton onClick={() => shiftMonth(1)} disabled={nextDisabled} label="Next month">
              ›
            </MonthButton>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day, index) => (
              <span
                key={index}
                className="flex h-7 items-center justify-center text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-muted"
              >
                {day}
              </span>
            ))}

            {Array.from({ length: leadingBlanks(firstOfMonth) }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = new Date(cursor.getFullYear(), cursor.getMonth(), index + 1);
              const disabled = outOfRange(date);
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);

              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(date)}
                  aria-current={isToday ? 'date' : undefined}
                  className={[
                    'ease-lakshya flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition duration-150',
                    disabled && 'cursor-not-allowed text-ink-muted/40',
                    !disabled && isSelected && 'bg-saffron font-semibold text-white',
                    !disabled && !isSelected && isToday && 'border border-saffron/50 text-ink hover:bg-sunk',
                    !disabled && !isSelected && !isToday && 'text-ink-soft hover:bg-sunk hover:text-ink',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <p className="text-xs text-ink-muted">
              {selected ? selected.toDateString().slice(0, 10) : 'No date chosen'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ease-lakshya rounded-lg px-2.5 py-1 text-xs text-ink-soft transition hover:bg-sunk hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="ease-lakshya flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:border-line-strong hover:bg-sunk hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
    >
      <span aria-hidden="true" className="text-base leading-none">{children}</span>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.2" y="5" width="17.6" height="16" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.2 9.6h17.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v3.6M16 3v3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
