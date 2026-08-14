import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, Loading, Notice } from '../components/ui/Feedback.jsx';
import { ProgressRing } from '../components/ProgressRing.jsx';
import { QuickDoubt } from '../components/QuickDoubt.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { daysUntil, formatDate } from '../lib/format.js';

const STATUS_COPY = {
  draft: { label: 'Needs topics', tone: 'text-amber' },
  assessing: { label: 'Ready for the diagnostic', tone: 'text-saffron' },
  active: { label: 'In progress', tone: 'text-teal' },
  completed: { label: 'Finished', tone: 'text-ink-muted' },
  archived: { label: 'Archived', tone: 'text-ink-muted' },
};

// Below this many goals the list fits on a screen and a search box is clutter.
const SEARCH_APPEARS_AT = 4;

export default function Dashboard() {
  const { data, error, loading, reload } = useResource(() => api.goals.list(), []);
  const [query, setQuery] = useState('');

  if (loading) return <Loading label="Loading your goals" />;

  if (error) {
    return <Notice title="We could not load your goals" onRetry={reload}>{error.message}</Notice>;
  }

  const goals = data?.goals ?? [];
  const matches = filterGoals(goals, query);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your goals</p>
          <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">What are we working towards?</h1>
        </div>

        <Link to="/goals/new">
          <Button variant="accent">New goal</Button>
        </Link>
      </header>

      {/* Not worth a search box until scrolling is actually a chore. */}
      {goals.length >= SEARCH_APPEARS_AT && (
        <GoalSearch
          value={query}
          onChange={setQuery}
          resultCount={matches.length}
          total={goals.length}
        />
      )}

      {goals.length === 0 ? (
        <EmptyState
          title="Nothing on the board yet"
          action={
            <Link to="/goals/new">
              <Button variant="accent">Set your first goal</Button>
            </Link>
          }
        >
          Tell Lakshya what you are preparing for and how long you have. It will work out the rest.
        </EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState
          title={`Nothing matches “${query.trim()}”`}
          action={
            <Button variant="outline" onClick={() => setQuery('')}>
              Clear the search
            </Button>
          }
        >
          Try part of the subject, the exam, or a topic name.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {matches.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </ul>
      )}

      <QuickDoubt />
    </div>
  );
}

/**
 * Matches on the subject, the exam, and the topic titles — someone hunting for
 * "brachial plexus" is looking for the anatomy goal, not a goal with that name.
 */
function filterGoals(goals, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return goals;

  const words = needle.split(/\s+/);

  return goals.filter((goal) => {
    const haystack = [
      goal.subject,
      goal.examType,
      ...(goal.topics ?? []).map((topic) => topic.title),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Every word has to appear somewhere, so extra words narrow rather than widen.
    return words.every((word) => haystack.includes(word));
  });
}

function GoalSearch({ value, onChange, resultCount, total }) {
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
          <SearchIcon />
        </span>

        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search your goals — subject, exam, or a topic"
          aria-label="Search your goals"
          className={[
            'ease-lakshya w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-10 text-sm text-ink transition',
            'placeholder:text-ink-muted focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30',
            '[&::-webkit-search-cancel-button]:hidden',
          ].join(' ')}
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear the search"
            className="ease-lakshya absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition hover:text-saffron"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {value.trim() && (
        <p className="mt-2 text-xs text-ink-muted" role="status">
          {resultCount} of {total} {total === 1 ? 'goal' : 'goals'}
        </p>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GoalCard({ goal }) {
  const status = STATUS_COPY[goal.status] ?? STATUS_COPY.draft;
  const remaining = daysUntil(goal.deadline);
  const destination = goal.status === 'active' ? `/goals/${goal.id}/plan` : `/goals/${goal.id}/setup`;

  return (
    <li>
      <Card
        as={Link}
        to={destination}
        className="ease-lakshya block p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={['eyebrow', status.tone].join(' ')}>{status.label}</p>
            <h2 className="mt-1.5 truncate text-xl font-semibold">{goal.subject}</h2>
            {goal.examType && <p className="mt-0.5 truncate text-sm text-ink-muted">{goal.examType}</p>}
          </div>

          {goal.topics?.length > 0 && (
            <ProgressRing value={0} size={56} tone="saffron" />
          )}
        </div>

        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
          <Stat label="Deadline" value={formatDate(goal.deadline)} />
          <Stat
            label="Days left"
            value={remaining === 0 ? 'Today' : `${remaining}`}
            tone={remaining <= 3 ? 'text-clay' : undefined}
          />
          <Stat label="Per day" value={`${goal.dailyMinutes} min`} />
          <Stat label="Topics" value={goal.topics?.length || '—'} />
        </dl>
      </Card>
    </li>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={['mt-0.5 font-medium tabular-nums', tone ?? 'text-ink'].join(' ')}>{value}</dd>
    </div>
  );
}
