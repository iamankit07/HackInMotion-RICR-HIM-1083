import { Goal } from '../models/Goal.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Loads the goal named in the route and refuses it if it belongs to somebody
 * else. Every goal-scoped route goes through here, which is what keeps one
 * student's plans, results and conversations out of another student's account.
 */
export const loadGoal = asyncHandler(async (req, res, next) => {
  const goal = await Goal.findById(req.params.goalId);

  if (!goal) {
    throw ApiError.notFound('We could not find that learning goal.');
  }

  if (!goal.user.equals(req.user._id)) {
    throw ApiError.forbidden('That learning goal belongs to another account.');
  }

  req.goal = goal;
  next();
});
