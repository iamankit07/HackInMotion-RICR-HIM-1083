import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { login, me, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';

const router = Router();

// The password endpoints are the obvious brute-force target, so they get a
// tighter limit than the rest of the API.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { message: 'Too many attempts. Please try again in a few minutes.' },
  },
});

router.post('/register', credentialLimiter, validate({ body: registerSchema }), register);
router.post('/login', credentialLimiter, validate({ body: loginSchema }), login);
router.get('/me', authenticate, me);

export default router;
