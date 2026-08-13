import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState, Loading, Notice } from '../components/ui/Feedback.jsx';
import { MasteryBar, ProgressRing } from '../components/ProgressRing.jsx';
import { SessionRow } from '../components/SessionRow.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { formatDate, formatMinutes, formatWeekday } from '../lib/format.js';

export default function StudyPlan() {
  const { goalId } = useParams();
  const navigate = useNavigate();

  const today = useResource(() => api.plan.today(goalId), [goalId]);
  const full = useResource(() => api.plan.get(goalId), [goalId]);
  const goal = useResource(() => api.goals.get(goalId), [goalId]);

  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (today.loading || goal.loading) return <Loading label="Opening your plan" />;

  // No plan yet is a normal state, not an error — send them back to finish setup.
  if (today.error?.status === 404) {
    return (
      <EmptyState
        title="No plan has been built yet"
        action={
          <Link to={`/goals/${goalId}/setup`}>
            <Button variant="accent">Finish setting up</Button>
          </Link>
        }
      >
        Generate your topics and take the diagnostic, and the plan will appear here.
      </EmptyState>
    );
  }

  if (today.error) {
    return <Notice title="We could not open your plan" onRetry={today.reload}>{today.error.message}</Notice>;
  }

  const { summary, progress, sessions, overdue } = today.data;
  const subject = goal.data?.goal?.subject ?? 'Your plan';

  const refresh = () => Promise.all([today.reload(), full.reload(), goal.reload()]);

  const setSessionStatus = async (sessionId, status) => {
    setBusy(sessionId);
    setActionError(null);

    try {
      await api.plan.updateSession(goalId, sessionId, status);
      await refresh();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(null);
    }
  };

  const rebuild = async () => {
    setBusy('replan');
    setActionError(null);

    try {
      await api.plan.replan(goalId, 'behind-schedule');
      await refresh();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(null);
    }
  };

  const startMockTest = async () => {
    setBusy('mock');
    setActionError(null);

    try {
      const { assessment } = await api.assessments.createMock(goalId, { questionCount: 8 });
      navigate(`/goals/${goalId}/quiz/${assessment.id}`);
    } catch (caught) {
      setActionError(caught);
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Study plan · version {summary.version}</p>
          <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">{subject}</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={startMockTest} loading={busy === 'mock'}>
            Take a mock test
          </Button>
          <Button variant="ghost" onClick={rebuild} loading={busy === 'replan'}>
            Rebuild plan
          </Button>
        </div>
      </header>

      {actionError && (
        <Notice title="That did not work">{actionError.message}</Notice>
      )}

      {summary.isBehind && (
        <Notice
          tone="warn"
          title={`${summary.missedSessions} ${summary.missedSessions === 1 ? 'session has' : 'sessions have'} slipped past`}
          onRetry={rebuild}
          retryLabel="Rebuild around what is left"
        >
          <p>
            Nothing is lost — rebuilding will fit the remaining work into the {summary.daysRemaining}{' '}
            days you have left, and credit everything you have already done.
          </p>
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="flex flex-col items-center gap-5 p-6">
          <ProgressRing value={summary.completionPercent} label="complete" />

          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-5 text-center text-sm">
            <Stat label="Days left" value={summary.daysRemaining} />
            <Stat label="Sessions" value={`${summary.completedSessions}/${summary.totalSessions}`} />
            <Stat label="Studied" value={formatMinutes(summary.completedMinutes)} />
            <Stat label="Planned" value={formatMinutes(summary.totalMinutes)} />
          </dl>
        </Card>

        <Card className="p-6">
          <CardHeader
            eyebrow={formatWeekday(today.data.date)}
            title={sessions.length > 0 ? 'What to study today' : 'Nothing scheduled today'}
          />

          {overdue.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
              <p className="text-sm font-medium text-ink">Still owed from earlier</p>
              <ul className="mt-2 flex flex-col gap-2">
                {overdue.slice(0, 3).map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-soft">
                      {session.title}
                      <span className="ml-2 text-xs text-ink-muted">{formatDate(session.date)}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === session.id}
                      onClick={() => setSessionStatus(session.id, 'completed')}
                    >
                      Done
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sessions.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              A rest day, or everything for today is already ticked off. Either is fine.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  busy={busy === session.id}
                  onComplete={() => setSessionStatus(session.id, 'completed')}
                  onUndo={() => setSessionStatus(session.id, 'pending')}
                  exploreTo={
                    session.kind === 'test' ? null : `/goals/${goalId}/explore/${session.topicKey}`
                  }
                  onAsk={() =>
                    navigate(`/goals/${goalId}/tutor`, { state: { topicKey: session.topicKey } })
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="p-6">
          <CardHeader eyebrow="The whole plan" title="Every session between now and the deadline" />

          {full.loading ? (
            <Loading label="Loading the full schedule" />
          ) : full.error ? (
            <Notice onRetry={full.reload}>{full.error.message}</Notice>
          ) : (
            <Timeline plan={full.data.plan} />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader eyebrow="Where you stand" title="Topic by topic" />

          <ul className="mt-4 flex flex-col gap-3.5">
            {progress.byTopic.map((topic) => (
              <li key={topic.topicKey}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink">{topic.title}</span>
                  {topic.status === 'mastered' && (
                    <span className="text-xs text-teal">solid</span>
                  )}
                </div>
                <MasteryBar value={topic.mastery} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Timeline({ plan }) {
  const days = groupByDay(plan.sessions);

  if (days.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">This plan has no sessions in it.</p>;
  }

  return (
    <ol className="mt-5 flex flex-col">
      {days.map(([date, sessions]) => {
        const minutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
        const done = sessions.every((session) => session.status === 'completed');

        return (
          <li key={date} className="relative flex gap-4 border-l border-line pb-6 pl-5 last:pb-0">
            <span
              className={[
                'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-paper',
                done ? 'bg-teal' : 'bg-line-strong',
              ].join(' ')}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-sm font-semibold text-ink">{formatWeekday(date)}</h3>
                <span className="text-xs text-ink-muted">
                  {formatDate(date)} · {formatMinutes(minutes)}
                </span>
              </div>

              <ul className="mt-2 flex flex-col gap-1.5">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-baseline gap-2.5 text-sm">
                    <span
                      className={[
                        'shrink-0 text-xs',
                        session.status === 'completed' ? 'text-teal' : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {session.status === 'completed' ? '✓' : '·'}
                    </span>
                    <span
                      className={
                        session.status === 'completed' ? 'text-ink-muted line-through' : 'text-ink-soft'
                      }
                    >
                      {session.title}
                    </span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-muted">
                      {session.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function groupByDay(sessions) {
  const days = new Map();

  for (const session of sessions) {
    const key = session.date.slice(0, 10);

    if (!days.has(key)) {
      days.set(key, []);
    }

    days.get(key).push(session);
  }

  return [...days.entries()];
}
