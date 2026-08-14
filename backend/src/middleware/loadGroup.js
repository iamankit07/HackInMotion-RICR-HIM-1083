import { StudyGroup } from '../models/StudyGroup.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Loads the group named in the route and refuses it unless the caller is a
 * member. This is the group equivalent of loadGoal, and the only thing standing
 * between one group's board and everybody else.
 *
 * Non-membership answers 404 rather than 403: telling a stranger "this group
 * exists but you cannot see it" is more than they need to know.
 */
export const loadGroup = asyncHandler(async (req, res, next) => {
  const group = await StudyGroup.findById(req.params.groupId);

  if (!group || !group.hasMember(req.user._id)) {
    throw ApiError.notFound('We could not find that study group.');
  }

  req.group = group;
  next();
});
