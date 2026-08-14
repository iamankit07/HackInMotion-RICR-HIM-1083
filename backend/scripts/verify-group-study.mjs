/**
 * Group study, with the authorisation boundary tested first.
 *
 * Sharing progress between accounts is the only place data crosses between
 * students, so most of this script is about what must NOT be reachable.
 *
 *   node scripts/verify-group-study.mjs
 */
const API = 'http://localhost:5000/api';

const call = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
};

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(46)} got ${JSON.stringify(actual)}${pass ? '' : ` expected ${JSON.stringify(expected)}`}`);
};

async function makeStudent(name, subject) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const reg = await call('POST', '/auth/register', { name, email, password: 'TestPass123' });
  const token = reg.json?.data?.token;

  const goal = await call('POST', '/goals', {
    subject,
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    dailyMinutes: 90,
    studyDays: [0, 1, 2, 3, 4, 5, 6],
    confidence: 'beginner',
  }, token);
  const goalId = goal.json?.data?.goal?.id ?? goal.json?.data?.id;

  await call('PUT', `/goals/${goalId}/topics`, {
    topics: [
      { title: 'Bones', summary: 'Skeleton', difficulty: 3, weight: 4, estimatedMinutes: 90, prerequisites: [] },
      { title: 'Muscles', summary: 'Muscles', difficulty: 4, weight: 4, estimatedMinutes: 90, prerequisites: [] },
    ],
  }, token);
  await call('POST', `/goals/${goalId}/plan`, {}, token);

  return { name, token, goalId };
}

async function main() {
  const asha = await makeStudent('Asha', 'Human Anatomy');
  const brij = await makeStudent('Brij', 'Human Anatomy');
  const chen = await makeStudent('Chen', 'Physiology'); // never joins

  console.log('=== creating and joining ===');
  const created = await call('POST', '/groups', { name: 'MBBS First Year', goalId: asha.goalId }, asha.token);
  check('owner can create', created.status, 201);
  const group = created.json?.data?.group;
  check('join code is six characters', group.joinCode?.length, 6);

  const joined = await call('POST', '/groups/join', { joinCode: group.joinCode.toLowerCase(), goalId: brij.goalId }, brij.token);
  check('code is case-insensitive', joined.status, 201);

  const rejoin = await call('POST', '/groups/join', { joinCode: group.joinCode, goalId: brij.goalId }, brij.token);
  check('cannot join twice', rejoin.status, 400);

  const badCode = await call('POST', '/groups/join', { joinCode: 'ZZZZZZ', goalId: chen.goalId }, chen.token);
  check('unknown code is refused', badCode.status, 404);

  console.log('\n=== the authorisation boundary ===');
  const outsider = await call('GET', `/groups/${group.id}`, null, chen.token);
  check('non-member cannot read the group', outsider.status, 404);

  const anon = await call('GET', `/groups/${group.id}`, null, null);
  check('signed-out cannot read the group', anon.status, 401);

  // Attaching someone else's goal must be impossible.
  const stolen = await call('POST', '/groups/join', { joinCode: group.joinCode, goalId: asha.goalId }, chen.token);
  check('cannot join using another persons goal', stolen.status, 400);

  // Knowing a groupmate's goal id must still not grant access to it.
  const board = await call('GET', `/groups/${group.id}`, null, asha.token);
  const brijRow = board.json?.data?.members?.find((m) => m.name === 'Brij');
  const peek = await call('GET', `/goals/${brij.goalId}`, null, asha.token);
  check('groupmate cannot open the others goal', peek.status, 403);
  const peekPlan = await call('GET', `/goals/${brij.goalId}/plan`, null, asha.token);
  check('groupmate cannot read the others plan', peekPlan.status, 403);
  const peekChats = await call('GET', `/goals/${brij.goalId}/conversations`, null, asha.token);
  check('groupmate cannot read the others tutor chats', peekChats.status, 403);

  console.log('\n=== what the board actually exposes ===');
  check('board lists both members', board.json?.data?.members?.length, 2);
  const fields = Object.keys(brijRow ?? {}).sort();
  console.log(`  fields shared: ${fields.join(', ')}`);

  const forbidden = ['email', 'password', 'sessions', 'plan', 'conversations', 'questions', 'answers', 'notes', 'topics'];
  const leaked = forbidden.filter((key) => fields.includes(key));
  check('no private fields on the board', leaked, []);
  check('progress is shared', typeof brijRow?.completionPercent, 'number');
  check('streak is shared', typeof brijRow?.currentStreak, 'number');

  console.log('\n=== ranking and leaving ===');
  // Asha finishes a session, so she should out-rank Brij on points.
  const plan = (await call('GET', `/goals/${asha.goalId}/plan`, null, asha.token)).json?.data?.plan;
  await call('PATCH', `/goals/${asha.goalId}/sessions/${plan.sessions[0].id}`, { status: 'completed' }, asha.token);

  const ranked = await call('GET', `/groups/${group.id}`, null, brij.token);
  const rows = ranked.json?.data?.members ?? [];
  check('ranked by points, Asha first', rows[0]?.name, 'Asha');
  check('rank numbers assigned', rows.map((r) => r.rank), [1, 2]);

  const left = await call('POST', `/groups/${group.id}/leave`, {}, brij.token);
  check('member can leave', left.json?.data?.left, true);
  check('group survives while someone remains', left.json?.data?.groupDeleted, false);
  const afterLeave = await call('GET', `/groups/${group.id}`, null, brij.token);
  check('leaver loses access', afterLeave.status, 404);

  const lastOut = await call('POST', `/groups/${group.id}/leave`, {}, asha.token);
  check('last member out deletes the group', lastOut.json?.data?.groupDeleted, true);

  console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`} — group study`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
