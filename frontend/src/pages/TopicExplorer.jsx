import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { MasteryBar } from '../components/ProgressRing.jsx';
import { TopicVisual } from '../components/TopicVisual.jsx';
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

  const { data, error, loading, reload } = useResource(() => api.goals.get(goalId), [goalId]);

  if (loading) return <Loading label="Loading the topic" />;

  if (error) {
    return <Notice title="We could not load this topic" onRetry={reload}>{error.message}</Notice>;
  }

  const topic = data.goal.topics.find((candidate) => candidate.key === topicKey);
  const progress = data.progress.byTopic.find((entry) => entry.topicKey === topicKey);

  if (!topic) {
    return (
      <Notice title="That topic is not in this plan">
        <p>It may have been removed when the topic list was regenerated.</p>
      </Notice>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header>
        <Link
          to={`/goals/${goalId}/plan`}
          className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← Back to the plan
        </Link>

        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{topic.title}</h1>
        {topic.summary && <p className="mt-2 max-w-2xl text-ink-muted">{topic.summary}</p>}
      </header>

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
            <p className="mt-3 text-sm text-ink-muted">You have not started this one yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="eyebrow">Stuck on it?</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            The tutor already knows you are on this topic, so you can ask it directly.
          </p>

          <Link to={`/goals/${goalId}/tutor`} state={{ topicKey: topic.key }} className="mt-4 inline-block">
            <Button variant="outline" size="sm">Ask about {topic.title}</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
