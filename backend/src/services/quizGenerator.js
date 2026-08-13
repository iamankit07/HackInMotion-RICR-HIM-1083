import { z } from 'zod';

import { generateJson } from './ai/index.js';

/**
 * Writes the diagnostic quiz that measures what a student actually knows, and
 * the mock tests that check whether the plan is working.
 *
 * The diagnostic is deliberately spread thin — one or two questions across many
 * topics — because its job is to find weak areas quickly, not to grade anyone.
 * Mock tests go the other way and dig into a handful of topics the student has
 * just studied.
 */

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topicKey: { type: 'string' },
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
          difficulty: { type: 'integer' },
        },
        required: ['topicKey', 'prompt', 'options', 'correctIndex', 'explanation', 'difficulty'],
      },
    },
  },
  required: ['questions'],
};

const questionSchema = z.object({
  topicKey: z.string(),
  prompt: z.string().min(5),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.coerce.number().int().min(0),
  explanation: z.string().default(''),
  difficulty: z.coerce.number().min(1).max(5).catch(3),
});

const responseSchema = z.object({ questions: z.array(questionSchema).min(1) });

export async function generateDiagnosticQuiz(goal, { questionCount = 8 } = {}) {
  // Cover the topics that carry the most marks first — a diagnostic that misses
  // the heavily weighted material is not worth taking.
  const covered = [...goal.topics].sort((a, b) => b.weight - a.weight).slice(0, questionCount);

  const { questions } = await generateJson({
    system: DIAGNOSTIC_SYSTEM,
    prompt: [
      `Subject: ${goal.subject}`,
      goal.examType ? `Exam: ${goal.examType}` : null,
      `The student describes themselves as ${goal.confidence}.`,
      '',
      `Write exactly ${covered.length} multiple choice questions, one for each topic below.`,
      'Use the topic key exactly as written.',
      '',
      ...covered.map((topic) => `- ${topic.key}: ${topic.title} — ${topic.summary}`),
      '',
      'Each question needs four options, exactly one correct, and a one-sentence',
      'explanation of why the right answer is right.',
      'Pitch them so a student who understands the topic answers correctly and one',
      'who has only heard the name does not. Avoid trick questions and avoid',
      'options like "all of the above".',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: responseSchema,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.5,
    maxOutputTokens: 8192,
  });

  return sanitiseQuestions(questions, goal.topics);
}

export async function generateMockTest(goal, topics, { questionCount = 8 } = {}) {
  const { questions } = await generateJson({
    system: MOCK_TEST_SYSTEM,
    prompt: [
      `Subject: ${goal.subject}`,
      goal.examType ? `Exam: ${goal.examType}` : null,
      '',
      `Write ${questionCount} multiple choice questions covering these topics, which the`,
      'student has just studied. Spread the questions across them rather than',
      'testing one topic repeatedly. Use the topic key exactly as written.',
      '',
      ...topics.map((topic) => `- ${topic.key}: ${topic.title} — ${topic.summary}`),
      '',
      'Four options each, exactly one correct, and an explanation that teaches',
      'something rather than restating the answer.',
      'Mix straightforward recall with one or two that need real understanding.',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: responseSchema,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  return sanitiseQuestions(questions, topics);
}

const DIAGNOSTIC_SYSTEM =
  'You write diagnostic questions for exam preparation. Your questions reveal whether a ' +
  'student understands a topic or has only memorised the vocabulary. You never write ' +
  'ambiguous questions and you never write more than one correct option.';

const MOCK_TEST_SYSTEM =
  'You write practice exam questions. They are the difficulty a student would actually ' +
  'face, and your explanations teach the underlying idea so a wrong answer is still ' +
  'worth something.';

/**
 * Drops anything the model got wrong rather than storing a broken question: an
 * answer index pointing past the end of the options, duplicate options, or a
 * topic key that was never in the graph.
 */
export function sanitiseQuestions(questions, topics) {
  const known = new Set(topics.map((topic) => topic.key));
  const fallbackKey = topics[0]?.key;

  return questions
    .map((question) => {
      const options = [...new Set(question.options.map((option) => option.trim()))];
      const correct = question.options[question.correctIndex]?.trim();
      const correctIndex = options.indexOf(correct);

      return {
        ...question,
        topicKey: known.has(question.topicKey) ? question.topicKey : fallbackKey,
        options,
        correctIndex,
        difficulty: Math.round(question.difficulty),
      };
    })
    .filter(
      (question) =>
        question.topicKey &&
        question.options.length >= 2 &&
        question.correctIndex >= 0 &&
        question.correctIndex < question.options.length,
    );
}
