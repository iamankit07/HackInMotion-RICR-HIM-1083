import { Router } from 'express';

import { login, me, register } from '../controllers/authController.js';
import { credentialLimiter } from '../middleware/rateLimits.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';

const router = Router();

router.post('/register', credentialLimiter, validate({ body: registerSchema }), register);
router.post('/login', credentialLimiter, validate({ body: loginSchema }), login);
router.get('/me', authenticate, me);

export default router;
