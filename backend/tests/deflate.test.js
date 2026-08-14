import test from 'node:test';
import assert from 'node:assert/strict';

import { deflate, deflateDeep } from '../src/services/ai/deflate.js';

test('replaces the words that mark text as machine-written', () => {
  assert.equal(deflate('This is crucial for the exam.'), 'This matters for the exam.');
  assert.equal(deflate('An essential concept.'), 'An important concept.');
  assert.equal(deflate('A comprehensive guide.'), 'A complete guide.');
  assert.equal(deflate('Let us delve into it.'), 'Let us look at it.');
  assert.equal(deflate('It plays a crucial role in digestion.'), 'It is central to digestion.');
});

test('keeps the capitalisation it found', () => {
  assert.equal(deflate('Crucial for marks.'), 'Important for marks.');
  assert.equal(deflate('crucial for marks.'), 'important for marks.');
});

test('turns a clause-joining dash into a comma', () => {
  assert.equal(
    deflate('The pump moves ions — this keeps the charge negative.'),
    'The pump moves ions, this keeps the charge negative.',
  );
});

test('leaves dashes that are not joining clauses', () => {
  assert.equal(deflate('See pages 10—12.'), 'See pages 10—12.');
  assert.equal(deflate('The 1990—91 season.'), 'The 1990—91 season.');
});

test('only matches whole words', () => {
  // Nothing here should change: these merely contain a banned word as a substring.
  for (const text of ['The crucially placed valve.', 'Essentially the same.', 'Vitality matters.']) {
    assert.equal(deflate(text), text);
  }
});

test('does not touch the science it is cleaning', () => {
  const source = 'Na⁺ crosses the membrane, and K⁺ leaks out. The ratio is 3:2.';
  assert.equal(deflate(source), source);
});

test('leaves markdown structure alone', () => {
  const notes = '## What you need to know\n\n**Bold heading**\n\n1. First\n2. Second';
  assert.equal(deflate(notes), notes);
});

test('survives empty and non-string input', () => {
  assert.equal(deflate(''), '');
  assert.equal(deflate(null), null);
  assert.equal(deflate(undefined), undefined);
  assert.equal(deflate(42), 42);
});

test('cleans every string inside a parsed response, at any depth', () => {
  const response = {
    topics: [
      { title: 'Crucial Concepts', summary: 'This is crucial for the exam.', difficulty: 3 },
      { title: 'Safe Title', summary: 'Nothing to change here.', prerequisites: ['a-key'] },
    ],
  };

  const cleaned = deflateDeep(response);

  assert.equal(cleaned.topics[0].title, 'Important Concepts');
  assert.equal(cleaned.topics[0].summary, 'This matters for the exam.');
  assert.equal(cleaned.topics[1].summary, 'Nothing to change here.');

  // Numbers, arrays and keys have to come through untouched — the scheduler
  // reads all three and a mangled key would break the topic graph.
  assert.equal(cleaned.topics[0].difficulty, 3);
  assert.deepEqual(cleaned.topics[1].prerequisites, ['a-key']);
});

test('does not mangle a slug that contains a banned word', () => {
  // Keys are matched against the graph, so changing one would silently orphan
  // a prerequisite.
  const cleaned = deflateDeep({ key: 'essential-nutrients', prerequisites: ['vital-organs'] });

  assert.equal(cleaned.key, 'essential-nutrients');
  assert.deepEqual(cleaned.prerequisites, ['vital-organs']);
});

test('tidies up after itself', () => {
  assert.equal(deflate('It is crucial  ,  really.'), 'It is important, really.');
});
