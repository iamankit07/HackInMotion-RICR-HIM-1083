import test from 'node:test';
import assert from 'node:assert/strict';

import { generateSchedule } from '../src/services/scheduler.js';
import { addDays, startOfDay, toDateKey } from '../src/utils/dates.js';

const TODAY = startOfDay('2026-08-12T00:00:00Z');

const topic = (key, overrides = {}) => ({
  key,
  title: key,
  summary: '',
  difficulty: 3,
  weight: 3,
  estimatedMinutes: 60,
  prerequisites: [],
  ...overrides,
});

const OS_TOPICS = [
  topic('processes', { title: 'Processes and Threads', weight: 5, estimatedMinutes: 90 }),
  topic('scheduling', { title: 'CPU Scheduling', prerequisites: ['processes'], weight: 4 }),
  topic('sync', { title: 'Synchronisation', prerequisites: ['processes'], weight: 5, difficulty: 5 }),
  topic('deadlock', { title: 'Deadlocks', prerequisites: ['sync'], weight: 3 }),
  topic('memory', { title: 'Memory Management', weight: 4, estimatedMinutes: 80 }),
  topic('virtual-memory', { title: 'Virtual Memory', prerequisites: ['memory'], weight: 5 }),
];

const masteryMap = (entries) =>
  new Map(Object.entries(entries).map(([key, mastery]) => [key, { mastery }]));

const plan = (overrides = {}) =>
  generateSchedule({
    topics: OS_TOPICS,
    progressByTopic: new Map(),
    from: TODAY,
    deadline: addDays(TODAY, 12),
    dailyMinutes: 120,
    studyDays: [0, 1, 2, 3, 4, 5, 6],
    ...overrides,
  });

const position = (sessions, session) =>
  sessions.findIndex((candidate) => candidate === session);

test('schedules every topic when there is enough time', () => {
  const { sessions, unscheduledTopicKeys } = plan();

  const learned = new Set(
    sessions.filter((session) => session.kind === 'learn').map((session) => session.topicKey),
  );

  assert.equal(unscheduledTopicKeys.length, 0);
  assert.equal(learned.size, OS_TOPICS.length);
});

test('never schedules a topic before its prerequisite', () => {
  const { sessions } = plan();
  const learning = sessions.filter((session) => session.kind === 'learn');

  for (const subject of OS_TOPICS) {
    for (const prerequisiteKey of subject.prerequisites) {
      const dependentStart = learning.find((session) => session.topicKey === subject.key);
      const prerequisiteEnd = learning.findLast(
        (session) => session.topicKey === prerequisiteKey,
      );

      assert.ok(dependentStart && prerequisiteEnd, `${subject.key} and its prerequisite both scheduled`);
      assert.ok(
        position(learning, prerequisiteEnd) < position(learning, dependentStart),
        `${prerequisiteKey} must finish before ${subject.key} starts`,
      );
    }
  }
});

test('never books more minutes into a day than the student has', () => {
  const dailyMinutes = 90;
  const { sessions } = plan({ dailyMinutes });

  const perDay = new Map();

  for (const session of sessions) {
    const key = toDateKey(session.date);
    perDay.set(key, (perDay.get(key) ?? 0) + session.minutes);
  }

  for (const [day, minutes] of perDay) {
    assert.ok(minutes <= dailyMinutes, `${day} was booked for ${minutes} of ${dailyMinutes} minutes`);
  }
});

test('never produces a session too short to be worth sitting down for', () => {
  for (const dailyMinutes of [45, 60, 90, 120, 200]) {
    const { sessions } = plan({ dailyMinutes });

    for (const session of sessions) {
      assert.ok(
        session.minutes >= 15,
        `${session.minutes}min session for ${session.title} at ${dailyMinutes}min/day`,
      );
    }
  }
});

test('spreads the work out when the student has more time than the syllabus needs', () => {
  // Ten days, roughly seven hours of material: studying should be paced, not
  // crammed into the first three days.
  const { sessions } = plan({ deadline: addDays(TODAY, 12), dailyMinutes: 240 });

  const daysUsed = new Set(sessions.map((session) => toDateKey(session.date)));

  assert.ok(daysUsed.size >= 7, `expected the work to spread out, it used ${daysUsed.size} days`);
});

test('gives a weak topic more time than a strong one of the same size', () => {
  const twoTopics = [
    topic('weak', { estimatedMinutes: 60 }),
    topic('strong', { estimatedMinutes: 60 }),
  ];

  const { sessions } = plan({
    topics: twoTopics,
    progressByTopic: masteryMap({ weak: 0.1, strong: 0.7 }),
  });

  const minutesFor = (key) =>
    sessions
      .filter((session) => session.topicKey === key && session.kind === 'learn')
      .reduce((sum, session) => sum + session.minutes, 0);

  assert.ok(
    minutesFor('weak') > minutesFor('strong'),
    `weak got ${minutesFor('weak')}, strong got ${minutesFor('strong')}`,
  );
});

test('puts the most urgent unblocked topic first', () => {
  const { sessions } = plan({
    progressByTopic: masteryMap({ processes: 0.9, memory: 0.05 }),
  });

  const firstLearn = sessions.find((session) => session.kind === 'learn');

  // Memory has no prerequisites and the student knows almost nothing about it,
  // so it should outrank the topic they have already mastered.
  assert.equal(firstLearn.topicKey, 'memory');
});

test('a mastered topic only gets a short refresh', () => {
  const { sessions } = plan({
    topics: [topic('known', { estimatedMinutes: 120 })],
    progressByTopic: masteryMap({ known: 0.95 }),
  });

  const total = sessions
    .filter((session) => session.kind === 'learn')
    .reduce((sum, session) => sum + session.minutes, 0);

  assert.ok(total <= 30, `expected a short refresh, got ${total} minutes`);
});

test('compresses the syllabus instead of dropping half of it when time is short', () => {
  const { sessions, diagnostics, unscheduledTopicKeys } = plan({
    deadline: addDays(TODAY, 4),
    dailyMinutes: 60,
  });

  const covered = new Set(
    sessions.filter((session) => session.kind === 'learn').map((session) => session.topicKey),
  );

  assert.ok(diagnostics.compression < 1, 'compression should engage');
  assert.ok(covered.size >= 4, `expected most topics to survive, got ${covered.size}`);
  assert.ok(unscheduledTopicKeys.length <= 2);
});

test('schedules revision and a mock test, not just first-pass learning', () => {
  const { sessions } = plan();

  assert.ok(sessions.some((session) => session.kind === 'revise'), 'revision sessions exist');
  assert.ok(sessions.some((session) => session.kind === 'test'), 'a mock test exists');
});

test('only uses the weekdays the student said they are free', () => {
  const weekendsOnly = [0, 6];
  const { sessions } = plan({ deadline: addDays(TODAY, 21), studyDays: weekendsOnly });

  for (const session of sessions) {
    assert.ok(
      weekendsOnly.includes(new Date(session.date).getUTCDay()),
      `${toDateKey(session.date)} is not a day the student study on`,
    );
  }
});

test('stops at the day before the deadline', () => {
  const deadline = addDays(TODAY, 10);
  const { sessions } = plan({ deadline });

  for (const session of sessions) {
    assert.ok(new Date(session.date) < deadline, 'nothing is scheduled on the exam day itself');
  }
});

test('returns an empty plan rather than throwing when the deadline has passed', () => {
  const result = plan({ deadline: addDays(TODAY, -3) });

  assert.equal(result.sessions.length, 0);
  assert.equal(result.unscheduledTopicKeys.length, OS_TOPICS.length);
});

test('handles a prerequisite cycle without hanging or losing topics', () => {
  const cyclic = [
    topic('a', { prerequisites: ['b'] }),
    topic('b', { prerequisites: ['a'] }),
    topic('c'),
  ];

  const { sessions } = plan({ topics: cyclic });
  const covered = new Set(sessions.map((session) => session.topicKey));

  assert.equal(covered.size >= 3, true, 'all three topics still appear');
});

test('ignores prerequisites that point at topics which do not exist', () => {
  const dangling = [topic('only', { prerequisites: ['ghost'] })];

  const { sessions, unscheduledTopicKeys } = plan({ topics: dangling });

  assert.equal(unscheduledTopicKeys.length, 0);
  assert.ok(sessions.length > 0);
});
