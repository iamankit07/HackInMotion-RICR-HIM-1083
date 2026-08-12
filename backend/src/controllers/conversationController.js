import { Conversation } from '../models/Conversation.js';

import { AllProvidersFailedError } from '../services/ai/errors.js';
import { answerQuestion, titleFromQuestion } from '../services/tutor.js';
import { summariseProgress } from '../services/progressService.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const UNAVAILABLE_REPLY =
  'I could not reach the tutor service just then, so this one is on me rather than you. ' +
  'Your question is saved — ask it again in a moment and I should be able to answer properly.';

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ goal: req.goal._id })
    .sort({ updatedAt: -1 })
    .select('title updatedAt createdAt messages');

  res.json({
    data: {
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        messageCount: conversation.messages.length,
        updatedAt: conversation.updatedAt,
      })),
    },
  });
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await loadOwnedConversation(req);

  res.json({ data: { conversation } });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await loadOwnedConversation(req);
  await conversation.deleteOne();

  res.status(204).send();
});

/**
 * Asks the tutor something. Creates the conversation on the first message so
 * the client never has to make two calls to start talking.
 */
export const askTutor = asyncHandler(async (req, res) => {
  const { question, topicKey } = req.body;

  const conversation = req.params.conversationId
    ? await loadOwnedConversation(req)
    : new Conversation({
        user: req.user._id,
        goal: req.goal._id,
        title: titleFromQuestion(question),
      });

  const topic = topicKey ? req.goal.topics.find((candidate) => candidate.key === topicKey) : null;

  if (topicKey && !topic) {
    throw ApiError.badRequest('That topic is not part of this learning goal.');
  }

  const history = [...conversation.messages];

  conversation.messages.push({ role: 'user', content: question, topicKey: topic?.key ?? null });

  let answer;
  let degraded = false;

  try {
    const { weakestTopics } = await summariseProgress(req.goal);

    answer = await answerQuestion({
      goal: req.goal,
      topic,
      weakAreas: weakestTopics.slice(0, 3),
      history,
      question,
    });
  } catch (error) {
    if (!(error instanceof AllProvidersFailedError)) {
      throw error;
    }

    // The question is kept and the failure is stated plainly, so the student
    // sees an honest reply in the thread instead of a lost message.
    answer = UNAVAILABLE_REPLY;
    degraded = true;
  }

  conversation.messages.push({
    role: 'assistant',
    content: answer,
    topicKey: topic?.key ?? null,
    degraded,
  });

  await conversation.save();

  res.status(req.params.conversationId ? 200 : 201).json({
    data: {
      conversation,
      reply: conversation.messages[conversation.messages.length - 1],
      degraded,
    },
  });
});

async function loadOwnedConversation(req) {
  const conversation = await Conversation.findById(req.params.conversationId);

  if (!conversation) {
    throw ApiError.notFound('We could not find that conversation.');
  }

  if (!conversation.user.equals(req.user._id)) {
    throw ApiError.forbidden('That conversation belongs to another account.');
  }

  return conversation;
}
