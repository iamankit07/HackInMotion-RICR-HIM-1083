/**
 * Errors thrown deliberately by route handlers. The error middleware trusts the
 * status and message on these, and hides the details of anything else.
 */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'You need to sign in to do that.') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'This does not belong to your account.') {
    return new ApiError(403, message);
  }

  static notFound(message = 'We could not find what you were looking for.') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = 'Too many requests. Please slow down.') {
    return new ApiError(429, message);
  }

  static serviceUnavailable(message = 'That service is temporarily unavailable.') {
    return new ApiError(503, message);
  }
}
