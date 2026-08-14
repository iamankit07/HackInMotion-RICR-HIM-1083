import { Router } from 'express';

import {
  createGroup,
  getGroup,
  joinGroup,
  leaveGroup,
  listGroups,
} from '../controllers/groupController.js';

import { authenticate } from '../middleware/authenticate.js';
import { loadGroup } from '../middleware/loadGroup.js';
import { validate } from '../middleware/validate.js';

import { createGroupSchema, joinGroupSchema } from '../validators/groupValidators.js';

const router = Router();

// Nothing here is public: a group board is other people's progress.
router.use(authenticate);

router.route('/').get(listGroups).post(validate({ body: createGroupSchema }), createGroup);
router.post('/join', validate({ body: joinGroupSchema }), joinGroup);

// Everything past here needs membership, not just an account.
const scoped = Router({ mergeParams: true });
router.use('/:groupId', loadGroup, scoped);

scoped.get('/', getGroup);
scoped.post('/leave', leaveGroup);

export default router;
