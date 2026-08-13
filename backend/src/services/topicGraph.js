import { z } from 'zod';

import { generateJson } from './ai/index.js';
import { daysBetween } from '../utils/dates.js';

/**
 * Turns "Operating Systems, end-sem in 12 days" into a graph of topics the
 * scheduler can reason about.
 *
 * This is the one job the language model is genuinely better at than we are:
 * knowing that synchronisation depends on processes, that virtual memory is
 * where people lose marks, and roughly how long each takes to learn. Everything
 * it returns is treated as untrusted — keys are re-slugged, references to
 * topics that do not exist are dropped, and prerequisite cycles are broken —
 * because the scheduler assumes a clean directed acyclic graph.
 */

const MIN_TOPICS = 5;
const MAX_TOPICS = 16;

// The shape handed to the provider so it constrains generation server-side.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          difficulty: { type: 'integer' },
          weight: { type: 'integer' },
          estimatedMinutes: { type: 'integer' },
          prerequisites: { type: 'array', items: { type: 'string' } },
        },
        required: ['key', 'title', 'summary', 'difficulty', 'weight', 'estimatedMinutes', 'prerequisites'],
      },
    },
  },
  required: ['topics'],
};

// The shape we insist on before any of it reaches the database.
const topicSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(120),
  summary: z.string().max(400).default(''),
  difficulty: z.coerce.number().min(1).max(5).catch(3),
  weight: z.coerce.number().min(1).max(5).catch(3),
  estimatedMinutes: z.coerce.number().min(10).max(600).catch(60),
  prerequisites: z.array(z.string()).default([]),
});

const responseSchema = z.object({
  topics: z.array(topicSchema).min(1),
});

export async function buildTopicGraph(goal) {
  const days = Math.max(1, daysBetween(new Date(), goal.deadline));
  const totalMinutes = days * goal.dailyMinutes;
  const targetCount = clamp(Math.round(totalMinutes / 90), MIN_TOPICS, MAX_TOPICS);

  const { topics } = await generateJson({
    system:
      'You are an experienced exam coach. You break a subject into the specific topics a ' +
      'student is actually tested on, in the order they should be learned. You are honest ' +
      'about what takes time and what carries marks. You never pad a syllabus with filler.',
    prompt: buildPrompt(goal, { days, totalMinutes, targetCount }),
    schema: responseSchema,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.3,
    maxOutputTokens: 8192,
  });

  return sanitise(topics.slice(0, MAX_TOPICS));
}

function buildPrompt(goal, { days, totalMinutes, targetCount }) {
  const lines = [
    `Subject: ${goal.subject}`,
    goal.examType ? `Exam or context: ${goal.examType}` : null,
    goal.notes ? `The student adds: ${goal.notes}` : null,
    `They describe themselves as ${goal.confidence}.`,
    `They have ${days} days and about ${Math.round(totalMinutes / 60)} hours of study time in total.`,
    '',
    `Break this down into about ${targetCount} topics.`,
    '',
    'For each topic give:',
    '- key: a short lowercase slug with hyphens, unique within this list',
    '- title: what a student would call it',
    '- summary: one sentence on what it covers and why it matters for the exam',
    '- difficulty: 1 to 5, where 5 is the one students find hardest',
    '- weight: 1 to 5, how heavily it is examined relative to the other topics here',
    '- estimatedMinutes: focused study time to learn it properly from scratch',
    '- prerequisites: keys of topics from this same list that must be understood first',
    '',
    `Keep the total of estimatedMinutes near ${totalMinutes} minutes so the plan is realistic.`,
    'Only list a prerequisite when the topic is genuinely impossible to follow without it.',
    'Prerequisites must never form a loop.',
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * The model is right about the subject and careless about the data. This makes
 * the graph safe for the scheduler: unique slug keys, no self-references, no
 * references to topics that were never returned, and no cycles.
 */
export function sanitise(rawTopics) {
  const used = new Set();

  const topics = rawTopics.map((topic, index) => {
    let key = slugify(topic.key || topic.title) || `topic-${index + 1}`;

    while (used.has(key)) {
      key = `${key}-${index + 1}`;
    }

    used.add(key);

    return {
      ...topic,
      key,
      originalKey: slugify(topic.key || ''),
      difficulty: Math.round(topic.difficulty),
      weight: Math.round(topic.weight),
      estimatedMinutes: Math.round(topic.estimatedMinutes),
    };
  });

  // The model refers to topics by the keys it invented, which we may have
  // rewritten to make unique — map the old names onto the new ones.
  const remap = new Map();

  for (const topic of topics) {
    if (topic.originalKey && !remap.has(topic.originalKey)) {
      remap.set(topic.originalKey, topic.key);
    }
  }

  const known = new Set(topics.map((topic) => topic.key));

  for (const topic of topics) {
    topic.prerequisites = [
      ...new Set(
        topic.prerequisites
          .map((prerequisite) => remap.get(slugify(prerequisite)) ?? slugify(prerequisite))
          .filter((prerequisite) => known.has(prerequisite) && prerequisite !== topic.key),
      ),
    ];

    delete topic.originalKey;
  }

  return breakCycles(topics);
}

/**
 * Depth-first search, dropping any edge that points back into the branch we are
 * currently walking. Those edges are exactly the ones that make a cycle, and
 * removing them leaves the rest of the ordering intact.
 */
function breakCycles(topics) {
  const byKey = new Map(topics.map((topic) => [topic.key, topic]));
  const UNVISITED = 0;
  const VISITING = 1;
  const DONE = 2;
  const state = new Map(topics.map((topic) => [topic.key, UNVISITED]));

  const visit = (key) => {
    state.set(key, VISITING);

    const topic = byKey.get(key);
    const kept = [];

    for (const prerequisite of topic.prerequisites) {
      const prerequisiteState = state.get(prerequisite);

      if (prerequisiteState === VISITING) {
        continue; // this edge closes a loop, so leave it out
      }

      if (prerequisiteState === UNVISITED) {
        visit(prerequisite);
      }

      kept.push(prerequisite);
    }

    topic.prerequisites = kept;
    state.set(key, DONE);
  };

  for (const topic of topics) {
    if (state.get(topic.key) === UNVISITED) {
      visit(topic.key);
    }
  }

  return topics;
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
