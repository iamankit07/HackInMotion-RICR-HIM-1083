import { generateText } from './ai/index.js';

/**
 * The doubt-solving assistant.
 *
 * What makes the answers useful is not the model, it is the context: the tutor
 * is told which subject the student is preparing for, which topic they are
 * looking at right now, and which areas they scored badly on. A question like
 * "why does this deadlock?" gets answered in terms of the syllabus the student
 * is actually sitting, at the level they are actually at.
 */

const HISTORY_LIMIT = 12;

export function answerQuestion({ goal, topic, weakAreas = [], history = [], question }) {
  const messages = [
    ...history.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: question },
  ];

  return generateText({
    system: buildSystemPrompt({ goal, topic, weakAreas }),
    messages,
    temperature: 0.6,
    maxOutputTokens: 1200,
  });
}

function buildSystemPrompt({ goal, topic, weakAreas }) {
  const lines = [
    `You are a patient tutor helping a student prepare for ${goal.examType || goal.subject}.`,
    `The subject is ${goal.subject} and the student is at a ${goal.confidence} level.`,
  ];

  if (topic) {
    lines.push(`They are currently studying "${topic.title}" — ${topic.summary}`);
  }

  if (weakAreas.length > 0) {
    lines.push(
      `Their diagnostic showed they struggle most with: ${weakAreas.map((area) => area.title).join(', ')}. ` +
        'Where it is relevant, connect your explanation back to those.',
    );
  }

  lines.push(
    '',
    'How to answer:',
    '- Start with the direct answer, then explain it. Do not warm up with preamble.',
    '- Explain in plain language and use a concrete example wherever one exists.',
    '- Keep it to a few short paragraphs. This is a student mid-revision, not a textbook.',
    '- If they have a misconception, name it and correct it rather than talking around it.',
    '- Use simple formatting: short paragraphs, and a list only when the content is genuinely a list.',
    `- If they ask about something outside ${goal.subject}, answer briefly and bring them back to what they are meant to be studying.`,
    '- If you are not certain about a fact, say so rather than inventing it.',
  );

  return lines.join('\n');
}

/**
 * A short title for a new conversation, taken from the first question so the
 * chat history is scannable. Deliberately does not call the model — this runs
 * on every first message and is not worth a round trip.
 */
export function titleFromQuestion(question) {
  const cleaned = question.replace(/\s+/g, ' ').trim();
  return cleaned.length <= 60 ? cleaned : `${cleaned.slice(0, 57)}...`;
}
