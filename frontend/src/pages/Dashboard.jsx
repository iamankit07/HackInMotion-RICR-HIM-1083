import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, Loading, Notice } from '../components/ui/Feedback.jsx';
import { ProgressRing } from '../components/ProgressRing.jsx';
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

export default function Dashboard() {
  const { data, error, loading, reload } = useResource(() => api.goals.list(), []);

  if (loading) return <Loading label="Loading your goals" />;

  if (error) {
    return <Notice title="We could not load your goals" onRetry={reload}>{error.message}</Notice>;
  }

  const goals = data?.goals ?? [];

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
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </div>
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
