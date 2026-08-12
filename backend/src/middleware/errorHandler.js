import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/**
 * Translates everything the app can throw into one response shape:
 *   { error: { message, details? } }
 *
 * Messages on 4xx are written to be shown to a student as-is. Anything
 * unrecognised is logged in full and reported as a generic 500, so internal
 * details never leak to the client.
 */
export function errorHandler(err, req, res, _next) {
  const { status, message, details } = normalise(err);

  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} failed`, err);
  }

  const body = { error: { message } };

  if (details) {
    body.error.details = details;
  }

  if (!isProduction && status >= 500) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

function normalise(err) {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message, details: err.details };
  }

  if (err.name === 'ValidationError' && err.errors) {
    return {
      status: 400,
      message: 'Some of those details were not valid.',
      details: Object.values(err.errors).map((field) => ({
        field: field.path,
        message: field.message,
      })),
    };
  }

  if (err.name === 'CastError') {
    return { status: 400, message: `"${err.value}" is not a valid ${err.path}.` };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    return { status: 409, message: `That ${field} is already registered.` };
  }

  if (err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Your session has expired. Please sign in again.' };
  }

  if (err.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Your session is not valid. Please sign in again.' };
  }

  return { status: 500, message: 'Something went wrong on our side. Please try again.' };
}
