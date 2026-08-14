import { Card, CardHeader } from './ui/Card.jsx';
import { formatMinutes } from '../lib/format.js';

/**
 * Streak, points and badges.
 *
 * The streak is the part that actually changes behaviour, so it leads. Badges
 * that have not been earned are still shown, greyed, with what they take —
 * a locked door you can see through is motivating, one you cannot is just
 * absent.
 */
export function Achievements({ achievements, compact = false }) {
  if (!achievements) return null;

  const { currentStreak, longestStreak, studiedToday, points, badges, badgesEarned, badgesTotal } =
    achievements;

  return (
    <Card className="p-6">
      <CardHeader eyebrow="Keeping it up" title="Your streak" />

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold text-ink">{currentStreak}</span>
            <span className="text-sm text-ink-muted">
              {currentStreak === 1 ? 'day' : 'days'} in a row
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {studiedToday
              ? 'Today is counted. Come back tomorrow to keep it going.'
              : currentStreak > 0
                ? 'Do anything today and it carries on.'
                : 'Finish one session today and it starts.'}
          </p>
        </div>

        <Stat label="Best run" value={`${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`} />
        <Stat label="Points" value={points.toLocaleString()} />
        <Stat label="Badges" value={`${badgesEarned}/${badgesTotal}`} />
      </div>

      {!compact && (
        <>
          <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
            <Tally label="Sessions done" value={achievements.sessionsCompleted} />
            <Tally label="Time studied" value={formatMinutes(achievements.minutesStudied)} />
            <Tally label="Topics solid" value={achievements.topicsMastered} />
          </div>

          <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            {badges.map((badge) => (
              <li key={badge.key}>
                <span
                  title={badge.earned ? badge.name : badge.hint}
                  className={[
                    'ease-lakshya inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition',
                    badge.earned
                      ? 'border-saffron/40 bg-saffron-soft font-medium text-saffron'
                      : 'border-line text-ink-muted',
                  ].join(' ')}
                >
                  <span aria-hidden="true">{badge.earned ? '●' : '○'}</span>
                  {badge.name}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-ink-muted">
            Hover any badge you haven&rsquo;t earned yet to see what it takes.
          </p>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Tally({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-ink">{value}</p>
    </div>
  );
}
