import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useLastGoal } from '../lib/useLastGoal.js';
import { Logo } from './Logo.jsx';
import { Button } from './ui/Button.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export function AppLayout() {
  const { user, signOut } = useAuth();

  // Not useParams: Groups and the dashboard have no goal in their path, and
  // reading it from there made the study tabs vanish the moment you left a goal.
  const goalId = useLastGoal();

  return (
    <div className="min-h-dvh">
      <header className="grain-free sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/goals" className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="select-none font-display text-xl font-semibold tracking-tight">Lakshya</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Tab to="/goals" end>Goals</Tab>
            {goalId && (
              <>
                <Tab to={`/goals/${goalId}/plan`}>Study plan</Tab>
                <Tab to={`/goals/${goalId}/tutor`}>Ask a doubt</Tab>
              </>
            )}
            <Tab to="/groups">Groups</Tab>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden select-none text-sm text-ink-muted sm:block">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 sm:hidden">
          <Tab to="/goals" end>Goals</Tab>
          {goalId && (
            <>
              <Tab to={`/goals/${goalId}/plan`}>Study plan</Tab>
              <Tab to={`/goals/${goalId}/tutor`}>Ask a doubt</Tab>
            </>
          )}
          <Tab to="/groups">Groups</Tab>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'ease-lakshya shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition duration-200',
          isActive ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-sunk hover:text-ink',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
