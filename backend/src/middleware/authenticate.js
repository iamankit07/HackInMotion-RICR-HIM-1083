import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/token.js';

/**
 * Reads the bearer token, loads the account behind it, and hangs it off
 * req.user. Every route that touches a student's own data sits behind this.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized();
  }

  // Expired and malformed tokens throw here and are turned into 401s by the
  // error middleware.
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user) {
    throw ApiError.unauthorized('That account no longer exists.');
  }

  req.user = user;
  next();
});
