import { Router } from 'express';
import mongoose from 'mongoose';

import authRoutes from './authRoutes.js';
import goalRoutes from './goalRoutes.js';
import groupRoutes from './groupRoutes.js';
import doubtRoutes from './doubtRoutes.js';
import { getAiStatus } from '../services/ai/index.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * What the platform's health check reads.
 *
 * It answers 503 when the database is unreachable, because an instance that
 * cannot serve data should be taken out of rotation rather than left accepting
 * requests it will only fail. The AI provider is reported but never affects the
 * verdict — the plan, progress and every existing page still work without it,
 * so an AI outage is not a reason to declare the API down.
 */
router.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({
    data: {
      status: ready ? 'ok' : 'degraded',
      database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      ai: getAiStatus(),
      uptime: Math.round(process.uptime()),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/goals', goalRoutes);
router.use('/groups', groupRoutes);
router.use('/doubts', doubtRoutes);

export default router;
