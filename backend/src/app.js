import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { allowedOrigins, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimits.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Render, Vercel and every other platform put a proxy in front of us, so the
  // client address arrives in X-Forwarded-For. Without this every request looks
  // like it came from the load balancer and rate limiting keys them all
  // together. One hop, not `true` — trusting the whole chain lets a client
  // forge the header and dodge the limits.
  app.set('trust proxy', 1);

  // Study plans are the biggest thing we send — forty sessions with a sentence
  // of reasoning each. They compress to roughly a fifth.
  app.use(compression());

  app.use(
    helmet({
      // The API serves JSON to a separate origin; a policy written for HTML
      // pages would only mislead anyone reading the headers.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin requests and tools like curl send no Origin header.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // A refused origin is a client mistake, not a server fault. Passing an
        // Error here would surface as a 500 and read like the API is broken.
        return callback(null, false);
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: '256kb' }));

  app.use(
    morgan(isProduction ? 'combined' : 'dev', {
      // The platform health check runs every few seconds. Logging it buries
      // everything that actually happened. `originalUrl` rather than `path`
      // because the router rewrites `path` while dispatching and morgan reads
      // this once the response has already finished.
      skip: (req) => req.originalUrl.split('?')[0] === '/api/health',
    }),
  );

  app.use('/api', globalLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
