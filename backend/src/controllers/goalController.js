import { Assessment } from '../models/Assessment.js';
import { Conversation } from '../models/Conversation.js';
import { Goal } from '../models/Goal.js';
import { Plan } from '../models/Plan.js';
import { Progress } from '../models/Progress.js';

import { AllProvidersFailedError } from '../services/ai/errors.js';
import { buildTopicGraph, sanitise } from '../services/topicGraph.js';
import { ensureProgressRecords, summariseProgress } from '../services/progressService.js';
import { currentPlanFor, summarisePlan } from '../services/planService.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });

  res.json({ data: { goals } });
});

export const createGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.create({ ...req.body, user: req.user._id, status: 'draft' });

  res.status(201).json({ data: { goal } });
});

export const getGoal = asyncHandler(async (req, res) => {
  const plan = await currentPlanFor(req.goal);

  res.json({
    data: {
      goal: req.goal,
      progress: await summariseProgress(req.goal),
      plan: plan ? summarisePlan(plan, req.goal) : null,
    },
  });
});

export const updateGoal = asyncHandler(async (req, res) => {
  Object.assign(req.goal, req.body);
  await req.goal.save();

  res.json({ data: { goal: req.goal } });
});

export const deleteGoal = asyncHandler(async (req, res) => {
  const goalId = req.goal._id;

  // Nothing belonging to a deleted goal should outlive it.
  await Promise.all([
    Plan.deleteMany({ goal: goalId }),
    Progress.deleteMany({ goal: goalId }),
    Assessment.deleteMany({ goal: goalId }),
    Conversation.deleteMany({ goal: goalId }),
    req.goal.deleteOne(),
  ]);

  res.status(204).send();
});

/**
 * Asks the AI to break the subject into a topic graph. If no provider can be
 * reached the student is told plainly and pointed at manual entry, rather than
 * being left on a spinner or handed an invented syllabus.
 */
export const generateTopics = asyncHandler(async (req, res) => {
  let topics;

  try {
    topics = await buildTopicGraph(req.goal);
  } catch (error) {
    if (error instanceof AllProvidersFailedError) {
      throw ApiError.serviceUnavailable(
        'We could not reach the AI service to break this subject down. Try again in a moment, ' +
          'or add your syllabus topics yourself and we will build the plan around them.',
      );
    }

    throw error;
  }

  await applyTopics(req.goal, topics, { fromFallback: false });

  res.json({ data: { goal: req.goal, topics: req.goal.topics } });
});

/**
 * The manual route. Also what a student uses when their syllabus does not match
 * what the model produced.
 */
export const setTopics = asyncHandler(async (req, res) => {
  const topics = sanitise(
    req.body.topics.map((topic) => ({ ...topic, key: topic.title, prerequisites: topic.prerequisites ?? [] })),
  );

  await applyTopics(req.goal, topics, { fromFallback: true });

  res.json({ data: { goal: req.goal, topics: req.goal.topics } });
});

async function applyTopics(goal, topics, { fromFallback }) {
  // Replacing the graph invalidates everything measured against the old one.
  await Progress.deleteMany({ goal: goal._id });

  goal.topics = topics;
  goal.topicsGeneratedAt = new Date();
  goal.topicsFromFallback = fromFallback;
  goal.status = 'assessing';

  await goal.save();
  await ensureProgressRecords(goal);
}
