import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthShell } from '../components/AuthShell.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Field.jsx';
import { Notice } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signUp(form);
      navigate('/goals/new', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldErrors = error?.fieldErrors ?? {};

  return (
    <AuthShell
      title="Start with what you actually know"
      subtitle="Two minutes to set up, and the plan builds itself around your answers."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className="font-medium text-saffron underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && Object.keys(fieldErrors).length === 0 && <Notice>{error.message}</Notice>}

        <Field label="Your name" error={fieldErrors.name}>
          {({ id, invalid }) => (
            <Input id={id} autoComplete="name" value={form.name} onChange={update('name')} invalid={invalid} required />
          )}
        </Field>

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

        <Field
          label="Password"
          hint="At least 8 characters, with a letter and a number."
          error={fieldErrors.password}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              invalid={invalid}
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
