/**
 * The scheduler caps a single sitting at 50 minutes, so a topic worth more than
 * that is split across several sessions — 68 minutes becomes 50 + 18. That is
 * deliberate, but on screen it just looks like the same topic listed twice with
 * no explanation.
 *
 * This works out, for each session, whether it is one part of a longer topic
 * and which part it is, so the rows can say so.
 */
export function withPartNumbers(sessions = []) {
  const counts = new Map();

  const keyOf = (session) => `${String(session.date).slice(0, 10)}|${session.topicKey}|${session.kind}`;

  for (const session of sessions) {
    const key = keyOf(session);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map();

  return sessions.map((session) => {
    const key = keyOf(session);
    const partCount = counts.get(key) ?? 1;

    if (partCount < 2) {
      return { ...session, part: 1, partCount: 1 };
    }

    const part = (seen.get(key) ?? 0) + 1;
    seen.set(key, part);

    return { ...session, part, partCount };
  });
}
