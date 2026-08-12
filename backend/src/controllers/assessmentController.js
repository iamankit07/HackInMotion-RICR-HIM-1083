import { Assessment } from '../models/Assessment.js';

import { AllProvidersFailedError } from '../services/ai/errors.js';
import { generateDiagnosticQuiz, generateMockTest } from '../services/quizGenerator.js';
import { applyAssessmentResults, summariseProgress } from '../services/progressService.js';
import { buildPlanForGoal, currentPlanFor, summarisePlan } from '../services/planService.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Below this average on a mock test, the plan is rebuilt around what the
// student got wrong rather than carrying on as if nothing happened.
const REPLAN_THRESHOLD = 0.5;

export const listAssessments = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ goal: req.goal._id })
    .sort({ createdAt: -1 })
    .select('kind title score submittedAt createdAt questions');

  res.json({
    data: {
      assessments: assessments.map((assessment) => ({
        id: assessment.id,
        kind: assessment.kind,
        title: assessment.title,
        total: assessment.questions.length,
        score: assessment.score,
        submittedAt: assessment.submittedAt,
        createdAt: assessment.createdAt,
      })),
    },
  });
});

export const createDiagnostic = asyncHandler(async (req, res) => {
  requireTopics(req.goal);

  const questions = await generateOrFail(() =>
    generateDiagnosticQuiz(req.goal, { questionCount: req.body?.questionCount ?? 8 }),
  );

  const assessment = await Assessment.create({
    user: req.user._id,
    goal: req.goal._id,
    kind: 'diagnostic',
    title: `Where are you with ${req.goal.subject}?`,
    questions,
  });

  res.status(201).json({ data: { assessment: assessment.toQuestionPaper() } });
});

export const createMockTest = asyncHandler(async (req, res) => {
  requireTopics(req.goal);

  const requested = req.body?.topicKeys ?? [];
  const topics = requested.length
    ? req.goal.topics.filter((topic) => requested.includes(topic.key))
    : await topicsWorthTesting(req.goal);

  if (topics.length === 0) {
    throw ApiError.badRequest('None of those topics are part of this goal.');
  }

  const questions = await generateOrFail(() =>
    generateMockTest(req.goal, topics, { questionCount: req.body?.questionCount ?? 8 }),
  );

  const assessment = await Assessment.create({
    user: req.user._id,
    goal: req.goal._id,
    kind: 'mock',
    title: `Mock test — ${topics.map((topic) => topic.title).join(', ')}`,
    questions,
  });

  res.status(201).json({ data: { assessment: assessment.toQuestionPaper() } });
});

export const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await loadOwnedAssessment(req);

  res.json({
    data: {
      assessment: assessment.isSubmitted
        ? assessment.toResultSheet()
        : assessment.toQuestionPaper(),
    },
  });
});

export const submitAssessment = asyncHandler(async (req, res) => {
  const assessment = await loadOwnedAssessment(req);

  if (assessment.isSubmitted) {
    throw ApiError.conflict('You have already submitted this one.');
  }

  for (const { questionIndex, selectedIndex } of req.body.answers) {
    const question = assessment.questions[questionIndex];

    if (!question) {
      throw ApiError.badRequest(`There is no question ${questionIndex} in this test.`);
    }

    if (selectedIndex >= question.options.length) {
      throw ApiError.badRequest(`Question ${questionIndex} has no option ${selectedIndex}.`);
    }

    question.selectedIndex = selectedIndex;
  }

  assessment.score = assessment.questions.filter(
    (question) => question.selectedIndex === question.correctIndex,
  ).length;
  assessment.submittedAt = new Date();

  await assessment.save();
  await applyAssessmentResults(req.goal, assessment);

  const response = {
    assessment: assessment.toResultSheet(),
    progress: await summariseProgress(req.goal),
  };

  const plan = await reactToResults(req.goal, assessment);

  if (plan) {
    response.plan = summarisePlan(plan, req.goal);
    response.planAction = plan.reason;
  }

  res.json({ data: response });
});

/**
 * The diagnostic exists to produce a plan, so finishing it builds one. A mock
 * test that goes badly rebuilds the existing plan around the gaps it exposed —
 * this is the adaptive re-planning, driven by evidence rather than a button.
 */
async function reactToResults(goal, assessment) {
  const existing = await currentPlanFor(goal);

  if (assessment.kind === 'diagnostic' && !existing) {
    const plan = await buildPlanForGoal(goal, { reason: 'initial' });

    goal.status = 'active';
    await goal.save();

    return plan;
  }

  if (assessment.kind === 'mock' && existing) {
    const accuracy = assessment.questions.length
      ? assessment.score / assessment.questions.length
      : 1;

    if (accuracy < REPLAN_THRESHOLD) {
      return buildPlanForGoal(goal, { reason: 'weak-retest' });
    }
  }

  return null;
}

/**
 * When no topics are named, test what the student has actually studied and is
 * weakest on — testing material they have not reached yet teaches nothing.
 */
async function topicsWorthTesting(goal) {
  const { byTopic } = await summariseProgress(goal);

  const studied = byTopic
    .filter((topic) => topic.minutesStudied > 0 || topic.questionsAnswered > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4)
    .map((topic) => topic.topicKey);

  const keys = studied.length > 0 ? studied : goal.topics.slice(0, 4).map((topic) => topic.key);

  return goal.topics.filter((topic) => keys.includes(topic.key));
}

function requireTopics(goal) {
  if (goal.topics.length === 0) {
    throw ApiError.badRequest('Generate the topics for this goal before taking a test.');
  }
}

async function generateOrFail(generate) {
  let questions;

  try {
    questions = await generate();
  } catch (error) {
    if (error instanceof AllProvidersFailedError) {
      throw ApiError.serviceUnavailable(
        'We could not reach the AI service to write your questions. Please try again in a moment.',
      );
    }

    throw error;
  }

  if (questions.length === 0) {
    throw ApiError.serviceUnavailable(
      'The questions that came back were not usable. Please try again.',
    );
  }

  return questions;
}

async function loadOwnedAssessment(req) {
  const assessment = await Assessment.findById(req.params.assessmentId);

  if (!assessment) {
    throw ApiError.notFound('We could not find that test.');
  }

  if (!assessment.user.equals(req.user._id)) {
    throw ApiError.forbidden('That test belongs to another account.');
  }

  return assessment;
}
