import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(form);
      navigate(location.state?.from ?? '/goals', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErrors = error?.fieldErrors ?? {};

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Pick up where your plan left off."
      footer={
        <>
          New here?{' '}
          <Link to="/sign-up" className="font-medium text-saffron underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && Object.keys(fieldErrors).length === 0 && <Notice>{error.message}</Notice>}

        <Field label="Email" error={fieldErrors.email}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              invalid={invalid}
              required
            />
          )}
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              invalid={invalid}
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
