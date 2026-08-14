import { Goal } from '../models/Goal.js';
import { StudyGroup, generateJoinCode } from '../models/StudyGroup.js';

import { buildLeaderboard, toGroupSummary } from '../services/groupStudy.js';

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const MAX_MEMBERS = 20;

/**
 * A student may only ever attach a goal that is theirs. Checked on both create
 * and join, because this is the one place a goal id arrives in a request body
 * rather than through loadGoal.
 */
async function ownedGoalOrFail(goalId, userId) {
  const goal = await Goal.findById(goalId).select('user');

  if (!goal || !goal.user.equals(userId)) {
    throw ApiError.badRequest('Pick one of your own goals to compare with the group.');
  }

  return goal;
}

export const listGroups = asyncHandler(async (req, res) => {
  const groups = await StudyGroup.find({ 'members.user': req.user._id }).sort({ createdAt: -1 });

  res.json({ data: { groups: groups.map((group) => toGroupSummary(group, req.user._id)) } });
});

export const createGroup = asyncHandler(async (req, res) => {
  await ownedGoalOrFail(req.body.goalId, req.user._id);

  const group = await StudyGroup.create({
    name: req.body.name,
    joinCode: await generateJoinCode(StudyGroup),
    owner: req.user._id,
    members: [{ user: req.user._id, goal: req.body.goalId }],
  });

  res.status(201).json({ data: { group: toGroupSummary(group, req.user._id) } });
});

export const joinGroup = asyncHandler(async (req, res) => {
  await ownedGoalOrFail(req.body.goalId, req.user._id);

  const group = await StudyGroup.findOne({ joinCode: req.body.joinCode.trim().toUpperCase() });

  if (!group) {
    throw ApiError.notFound('No group has that code. Check it with whoever invited you.');
  }

  if (group.hasMember(req.user._id)) {
    throw ApiError.badRequest('You are already in this group.');
  }

  if (group.members.length >= MAX_MEMBERS) {
    throw ApiError.badRequest('This group is full.');
  }

  group.members.push({ user: req.user._id, goal: req.body.goalId });
  await group.save();

  res.status(201).json({ data: { group: toGroupSummary(group, req.user._id) } });
});

export const getGroup = asyncHandler(async (req, res) => {
  res.json({
    data: {
      group: toGroupSummary(req.group, req.user._id),
      members: await buildLeaderboard(req.group),
    },
  });
});

/**
 * Leaving removes only the caller. The last member out takes the group with
 * them rather than leaving an empty board and a live join code behind.
 */
export const leaveGroup = asyncHandler(async (req, res) => {
  req.group.members = req.group.members.filter((member) => !member.user.equals(req.user._id));

  if (req.group.members.length === 0) {
    await req.group.deleteOne();
    res.json({ data: { left: true, groupDeleted: true } });
    return;
  }

  // The owner leaving hands the group to whoever has been there longest,
  // so it never ends up with an owner who is not in it.
  if (req.group.owner.equals(req.user._id)) {
    req.group.owner = req.group.members[0].user;
  }

  await req.group.save();

  res.json({ data: { left: true, groupDeleted: false } });
});
