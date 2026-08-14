import { Conversation } from '../models/Conversation.js';

import { AllProvidersFailedError } from '../services/ai/errors.js';
import { answerQuestion, titleFromQuestion } from '../services/tutor.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const UNAVAILABLE_REPLY =
  'I could not reach the tutor service just then, so this one is on me rather than you. ' +
  'Your question is saved — ask it again in a moment and I should be able to answer properly.';

/**
 * A doubt with no syllabus behind it.
 *
 * Not every question a student has belongs to a course they have set up, and
 * making somebody build a study plan before they can ask what a sesamoid bone
 * is would be absurd. These conversations carry no goal; the question is the
 * whole of it.
 */
export const askDoubt = asyncHandler(async (req, res) => {
  const { question } = req.body;

  const conversation = req.params.conversationId
    ? await loadOwnedDoubt(req)
    : new Conversation({
        user: req.user._id,
        goal: null,
        title: titleFromQuestion(question),
      });

  const history = [...conversation.messages];
  conversation.messages.push({ role: 'user', content: question });

  let answer;
  let degraded = false;

  try {
    // No goal, no topic, no weak areas — the tutor answers on the question
    // alone rather than pretending to know a syllabus.
    answer = await answerQuestion({ goal: null, topic: null, history, question });
  } catch (error) {
    if (!(error instanceof AllProvidersFailedError)) {
      throw error;
    }

    answer = UNAVAILABLE_REPLY;
    degraded = true;
  }

  conversation.messages.push({ role: 'assistant', content: answer, degraded });
  await conversation.save();

  res.status(req.params.conversationId ? 200 : 201).json({
    data: {
      conversation,
      reply: conversation.messages[conversation.messages.length - 1],
      degraded,
    },
  });
});

export const listDoubts = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ user: req.user._id, goal: null })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select('title updatedAt messages');

  res.json({
    data: {
      doubts: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        messageCount: conversation.messages.length,
        updatedAt: conversation.updatedAt,
      })),
    },
  });
});

export const getDoubt = asyncHandler(async (req, res) => {
  res.json({ data: { conversation: await loadOwnedDoubt(req) } });
});

/**
 * Only the asker's own goal-free conversations. Scoping on both the id and the
 * user is what stops one student reading another's by guessing an id.
 */
async function loadOwnedDoubt(req) {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    user: req.user._id,
    goal: null,
  });

  if (!conversation) {
    throw ApiError.notFound('We could not find that question.');
  }

  return conversation;
}
