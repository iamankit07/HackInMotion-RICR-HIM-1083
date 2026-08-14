/**
 * Proves the adaptive re-planning path end to end.
 *
 * A plan only falls behind after days pass, which a test cannot wait for, so
 * this builds a real plan through the API and then ages it in the database
 * before asking the server what today looks like.
 *
 *   node scripts/verify-adaptive-replan.mjs
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

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  const email = `replan-${Date.now()}@example.com`;
  const reg = await call('POST', '/auth/register', { name: 'Replan', email, password: 'TestPass123' });
  const token = reg.json?.data?.token;

  const goal = await call('POST', '/goals', {
    subject: 'Human Anatomy',
    deadline: new Date(Date.now() + 20 * 86400000).toISOString(),
    dailyMinutes: 90,
    studyDays: [0, 1, 2, 3, 4, 5, 6],
    confidence: 'beginner',
  }, token);
  const goalId = goal.json?.data?.goal?.id ?? goal.json?.data?.id;

  await call('PUT', `/goals/${goalId}/topics`, {
    topics: [
      { title: 'Bones and Skeleton', summary: 'Skeleton', difficulty: 3, weight: 4, estimatedMinutes: 120, prerequisites: [] },
      { title: 'Muscles', summary: 'Muscles', difficulty: 4, weight: 4, estimatedMinutes: 120, prerequisites: [] },
      { title: 'Blood Vessels', summary: 'Vessels', difficulty: 4, weight: 4, estimatedMinutes: 120, prerequisites: [] },
    ],
  }, token);

  await call('POST', `/goals/${goalId}/plan`, {}, token);

  await mongoose.connect(env.MONGODB_URI);

  const plan = await Plan.findOne({ goal: goalId, isCurrent: true });
  const before = { version: plan.version, sessions: plan.sessions.length };

  // Age the plan: sessions sat in the past untouched, and the plan itself was
  // built days ago so the once-a-day guard does not suppress the rebuild.
  plan.sessions.forEach((session, index) => {
    session.date = daysAgo(4 - Math.min(index, 3));
  });
  plan.startDate = daysAgo(4);
  await plan.save({ timestamps: false });

  // Mongoose marks createdAt immutable, so assigning it on the document is
  // silently dropped. The raw driver is the only way to age a plan.
  await Plan.collection.updateOne(
    { _id: plan._id },
    { $set: { createdAt: daysAgo(4), updatedAt: daysAgo(4) } },
  );

  const pending = plan.sessions.filter((s) => s.status === 'pending' && s.date < new Date()).length;
  console.log(`plan v${before.version}: ${before.sessions} sessions, ${pending} now in the past and unfinished`);

  const today = await call('GET', `/goals/${goalId}/today`, null, token);
  const auto = today.json?.data?.autoRebuilt;

  console.log(`\nGET /today -> ${today.status}`);
  console.log(`autoRebuilt : ${auto ? JSON.stringify(auto) : 'null  <-- did NOT rebuild'}`);

  const after = await Plan.findOne({ goal: goalId, isCurrent: true }).lean();
  console.log(`plan version: ${before.version} -> ${after.version}`);
  console.log(`reason      : ${after.reason}`);

  const versions = await Plan.countDocuments({ goal: goalId });
  console.log(`versions kept: ${versions} (history preserved)`);

  // Asking again the same day must not rebuild a second time.
  const again = await call('GET', `/goals/${goalId}/today`, null, token);
  const secondAuto = again.json?.data?.autoRebuilt;
  const afterAgain = await Plan.findOne({ goal: goalId, isCurrent: true }).lean();
  console.log(`\nsecond visit today -> autoRebuilt=${secondAuto ? 'YES (would churn)' : 'null (guard held)'}  version=${afterAgain.version}`);

  const pass =
    auto && auto.missedSessions >= 2 && after.version === before.version + 1 &&
    after.reason === 'behind-schedule' && !secondAuto && afterAgain.version === after.version;

  console.log(`\n${pass ? 'PASS' : 'FAIL'} — adaptive re-planning on missed sessions`);

  await mongoose.disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
