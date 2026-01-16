/**
 * Cron Jobs Scheduler
 *
 * Initializes and manages scheduled tasks for the application.
 *
 * Hourly cron handles TWO things:
 * 1. 5 AM check: Process YESTERDAY's absences (safety net)
 * 2. Shift-end check: Process TODAY's absences for teams whose shift just ended
 */

import cron from 'node-cron';
import { finalizeAttendance, processShiftEndAbsences } from './attendance-finalizer.js';
import { logger } from '../utils/logger.js';
import type { AppContext } from '../types/context.js';
import { Hono } from 'hono';

/**
 * Initialize all cron jobs
 * Should be called when server starts
 */
export function initCronJobs() {
  // Run every hour (0 * * * *) to handle multiple timezones and shift ends
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Hourly check started...');

    // 1. 5 AM check - process yesterday's absences (safety net)
    try {
      const yesterdayResult = await finalizeAttendance();
      if (yesterdayResult.companiesProcessed > 0) {
        logger.info({ result: yesterdayResult }, '[CRON] Yesterday check completed');
      }
    } catch (error) {
      logger.error(error, '[CRON] Yesterday check failed');
    }

    // 2. Shift-end check - process today's absences for teams whose shift ended
    try {
      const shiftEndResult = await processShiftEndAbsences();
      if (shiftEndResult.teamsProcessed > 0) {
        logger.info({ result: shiftEndResult }, '[CRON] Shift-end check completed');
      }
    } catch (error) {
      logger.error(error, '[CRON] Shift-end check failed');
    }

    logger.info('[CRON] Hourly check finished');
  });

  logger.info('[CRON] Initialized - Hourly: 5 AM (yesterday) + shift-end (today)');
}

/**
 * Manual trigger endpoint for testing (admin only)
 * POST /api/cron/test-attendance-finalizer
 */
const cronRoutes = new Hono<AppContext>();

// Test yesterday's absence check (5 AM logic)
cronRoutes.post('/test-yesterday', async (c) => {
  const user = c.get('user');
  const allowedRoles = ['ADMIN', 'EXECUTIVE'];
  if (!allowedRoles.includes(user.role)) {
    return c.json({ error: 'Admin or Executive only' }, 403);
  }

  try {
    const result = await finalizeAttendance(true);
    return c.json({
      success: true,
      message: 'Yesterday absence check completed (forced)',
      result,
    });
  } catch (error) {
    logger.error(error, '[CRON] Manual yesterday check failed');
    return c.json(
      {
        error: 'Failed to run yesterday check',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// Test shift-end absence check (same-day logic)
cronRoutes.post('/test-shift-end', async (c) => {
  const user = c.get('user');
  const allowedRoles = ['ADMIN', 'EXECUTIVE'];
  if (!allowedRoles.includes(user.role)) {
    return c.json({ error: 'Admin or Executive only' }, 403);
  }

  try {
    const result = await processShiftEndAbsences(true);
    return c.json({
      success: true,
      message: 'Shift-end absence check completed (forced)',
      result,
    });
  } catch (error) {
    logger.error(error, '[CRON] Manual shift-end check failed');
    return c.json(
      {
        error: 'Failed to run shift-end check',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export { cronRoutes };

