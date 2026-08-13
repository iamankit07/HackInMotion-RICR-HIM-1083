import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ChoiceGroup, Field, Input, Textarea } from '../components/ui/Field.jsx';
import { DateField } from '../components/ui/DateField.jsx';
import { Notice } from '../components/ui/Feedback.jsx';
import { api } from '../lib/api.js';
import { formatMinutes } from '../lib/format.js';

const CONFIDENCE = [
  { value: 'beginner', label: 'Starting from scratch' },
  { value: 'intermediate', label: 'Know some of it' },
  { value: 'advanced', label: 'Mostly revision' },
];

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DAILY_PRESETS = [30, 60, 90, 120, 180, 240];

const twoWeeksOut = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
};

export default function NewGoal() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    subject: '',
    examType: '',
    notes: '',
    deadline: twoWeeksOut(),
    dailyMinutes: 90,
    studyDays: [0, 1, 2, 3, 4, 5, 6],
    confidence: 'intermediate',
  });

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const update = (key) => (event) => set(key, event.target.value);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { goal } = await api.goals.create({
        ...form,
        deadline: new Date(`${form.deadline}T09:00:00`).toISOString(),
        dailyMinutes: Number(form.dailyMinutes),
      });

      navigate(`/goals/${goal.id}/setup`);
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  };

  const fieldErrors = error?.fieldErrors ?? {};
  const weeklyMinutes = form.studyDays.length * Number(form.dailyMinutes || 0);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="eyebrow">New goal</p>
        <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">
          What are you preparing for?
        </h1>
        <p className="mt-2.5 text-ink-muted">
          Be honest about the time. A plan built on hours you do not have is worse than no plan.
        </p>
      </header>

      <form onSubmit={submit} noValidate>
        <Card className="flex flex-col gap-6 p-6 sm:p-7">
          {error && Object.keys(fieldErrors).length === 0 && <Notice>{error.message}</Notice>}

          <Field label="Subject or topic" error={fieldErrors.subject}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.subject}
                onChange={update('subject')}
                placeholder="Operating Systems"
                invalid={invalid}
                required
              />
            )}
          </Field>

          <Field
            label="Exam or context"
            hint="Optional, but it sharpens what gets prioritised."
            error={fieldErrors.examType}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                value={form.examType}
                onChange={update('examType')}
                placeholder="University end-sem"
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Deadline" error={fieldErrors.deadline}>
            {({ id, invalid }) => (
              <DateField
                id={id}
                value={form.deadline}
                onChange={update('deadline')}
                min={new Date().toISOString().slice(0, 10)}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            label="Time per study day"
            hint={`About ${formatMinutes(weeklyMinutes)} a week across the days you picked.`}
            error={fieldErrors.dailyMinutes}
          >
            {({ id }) => (
              <div className="flex flex-col gap-3">
                <ChoiceGroup
                  options={DAILY_PRESETS.map((value) => ({ value, label: formatMinutes(value) }))}
                  value={Number(form.dailyMinutes)}
                  onChange={(value) => set('dailyMinutes', value)}
                />
                <Input
                  id={id}
                  type="number"
                  min={15}
                  max={960}
                  step={15}
                  value={form.dailyMinutes}
                  onChange={update('dailyMinutes')}
                  className="max-w-40"
                />
              </div>
            )}
          </Field>

          <Field label="Days you can study" error={fieldErrors.studyDays}>
            {() => (
              <ChoiceGroup
                multiple
                options={WEEKDAYS}
                value={form.studyDays}
                onChange={(value) => set('studyDays', value)}
              />
            )}
          </Field>

          <Field label="How well do you know it already?" error={fieldErrors.confidence}>
            {() => (
              <ChoiceGroup
                options={CONFIDENCE}
                value={form.confidence}
                onChange={(value) => set('confidence', value)}
              />
            )}
          </Field>

          <Field
            label="Anything else"
            hint="Chapters that are definitely on the paper, topics you dread, whatever helps."
            error={fieldErrors.notes}
          >
            {({ id, invalid }) => (
              <Textarea id={id} value={form.notes} onChange={update('notes')} invalid={invalid} />
            )}
          </Field>

          <Button type="submit" size="lg" variant="accent" loading={submitting} className="self-start">
            Continue
          </Button>
        </Card>
      </form>
    </div>
  );
}
