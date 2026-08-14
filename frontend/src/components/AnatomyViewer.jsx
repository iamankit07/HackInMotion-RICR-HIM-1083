import { Suspense, lazy, useCallback, useEffect, useId, useState } from 'react';

import {
  anatomyModelUrl,
  checkVrSupport,
  getAnatomySystem,
  VR_APK_SIZE,
  VR_APK_URL,
} from '../lib/anatomy.js';
import { Button } from './ui/Button.jsx';

// three.js and its loaders are far larger than the rest of the app put
// together, so they are fetched only once a student asks to see a model.
const AnatomyCanvas = lazy(() => import('./AnatomyCanvas.jsx'));

/**
 * Only one model on screen at a time.
 *
 * A plan can list several anatomy topics in a day, and each open viewer holds a
 * WebGL context. Browsers allow about eight before they start force-killing the
 * oldest, which shows up as a canvas that suddenly goes black. Opening one
 * closes whichever was open before.
 */
const listeners = new Set();
let openViewer = null;

function claimViewer(id) {
  openViewer = id;
  listeners.forEach((notify) => notify(openViewer));
}

function releaseViewer(id) {
  if (openViewer === id) claimViewer(null);
}

/**
 * A 3D anatomy model offered beside a study topic.
 *
 * Loading is deliberately opt-in: each model is a few megabytes, and the study
 * plan is what people came for. Nothing is fetched until the student asks,
 * which keeps the plan quick to open on a phone.
 */
export function AnatomyViewer({ systemKey, topicTitle, className = '' }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  // Only the Quest browser answers yes, so on a laptop the VR button is never
  // rendered at all rather than offered and then failing.
  const [vrSupported, setVrSupported] = useState(false);
  const [vrRequested, setVrRequested] = useState(false);
  const [vrActive, setVrActive] = useState(false);
  const [vrError, setVrError] = useState('');

  useEffect(() => {
    let alive = true;
    checkVrSupport().then((supported) => alive && setVrSupported(supported));
    return () => {
      alive = false;
    };
  }, []);

  const handleVrChange = useCallback((active, error) => {
    setVrActive(active);
    if (!active) setVrRequested(false);
    setVrError(error ? 'The headset would not open the model. Try again.' : '');
  }, []);

  const enterVr = () => {
    setVrError('');
    claimViewer(id); // the canvas has to exist before a session can use it
    setVrRequested(true);
  };

  // Follow whichever viewer currently holds the slot, and give it up on unmount
  // so navigating away does not leave a context claimed by a dead component.
  useEffect(() => {
    const notify = (current) => setOpen(current === id);

    listeners.add(notify);

    return () => {
      listeners.delete(notify);
      releaseViewer(id);
    };
  }, [id]);

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

          {/*
            The headset build is a sideload rather than a store install, so it
            stays the secondary option under the blurb. It was an underlined
            phrase and read as part of the sentence above it, so it borrows the
            ghost button's shape: quiet, but obviously a thing you press.
          */}
          <a
            className="ease-lakshya mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-sunk/50 px-2.5 py-1 text-xs font-medium text-ink-soft transition duration-200 hover:border-line-strong hover:bg-sunk hover:text-ink"
            href={VR_APK_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            <DownloadIcon />
            Quest headset app ({VR_APK_SIZE})
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={open ? 'outline' : 'accent'}
            size="sm"
            onClick={() => (open ? releaseViewer(id) : claimViewer(id))}
          >
            {open ? 'Hide model' : 'Open model'}
          </Button>

          {vrSupported && (
            <Button variant="accent" size="sm" onClick={enterVr} disabled={vrRequested && !vrActive}>
              {vrActive ? 'In VR' : vrRequested ? 'Opening…' : 'View in VR'}
            </Button>
          )}
        </div>
      </div>

      {vrError && (
        <p className="px-4 pb-3 text-xs text-clay" role="alert">
          {vrError}
        </p>
      )}

      {open && (
        <div className="relative h-[22rem] w-full border-t border-line bg-sunk sm:h-[28rem]">
          <Suspense fallback={<LoadingPanel />}>
            <AnatomyCanvas
              url={url}
              vrRequested={vrRequested}
              vrActive={vrActive}
              onVrChange={handleVrChange}
            />
          </Suspense>

          <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[0.6875rem] text-ink-muted">
            {vrActive
              ? 'Look around. Take the headset off or press the menu button to come back.'
              : 'Drag to rotate · scroll or pinch to zoom'}
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

// Says "this downloads something" before the label has to.
function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
