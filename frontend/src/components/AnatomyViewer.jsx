import { Suspense, lazy, useState } from 'react';

import { anatomyModelUrl, getAnatomySystem } from '../lib/anatomy.js';
import { Button } from './ui/Button.jsx';

// three.js and its loaders are far larger than the rest of the app put
// together, so they are fetched only once a student asks to see a model.
const AnatomyCanvas = lazy(() => import('./AnatomyCanvas.jsx'));

/**
 * A 3D anatomy model offered beside a study topic.
 *
 * Loading is deliberately opt-in: each model is a few megabytes, and the study
 * plan is what people came for. Nothing is fetched until the student asks,
 * which keeps the plan quick to open on a phone.
 */
export function AnatomyViewer({ systemKey, topicTitle, className = '' }) {
  const [open, setOpen] = useState(false);
  const system = getAnatomySystem(systemKey);
  const url = anatomyModelUrl(systemKey);

  if (!system || !url) return null;

  return (
    <div
      className={['overflow-hidden rounded-2xl border border-line bg-surface', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="eyebrow">See it in 3D</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{system.label}</p>
          <p className="text-xs leading-relaxed text-ink-muted">{system.blurb}</p>
        </div>

        <Button variant={open ? 'outline' : 'accent'} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide model' : 'Open model'}
        </Button>
      </div>

      {open && (
        <div className="relative h-[22rem] w-full border-t border-line bg-sunk sm:h-[28rem]">
          <Suspense fallback={<LoadingPanel />}>
            <AnatomyCanvas url={url} />
          </Suspense>

          <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[0.6875rem] text-ink-muted">
            Drag to rotate · scroll or pinch to zoom
            {topicTitle ? ` · ${topicTitle}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-saffron border-t-transparent" />
        Loading the 3D viewer
      </div>
    </div>
  );
}
