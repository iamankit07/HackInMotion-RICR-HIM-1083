import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { MasteryBar } from '../components/ProgressRing.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { formatMinutes } from '../lib/format.js';

/**
 * One group's board.
 *
 * Ranked by points rather than raw hours, so someone with less free time who
 * turns up every day is not permanently bottom. Everything shown here is a
 * number the member's own dashboard already shows them.
 */
export default function StudyGroup() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const { data, error, loading, reload } = useResource(() => api.groups.get(groupId), [groupId]);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return <Loading label="Loading the group" />;

  if (error) {
    return (
      <Notice title="We couldn't open that group" onRetry={reload}>
        {error.message}
      </Notice>
    );
  }

  const { group, members } = data;
  const active = members.filter((member) => member.available);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the code is on screen to read out anyway.
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      await api.groups.leave(groupId);
      navigate('/groups', { replace: true });
    } catch {
      setLeaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link
          to="/groups"
          className="ease-lakshya text-sm text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← All groups
        </Link>

        <p className="eyebrow mt-3">Study group · {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p>
        <h1 className="mt-1.5 text-3xl font-semibold sm:text-4xl">{group.name}</h1>
      </header>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-ink">Invite someone</p>
          <p className="mt-0.5 text-sm text-ink-muted">Share this code. They enter it under “Join with a code”.</p>
        </div>

        <div className="flex items-center gap-2">
          <code className="rounded-lg border border-line bg-sunk px-3 py-2 font-mono text-lg tracking-[0.3em] text-ink">
            {group.joinCode}
          </code>
          <Button variant="outline" size="sm" onClick={copyCode}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader eyebrow="How everyone is doing" title="Side by side" />

        <ul className="mt-5 flex flex-col divide-y divide-line border-t border-line">
          {active.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center gap-4 py-4">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                  member.rank === 1 ? 'bg-saffron text-on-accent' : 'bg-sunk text-ink-soft',
                ].join(' ')}
              >
                {member.rank}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold text-ink">{member.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {member.subject}
                  {member.examType ? ` · ${member.examType}` : ''}
                </p>

                <div className="mt-2 max-w-xs">
                  <MasteryBar value={member.completionPercent / 100} />
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <Stat label="Done" value={`${member.completionPercent}%`} />
                <Stat label="Streak" value={`${member.currentStreak}d`} highlight={member.currentStreak > 0} />
                <Stat label="Studied" value={formatMinutes(member.minutesStudied)} />
                <Stat label="Points" value={member.points.toLocaleString()} />
              </dl>
            </li>
          ))}
        </ul>

        {members.length > active.length && (
          <p className="mt-4 text-xs text-ink-muted">
            Some members have no plan to compare yet.
          </p>
        )}

        <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">
          Only progress is shared. Nobody in the group can see your quiz answers, your tutor
          conversations, or the plan itself.
        </p>
      </Card>

      <div>
        <Button variant="danger" size="sm" loading={leaving} onClick={leave}>
          Leave this group
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={['mt-0.5 font-semibold tabular-nums', highlight ? 'text-saffron' : 'text-ink'].join(' ')}>
        {value}
      </dd>
    </div>
  );
}
