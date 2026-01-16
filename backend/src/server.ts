import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { initCronJobs } from './cron/index.js';

// Validate environment variables
try {
  validateEnv();
} catch (error) {
  logger.error(error, 'Environment validation failed');
  process.exit(1);
}

const port = Number(env.PORT);

logger.info(`Starting server in ${env.NODE_ENV} mode...`);

// Initialize cron jobs
initCronJobs();

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info(`Server is running on http://localhost:${info.port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});
