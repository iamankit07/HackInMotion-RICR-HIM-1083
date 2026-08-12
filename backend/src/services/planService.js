import { Plan } from '../models/Plan.js';
import { generateSchedule } from './scheduler.js';
import { progressMapFor } from './progressService.js';

/**
 * Wraps the scheduler with the bits that touch the database: reading the
 * student's current state, retiring the previous plan, and stamping a version
 * so the history of how the plan adapted is preserved rather than overwritten.
 */
export async function buildPlanForGoal(goal, { reason = 'initial', from = new Date() } = {}) {
  const progressByTopic = await progressMapFor(goal);

  const schedule = generateSchedule({
    topics: goal.topics,
    progressByTopic,
    from,
    deadline: goal.deadline,
    dailyMinutes: goal.dailyMinutes,
    studyDays: goal.studyDays,
  });

  const previous = await Plan.findOne({ goal: goal._id }).sort({ version: -1 }).lean();

  await Plan.updateMany({ goal: goal._id, isCurrent: true }, { $set: { isCurrent: false } });

  return Plan.create({
    user: goal.user,
    goal: goal._id,
    version: (previous?.version ?? 0) + 1,
    isCurrent: true,
    reason,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    sessions: schedule.sessions,
    unscheduledTopicKeys: schedule.unscheduledTopicKeys,
  });
}

export function currentPlanFor(goal) {
  return Plan.findOne({ goal: goal._id, isCurrent: true });
}

/**
 * How far behind the student is: sessions that were due before today and never
 * got ticked off. This is what decides whether the plan needs rebuilding.
 */
export function countMissedSessions(plan, today = new Date()) {
  const startOfToday = new Date(today);
  startOfToday.setUTCHours(0, 0, 0, 0);

  return plan.sessions.filter(
    (session) => session.status === 'pending' && session.date < startOfToday,
  ).length;
}

export function summarisePlan(plan, goal) {
  const sessions = plan.sessions;
  const completed = sessions.filter((session) => session.status === 'completed');
  const missed = countMissedSessions(plan);

  return {
    version: plan.version,
    startDate: plan.startDate,
    endDate: plan.endDate,
    totalSessions: sessions.length,
    completedSessions: completed.length,
    completionPercent: sessions.length
      ? Math.round((completed.length / sessions.length) * 100)
      : 0,
    totalMinutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
    completedMinutes: completed.reduce((sum, session) => sum + session.minutes, 0),
    missedSessions: missed,
    isBehind: missed > 0,
    daysRemaining: goal.daysRemaining,
    unscheduledTopicKeys: plan.unscheduledTopicKeys,
  };
}
