import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Logo } from '../components/Logo.jsx';

export default function NotFound() {
  return (
    <div className="grain-free flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo size={40} />
      <h1 className="mt-6 text-3xl font-semibold">That page is not here</h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        The link may be out of date, or the goal it pointed at has been deleted.
      </p>

      <Link to="/goals" className="mt-7">
        <Button variant="accent">Back to your goals</Button>
      </Link>
    </div>
  );
}
