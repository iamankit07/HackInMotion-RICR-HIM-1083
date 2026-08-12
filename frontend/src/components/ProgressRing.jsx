/**
 * The signature element: progress drawn as an arrow closing on a target, which
 * is what the name means. Used for overall plan completion and, at a smaller
 * size, for per-topic mastery.
 */
export function ProgressRing({ value, size = 132, label, caption, tone = 'saffron' }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = size < 70 ? 5 : 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <div className="grain-free inline-flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`var(--${tone})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
          />
          {/* The inner rings that make it read as a target rather than a donut. */}
          {size >= 100 && (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius - stroke * 2}
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                opacity="0.8"
              />
              <circle cx={size / 2} cy={size / 2} r={radius - stroke * 4} fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.5" />
            </>
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-semibold text-ink"
            style={{ fontSize: size < 70 ? '0.875rem' : '1.75rem' }}
          >
            {percent}
            <span className="text-ink-muted" style={{ fontSize: '0.6em' }}>
              %
            </span>
          </span>
          {label && size >= 100 && <span className="eyebrow mt-0.5">{label}</span>}
        </div>
      </div>

      {caption && <p className="text-center text-sm text-ink-muted">{caption}</p>}
    </div>
  );
}

/** Slim horizontal bar, for per-topic mastery inside a list. */
export function MasteryBar({ value, tone }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const colour = tone ?? (percent >= 85 ? 'teal' : percent >= 50 ? 'amber' : 'clay');

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: `var(--${colour})`,
            transition: 'width 600ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-ink-muted">{percent}%</span>
    </div>
  );
}
