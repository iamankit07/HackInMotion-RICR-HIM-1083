import { Link, useLocation, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { MasteryBar } from '../components/ProgressRing.jsx';
import { TopicVisual } from '../components/TopicVisual.jsx';
import { TopicNotes } from '../components/TopicNotes.jsx';
import { RichInline } from '../components/ui/RichText.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { formatMinutes } from '../lib/format.js';

/**
 * A single topic on its own page, with room for a visual explanation of it.
 * Reading "the femur articulates with the acetabulum" is not the same as seeing
 * it, which is the gap this screen exists to close.
 */
export default function TopicExplorer() {
  const { goalId, topicKey } = useParams();
  const location = useLocation();

  const { data, error, loading, reload } = useResource(() => api.goals.get(goalId), [goalId]);

  if (loading) return <Loading label="Loading the topic" />;

  if (error) {
    return <Notice title="We couldn't load this topic" onRetry={reload}>{error.message}</Notice>;
  }

  const topic = data.goal.topics.find((candidate) => candidate.key === topicKey);
  const progress = data.progress.byTopic.find((entry) => entry.topicKey === topicKey);
  const position = data.goal.topics.findIndex((candidate) => candidate.key === topicKey) + 1;

  // Whoever linked here says where "back" should go. Deep links have no such
  // state, and the plan is the right guess for those.
  const cameFrom = location.state?.from ?? `/goals/${goalId}/plan`;
  const cameFromSetup = cameFrom.endsWith('/setup');

  if (!topic) {
    return (
      <Notice title="That topic isn't in this plan">
        <p>It may have been removed when the topic list was regenerated.</p>
      </Notice>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header>
        {/* Where the reader came from, so "back" does not send someone who
            opened this from setup to a plan that does not exist yet. */}
        <Link
          to={cameFrom}
          className="ease-lakshya text-sm text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← Back to {cameFromSetup ? 'setting up' : 'the plan'}
        </Link>

        {/* Every other screen names itself in an eyebrow; without one there is
            nothing telling you which goal this topic belongs to. */}
        <p className="eyebrow mt-3">
          {data.goal.subject} · Topic {position > 0 ? `${position} of ${data.goal.topics.length}` : ''}
        </p>

        <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">{topic.title}</h1>
        {topic.summary && (
          <p className="mt-2 max-w-2xl text-ink-muted">
            <RichInline content={topic.summary} />
          </p>
        )}
      </header>

      <TopicNotes goalId={goalId} topic={topic} />

      <TopicVisual topic={topic} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="eyebrow">Where you stand</p>

          {progress ? (
            <div className="mt-3 flex flex-col gap-3">
              <MasteryBar value={progress.mastery} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Questions answered</dt>
                  <dd className="mt-0.5 tabular-nums text-ink">{progress.questionsAnswered}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Time studied</dt>
                  <dd className="mt-0.5 tabular-nums text-ink">
                    {formatMinutes(progress.minutesStudied)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">You haven&rsquo;t started this one yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="eyebrow">Stuck on it?</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            The tutor already knows you&rsquo;re on this topic, so just ask.
          </p>

          <Link to={`/goals/${goalId}/tutor`} state={{ topicKey: topic.key }} className="mt-4 inline-block">
            <Button variant="outline" size="sm">Ask about {topic.title}</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
