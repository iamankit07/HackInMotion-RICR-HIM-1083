import { Router } from 'express';
import mongoose from 'mongoose';

import authRoutes from './authRoutes.js';
import goalRoutes from './goalRoutes.js';
import groupRoutes from './groupRoutes.js';
import { getAiStatus } from '../services/ai/index.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.json({
    data: {
      status: 'ok',
      database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      ai: getAiStatus(),
      uptime: Math.round(process.uptime()),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/goals', goalRoutes);
router.use('/groups', groupRoutes);

export default router;
