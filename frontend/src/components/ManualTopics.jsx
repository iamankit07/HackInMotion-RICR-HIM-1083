import { useState } from 'react';

import { Button } from './ui/Button.jsx';
import { Input } from './ui/Field.jsx';
import { Notice } from './ui/Feedback.jsx';

const blank = () => ({ title: '', estimatedMinutes: 60, difficulty: 3, weight: 3 });

/**
 * The route a student takes when the AI is unreachable, or when the generated
 * list does not match the syllabus they were actually given. Prerequisites are
 * left out on purpose — asking someone to hand-enter a dependency graph while
 * they are stressed is not a reasonable ask, and the scheduler copes without.
 */
export function ManualTopics({ initial = [], onSave, onCancel }) {
  const [rows, setRows] = useState(
    initial.length > 0
      ? initial.map((topic) => ({
          title: topic.title,
          estimatedMinutes: topic.estimatedMinutes,
          difficulty: topic.difficulty,
          weight: topic.weight,
        }))
      : [blank(), blank(), blank()],
  );

  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (index, key, value) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, [key]: value } : row)));

  const remove = (index) => setRows(rows.filter((_, position) => position !== index));

  const save = async () => {
    const topics = rows
      .filter((row) => row.title.trim().length > 1)
      .map((row) => ({
        title: row.title.trim(),
        estimatedMinutes: Number(row.estimatedMinutes) || 60,
        difficulty: Number(row.difficulty) || 3,
        weight: Number(row.weight) || 3,
      }));

    if (topics.length === 0) {
      setError(new Error('Add at least one topic before saving.'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(topics);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-4">
      {error && <Notice>{error.message}</Notice>}

      <div className="flex flex-col gap-2.5">
        <div className="hidden gap-3 px-1 text-xs text-ink-muted sm:grid sm:grid-cols-[1fr_5.5rem_5rem_5rem_2rem]">
          <span>Topic</span>
          <span>Minutes</span>
          <span>Difficulty</span>
          <span>Weight</span>
          <span />
        </div>

        {rows.map((row, index) => (
          <div key={index} className="grid gap-2.5 sm:grid-cols-[1fr_5.5rem_5rem_5rem_2rem] sm:items-center">
            <Input
              value={row.title}
              onChange={(event) => update(index, 'title', event.target.value)}
              placeholder={`Topic ${index + 1}`}
              aria-label={`Topic ${index + 1} name`}
            />
            <Input
              type="number"
              min={10}
              max={600}
              step={10}
              value={row.estimatedMinutes}
              onChange={(event) => update(index, 'estimatedMinutes', event.target.value)}
              aria-label={`Topic ${index + 1} minutes`}
            />
            <Input
              type="number"
              min={1}
              max={5}
              value={row.difficulty}
              onChange={(event) => update(index, 'difficulty', event.target.value)}
              aria-label={`Topic ${index + 1} difficulty`}
            />
            <Input
              type="number"
              min={1}
              max={5}
              value={row.weight}
              onChange={(event) => update(index, 'weight', event.target.value)}
              aria-label={`Topic ${index + 1} weight`}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="ease-lakshya justify-self-start rounded-lg px-2 py-1 text-sm text-ink-muted transition hover:bg-clay-soft hover:text-clay sm:justify-self-center"
              aria-label={`Remove topic ${index + 1}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, blank()])}>
          Add a topic
        </Button>
        <Button variant="accent" size="sm" onClick={save} loading={saving}>
          Save topics
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
