import { Assessment } from '../models/Assessment.js';
import { Goal } from '../models/Goal.js';
import { User } from '../models/User.js';

import { summariseAchievements } from './gamification.js';
import { currentPlanFor, summarisePlan } from './planService.js';

/**
 * What one member of a study group is allowed to see of another.
 *
 * This is the only place data crosses between accounts, so the shape is built
 * by hand rather than by serialising documents. Everything included is a
 * number or a title the student chose; nothing is copied through that they
 * would not read out to the group themselves.
 *
 * Deliberately never included: study plans, tutor conversations, quiz
 * questions and answers, topic notes, email addresses. A groupmate learning
 * that someone is 40% through says nothing about what they got wrong.
 */
export async function buildLeaderboard(group) {
  const rows = await Promise.all(
    group.members.map(async (member) => {
      const [user, goal] = await Promise.all([
        User.findById(member.user).select('name').lean(),
        Goal.findById(member.goal).select('subject examType deadline topics'),
      ]);

      // A member who deleted their goal stays in the group but has nothing to
      // compare — better than dropping them out of the list without warning.
      if (!user || !goal) {
        return {
          name: user?.name ?? 'A former member',
          joinedAt: member.joinedAt,
          available: false,
        };
      }

      const plan = await currentPlanFor(goal);
      const assessments = await Assessment.find({ goal: goal._id })
        .select('score submittedAt questions.prompt')
        .lean();

      const achievements = await summariseAchievements(
        { user: member.user, goal: goal._id },
        { assessments },
      );

      const summary = plan ? summarisePlan(plan, goal) : null;

      return {
        userId: String(member.user),
        name: user.name,
        joinedAt: member.joinedAt,
        available: true,
        subject: goal.subject,
        examType: goal.examType,
        deadline: goal.deadline,
        topicCount: goal.topics.length,
        completionPercent: summary?.completionPercent ?? 0,
        sessionsCompleted: achievements.sessionsCompleted,
        minutesStudied: achievements.minutesStudied,
        topicsMastered: achievements.topicsMastered,
        currentStreak: achievements.currentStreak,
        longestStreak: achievements.longestStreak,
        points: achievements.points,
        badgesEarned: achievements.badgesEarned,
      };
    }),
  );

  // Ranked by points, which rewards consistency rather than whoever started
  // with the most free time.
  const ranked = [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  return ranked.map((row, index) => ({ ...row, rank: row.available ? index + 1 : null }));
}

/** The group as its own members see it. */
export function toGroupSummary(group, viewerId) {
  return {
    id: String(group._id),
    name: group.name,
    joinCode: group.joinCode,
    memberCount: group.members.length,
    isOwner: group.owner.equals(viewerId),
    createdAt: group.createdAt,
  };
}
