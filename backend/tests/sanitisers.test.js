import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitise } from '../src/services/topicGraph.js';
import { sanitiseQuestions } from '../src/services/quizGenerator.js';

const raw = (key, overrides = {}) => ({
  key,
  title: key,
  summary: '',
  difficulty: 3,
  weight: 3,
  estimatedMinutes: 60,
  prerequisites: [],
  ...overrides,
});

test('turns loose keys into slugs', () => {
  const [topic] = sanitise([raw('Virtual Memory & Paging!')]);

  assert.equal(topic.key, 'virtual-memory-paging');
});

test('makes duplicate keys unique and keeps prerequisites pointing somewhere real', () => {
  const topics = sanitise([raw('arrays'), raw('arrays'), raw('sorting', { prerequisites: ['arrays'] })]);

  const keys = topics.map((topic) => topic.key);

  assert.equal(new Set(keys).size, 3, 'every key is unique');
  assert.deepEqual(topics[2].prerequisites, ['arrays']);
});

test('drops prerequisites that point at topics which were never returned', () => {
  const [topic] = sanitise([raw('trees', { prerequisites: ['graphs', 'nothing-like-this'] })]);

  assert.deepEqual(topic.prerequisites, []);
});

test('drops a topic listing itself as its own prerequisite', () => {
  const [topic] = sanitise([raw('recursion', { prerequisites: ['recursion'] })]);

  assert.deepEqual(topic.prerequisites, []);
});

test('breaks a prerequisite cycle while keeping every topic', () => {
  const topics = sanitise([
    raw('a', { prerequisites: ['c'] }),
    raw('b', { prerequisites: ['a'] }),
    raw('c', { prerequisites: ['b'] }),
  ]);

  assert.equal(topics.length, 3);

  const edges = topics.flatMap((topic) => topic.prerequisites.map((from) => `${from}->${topic.key}`));

  assert.equal(edges.length, 2, 'exactly one edge is removed to open the loop');
  assert.ok(isAcyclic(topics), 'the result is a directed acyclic graph');
});

test('keeps a question whose options are valid', () => {
  const questions = sanitiseQuestions(
    [
      {
        topicKey: 'processes',
        prompt: 'What is a process?',
        options: ['A program in execution', 'A file', 'A compiler', 'A register'],
        correctIndex: 0,
        explanation: 'A process is a program that is running.',
        difficulty: 2,
      },
    ],
    [{ key: 'processes' }],
  );

  assert.equal(questions.length, 1);
  assert.equal(questions[0].correctIndex, 0);
});

test('follows the correct answer when duplicate options are collapsed', () => {
  const [question] = sanitiseQuestions(
    [
      {
        topicKey: 'processes',
        prompt: 'Pick one',
        options: ['same', 'same', 'right', 'other'],
        correctIndex: 2,
        explanation: '',
        difficulty: 3,
      },
    ],
    [{ key: 'processes' }],
  );

  assert.equal(question.options.length, 3);
  assert.equal(question.options[question.correctIndex], 'right');
});

test('throws away a question whose answer index points past the options', () => {
  const questions = sanitiseQuestions(
    [
      {
        topicKey: 'processes',
        prompt: 'Broken',
        options: ['a', 'b'],
        correctIndex: 7,
        explanation: '',
        difficulty: 3,
      },
    ],
    [{ key: 'processes' }],
  );

  assert.equal(questions.length, 0);
});

test('reassigns a question tagged with a topic that does not exist', () => {
  const [question] = sanitiseQuestions(
    [
      {
        topicKey: 'invented-topic',
        prompt: 'Still a fine question',
        options: ['a', 'b'],
        correctIndex: 0,
        explanation: '',
        difficulty: 3,
      },
    ],
    [{ key: 'processes' }],
  );

  assert.equal(question.topicKey, 'processes');
});

function isAcyclic(topics) {
  const byKey = new Map(topics.map((topic) => [topic.key, topic]));
  const state = new Map();

  const walk = (key) => {
    if (state.get(key) === 1) return false;
    if (state.get(key) === 2) return true;

    state.set(key, 1);

    for (const prerequisite of byKey.get(key).prerequisites) {
      if (!walk(prerequisite)) return false;
    }

    state.set(key, 2);
    return true;
  };

  return topics.every((topic) => walk(topic.key));
}
