import { generateText } from './ai/index.js';

/**
 * The study material for one topic.
 *
 * A plan that only tells you what to study is half a product — the student
 * still has to go and find the material. These are the notes they would
 * otherwise write themselves: what the topic covers, the ideas that carry the
 * marks, the mistakes people make, and what to be able to do by the end.
 *
 * Written once per topic and stored on the goal. Regenerating on every visit
 * would burn the daily AI quota within an afternoon, and the notes for a fixed
 * syllabus topic do not change between readings anyway.
 */

export function writeTopicNotes({ goal, topic, mastery }) {
  return generateText({
    system: buildSystemPrompt({ goal, topic, mastery }),
    prompt:
      `Write the study notes for "${topic.title}".` +
      (topic.summary ? ` The syllabus describes it as: ${topic.summary}` : ''),
    temperature: 0.5,
    // Notes are longer than a chat reply, and the model's own reasoning is
    // charged against this budget as well.
    maxOutputTokens: 4000,
  });
}

function buildSystemPrompt({ goal, topic, mastery }) {
  const lines = [
    `You are writing revision notes for a student preparing for ${goal.examType || goal.subject}.`,
    `The subject is ${goal.subject}. They describe themselves as ${goal.confidence} level.`,
    `They have about ${topic.estimatedMinutes} minutes set aside for this topic.`,
  ];

  if (topic.prerequisites?.length) {
    lines.push(
      `They have already studied: ${topic.prerequisites.join(', ')}. You can build on those without re-teaching them.`,
    );
  }

  if (typeof mastery === 'number' && mastery > 0) {
    lines.push(
      mastery < 0.4
        ? 'Their diagnostic score on this topic was low, so start from the basics and do not assume much.'
        : 'They already scored reasonably on this topic, so keep the basics brief and spend the space on the harder parts.',
    );
  }

  lines.push(
    '',
    'Write the notes under exactly these headings, using "## " before each one:',
    '',
    '## The short version',
    'Three or four sentences a student could read the night before and still get value from.',
    '',
    '## What you need to know',
    'The actual content, broken into short paragraphs or a list. This is the bulk of it.',
    'Cover the ideas that carry marks, not everything that could be said about the topic.',
    '',
    '## Where students lose marks',
    'The specific mistakes and misconceptions examiners see on this topic.',
    '',
    '## Check yourself',
    'Three or four questions they should be able to answer before moving on. Questions only, no answers.',
    '',
    'How to write:',
    '- Plain language. Explain terms the first time you use them.',
    '- Be specific to this topic. Generic study advice is worthless here.',
    '- Use a concrete example wherever one exists.',
    '- Write in Unicode, not LaTeX: x² not $x^2$, √ not \\sqrt, Na⁺ not Na^+.',
    '- Do not pad. A student mid-revision will stop reading.',
    '- If you are unsure of a fact, leave it out rather than inventing it.',
    '',
    // These notes are the main thing a student reads on the topic page, so they
    // must not read as though a machine produced them.
    'Sound like a teacher, not a generator:',
    '- Never join two clauses with a dash. Start a new sentence.',
    '- No "not just X, but Y" phrasing, and no other balanced contrast.',
    '- Vary sentence length. Three sentences of the same shape in a row reads as filler.',
    '- Contractions are fine and usually better.',
    '- Skip comprehensive, crucial, essential, fundamental, vital, delve, robust and seamless.',
    '- Do not open with "In this section" or close by summarising what you just said.',
  );

  return lines.join('\n');
}
