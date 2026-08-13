import { Link } from 'react-router-dom';

import { Button } from './ui/Button.jsx';
import { SESSION_LABELS, SESSION_TONES, formatMinutes } from '../lib/format.js';

/**
 * One study session. The `reason` line is the whole point — a block of time
 * with an explanation attached is a plan, the same block without one is a
 * timetable someone else wrote.
 */
export function SessionRow({ session, busy, onComplete, onUndo, onAsk, exploreTo }) {
  const done = session.status === 'completed';

  return (
    <li
      className={[
        'ease-lakshya rounded-xl border p-4 transition duration-200',
        done ? 'border-line bg-sunk/60' : 'border-line bg-surface hover:border-line-strong',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
                SESSION_TONES[session.kind],
              ].join(' ')}
            >
              {SESSION_LABELS[session.kind]}
            </span>
            <span className="text-xs tabular-nums text-ink-muted">
              {formatMinutes(session.minutes)}
            </span>
          </div>

          <h3
            className={[
              'mt-2 text-[0.9375rem] font-semibold',
              done ? 'text-ink-muted line-through' : 'text-ink',
            ].join(' ')}
          >
            {exploreTo && !done ? (
              <Link to={exploreTo} className="underline-offset-4 hover:text-saffron hover:underline">
                {session.title}
              </Link>
            ) : (
              session.title
            )}
          </h3>

          {session.reason && !done && (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{session.reason}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {onAsk && !done && (
            <Button variant="ghost" size="sm" onClick={onAsk}>
              Ask
            </Button>
          )}

          {done ? (
            <Button variant="ghost" size="sm" loading={busy} onClick={onUndo}>
              Undo
            </Button>
          ) : (
            <Button variant="outline" size="sm" loading={busy} onClick={onComplete}>
              Mark done
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
