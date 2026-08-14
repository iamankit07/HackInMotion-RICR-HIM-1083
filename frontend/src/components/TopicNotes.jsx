import { useState } from 'react';

import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';
import { Notice } from './ui/Feedback.jsx';
import { RichText } from './ui/RichText.jsx';
import { api } from '../lib/api.js';

/**
 * The study material for a topic.
 *
 * Knowing what to study is only half of it — this is the part a student
 * actually reads. Notes are written on request rather than for the whole
 * syllabus at once, because each one costs an AI call, and are kept afterwards
 * so opening the topic again is instant.
 */
export function TopicNotes({ goalId, topic }) {
  const [notes, setNotes] = useState(topic.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const write = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await api.goals.topicNotes(goalId, topic.key);
      setNotes(payload.notes);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  };

  if (notes) {
    return (
      <Card className="p-6">
        <p className="eyebrow">Study notes</p>
        <RichText content={notes} className="mt-3 leading-relaxed text-ink-soft" />

        <p className="mt-6 border-t border-line pt-3.5 text-xs text-ink-muted">
          Written for your goal and level. Check anything that matters against your syllabus.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="eyebrow">Study notes</p>
      <h2 className="mt-1.5 text-lg font-semibold text-ink">Nothing written for this topic yet</h2>
      <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-muted">
        Lakshya can write up {topic.title} for you: what it covers, where the marks are, the
        mistakes people make, and a few questions to test yourself with. We keep them after that, so
        this only takes a moment once.
      </p>

      {error && (
        <div className="mt-4">
          <Notice title="We couldn't write these notes" onRetry={write}>
            {error.message}
          </Notice>
        </div>
      )}

      <Button variant="accent" className="mt-5" loading={loading} onClick={write}>
        {loading ? 'Writing your notes' : 'Write my notes'}
      </Button>
    </Card>
  );
}
