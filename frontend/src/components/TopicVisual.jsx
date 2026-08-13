import { Card } from './ui/Card.jsx';
import { AnatomyViewer } from './AnatomyViewer.jsx';
import { matchAnatomySystem } from '../lib/anatomy.js';

/**
 * The visual explanation for a topic.
 *
 * Anatomy is covered: a topic about the brachial plexus or the rotator cuff
 * opens the matching body system as a model you can turn around, which is where
 * a printed diagram fails hardest. Every other subject still falls through to
 * the placeholder below.
 *
 * Anything added here must stay usable on a phone: the plan screens are what a
 * student opens under exam pressure, and this page cannot be the one that makes
 * the app feel heavy. The renderer is a separate chunk fetched only once a
 * student opens a model, so arriving on this page costs nothing extra.
 */
export function TopicVisual({ topic }) {
  const anatomySystem = matchAnatomySystem(topic.title, topic.summary);

  if (anatomySystem) {
    return <AnatomyViewer systemKey={anatomySystem} topicTitle={topic.title} />;
  }

  return (
    <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <Diagram />

      <h2 className="mt-5 text-lg font-semibold text-ink">No visual for this topic yet</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
        Interactive models are being added subject by subject. Until then, use the tutor below to
        have {topic.title} explained in whatever way helps.
      </p>
    </Card>
  );
}

function Diagram() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="text-line-strong">
      <rect x="6" y="10" width="44" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="24" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <path d="M12 38 L24 29 L32 34 L44 22" fill="none" stroke="var(--saffron)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}
