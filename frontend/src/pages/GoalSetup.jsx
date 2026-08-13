import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { RichInline } from '../components/ui/RichText.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { formatMinutes } from '../lib/format.js';
import { ManualTopics } from '../components/ManualTopics.jsx';

export default function GoalSetup() {
  const { goalId } = useParams();
  const navigate = useNavigate();

  const { data, error, loading, reload, setData } = useResource(() => api.goals.get(goalId), [goalId]);

  const [working, setWorking] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showManual, setShowManual] = useState(false);

  if (loading) return <Loading label="Loading your goal" />;

  if (error) {
    return <Notice title="We could not load this goal" onRetry={reload}>{error.message}</Notice>;
  }

  const { goal } = data;
  const hasTopics = goal.topics.length > 0;

  const generateTopics = async () => {
    setWorking('topics');
    setActionError(null);

    try {
      const result = await api.goals.generateTopics(goalId);
      setData({ ...data, goal: result.goal });
      setShowManual(false);
    } catch (caught) {
      setActionError(caught);

      // If the AI is unreachable, the manual route is the way forward — open it
      // rather than making the student find it.
      if (caught.isAiUnavailable) {
        setShowManual(true);
      }
    } finally {
      setWorking(null);
    }
  };

  const saveManualTopics = async (topics) => {
    setActionError(null);
    const result = await api.goals.setTopics(goalId, topics);
    setData({ ...data, goal: result.goal });
    setShowManual(false);
  };

  const startDiagnostic = async () => {
    setWorking('diagnostic');
    setActionError(null);

    try {
      const { assessment } = await api.assessments.createDiagnostic(goalId, 8);
      navigate(`/goals/${goalId}/quiz/${assessment.id}`);
    } catch (caught) {
      setActionError(caught);
      setWorking(null);
    }
  };

  const skipToplan = async () => {
    setWorking('plan');
    setActionError(null);

    try {
      await api.plan.create(goalId);
      navigate(`/goals/${goalId}/plan`);
    } catch (caught) {
      setActionError(caught);
      setWorking(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="eyebrow">Setting up</p>
        <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">{goal.subject}</h1>
        <p className="mt-2 text-ink-muted">
          {goal.examType && `${goal.examType} · `}
          {goal.daysRemaining} days left · {formatMinutes(goal.dailyMinutes)} a day
        </p>
      </header>

      {actionError && (
        <Notice
          title={actionError.isAiUnavailable ? 'The AI service is not responding' : 'That did not work'}
          onRetry={actionError.isAiUnavailable ? generateTopics : undefined}
        >
          {actionError.message}
        </Notice>
      )}

      <Card className="p-6">
        <CardHeader
          eyebrow="Step one"
          title="Break the subject into topics"
          action={
            hasTopics && (
              <Button variant="ghost" size="sm" onClick={generateTopics} loading={working === 'topics'}>
                Regenerate
              </Button>
            )
          }
        />

        {!hasTopics && !showManual && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Lakshya asks the AI to split {goal.subject} into the topics you are actually examined
              on, work out what depends on what, and estimate how long each takes. You can edit the
              result or write your own list instead.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="accent" onClick={generateTopics} loading={working === 'topics'}>
                Generate topics
              </Button>
              <Button variant="outline" onClick={() => setShowManual(true)}>
                Enter them myself
              </Button>
            </div>
          </>
        )}

        {showManual && (
          <ManualTopics
            initial={goal.topics}
            onCancel={() => setShowManual(false)}
            onSave={saveManualTopics}
          />
        )}

        {hasTopics && !showManual && (
          <>
            <ol className="mt-5 flex flex-col divide-y divide-line border-t border-line">
              {goal.topics.map((topic, index) => (
                <li key={topic.key} className="flex gap-4 py-3.5">
                  <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-ink-muted">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[0.9375rem] font-semibold text-ink">{topic.title}</h3>
                    {topic.summary && (
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                        <RichInline content={topic.summary} />
                      </p>
                    )}
                    {topic.prerequisites.length > 0 && (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Needs first: {topic.prerequisites.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right text-xs text-ink-muted">
                    <p className="tabular-nums">{formatMinutes(topic.estimatedMinutes)}</p>
                    <p className="mt-0.5">weight {topic.weight}/5</p>
                  </div>
                </li>
              ))}
            </ol>

            <Button variant="ghost" size="sm" onClick={() => setShowManual(true)} className="mt-4">
              Edit this list
            </Button>
          </>
        )}
      </Card>

      {hasTopics && !showManual && (
        <Card className="p-6">
          <CardHeader eyebrow="Step two" title="Find out where you actually stand" />

          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Eight questions across the syllabus. It is not a mark — it is how the plan learns which
            topics need the hours and which only need a look. Skip it and the plan runs on your
            self-rating alone.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="accent" onClick={startDiagnostic} loading={working === 'diagnostic'}>
              Take the diagnostic
            </Button>
            <Button variant="outline" onClick={skipToplan} loading={working === 'plan'}>
              Skip and build the plan
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
