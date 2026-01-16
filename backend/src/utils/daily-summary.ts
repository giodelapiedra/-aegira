/**
 * Daily Team Summary Utility
 *
 * Pre-computed daily statistics per team for fast analytics queries.
 * Instead of querying thousands of check-in records, we read pre-aggregated daily summaries.
 */

import { prisma } from '../config/prisma.js';
import {
  getTodayForDbDate,
  toDbDate,
  getDayName,
  getStartOfDay,
  getEndOfDay,
  DEFAULT_TIMEZONE,
} from './date-helpers.js';

// ============================================
// TYPES
// ============================================

interface DailyTeamSummaryData {
  teamId: string;
  companyId: string;
  date: Date;
  isWorkDay: boolean;
  isHoliday: boolean;
  totalMembers: number;
  onLeaveCount: number;      // Exception APPROVED only (planned leave)
  expectedToCheckIn: number;
  checkedInCount: number;
  notCheckedInCount: number; // Legacy: for backwards compat
  greenCount: number;
  yellowCount: number;
  redCount: number;
  absentCount: number;       // DailyAttendance status='ABSENT' (penalized)
  excusedCount: number;      // DailyAttendance status='EXCUSED' (TL approved)
  avgReadinessScore: number | null;
  complianceRate: number | null;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Recalculate and upsert DailyTeamSummary for a specific team and date
 */
export async function recalculateDailyTeamSummary(
  teamId: string,
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<DailyTeamSummaryData> {
  // 1. Get team with members
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: {
          isActive: true,
          role: { in: ['WORKER', 'MEMBER'] },
        },
        select: { id: true },
      },
      company: {
        select: { id: true, timezone: true },
      },
    },
  });

  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const tz = team.company?.timezone || timezone;
  const memberIds = team.members.map(m => m.id);
  const totalMembers = memberIds.length;

  // Convert date to @db.Date format
  const dbDate = toDbDate(date, tz);

  // 2. Check if work day
  const dayName = getDayName(date, tz);
  const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());
  const isWorkDay = workDaysList.includes(dayName);

  // 3. Check if holiday
  const holiday = await prisma.holiday.findFirst({
    where: {
      companyId: team.companyId,
      date: dbDate,
    },
  });
  const isHoliday = !!holiday;

  // 4. Count members on leave (Exception APPROVED only - planned leave)
  let onLeaveCount = 0;
  if (memberIds.length > 0) {
    onLeaveCount = await prisma.exception.count({
      where: {
        userId: { in: memberIds },
        status: 'APPROVED',
        startDate: { lte: dbDate },
        endDate: { gte: dbDate },
      },
    });
  }

  // 5. Count ABSENT and EXCUSED from DailyAttendance (source of truth, no duplication)
  let absentCount = 0;
  let excusedCount = 0;
  if (memberIds.length > 0) {
    // Count ABSENT status (penalized, 0 points)
    absentCount = await prisma.dailyAttendance.count({
      where: {
        userId: { in: memberIds },
        date: dbDate,
        status: 'ABSENT',
      },
    });

    // Count EXCUSED status (TL approved, not counted)
    excusedCount = await prisma.dailyAttendance.count({
      where: {
        userId: { in: memberIds },
        date: dbDate,
        status: 'EXCUSED',
      },
    });
  }

  // 6. Calculate expected to check in
  // Expected = totalMembers - onLeave - excused (not counted in expected)
  // IMPORTANT: Absent workers ARE included in expectedToCheckIn (they're expected but didn't check in)
  // This affects compliance rate: compliance = checkedIn / expected
  const expectedToCheckIn = (!isWorkDay || isHoliday) ? 0 : (totalMembers - onLeaveCount - excusedCount);

  // 7. Get check-in stats for this date
  // IMPORTANT: Only actual check-ins are included (absent workers have NO check-in record)
  // This means absent workers DON'T affect avgReadinessScore or metrics (mood/stress/sleep/physicalHealth)
  const dayStart = getStartOfDay(date, tz);
  const dayEnd = getEndOfDay(date, tz);

  let checkins: { readinessScore: number; readinessStatus: string }[] = [];
  if (memberIds.length > 0) {
    checkins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        readinessScore: true,
        readinessStatus: true,
      },
    });
  }

  const checkedInCount = checkins.length;
  const notCheckedInCount = Math.max(0, expectedToCheckIn - checkedInCount);
  const greenCount = checkins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellowCount = checkins.filter(c => c.readinessStatus === 'YELLOW').length;
  const redCount = checkins.filter(c => c.readinessStatus === 'RED').length;

  // 8. Calculate scores
  // avgReadinessScore = average of ACTUAL check-ins only
  // Absent workers DON'T affect this (no check-in = no readiness score)
  const avgReadinessScore = checkins.length > 0
    ? checkins.reduce((sum, c) => sum + c.readinessScore, 0) / checkins.length
    : null;

  // Compliance rate = checkedIn / expected
  // Absent workers ARE included in expected (they were expected but didn't check in)
  // This means absent workers LOWER the compliance rate (correct behavior)
  const complianceRate = expectedToCheckIn > 0
    ? (checkedInCount / expectedToCheckIn) * 100
    : null;

  // 9. Upsert summary
  const summaryData: DailyTeamSummaryData = {
    teamId,
    companyId: team.companyId,
    date: dbDate,
    isWorkDay,
    isHoliday,
    totalMembers,
    onLeaveCount,       // Exception APPROVED only (planned leave)
    expectedToCheckIn,
    checkedInCount,
    notCheckedInCount,  // Legacy for backwards compat
    greenCount,
    yellowCount,
    redCount,
    absentCount,        // DailyAttendance ABSENT (penalized)
    excusedCount,       // DailyAttendance EXCUSED (TL approved)
    avgReadinessScore,
    complianceRate,
  };

  // Note: absentCount and excusedCount exist in schema but Prisma types may be outdated
  await prisma.dailyTeamSummary.upsert({
    where: {
      teamId_date: { teamId, date: dbDate },
    },
    create: summaryData,
    update: {
      ...summaryData,
      // Explicitly include all fields (absentCount and excusedCount exist in schema)
    } as any, // Type assertion needed - fields exist in schema but Prisma types outdated
  });

  return summaryData;
}

/**
 * Recalculate today's summary for a team
 */
export async function recalculateTodaySummary(
  teamId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<DailyTeamSummaryData> {
  const today = getTodayForDbDate(timezone);
  return recalculateDailyTeamSummary(teamId, today, timezone);
}

/**
 * Recalculate summaries for a date range (used for exemption approval/rejection)
 */
export async function recalculateSummariesForDateRange(
  teamId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<void> {
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    await recalculateDailyTeamSummary(teamId, current, timezone);
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Recalculate summaries for all teams on a specific date (used for holiday add/remove)
 */
export async function recalculateAllTeamSummariesForDate(
  companyId: string,
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<void> {
  const teams = await prisma.team.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  });

  for (const team of teams) {
    await recalculateDailyTeamSummary(team.id, date, timezone);
  }
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Get team summary for a specific date
 */
export async function getTeamSummaryForDate(
  teamId: string,
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
) {
  const dbDate = toDbDate(date, timezone);

  return prisma.dailyTeamSummary.findUnique({
    where: {
      teamId_date: { teamId, date: dbDate },
    },
  });
}

/**
 * Get team summaries for a date range
 */
export async function getTeamSummariesForRange(
  teamId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
) {
  const dbStartDate = toDbDate(startDate, timezone);
  const dbEndDate = toDbDate(endDate, timezone);

  return prisma.dailyTeamSummary.findMany({
    where: {
      teamId,
      date: { gte: dbStartDate, lte: dbEndDate },
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get all team summaries for a company on a specific date
 */
export async function getCompanySummariesForDate(
  companyId: string,
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
) {
  const dbDate = toDbDate(date, timezone);

  return prisma.dailyTeamSummary.findMany({
    where: {
      companyId,
      date: dbDate,
    },
    include: {
      team: {
        select: { id: true, name: true, leaderId: true },
      },
    },
  });
}

/**
 * Calculate aggregate stats from summaries
 */
export function aggregateSummaries(summaries: DailyTeamSummaryData[]) {
  // Filter to only work days that are not holidays
  const workDaySummaries = summaries.filter(s => s.isWorkDay && !s.isHoliday);

  if (workDaySummaries.length === 0) {
    return {
      totalDays: 0,
      totalExpected: 0,
      totalCheckedIn: 0,
      avgComplianceRate: null,
      avgReadinessScore: null,
      totalGreen: 0,
      totalYellow: 0,
      totalRed: 0,
    };
  }

  const totalExpected = workDaySummaries.reduce((sum, s) => sum + s.expectedToCheckIn, 0);
  const totalCheckedIn = workDaySummaries.reduce((sum, s) => sum + s.checkedInCount, 0);
  const totalGreen = workDaySummaries.reduce((sum, s) => sum + s.greenCount, 0);
  const totalYellow = workDaySummaries.reduce((sum, s) => sum + s.yellowCount, 0);
  const totalRed = workDaySummaries.reduce((sum, s) => sum + s.redCount, 0);

  // Calculate compliance rate (NOT an average - it's a percentage rate)
  // Compliance = (totalCheckedIn / totalExpected) * 100
  // This is different from Average Metrics (mood, stress, sleep, physicalHealth)
  const avgComplianceRate = totalExpected > 0
    ? (totalCheckedIn / totalExpected) * 100
    : null;

  // Calculate average readiness (only from days with check-ins)
  const daysWithCheckins = workDaySummaries.filter(s => s.avgReadinessScore !== null);
  const avgReadinessScore = daysWithCheckins.length > 0
    ? daysWithCheckins.reduce((sum, s) => sum + (s.avgReadinessScore || 0), 0) / daysWithCheckins.length
    : null;

  return {
    totalDays: workDaySummaries.length,
    totalExpected,
    totalCheckedIn,
    avgComplianceRate,
    avgReadinessScore,
    totalGreen,
    totalYellow,
    totalRed,
  };
}

// ============================================
// WORKER HEALTH REPORT (GROUP BY Approach)
// ============================================

/**
 * Get worker's monthly baseline history using GROUP BY
 * No extra table needed - calculates from Checkin records
 */
export async function getWorkerMonthlyBaseline(userId: string) {
  const monthlyData = await prisma.$queryRaw<
    {
      year: number;
      month: number;
      avgScore: number;
      avgMood: number;
      avgStress: number;
      avgSleep: number;
      avgPhysical: number;
      totalCheckins: bigint;
      lowestScore: number;
      highestScore: number;
    }[]
  >`
    SELECT
      EXTRACT(YEAR FROM "createdAt")::int as year,
      EXTRACT(MONTH FROM "createdAt")::int as month,
      AVG("readinessScore")::float as "avgScore",
      AVG("mood")::float as "avgMood",
      AVG("stress")::float as "avgStress",
      AVG("sleep")::float as "avgSleep",
      AVG("physicalHealth")::float as "avgPhysical",
      COUNT(*) as "totalCheckins",
      MIN("readinessScore")::float as "lowestScore",
      MAX("readinessScore")::float as "highestScore"
    FROM "checkins"
    WHERE "userId" = ${userId}
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  // Convert BigInt to number
  return monthlyData.map(row => ({
    ...row,
    totalCheckins: Number(row.totalCheckins),
  }));
}

/**
 * Get worker's baseline for a specific period
 */
export async function getWorkerBaselineForPeriod(
  userId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const checkins = await prisma.checkin.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    select: {
      readinessScore: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (checkins.length === 0) {
    return null;
  }

  const total = checkins.length;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    period: days,
    totalCheckins: total,
    avgScore: sum(checkins.map(c => c.readinessScore)) / total,
    avgMood: sum(checkins.map(c => c.mood)) / total,
    avgStress: sum(checkins.map(c => c.stress)) / total,
    avgSleep: sum(checkins.map(c => c.sleep)) / total,
    avgPhysical: sum(checkins.map(c => c.physicalHealth)) / total,
    lowestScore: Math.min(...checkins.map(c => c.readinessScore)),
    highestScore: Math.max(...checkins.map(c => c.readinessScore)),
    firstCheckin: checkins[checkins.length - 1].createdAt,
    lastCheckin: checkins[0].createdAt,
  };
}

/**
 * Get worker's check-in history around a specific date (for claim validation)
 */
export async function getWorkerHistoryAroundDate(
  userId: string,
  targetDate: Date,
  daysBefore: number = 7,
  daysAfter: number = 3
) {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBefore);

  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + daysAfter);

  const checkins = await prisma.checkin.findMany({
    where: {
      userId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      readinessScore: true,
      readinessStatus: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      notes: true,
      lowScoreReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate baseline from period before target date
  const beforeTarget = checkins.filter(c => c.createdAt < targetDate);
  const baseline = beforeTarget.length > 0
    ? beforeTarget.reduce((sum, c) => sum + c.readinessScore, 0) / beforeTarget.length
    : null;

  return {
    targetDate,
    daysBefore,
    daysAfter,
    baseline,
    checkins,
  };
}

/**
 * Generate full worker health validation report
 */
export async function generateWorkerHealthReport(
  userId: string,
  claimDate?: Date,
  periodDays: number = 30
) {
  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Get baseline for period
  const baseline = await getWorkerBaselineForPeriod(userId, periodDays);

  // Get monthly history
  const monthlyHistory = await getWorkerMonthlyBaseline(userId);

  // Get check-ins around claim date (if provided)
  const claimAnalysis = claimDate
    ? await getWorkerHistoryAroundDate(userId, claimDate)
    : null;

  return {
    worker: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      team: user.team?.name || 'No Team',
    },
    baseline,
    monthlyHistory,
    claimAnalysis,
    generatedAt: new Date(),
  };
}
