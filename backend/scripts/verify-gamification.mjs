/**
 * Checks streaks, points and badges against work that really happened.
 *
 * Study days cannot be waited for, so this completes sessions through the API
 * and then backdates when they were ticked off, which is the only input the
 * streak is counted from.
 *
 *   node scripts/verify-gamification.mjs
 */
import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Plan } from '../src/models/Plan.js';

const API = 'http://localhost:5000/api';

const call = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
};

const dayStart = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
};

let failures = 0;
const check = (label, actual, expected) => {
  const pass = actual === expected;
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} got ${actual}${pass ? '' : `, expected ${expected}`}`);
};

async function main() {
  const email = `game-${Date.now()}@example.com`;
  const reg = await call('POST', '/auth/register', { name: 'Game', email, password: 'TestPass123' });
  const token = reg.json?.data?.token;

  const goal = await call('POST', '/goals', {
    subject: 'Human Anatomy',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    dailyMinutes: 120,
    studyDays: [0, 1, 2, 3, 4, 5, 6],
    confidence: 'beginner',
  }, token);
  const goalId = goal.json?.data?.goal?.id ?? goal.json?.data?.id;

  await call('PUT', `/goals/${goalId}/topics`, {
    topics: [
      { title: 'Bones', summary: 'Skeleton', difficulty: 3, weight: 4, estimatedMinutes: 100, prerequisites: [] },
      { title: 'Muscles', summary: 'Muscles', difficulty: 4, weight: 4, estimatedMinutes: 100, prerequisites: [] },
      { title: 'Nerves', summary: 'Nerves', difficulty: 4, weight: 4, estimatedMinutes: 100, prerequisites: [] },
    ],
  }, token);
  await call('POST', `/goals/${goalId}/plan`, {}, token);

  console.log('=== nothing done yet ===');
  let a = (await call('GET', `/goals/${goalId}/achievements`, null, token)).json?.data?.achievements;
  check('current streak', a.currentStreak, 0);
  check('points', a.points, 0);
  check('badges earned', a.badgesEarned, 0);
  check('studied today', a.studiedToday, false);

  // Complete four sessions, then place them on today and the three days before.
  const plan = (await call('GET', `/goals/${goalId}/plan`, null, token)).json?.data?.plan;
  const ids = plan.sessions.slice(0, 4).map((s) => s.id);
  for (const id of ids) {
    await call('PATCH', `/goals/${goalId}/sessions/${id}`, { status: 'completed' }, token);
  }

  await mongoose.connect(env.MONGODB_URI);
  const doc = await Plan.findOne({ goal: goalId, isCurrent: true });
  ids.forEach((id, index) => {
    const session = doc.sessions.id(id);
    session.completedAt = dayStart(index); // today, yesterday, -2, -3
  });
  await doc.save({ timestamps: false });
  const minutes = ids.reduce((sum, id) => sum + doc.sessions.id(id).minutes, 0);

  console.log('\n=== four sessions, four consecutive days ending today ===');
  a = (await call('GET', `/goals/${goalId}/achievements`, null, token)).json?.data?.achievements;
  check('sessions completed', a.sessionsCompleted, 4);
  check('distinct study days', a.daysStudied, 4);
  check('current streak', a.currentStreak, 4);
  check('longest streak', a.longestStreak, 4);
  check('studied today', a.studiedToday, true);
  check('minutes studied', a.minutesStudied, minutes);
  check('points', a.points, 4 * 10 + Math.floor(minutes / 10));
  check('"Three in a row" earned', a.badges.find((b) => b.key === 'streak-3').earned, true);
  check('"A full week" not earned', a.badges.find((b) => b.key === 'streak-7').earned, false);
  check('"Off the mark" earned', a.badges.find((b) => b.key === 'first-session').earned, true);

  // Break the run: move the most recent completion two days back so there is a
  // gap between it and today.
  const fresh = await Plan.findOne({ goal: goalId, isCurrent: true });
  fresh.sessions.id(ids[0]).completedAt = dayStart(5);
  await fresh.save({ timestamps: false });

  console.log('\n=== streak broken by a gap ===');
  a = (await call('GET', `/goals/${goalId}/achievements`, null, token)).json?.data?.achievements;
  check('studied today', a.studiedToday, false);
  check('current streak counts back from yesterday', a.currentStreak, 3);
  check('longest streak remembered', a.longestStreak, 3);
  check('sessions still counted', a.sessionsCompleted, 4);

  console.log('\n=== rebuilding the plan must not erase history ===');
  await call('POST', `/goals/${goalId}/plan/replan`, { reason: 'requested' }, token);
  a = (await call('GET', `/goals/${goalId}/achievements`, null, token)).json?.data?.achievements;
  check('sessions survive a rebuild', a.sessionsCompleted, 4);
  check('streak survives a rebuild', a.longestStreak, 3);

  console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`} — gamification`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
