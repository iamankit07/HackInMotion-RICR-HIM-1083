import { Router } from 'express';

import {
  createGoal,
  deleteGoal,
  generateTopics,
  getGoal,
  listGoals,
  setTopics,
  updateGoal,
} from '../controllers/goalController.js';

import {
  createDiagnostic,
  createMockTest,
  getAssessment,
  listAssessments,
  submitAssessment,
} from '../controllers/assessmentController.js';

import {
  createPlan,
  getPlan,
  getToday,
  listPlanVersions,
  replan,
  updateSession,
} from '../controllers/planController.js';

import {
  askTutor,
  deleteConversation,
  getConversation,
  listConversations,
} from '../controllers/conversationController.js';

import { authenticate } from '../middleware/authenticate.js';
import { loadGoal } from '../middleware/loadGoal.js';
import { validate } from '../middleware/validate.js';

import { createGoalSchema, manualTopicsSchema, updateGoalSchema } from '../validators/goalValidators.js';
import {
  askTutorSchema,
  createQuizSchema,
  replanSchema,
  submitAnswersSchema,
  updateSessionSchema,
} from '../validators/studyValidators.js';

const router = Router();

router.use(authenticate);

router.route('/').get(listGoals).post(validate({ body: createGoalSchema }), createGoal);

/**
 * Everything below is scoped to one goal. `loadGoal` runs first and rejects
 * anything that is not the signed-in student's, so no handler past this point
 * has to think about ownership.
 */
const scoped = Router({ mergeParams: true });

scoped.use(loadGoal);

scoped
  .route('/')
  .get(getGoal)
  .patch(validate({ body: updateGoalSchema }), updateGoal)
  .delete(deleteGoal);

scoped.post('/topics/generate', generateTopics);
scoped.put('/topics', validate({ body: manualTopicsSchema }), setTopics);

scoped.route('/plan').get(getPlan).post(createPlan);
scoped.post('/plan/replan', validate({ body: replanSchema }), replan);
scoped.get('/plan/versions', listPlanVersions);

scoped.get('/today', getToday);
scoped.patch('/sessions/:sessionId', validate({ body: updateSessionSchema }), updateSession);

scoped.get('/assessments', listAssessments);
scoped.post('/assessments/diagnostic', validate({ body: createQuizSchema }), createDiagnostic);
scoped.post('/assessments/mock', validate({ body: createQuizSchema }), createMockTest);
scoped.get('/assessments/:assessmentId', getAssessment);
scoped.post(
  '/assessments/:assessmentId/submit',
  validate({ body: submitAnswersSchema }),
  submitAssessment,
);

scoped.get('/conversations', listConversations);
scoped.post('/conversations', validate({ body: askTutorSchema }), askTutor);
scoped.get('/conversations/:conversationId', getConversation);
scoped.delete('/conversations/:conversationId', deleteConversation);
scoped.post(
  '/conversations/:conversationId/messages',
  validate({ body: askTutorSchema }),
  askTutor,
);

router.use('/:goalId', scoped);

export default router;
