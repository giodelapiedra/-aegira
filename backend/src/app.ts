import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { api } from './routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// Global middlewares
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use('*', secureHeaders());
app.use('*', honoLogger((message) => logger.info(message)));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.route('/api', api);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
    },
    404
  );
});

// Error handler
app.onError(errorHandler);

export { app };
