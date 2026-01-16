/**
 * Absence Detection and Management Utilities
 *
 * NOTE: Primary absence creation is handled by cron job (attendance-finalizer.ts)
 * These utilities are for:
 * - Reading absence data (getPendingJustifications, getAbsenceHistory, etc.)
 * - Fallback detection (detectAndCreateAbsences) - only for edge cases
 *
 * Baseline date: first check-in > next day after teamJoinedAt > next day after createdAt
 */

import { prisma } from '../config/prisma.js';
import {
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
  getStartOfNextDay,
  toDateTime,
  getNowDT,
  DEFAULT_TIMEZONE,
  DAY_NAMES,
  toDbDate,
} from './date-helpers.js';

/**
 * Detect and create absence records for a worker (FALLBACK ONLY)
 *
 * NOTE: Primary creation is done by cron job at 5 AM.
 * This function is kept for edge cases (e.g., cron failure, historical gaps).
 *
 * @param userId - Worker's user ID
 * @param companyId - Company ID
 * @param timezone - Company timezone (IANA format)
 * @returns Array of newly created absence records
 */
export async function detectAndCreateAbsences(
  userId: string,
  companyId: string,
  timezone: string = DEFAULT_TIMEZONE
) {
  // 1. Get user with team info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true, company: true },
  });

  if (!user?.team || !user.team.isActive) return [];

  // Use company timezone
  const tz = user.company?.timezone || timezone;
  const teamWorkDays = user.team.workDays.split(',').map((d) => d.trim().toUpperCase());

  // 2. Get first check-in (to determine baseline)
  const firstCheckin = await prisma.checkin.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  // 3. Determine baseline date (when check-in requirement starts)
  // Priority:
  // a) First check-in date (worker already active)
  // b) NEXT DAY after teamJoinedAt (new worker - join day is free)
  // c) NEXT DAY after createdAt (fallback)
  let baselineDate: Date;

  if (firstCheckin) {
    // Already checked in before - use first check-in date
    baselineDate = firstCheckin.createdAt;
  } else if (user.teamJoinedAt) {
    // New worker - requirement starts NEXT DAY after joining
    baselineDate = getStartOfNextDay(new Date(user.teamJoinedAt), tz);
  } else {
    // Fallback - NEXT DAY after account creation
    baselineDate = getStartOfNextDay(new Date(user.createdAt), tz);
  }

  // 4. Get today and yesterday in COMPANY TIMEZONE (not UTC!)
  const nowInTz = getNowDT(tz);
  const todayInTz = nowInTz.startOf('day');
  const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');
  const baselineDateInTz = toDateTime(baselineDate, tz).startOf('day');

  // 5. Check if shift has ended today (include today in detection)
  const shiftEnd = user.team.shiftEnd || '17:00';
  const [shiftEndHour, shiftEndMin] = shiftEnd.split(':').map(Number);
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
  const currentMinutes = nowInTz.hour * 60 + nowInTz.minute;
  const shiftEndedToday = currentMinutes > shiftEndMinutes;

  // Check if today is a work day
  const todayDayOfWeek = getDayOfWeekInTimezone(todayInTz.toJSDate(), tz);
  const todayDayName = DAY_NAMES[todayDayOfWeek];
  const isTodayWorkDay = teamWorkDays.includes(todayDayName);

  // If shift ended today AND today is a work day, include today in detection
  // Otherwise, only check up to yesterday
  const checkUntilDate = (isTodayWorkDay && shiftEndedToday) ? todayInTz : yesterdayInTz;

  // 6. If no gap, return early
  if (baselineDateInTz > checkUntilDate) return [];

  // 7. Get existing data for quick lookup
  const [checkins, exemptions, holidays, existingAbsences] = await Promise.all([
    prisma.checkin.findMany({
      where: { userId, createdAt: { gte: baselineDate } },
      select: { createdAt: true },
    }),
    prisma.exception.findMany({
      where: { userId, status: 'APPROVED' },
    }),
    prisma.holiday.findMany({
      where: { companyId },
      select: { date: true },
    }),
    prisma.absence.findMany({
      where: { userId },
      select: { absenceDate: true },
    }),
  ]);

  // Build lookup sets using COMPANY TIMEZONE
  const checkinDates = new Set(checkins.map((c) => getDateStringInTimezone(c.createdAt, tz)));
  const holidayDates = new Set(holidays.map((h) => getDateStringInTimezone(h.date, tz)));
  const absenceDates = new Set(existingAbsences.map((a) => getDateStringInTimezone(a.absenceDate, tz)));

  const isDateExempted = (dateStr: string) => {
    return exemptions.some((e) => {
      if (!e.startDate || !e.endDate) return false;
      const start = getDateStringInTimezone(e.startDate, tz);
      const end = getDateStringInTimezone(e.endDate, tz);
      return dateStr >= start && dateStr <= end;
    });
  };

  const createdAbsences = [];

  // 8. Iterate using Luxon DateTime in company timezone
  let current = baselineDateInTz; // Start from baseline date

  while (current <= checkUntilDate) {
    const dateStr = current.toFormat('yyyy-MM-dd');

    // Get day of week in COMPANY TIMEZONE
    const dayOfWeek = getDayOfWeekInTimezone(current.toJSDate(), tz);
    const dayName = DAY_NAMES[dayOfWeek];

    // Skip if not a work day
    if (!teamWorkDays.includes(dayName)) {
      current = current.plus({ days: 1 });
      continue;
    }

    // Skip if has check-in, holiday, exemption, or existing absence
    if (
      checkinDates.has(dateStr) ||
      holidayDates.has(dateStr) ||
      isDateExempted(dateStr) ||
      absenceDates.has(dateStr)
    ) {
      current = current.plus({ days: 1 });
      continue;
    }

    // Create absence record with date in company timezone
    const absence = await prisma.absence.create({
      data: {
        userId,
        teamId: user.team.id, // Include teamId for TL filtering
        companyId,
        absenceDate: toDbDate(current.toJSDate(), tz), // Use toDbDate for proper DB storage
        status: 'PENDING_JUSTIFICATION',
      },
    });
    createdAbsences.push(absence);

    current = current.plus({ days: 1 });
  }

  return createdAbsences;
}

/**
 * Get pending justifications for a worker (not yet justified)
 * These are absences where worker hasn't submitted justification yet
 *
 * @param userId - Worker's user ID
 * @returns Array of absence records needing justification
 */
export async function getPendingJustifications(userId: string) {
  return prisma.absence.findMany({
    where: {
      userId,
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: null, // Only absences NOT YET justified by worker
    },
    orderBy: { absenceDate: 'asc' },
  });
}

/**
 * Get pending reviews for a team leader (justified but not reviewed)
 * These are absences where worker has submitted justification, waiting for TL review
 *
 * @param teamId - Team ID (TL's team)
 * @returns Array of absence records needing TL review
 */
export async function getPendingReviews(teamId: string) {
  return prisma.absence.findMany({
    where: {
      teamId,
      justifiedAt: { not: null }, // Already justified by worker
      status: 'PENDING_JUSTIFICATION', // Waiting for TL review
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
    orderBy: { justifiedAt: 'asc' }, // Oldest first
  });
}

/**
 * Get all absences for a worker (for history page)
 *
 * @param userId - Worker's user ID
 * @param limit - Maximum number of records to return
 * @returns Array of absence records
 */
export async function getAbsenceHistory(userId: string, limit: number = 50) {
  return prisma.absence.findMany({
    where: { userId },
    include: {
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { absenceDate: 'desc' },
    take: limit,
  });
}

/**
 * Check if a worker has pending justifications that block app usage
 *
 * @param userId - Worker's user ID
 * @returns Boolean indicating if worker is blocked
 */
export async function hasBlockingAbsences(userId: string): Promise<boolean> {
  const count = await prisma.absence.count({
    where: {
      userId,
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: null, // Not yet justified
    },
  });
  return count > 0;
}

/**
 * Get absence status counts for a user (for dashboard display)
 *
 * @param userId - Worker's user ID
 * @returns Object with counts for each status
 */
export async function getAbsenceStatusCounts(userId: string) {
  const [pending, excused, unexcused] = await Promise.all([
    prisma.absence.count({
      where: { userId, status: 'PENDING_JUSTIFICATION' },
    }),
    prisma.absence.count({
      where: { userId, status: 'EXCUSED' },
    }),
    prisma.absence.count({
      where: { userId, status: 'UNEXCUSED' },
    }),
  ]);

  return {
    pending,
    excused,
    unexcused,
    total: pending + excused + unexcused,
  };
}

/**
 * Get absences for a specific date range (for grade calculation)
 *
 * @param userId - Worker's user ID
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of absence records
 */
export async function getAbsencesInRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.absence.findMany({
    where: {
      userId,
      absenceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
}
