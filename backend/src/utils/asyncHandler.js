/**
 * Express 4 does not catch rejected promises from async handlers, so every async
 * route is wrapped in this and failures land in the error middleware instead of
 * hanging the request.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
