/**
 * Leave Status Utility
 * Handles checking if users are on leave or returning from leave
 *
 * IMPORTANT: Uses company timezone for all date calculations
 */

import { DateTime } from 'luxon';
import { prisma } from '../config/prisma.js';
import {
  toDateTime,
  getNowDT,
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
  DEFAULT_TIMEZONE,
  DAY_NAMES,
} from './date-helpers.js';

// ============================================
// TYPES
// ============================================

export interface LeaveStatus {
  isOnLeave: boolean;
  isReturning: boolean;
  currentException?: {
    id: string;
    type: string;
    startDate: Date | null;
    endDate: Date | null;
    reason: string;
  };
  lastException?: {
    id: string;
    type: string;
    startDate: Date | null;
    endDate: Date | null;
    reason: string;
  };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Check if a user is currently on approved leave or returning from leave
 *
 * IMPORTANT: Uses company timezone for all date calculations
 *
 * Leave Logic (End date = LAST DAY of exemption, not return date):
 * - If exemption endDate >= today: User is ON LEAVE (cannot check in)
 * - If exemption endDate < today (within 3 days): User is RETURNING
 * - Example: Exemption ends Jan 6 → Jan 6 is still ON LEAVE → Jan 7 is first required check-in
 */
export async function getUserLeaveStatus(
  userId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<LeaveStatus> {
  // Get today's start and tomorrow in company timezone
  const now = getNowDT(timezone);
  const todayStart = now.startOf('day');
  const tomorrow = todayStart.plus({ days: 1 });

  // Check if user has an approved exception covering today
  // End date = LAST DAY of exemption (not return date)
  // If exemption ends today → today is still on leave → tomorrow is first check-in day
  const currentException = await prisma.exception.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { lte: tomorrow.toJSDate() },
      endDate: { gte: todayStart.toJSDate() }, // >= today (includes end date as last day of leave)
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      reason: true,
    },
  });

  if (currentException) {
    return {
      isOnLeave: true,
      isReturning: false,
      currentException,
    };
  }

  // Check if user just returned from leave (leave ended yesterday or within last 3 days)
  const threeDaysAgo = todayStart.minus({ days: 3 });

  const recentException = await prisma.exception.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      endDate: {
        gte: threeDaysAgo.toJSDate(),
        lt: todayStart.toJSDate(),
      },
    },
    orderBy: { endDate: 'desc' },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      reason: true,
    },
  });

  // Check if user has checked in since the leave ended
  if (recentException && recentException.endDate) {
    const lastCheckin = await prisma.checkin.findFirst({
      where: {
        userId,
        createdAt: { gt: recentException.endDate },
      },
    });

    // If no check-in since leave ended, user is "returning"
    if (!lastCheckin) {
      return {
        isOnLeave: false,
        isReturning: true,
        lastException: recentException,
      };
    }
  }

  return {
    isOnLeave: false,
    isReturning: false,
  };
}

/**
 * Check if a date range is covered by approved exceptions
 * Used for streak calculation
 *
 * IMPORTANT: Uses company timezone for date calculations
 */
export async function getDaysCoveredByLeave(
  userId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<number> {
  const exceptions = await prisma.exception.findMany({
    where: {
      userId,
      status: 'APPROVED',
      OR: [
        // Exception overlaps with our date range
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
  });

  if (exceptions.length === 0) return 0;

  // Count unique days covered by leave within our date range (using company timezone)
  const coveredDays = new Set<string>();

  for (const exception of exceptions) {
    if (!exception.startDate || !exception.endDate) continue;

    // Calculate overlap between exception and requested range
    const exStart = toDateTime(exception.startDate, timezone).startOf('day');
    const exEnd = toDateTime(exception.endDate, timezone).startOf('day');
    const rangeStart = toDateTime(startDate, timezone).startOf('day');
    const rangeEnd = toDateTime(endDate, timezone).startOf('day');

    // Get the actual overlap
    const overlapStart = exStart > rangeStart ? exStart : rangeStart;
    const overlapEnd = exEnd < rangeEnd ? exEnd : rangeEnd;

    // Count days in overlap
    let current = overlapStart;
    while (current <= overlapEnd) {
      coveredDays.add(current.toFormat('yyyy-MM-dd'));
      current = current.plus({ days: 1 });
    }
  }

  return coveredDays.size;
}

/**
 * Calculate work days between two dates for a team
 *
 * IMPORTANT: Uses company timezone for day-of-week calculation
 */
export function getWorkDaysBetween(
  startDate: Date,
  endDate: Date,
  workDaysString: string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const workDays = workDaysString.split(',').map(d => d.trim().toUpperCase());

  let count = 0;
  let current = toDateTime(startDate, timezone).startOf('day');
  const end = toDateTime(endDate, timezone).startOf('day');

  while (current <= end) {
    const dayOfWeek = getDayOfWeekInTimezone(current.toJSDate(), timezone);
    const dayName = DAY_NAMES[dayOfWeek];
    if (workDays.includes(dayName)) {
      count++;
    }
    current = current.plus({ days: 1 });
  }

  return count;
}

/**
 * Check if a specific date is covered by an approved leave
 * Returns the exception if found, null otherwise
 * End date = LAST DAY of exemption (not return date)
 */
export async function getLeaveForDate(
  userId: string,
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<{
  id: string;
  type: string;
  startDate: Date | null;
  endDate: Date | null;
} | null> {
  const checkDate = toDateTime(date, timezone).startOf('day');

  const exception = await prisma.exception.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { lte: checkDate.toJSDate() },
      endDate: { gte: checkDate.toJSDate() }, // Include end date as last day of exemption
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
    },
  });

  return exception;
}

/**
 * Get all active leaves for a list of users on a specific date
 * Useful for team dashboards
 */
export async function getActiveLeaves(
  userIds: string[],
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<Map<string, { type: string; endDate: Date | null }>> {
  const checkDate = toDateTime(date, timezone).startOf('day');

  const exceptions = await prisma.exception.findMany({
    where: {
      userId: { in: userIds },
      status: 'APPROVED',
      startDate: { lte: checkDate.toJSDate() },
      endDate: { gt: checkDate.toJSDate() },
    },
    select: {
      userId: true,
      type: true,
      endDate: true,
    },
  });

  const leaveMap = new Map<string, { type: string; endDate: Date | null }>();
  for (const ex of exceptions) {
    leaveMap.set(ex.userId, { type: ex.type, endDate: ex.endDate });
  }

  return leaveMap;
}

/**
 * Calculate remaining leave days for a user in a period
 */
export async function getRemainingLeaveDays(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  maxLeaveDays: number,
  timezone: string = DEFAULT_TIMEZONE
): Promise<{
  used: number;
  remaining: number;
  exceptions: Array<{ type: string; days: number }>;
}> {
  const exceptions = await prisma.exception.findMany({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { gte: periodStart },
      endDate: { lte: periodEnd },
    },
    select: {
      type: true,
      startDate: true,
      endDate: true,
    },
  });

  const usedByType: Record<string, number> = {};
  let totalUsed = 0;

  for (const ex of exceptions) {
    if (!ex.startDate || !ex.endDate) continue;

    const start = toDateTime(ex.startDate, timezone).startOf('day');
    const end = toDateTime(ex.endDate, timezone).startOf('day');
    const days = Math.floor(end.diff(start, 'days').days) + 1;

    usedByType[ex.type] = (usedByType[ex.type] || 0) + days;
    totalUsed += days;
  }

  return {
    used: totalUsed,
    remaining: Math.max(0, maxLeaveDays - totalUsed),
    exceptions: Object.entries(usedByType).map(([type, days]) => ({ type, days })),
  };
}
