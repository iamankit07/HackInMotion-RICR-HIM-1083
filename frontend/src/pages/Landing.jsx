import { Link } from 'react-router-dom';

import { Logo } from '../components/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';

const STEPS = [
  {
    n: '01',
    title: 'Tell it what you are up against',
    body: 'The subject, the date, and how many hours a day you honestly have. Not how many you wish you had.',
  },
  {
    n: '02',
    title: 'Take a short diagnostic',
    body: 'Eight questions across the syllabus. It is looking for the gaps, not marking you.',
  },
  {
    n: '03',
    title: 'Get a plan that admits the truth',
    body: 'Weak topics get the time. Topics you already know get a refresh. Everything fits the days left.',
  },
  {
    n: '04',
    title: 'Fall behind, and it rebuilds',
    body: 'Miss a session or fail a re-test and the schedule reshapes around what is left.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="grain-free mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-xl font-semibold tracking-tight">Lakshya</span>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/sign-up">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="grain-free relative mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <BackdropRings />

        <p className="eyebrow">लक्ष्य · the target</p>

        <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold sm:text-6xl">
          Stop revising the chapter you{' '}
          <span className="marked">already know</span>.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Lakshya works out what you actually understand, then builds a day-by-day plan around the
          gaps and the hours you genuinely have left. Not a to-do list. A plan that changes when you
          do.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link to="/sign-up">
            <Button size="lg" variant="accent">Build my study plan</Button>
          </Link>
          <Link to="/sign-in">
            <Button size="lg" variant="outline">I already have an account</Button>
          </Link>
        </div>

        <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-3">
          {[
            ['Diagnostic first', 'The plan starts from evidence, not a guess'],
            ['Prerequisite aware', 'Nothing is scheduled before what it depends on'],
            ['Spaced revision', 'Earlier topics come back before you forget them'],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="font-display text-base font-semibold text-ink">{term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grain-free border-t border-line bg-sunk">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-lg text-2xl font-semibold sm:text-3xl">
            Four steps, and none of them is “make a timetable yourself”.
          </h2>

          <ol className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-5">
                <span className="font-display text-2xl font-semibold text-saffron">{step.n}</span>
                <div>
                  <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="grain-free mx-auto max-w-6xl px-5 py-10 text-sm text-ink-muted sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-8">
          <span>Lakshya — built for HackInMotion 2026</span>
          <span>Team RICR-HIM-1083</span>
        </div>
      </footer>
    </div>
  );
}

function BackdropRings() {
  return (
    <svg
      viewBox="0 0 500 500"
      aria-hidden="true"
      className="pointer-events-none absolute -right-32 -top-24 -z-10 hidden h-[38rem] w-[38rem] text-line-strong lg:block"
    >
      {[240, 195, 150, 105, 60, 20].map((r, index) => (
        <circle
          key={r}
          cx="250"
          cy="250"
          r={r}
          fill={r === 20 ? 'var(--saffron)' : 'none'}
          stroke={r === 20 ? 'none' : 'currentColor'}
          strokeWidth="1.25"
          opacity={r === 20 ? 0.18 : 0.5 - index * 0.06}
        />
      ))}
    </svg>
  );
}
