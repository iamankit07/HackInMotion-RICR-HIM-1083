import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState, Loading, Notice } from '../components/ui/Feedback.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';

/**
 * Study groups: the ones you are in, and the two ways to get into one.
 *
 * Joining is by a short code rather than by searching for people — there is no
 * directory of students to browse, which keeps the whole feature to "someone
 * you already know sent you six characters".
 */
export default function StudyGroups() {
  const groups = useResource(() => api.groups.list(), []);
  const goals = useResource(() => api.goals.list(), []);

  const [mode, setMode] = useState(null); // 'create' | 'join'

  if (groups.loading || goals.loading) return <Loading label="Loading your groups" />;

  if (groups.error) {
    return <Notice title="We could not load your groups" onRetry={groups.reload}>{groups.error.message}</Notice>;
  }

  const myGoals = goals.data?.goals ?? [];
  const list = groups.data?.groups ?? [];

  const done = () => {
    setMode(null);
    groups.reload();
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Study groups</p>
          <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">Revise alongside other people</h1>
        </div>

        {myGoals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => setMode('create')}>Start a group</Button>
            <Button variant="outline" onClick={() => setMode('join')}>Join with a code</Button>
          </div>
        )}
      </header>

      {myGoals.length === 0 ? (
        <EmptyState
          title="Set a goal first"
          action={<Link to="/goals/new"><Button variant="accent">Set a goal</Button></Link>}
        >
          A group compares progress across everyone&rsquo;s plans, so you need a plan of your own
          before you can join one.
        </EmptyState>
      ) : (
        <>
          {mode === 'create' && <CreateGroup goals={myGoals} onDone={done} onCancel={() => setMode(null)} />}
          {mode === 'join' && <JoinGroup goals={myGoals} onDone={done} onCancel={() => setMode(null)} />}

          {list.length === 0 && !mode ? (
            <EmptyState title="You are not in a group yet">
              Start one and share the code, or type in a code someone sent you. Everyone keeps their
              own plan — you just get to see how each other is doing.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {list.map((group) => (
                <li key={group.id}>
                  <Link to={`/groups/${group.id}`} className="block">
                    <Card className="ease-lakshya p-5 transition duration-200 hover:border-line-strong">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-ink">{group.name}</h2>
                          <p className="mt-1 text-sm text-ink-muted">
                            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                            {group.isOwner && ' · you started it'}
                          </p>
                        </div>
                        <code className="shrink-0 rounded-lg bg-sunk px-2 py-1 font-mono text-xs tracking-widest text-ink-soft">
                          {group.joinCode}
                        </code>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CreateGroup({ goals, onDone, onCancel }) {
  const [name, setName] = useState('');
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.groups.create({ name: name.trim(), goalId });
      onDone();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader eyebrow="New group" title="Start a group" />

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        {error && <Notice title="We could not start that group">{error.message}</Notice>}

        <Field label="What is the group called?">
          {({ id }) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="MBBS first year" required />
          )}
        </Field>

        <GoalPicker goals={goals} value={goalId} onChange={setGoalId} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="accent" loading={busy} disabled={name.trim().length < 2}>
            Start the group
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function JoinGroup({ goals, onDone, onCancel }) {
  const [joinCode, setJoinCode] = useState('');
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.groups.join({ joinCode: joinCode.trim().toUpperCase(), goalId });
      onDone();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader eyebrow="Join" title="Join with a code" />

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        {error && <Notice title="We could not join that group">{error.message}</Notice>}

        <Field label="Join code" hint="Six letters and numbers, from whoever invited you.">
          {({ id }) => (
            <Input
              id={id}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="K4M2PX"
              maxLength={6}
              className="font-mono uppercase tracking-[0.3em]"
              required
            />
          )}
        </Field>

        <GoalPicker goals={goals} value={goalId} onChange={setGoalId} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="accent" loading={busy} disabled={joinCode.trim().length !== 6}>
            Join the group
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function GoalPicker({ goals, value, onChange }) {
  return (
    <Field
      label="Which goal are you comparing?"
      hint="Only your progress on this goal is shared. Your quiz answers and tutor chats stay private."
    >
      {({ id }) => (
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.subject}
              {goal.examType ? ` · ${goal.examType}` : ''}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
