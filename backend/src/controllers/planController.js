import { Plan } from '../models/Plan.js';

import { buildPlanForGoal, countMissedSessions, currentPlanFor, summarisePlan } from '../services/planService.js';
import { recordSessionCompleted, summariseProgress } from '../services/progressService.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isSameDay, startOfDay } from '../utils/dates.js';

export const createPlan = asyncHandler(async (req, res) => {
  if (req.goal.topics.length === 0) {
    throw ApiError.badRequest(
      'This goal has no topics yet. Generate them first so we know what to schedule.',
    );
  }

  const plan = await buildPlanForGoal(req.goal, { reason: 'initial' });

  req.goal.status = 'active';
  await req.goal.save();

  res.status(201).json({ data: { plan, summary: summarisePlan(plan, req.goal) } });
});

export const getPlan = asyncHandler(async (req, res) => {
  const plan = await currentPlanFor(req.goal);

  if (!plan) {
    throw ApiError.notFound('No study plan has been built for this goal yet.');
  }

  res.json({ data: { plan, summary: summarisePlan(plan, req.goal) } });
});

/**
 * Rebuilds the schedule around whatever is left. Everything already completed
 * is credited through the progress records, so re-planning moves the remaining
 * work forward instead of starting the syllabus again.
 */
export const replan = asyncHandler(async (req, res) => {
  const existing = await currentPlanFor(req.goal);

  if (!existing) {
    throw ApiError.notFound('There is no plan to rebuild yet.');
  }

  const missed = countMissedSessions(existing);
  const plan = await buildPlanForGoal(req.goal, {
    reason: req.body?.reason ?? (missed > 0 ? 'behind-schedule' : 'requested'),
  });

  res.json({
    data: {
      plan,
      summary: summarisePlan(plan, req.goal),
      rebuiltBecause: { missedSessions: missed },
    },
  });
});

/**
 * The history of how the plan changed. Read lean and shaped by hand — the
 * document virtuals would report zero minutes here because the sessions
 * themselves are deliberately not loaded.
 */
export const listPlanVersions = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ goal: req.goal._id }).sort({ version: -1 }).lean();

  res.json({
    data: {
      versions: plans.map((plan) => ({
        id: String(plan._id),
        version: plan.version,
        reason: plan.reason,
        isCurrent: plan.isCurrent,
        startDate: plan.startDate,
        endDate: plan.endDate,
        createdAt: plan.createdAt,
        totalSessions: plan.sessions.length,
        totalMinutes: plan.sessions.reduce((sum, session) => sum + session.minutes, 0),
        completedSessions: plan.sessions.filter((session) => session.status === 'completed').length,
      })),
    },
  });
});

/**
 * What the student sees when they open the app: today's sessions, where they
 * stand, and whether the plan has drifted out of date.
 */
export const getToday = asyncHandler(async (req, res) => {
  const plan = await currentPlanFor(req.goal);

  if (!plan) {
    throw ApiError.notFound('No study plan has been built for this goal yet.');
  }

  const today = startOfDay(new Date());
  const sessions = plan.sessions.filter((session) => isSameDay(session.date, today));
  const overdue = plan.sessions.filter(
    (session) => session.status === 'pending' && startOfDay(session.date) < today,
  );

  res.json({
    data: {
      date: today,
      sessions,
      overdue,
      summary: summarisePlan(plan, req.goal),
      progress: await summariseProgress(req.goal),
    },
  });
});

export const updateSession = asyncHandler(async (req, res) => {
  const plan = await currentPlanFor(req.goal);

  if (!plan) {
    throw ApiError.notFound('No study plan has been built for this goal yet.');
  }

  const session = plan.sessions.id(req.params.sessionId);

  if (!session) {
    throw ApiError.notFound('That session is not part of your current plan.');
  }

  const previousStatus = session.status;
  const { status } = req.body;

  session.status = status;
  session.completedAt = status === 'completed' ? new Date() : undefined;

  await plan.save();

  // Only credit the time the first time it is marked done, so toggling a
  // session on and off does not inflate how much has been studied.
  if (status === 'completed' && previousStatus !== 'completed') {
    await recordSessionCompleted(req.goal, session);
  }

  res.json({ data: { session, summary: summarisePlan(plan, req.goal) } });
});
