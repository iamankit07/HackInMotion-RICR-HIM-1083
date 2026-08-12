import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.json({
    data: {
      status: 'ok',
      database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
      uptime: Math.round(process.uptime()),
    },
  });
});

export default router;
