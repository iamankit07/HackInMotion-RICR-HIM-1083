import { Link } from 'react-router-dom';

import { Logo } from './Logo.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

/**
 * Split layout for sign in and sign up: the form on the left where the eye
 * lands, and the reason to bother on the right.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_0.85fr]">
      <div className="fixed right-5 top-5 z-30 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="grain-free mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex items-center gap-2.5">
            <Logo size={28} />
            <span className="select-none font-display text-xl font-semibold tracking-tight">Lakshya</span>
          </Link>

          <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2.5 text-ink-muted">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>

      <aside className="grain-free relative hidden overflow-hidden border-l border-line bg-sunk lg:flex lg:flex-col lg:justify-center lg:px-14">
        <Rings />

        <blockquote className="relative z-10 max-w-sm">
          <p className="font-display text-2xl leading-snug text-ink">
            “Two weeks to the exam and I spent the first four days revising the one chapter I
            already knew.”
          </p>
          <footer className="mt-4 text-sm text-ink-muted">
            This is the problem we built Lakshya to fix.
          </footer>
        </blockquote>

        <ul className="relative z-10 mt-10 space-y-3.5 text-sm text-ink-soft">
          {[
            'A quick test that finds your weak spots before you waste time on them',
            'A day-by-day plan that fits the hours you actually have',
            "A tutor that already knows what you're studying today",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
              {line}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/** Oversized target bleeding off the corner, as a background rather than art. */
function Rings() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="pointer-events-none absolute -right-24 -top-16 h-[30rem] w-[30rem] text-line-strong"
      aria-hidden="true"
    >
      {[190, 150, 110, 70, 30].map((r, index) => (
        <circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity={0.65 - index * 0.09}
        />
      ))}
    </svg>
  );
}
