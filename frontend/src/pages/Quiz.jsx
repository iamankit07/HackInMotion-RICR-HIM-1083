import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { RichInline, RichText } from '../components/ui/RichText.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';

export default function Quiz() {
  const { goalId, assessmentId } = useParams();
  const navigate = useNavigate();

  const { data, error, loading, reload } = useResource(
    () => api.assessments.get(goalId, assessmentId),
    [goalId, assessmentId],
  );

  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading label="Getting your questions ready" />;

  if (error) {
    return <Notice title="We could not load this test" onRetry={reload}>{error.message}</Notice>;
  }

  const assessment = result?.assessment ?? data.assessment;
  const isReviewing = Boolean(result) || Boolean(assessment.submittedAt);

  const answered = Object.keys(answers).length;
  const total = assessment.questions.length;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = await api.assessments.submit(
        goalId,
        assessmentId,
        Object.entries(answers).map(([questionIndex, selectedIndex]) => ({
          questionIndex: Number(questionIndex),
          selectedIndex,
        })),
      );

      setResult(payload);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <p className="eyebrow">{assessment.kind === 'diagnostic' ? 'Diagnostic' : 'Mock test'}</p>
        <h1 className="mt-1.5 text-3xl font-semibold">{assessment.title}</h1>

        {!isReviewing && (
          <p className="mt-2 text-ink-muted">
            {total} questions. Answer what you can — a wrong answer here saves you an hour later.
          </p>
        )}
      </header>

      {isReviewing && <ResultBanner result={result} assessment={assessment} goalId={goalId} />}

      {submitError && <Notice title="We could not submit that">{submitError.message}</Notice>}

      <ol className="flex flex-col gap-4">
        {assessment.questions.map((question, index) => (
          <Card key={index} className="p-5 sm:p-6">
            <p className="eyebrow">Question {index + 1}</p>
            <h2 className="mt-2 text-base font-semibold leading-relaxed text-ink sm:text-lg">
              <RichInline content={question.prompt} />
            </h2>

            <div className="mt-4 flex flex-col gap-2">
              {question.options.map((option, optionIndex) => (
                <Option
                  key={optionIndex}
                  option={option}
                  name={`question-${index}`}
                  checked={
                    isReviewing
                      ? question.selectedIndex === optionIndex
                      : answers[index] === optionIndex
                  }
                  correct={isReviewing && question.correctIndex === optionIndex}
                  wrong={
                    isReviewing &&
                    question.selectedIndex === optionIndex &&
                    question.selectedIndex !== question.correctIndex
                  }
                  disabled={isReviewing}
                  onChange={() => setAnswers({ ...answers, [index]: optionIndex })}
                />
              ))}
            </div>

            {isReviewing && question.explanation && (
              <RichText
                content={question.explanation}
                className="mt-4 border-t border-line pt-3.5 text-sm leading-relaxed text-ink-soft"
              />
            )}
          </Card>
        ))}
      </ol>

      {!isReviewing && (
        <div className="sticky bottom-4 z-10">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <p className="text-sm text-ink-muted">
              {answered} of {total} answered
            </p>
            <Button variant="accent" onClick={submit} loading={submitting} disabled={answered === 0}>
              Submit and build my plan
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function Option({ option, name, checked, correct, wrong, disabled, onChange }) {
  const tone = correct
    ? 'border-teal bg-teal-soft text-teal'
    : wrong
      ? 'border-clay bg-clay-soft text-clay'
      : checked
        ? 'border-ink bg-sunk text-ink'
        : 'border-line text-ink-soft hover:border-line-strong hover:bg-sunk';

  return (
    <label
      className={[
        'ease-lakshya flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition duration-200',
        tone,
        disabled && 'cursor-default',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 accent-current"
      />
      <span className="leading-relaxed">
        <RichInline content={option} />
      </span>
    </label>
  );
}

function ResultBanner({ result, assessment, goalId }) {
  const score = result?.assessment?.score ?? assessment.score;
  const total = assessment.questions.length;
  const percent = Math.round((score / total) * 100);

  const weakest = result?.progress?.weakestTopics?.slice(0, 3) ?? [];

  const planMessage = {
    initial: 'Your study plan has been built around these results.',
    'weak-retest': 'That went badly enough that the plan has been rebuilt around the gaps.',
  }[result?.planAction];

  return (
    <Card className="p-6">
      <p className="eyebrow">Result</p>

      <p className="mt-2 font-display text-3xl font-semibold">
        {score} <span className="text-ink-muted">/ {total}</span>
        <span className="ml-3 text-lg text-ink-muted">{percent}%</span>
      </p>

      {weakest.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Where the time is going to go</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {weakest.map((topic) => (
              <li key={topic.topicKey} className="flex justify-between gap-4 text-sm text-ink-muted">
                <span>{topic.title}</span>
                <span className="tabular-nums">{Math.round(topic.mastery * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {planMessage && <p className="mt-5 text-sm text-ink-soft">{planMessage}</p>}

      <Link to={`/goals/${goalId}/plan`} className="mt-5 inline-block">
        <Button variant="accent">See my plan</Button>
      </Link>
    </Card>
  );
}
