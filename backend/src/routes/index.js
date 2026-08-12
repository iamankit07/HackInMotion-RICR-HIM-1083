import { Router } from 'express';
import mongoose from 'mongoose';

import authRoutes from './authRoutes.js';
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

export default router;
