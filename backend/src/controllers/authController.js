import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccessToken } from '../utils/token.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with that email already exists.');
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
  });

  res.status(201).json({
    data: { user, token: signAccessToken(user.id) },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await user.verifyPassword(password) : false;

  // One message for both failures, so the response cannot be used to work out
  // which email addresses are registered.
  if (!passwordMatches) {
    throw ApiError.unauthorized('That email and password combination is not correct.');
  }

  res.json({
    data: { user, token: signAccessToken(user.id) },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ data: { user: req.user } });
});
