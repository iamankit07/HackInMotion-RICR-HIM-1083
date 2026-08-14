import { Router } from 'express';

import { askDoubt, getDoubt, listDoubts } from '../controllers/doubtController.js';

import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimits.js';

import { askDoubtSchema } from '../validators/studyValidators.js';

const router = Router();

router.use(authenticate);

router.route('/').get(listDoubts).post(aiLimiter, validate({ body: askDoubtSchema }), askDoubt);
router.get('/:conversationId', getDoubt);
router.post('/:conversationId/messages', aiLimiter, validate({ body: askDoubtSchema }), askDoubt);

export default router;
