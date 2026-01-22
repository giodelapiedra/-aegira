/**
 * Worker Module
 *
 * Consolidated API endpoints for worker dashboard.
 * Optimized to reduce multiple API calls into single requests.
 */

import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import { getUserLeaveStatus } from '../../utils/leave.js';
import { logger } from '../../utils/logger.js';
import {
  getTodayRange,
  getTodayForDbDate,
  getCurrentWeekRange,
  getNowDT,
  toDateTime,
  formatLocalDate,
  isTodayWorkDay,
  DAY_NAMES,
} from '../../utils/date-helpers.js';

const workerRoutes = new Hono<AppContext>();

// ============================================
// TYPES
// ============================================

interface WeekStatsResult {
  weekStart: string;
  weekEnd: string;
  totalCheckins: number;
  scheduledDaysThisWeek: number;
  scheduledDaysSoFar: number;
  avgScore: number;
  avgStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
  dailyStatus: Record<string, { status: string; score: number } | null>;
  workDays: string[];
  currentStreak: number;
  longestStreak: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Convert Luxon weekday (1=Mon, 7=Sun) to JS weekday (0=Sun, 6=Sat)
 */
function luxonToJsWeekday(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

/**
 * Calculate week statistics from check-ins
 * Uses Luxon for timezone-aware calculations
 */
function calculateWeekStats(
  checkins: Array<{ createdAt: Date; readinessScore: number; readinessStatus: string }>,
  workDaysString: string | undefined,
  timezone: string,
  currentStreak: number,
  longestStreak: number
): WeekStatsResult {
  const now = getNowDT(timezone);
  const { start: weekStartDate, end: weekEndDate } = getCurrentWeekRange(timezone);
  const weekStart = toDateTime(weekStartDate, timezone);
  const weekEnd = toDateTime(weekEndDate, timezone);

  // Filter check-ins for current week
  const weekCheckins = checkins.filter((c) => {
    const checkinDt = toDateTime(c.createdAt, timezone);
    return checkinDt >= weekStart && checkinDt <= weekEnd;
  });

  const totalCheckins = weekCheckins.length;
  const avgScore =
    totalCheckins > 0
      ? Math.round(weekCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / totalCheckins)
      : 0;

  // Build daily status map
  const dailyStatus: Record<string, { status: string; score: number } | null> = {};
  for (const day of DAY_NAMES) {
    dailyStatus[day] = null;
  }

  // Fill in actual check-in data
  for (const checkin of weekCheckins) {
    const checkinDt = toDateTime(checkin.createdAt, timezone);
    const dayIndex = luxonToJsWeekday(checkinDt.weekday);
    const dayName = DAY_NAMES[dayIndex];
    dailyStatus[dayName] = {
      status: checkin.readinessStatus,
      score: checkin.readinessScore,
    };
  }

  // Calculate scheduled work days
  const workDays = workDaysString?.split(',').map((d) => d.trim().toUpperCase()) || [
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
  ];
  const scheduledDaysThisWeek = workDays.length;

  // Count scheduled days up to today
  let scheduledDaysSoFar = 0;
  let current = weekStart;
  const today = now.startOf('day');

  while (current <= weekEnd && current <= today) {
    const dayIndex = luxonToJsWeekday(current.weekday);
    const dayName = DAY_NAMES[dayIndex];
    if (workDays.includes(dayName)) {
      scheduledDaysSoFar++;
    }
    current = current.plus({ days: 1 });
  }

  // Determine average status
  let avgStatus: 'GREEN' | 'YELLOW' | 'RED' | null = null;
  if (totalCheckins > 0) {
    avgStatus = avgScore >= 70 ? 'GREEN' : avgScore >= 50 ? 'YELLOW' : 'RED';
  }

  return {
    weekStart: formatLocalDate(weekStartDate, timezone),
    weekEnd: formatLocalDate(weekEndDate, timezone),
    totalCheckins,
    scheduledDaysThisWeek,
    scheduledDaysSoFar,
    avgScore,
    avgStatus,
    dailyStatus,
    workDays,
    currentStreak,
    longestStreak,
  };
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /worker/dashboard
 *
 * Consolidated endpoint for worker dashboard data.
 * Replaces multiple API calls with a single optimized request.
 *
 * Returns:
 * - User profile with streak data
 * - Team schedule info
 * - Leave status (on leave, returning, before start)
 * - Today's check-in
 * - Week statistics
 * - Recent check-ins
 * - Pending exemption (if any)
 * - Holiday status
 */
workerRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const timezone = c.get('timezone');

  try {
    const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
    const todayForDb = getTodayForDbDate(timezone);

    // Parallel fetch all independent data
    const [
      user,
      todayCheckin,
      recentCheckins,
      pendingExemption,
      holiday,
      activeExemptions,
    ] = await Promise.all([
      // User with team (for schedule and streak data)
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatar: true,
          teamId: true,
          currentStreak: true,
          longestStreak: true,
          totalCheckins: true,
          avgReadinessScore: true,
          lastReadinessStatus: true,
          team: {
            select: {
              id: true,
              name: true,
              workDays: true,
              shiftStart: true,
              shiftEnd: true,
              leaderId: true,
            },
          },
        },
      }),

      // Today's check-in
      prisma.checkin.findFirst({
        where: {
          userId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        select: {
          id: true,
          mood: true,
          stress: true,
          sleep: true,
          physicalHealth: true,
          readinessScore: true,
          readinessStatus: true,
          lowScoreReason: true,
          lowScoreDetails: true,
          notes: true,
          createdAt: true,
        },
      }),

      // Recent check-ins for week stats (fetch more for calculation, return 7)
      prisma.checkin.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 14, // 2 weeks of data for accurate week stats
        select: {
          id: true,
          readinessScore: true,
          readinessStatus: true,
          createdAt: true,
        },
      }),

      // Pending exemption request
      prisma.exception.findFirst({
        where: {
          userId,
          status: 'PENDING',
          isExemption: true,
        },
        select: {
          id: true,
          type: true,
          reason: true,
          scoreAtRequest: true,
          createdAt: true,
        },
      }),

      // Today's holiday
      prisma.holiday.findFirst({
        where: {
          companyId,
          date: todayForDb,
        },
        select: { name: true },
      }),

      // Active exemptions for the user (for week calendar, return date calculations)
      prisma.exception.findMany({
        where: {
          userId,
          status: 'APPROVED',
          OR: [
            { endDate: null }, // Indefinite exemption
            { endDate: { gte: todayStart } }, // End date is today or later
          ],
        },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          reason: true,
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    // Handle user not found
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get leave status using existing utility (handles all edge cases)
    // This is a separate call because it has complex logic we don't want to duplicate
    const leaveStatus = await getUserLeaveStatus(userId, timezone);

    // Handle user without team (valid state for unassigned users)
    if (!user.team) {
      return c.json({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          teamId: user.teamId,
          currentStreak: user.currentStreak || 0,
          longestStreak: user.longestStreak || 0,
          totalCheckins: user.totalCheckins || 0,
          avgReadinessScore: user.avgReadinessScore || 0,
          lastReadinessStatus: user.lastReadinessStatus,
        },
        team: null,
        leaveStatus: {
          isOnLeave: false,
          isReturning: false,
          isBeforeStart: true,
          effectiveStartDate: null,
          currentException: null,
        },
        todayCheckin: null,
        weekStats: null,
        recentCheckins: [],
        pendingExemption: null,
        activeExemptions: [],
        isHoliday: !!holiday,
        holidayName: holiday?.name || null,
        isWorkDay: false,
        timezone, // Company timezone for frontend calculations
      });
    }

    // Calculate week stats
    const weekStats = calculateWeekStats(
      recentCheckins,
      user.team.workDays,
      timezone,
      user.currentStreak || 0,
      user.longestStreak || 0
    );

    // Check if today is a work day
    const isWorkDay = isTodayWorkDay(user.team.workDays, timezone);

    // Return consolidated response
    return c.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        teamId: user.teamId,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        totalCheckins: user.totalCheckins || 0,
        avgReadinessScore: user.avgReadinessScore || 0,
        lastReadinessStatus: user.lastReadinessStatus,
      },
      team: user.team,
      leaveStatus: {
        isOnLeave: leaveStatus.isOnLeave,
        isReturning: leaveStatus.isReturning,
        isBeforeStart: leaveStatus.isBeforeStart,
        effectiveStartDate: leaveStatus.effectiveStartDate || null,
        currentException: leaveStatus.currentException || null,
      },
      todayCheckin,
      weekStats,
      recentCheckins: recentCheckins.slice(0, 7), // Return only 7 most recent
      pendingExemption,
      activeExemptions,
      isHoliday: !!holiday,
      holidayName: holiday?.name || null,
      isWorkDay,
      timezone, // Company timezone for frontend calculations
    });
  } catch (error) {
    logger.error(error, 'Worker dashboard error');

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return c.json({ error: 'Database error', code: error.code }, 500);
    }

    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { workerRoutes };
