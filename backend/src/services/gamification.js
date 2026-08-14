import { Plan } from '../models/Plan.js';
import { Progress } from '../models/Progress.js';
import { startOfDay } from '../utils/dates.js';

/**
 * Streaks, points and badges.
 *
 * Nothing here is stored. Every number is derived from work the student has
 * already done — sessions carry the moment they were ticked off, progress
 * records carry mastery — so there is no second copy of the truth to drift out
 * of step, nothing to backfill, and no way for a missed write to quietly cost
 * someone their streak. Rebuilding a plan keeps the old versions, so the
 * history a streak is counted from survives re-planning.
 */

const POINTS = {
  session: 10,
  perTenMinutes: 1,
  topicMastered: 25,
  assessment: 20,
  perfectAssessment: 30,
};

/** A day counts once, however many sessions were finished in it. */
function studyDays(plans) {
  const days = new Set();

  for (const plan of plans) {
    for (const session of plan.sessions) {
      if (session.status === 'completed' && session.completedAt) {
        days.add(startOfDay(session.completedAt).getTime());
      }
    }
  }

  return [...days].sort((a, b) => a - b);
}

/**
 * Counts back from today, or from yesterday if nothing has been done yet
 * today — a streak should not be declared broken at one minute past midnight,
 * before the student has had the day to study.
 */
function streaksFrom(days, today = new Date()) {
  if (days.length === 0) {
    return { current: 0, longest: 0, studiedToday: false };
  }

  const DAY = 86400000;
  const todayStart = startOfDay(today).getTime();
  const set = new Set(days);
  const studiedToday = set.has(todayStart);

  let current = 0;
  let cursor = studiedToday ? todayStart : todayStart - DAY;

  while (set.has(cursor)) {
    current += 1;
    cursor -= DAY;
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] - days[i - 1] === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return { current, longest: Math.max(longest, current), studiedToday };
}

const BADGES = [
  { key: 'first-session', name: 'Off the mark', earned: (s) => s.sessionsCompleted >= 1, hint: 'Finish your first session' },
  { key: 'ten-sessions', name: 'Ten down', earned: (s) => s.sessionsCompleted >= 10, hint: 'Finish 10 sessions' },
  { key: 'fifty-sessions', name: 'Fifty deep', earned: (s) => s.sessionsCompleted >= 50, hint: 'Finish 50 sessions' },
  { key: 'streak-3', name: 'Three in a row', earned: (s) => s.longestStreak >= 3, hint: 'Study three days running' },
  { key: 'streak-7', name: 'A full week', earned: (s) => s.longestStreak >= 7, hint: 'Study seven days running' },
  { key: 'streak-30', name: 'A month of it', earned: (s) => s.longestStreak >= 30, hint: 'Study thirty days running' },
  { key: 'five-hours', name: 'Five hours in', earned: (s) => s.minutesStudied >= 300, hint: 'Study for five hours' },
  { key: 'twenty-hours', name: 'Twenty hours in', earned: (s) => s.minutesStudied >= 1200, hint: 'Study for twenty hours' },
  { key: 'first-mastered', name: 'One down', earned: (s) => s.topicsMastered >= 1, hint: 'Get a topic to mastered' },
  { key: 'five-mastered', name: 'Five solid', earned: (s) => s.topicsMastered >= 5, hint: 'Get five topics to mastered' },
  { key: 'first-test', name: 'Tested', earned: (s) => s.assessmentsTaken >= 1, hint: 'Take a test' },
  { key: 'perfect-test', name: 'Full marks', earned: (s) => s.perfectAssessments >= 1, hint: 'Score full marks on a test' },
];

/**
 * @param scope  { user } for everything they have ever done, or
 *               { user, goal } for one subject.
 */
export async function summariseAchievements(scope, { assessments = [] } = {}) {
  const query = scope.goal ? { user: scope.user, goal: scope.goal } : { user: scope.user };

  // Every version, not just the current plan: rebuilding must not erase the
  // record of work already done.
  const plans = await Plan.find(query).select('sessions').lean();
  const progress = await Progress.find(query).select('status mastery').lean();

  const completed = plans.flatMap((plan) =>
    plan.sessions.filter((session) => session.status === 'completed'),
  );

  const minutesStudied = completed.reduce((sum, session) => sum + (session.minutes ?? 0), 0);
  const topicsMastered = progress.filter((record) => record.status === 'mastered').length;

  const perfectAssessments = assessments.filter(
    (a) => a.submittedAt && a.questions?.length && a.score === a.questions.length,
  ).length;

  const days = studyDays(plans);
  const { current, longest, studiedToday } = streaksFrom(days);

  const stats = {
    sessionsCompleted: completed.length,
    minutesStudied,
    topicsMastered,
    assessmentsTaken: assessments.filter((a) => a.submittedAt).length,
    perfectAssessments,
    currentStreak: current,
    longestStreak: longest,
    studiedToday,
    daysStudied: days.length,
  };

  stats.points =
    stats.sessionsCompleted * POINTS.session +
    Math.floor(stats.minutesStudied / 10) * POINTS.perTenMinutes +
    stats.topicsMastered * POINTS.topicMastered +
    stats.assessmentsTaken * POINTS.assessment +
    stats.perfectAssessments * POINTS.perfectAssessment;

  const badges = BADGES.map(({ key, name, earned, hint }) => ({
    key,
    name,
    hint,
    earned: earned(stats),
  }));

  return {
    ...stats,
    badges,
    badgesEarned: badges.filter((badge) => badge.earned).length,
    badgesTotal: badges.length,
  };
}
