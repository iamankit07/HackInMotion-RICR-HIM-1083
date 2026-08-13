import { Card } from './ui/Card.jsx';

/**
 * The visual explanation for a topic.
 *
 * Right now this is the placeholder every topic falls back to. The interactive
 * models are being built here — anatomy first, since that is where a diagram in
 * a textbook fails hardest and a model you can rotate helps most.
 *
 * Anything added here must stay usable on a phone: the plan screens are what a
 * student opens under exam pressure, and this page cannot be the one that makes
 * the app feel heavy. Load the viewer only when this page is open, and keep this
 * fallback for topics that have no model.
 */
export function TopicVisual({ topic }) {
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
