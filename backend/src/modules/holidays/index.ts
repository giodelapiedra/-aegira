/**
 * Holidays Module
 * Manages company-wide holidays set by Executive
 *
 * Holidays:
 * - Block check-in for all workers on that date
 * - Skip in compliance calculation (like exemptions)
 * - Visible to all users in company calendar
 */

import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import type { AppContext } from '../../types/context.js';
import {
  getTodayForDbDate,
  getStartOfDay,
  formatLocalDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import { recalculateAllTeamSummariesForDate } from '../../utils/daily-summary.js';

const holidaysRoutes = new Hono<AppContext>();

// Helper: Validate date string
function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// REMOVED: getCompanyTimezone helper - now use c.get('timezone') from context
// Timezone is fetched once in auth middleware and available everywhere

// GET /holidays - List holidays for company
// Query params: ?year=2026&month=1 (optional)
holidaysRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');
  const yearParam = c.req.query('year');
  const monthParam = c.req.query('month');

  const timezone = c.get('timezone');

  // Build date filter
  const where: any = { companyId };

  if (yearParam) {
    const year = parseInt(yearParam);

    // FIX: Use Luxon to create dates in company timezone, not server local time
    const startOfYearDT = DateTime.fromObject(
      { year, month: 1, day: 1 },
      { zone: timezone }
    ).startOf('day');
    const startOfYear = startOfYearDT.toJSDate();
    const endOfYear = startOfYearDT.endOf('year').toJSDate();

    if (monthParam) {
      // Filter by specific month (monthParam is 1-indexed from API)
      const month = parseInt(monthParam);
      const startOfMonthDT = DateTime.fromObject(
        { year, month, day: 1 },
        { zone: timezone }
      ).startOf('day');
      const startOfMonth = startOfMonthDT.toJSDate();
      const endOfMonth = startOfMonthDT.endOf('month').toJSDate();
      where.date = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else {
      // Filter by year only
      where.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }
  }

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return c.json({
    data: holidays.map((h) => ({
      id: h.id,
      date: formatLocalDate(h.date, timezone),
      name: h.name,
      createdBy: `${h.creator.firstName} ${h.creator.lastName}`,
      createdAt: h.createdAt.toISOString(),
    })),
  });
});

// GET /holidays/check/:date - Check if a specific date is a holiday
holidaysRoutes.get('/check/:date', async (c) => {
  const companyId = c.get('companyId');
  const dateParam = c.req.param('date');

  if (!isValidDate(dateParam)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const timezone = c.get('timezone');
  const checkDate = getStartOfDay(new Date(dateParam), timezone);

  const holiday = await prisma.holiday.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: checkDate,
      },
    },
  });

  return c.json({
    isHoliday: !!holiday,
    holiday: holiday
      ? {
          id: holiday.id,
          name: holiday.name,
          date: formatLocalDate(holiday.date, timezone),
        }
      : null,
  });
});

// POST /holidays - Add a holiday (Executive only)
holidaysRoutes.post('/', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');

  // Only Executive can add holidays
  if (user.role !== 'EXECUTIVE' && user.role !== 'ADMIN') {
    return c.json({ error: 'Only executives can manage holidays' }, 403);
  }

  const body = await c.req.json();
  const { date, name } = body;

  if (!date || !name) {
    return c.json({ error: 'Date and name are required' }, 400);
  }

  if (!isValidDate(date)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  if (name.trim().length === 0) {
    return c.json({ error: 'Holiday name cannot be empty' }, 400);
  }

  const timezone = c.get('timezone');
  const holidayDate = getStartOfDay(new Date(date), timezone);

  // Check if holiday already exists on this date
  const existing = await prisma.holiday.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: holidayDate,
      },
    },
  });

  if (existing) {
    return c.json({
      error: `A holiday already exists on this date: ${existing.name}`,
    }, 400);
  }

  // Create holiday
  const holiday = await prisma.holiday.create({
    data: {
      companyId,
      date: holidayDate,
      name: name.trim(),
      createdBy: userId,
    },
    include: {
      creator: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Log the action
  await createSystemLog({
    companyId,
    userId,
    action: 'SETTINGS_UPDATED',
    entityType: 'holiday',
    entityId: holiday.id,
    description: `${user.firstName} ${user.lastName} added company holiday: ${holiday.name} on ${formatLocalDate(holiday.date, timezone)}`,
    metadata: {
      holidayName: holiday.name,
      holidayDate: formatLocalDate(holiday.date, timezone),
    },
  });

  // Recalculate daily team summaries for all teams on this date (affects expectedToCheckIn)
  // Fire and forget - don't block response
  recalculateAllTeamSummariesForDate(companyId, holidayDate, timezone).catch(err => {
    console.error('Failed to recalculate summaries after holiday creation:', err);
  });

  return c.json({
    id: holiday.id,
    date: formatLocalDate(holiday.date, timezone),
    name: holiday.name,
    createdBy: `${holiday.creator.firstName} ${holiday.creator.lastName}`,
    createdAt: holiday.createdAt.toISOString(),
  }, 201);
});

// DELETE /holidays/:id - Remove a holiday (Executive only)
holidaysRoutes.delete('/:id', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');
  const holidayId = c.req.param('id');

  // Only Executive can remove holidays
  if (user.role !== 'EXECUTIVE' && user.role !== 'ADMIN') {
    return c.json({ error: 'Only executives can manage holidays' }, 403);
  }

  const timezone = c.get('timezone');

  // Find the holiday
  const holiday = await prisma.holiday.findFirst({
    where: {
      id: holidayId,
      companyId,
    },
  });

  if (!holiday) {
    return c.json({ error: 'Holiday not found' }, 404);
  }

  // Store the date before deleting for recalculation
  const holidayDate = holiday.date;

  // Delete the holiday
  await prisma.holiday.delete({
    where: { id: holidayId },
  });

  // Log the action
  await createSystemLog({
    companyId,
    userId,
    action: 'SETTINGS_UPDATED',
    entityType: 'holiday',
    entityId: holidayId,
    description: `${user.firstName} ${user.lastName} removed company holiday: ${holiday.name} from ${formatLocalDate(holidayDate, timezone)}`,
    metadata: {
      holidayName: holiday.name,
      holidayDate: formatLocalDate(holidayDate, timezone),
    },
  });

  // Recalculate daily team summaries for all teams on this date (no longer a holiday)
  // Fire and forget - don't block response
  recalculateAllTeamSummariesForDate(companyId, holidayDate, timezone).catch(err => {
    console.error('Failed to recalculate summaries after holiday deletion:', err);
  });

  return c.json({ success: true });
});

// DELETE /holidays/date/:date - Remove a holiday by date (Executive only)
// Useful for calendar click-to-remove
holidaysRoutes.delete('/date/:date', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');
  const dateParam = c.req.param('date');

  // Only Executive can remove holidays
  if (user.role !== 'EXECUTIVE' && user.role !== 'ADMIN') {
    return c.json({ error: 'Only executives can manage holidays' }, 403);
  }

  if (!isValidDate(dateParam)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const timezone = c.get('timezone');
  const holidayDate = getStartOfDay(new Date(dateParam), timezone);

  // Find the holiday
  const holiday = await prisma.holiday.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: holidayDate,
      },
    },
  });

  if (!holiday) {
    return c.json({ error: 'No holiday found on this date' }, 404);
  }

  // Delete the holiday
  await prisma.holiday.delete({
    where: { id: holiday.id },
  });

  // Log the action
  await createSystemLog({
    companyId,
    userId,
    action: 'SETTINGS_UPDATED',
    entityType: 'holiday',
    entityId: holiday.id,
    description: `${user.firstName} ${user.lastName} removed company holiday: ${holiday.name} from ${formatLocalDate(holiday.date, timezone)}`,
    metadata: {
      holidayName: holiday.name,
      holidayDate: formatLocalDate(holiday.date, timezone),
    },
  });

  // Recalculate daily team summaries for all teams on this date (no longer a holiday)
  // Fire and forget - don't block response
  recalculateAllTeamSummariesForDate(companyId, holidayDate, timezone).catch(err => {
    console.error('Failed to recalculate summaries after holiday deletion:', err);
  });

  return c.json({ success: true });
});

export { holidaysRoutes };
