import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and replaces the named request parts with their parsed output, so
 * handlers always receive coerced, trimmed, known-shaped data.
 *
 *   router.post('/goals', validate({ body: createGoalSchema }), createGoal);
 */
export const validate = (schemas) => (req, res, next) => {
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      return next(
        ApiError.badRequest('Please check the highlighted fields.', formatIssues(result.error)),
      );
    }

    // req.query and req.params are getter-only in Express 5; assigning to a
    // separate key keeps this working across both major versions.
    if (part === 'body') {
      req.body = result.data;
    } else {
      req[`validated${part[0].toUpperCase()}${part.slice(1)}`] = result.data;
    }
  }

  return next();
};

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
