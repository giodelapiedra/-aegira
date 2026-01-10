/**
 * Attendance Utility
 * Handles attendance status calculation and performance scoring
 *
 * IMPORTANT: Uses company timezone for all date calculations
 */

import { DateTime } from 'luxon';
import { prisma } from '../config/prisma.js';
import {
  toDateTime,
  getNowDT,
  getTimeInTimezone,
  getDayOfWeekInTimezone,
  getDateStringInTimezone,
  getStartOfNextDay,
  DEFAULT_TIMEZONE,
  DAY_NAMES,
} from './date-helpers.js';

// ===========================================
// TYPES
// ===========================================

export type AttendanceStatus = 'GREEN' | 'YELLOW' | 'ABSENT' | 'EXCUSED';

export interface AttendanceResult {
  status: AttendanceStatus;
  score: number | null;
  isCounted: boolean;
  minutesLate: number;
}

export interface PerformanceScore {
  score: number;
  totalDays: number;
  countedDays: number;
  workDays: number;
  breakdown: {
    green: number;
    yellow: number;
    absent: number;
    excused: number;
    absenceExcused: number;    // Absence justified and TL excused
    absenceUnexcused: number;  // Absence not excused (0 points)
    absencePending: number;    // Absence pending justification/review (0 points until resolved)
  };
}

export interface DailyAttendanceRecord {
  date: string;
  status: AttendanceStatus;
  score: number | null;
  isCounted: boolean;
  checkInTime?: Date | null;
  minutesLate?: number;
  exceptionType?: string | null;
  absenceInfo?: {
    status: string;
    reasonCategory?: string | null;
    justifiedAt?: Date | null;
    reviewedAt?: Date | null;
  } | null;
}

// ===========================================
// CONSTANTS
// ===========================================

export const ATTENDANCE_SCORES = {
  GREEN: 100,
  YELLOW: 75,
  ABSENT: 0,
  EXCUSED: null,
} as const;

// ===========================================
// ATTENDANCE STATUS CALCULATION
// ===========================================

/**
 * Calculate attendance status based on check-in time vs scheduled time
 * GREEN = On-time (within grace period) = 100 points
 * YELLOW = Late (after grace period) = 75 points
 *
 * IMPORTANT: Uses company timezone for time comparison
 */
export function calculateAttendanceStatus(
  checkInTime: Date,
  scheduledStart: string,
  gracePeriodMins: number = 15,
  timezone: string = DEFAULT_TIMEZONE
): AttendanceResult {
  const [schedHour, schedMin] = scheduledStart.split(':').map(Number);
  const scheduledMinutes = schedHour * 60 + schedMin;
  const graceEndMinutes = scheduledMinutes + gracePeriodMins;

  // Get check-in time in company timezone (not UTC!)
  const { hour: checkInHour, minute: checkInMin } = getTimeInTimezone(checkInTime, timezone);
  const checkInMinutes = checkInHour * 60 + checkInMin;

  // Calculate minutes late (0 if on-time or early)
  const minutesLate = Math.max(0, checkInMinutes - graceEndMinutes);

  // On-time: checked in before or within grace period
  if (checkInMinutes <= graceEndMinutes) {
    return {
      status: 'GREEN',
      score: ATTENDANCE_SCORES.GREEN,
      isCounted: true,
      minutesLate: 0,
    };
  }

  // Late: checked in after grace period
  return {
    status: 'YELLOW',
    score: ATTENDANCE_SCORES.YELLOW,
    isCounted: true,
    minutesLate,
  };
}

// ===========================================
// PERFORMANCE SCORE CALCULATION (Lazy Evaluation)
// ===========================================

/**
 * Calculate performance score for a user over a period using lazy evaluation.
 * This checks all work days in the period and determines status on-the-fly:
 *
 * - GREEN (100) = on-time check-in, counted
 * - YELLOW (75) = late check-in, counted
 * - ABSENT (0) = no check-in AND no approved exception, counted (pulls down average)
 * - EXCUSED = has approved exception, NOT counted (excluded from computation)
 *
 * IMPORTANT: Uses company timezone for all date calculations
 */
export async function calculatePerformanceScore(
  userId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<PerformanceScore> {
  // Parallel query: Get user with team info AND first check-in date
  const [user, firstCheckin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { team: true },
    }),
    prisma.checkin.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  if (!user?.team) {
    return {
      score: 0,
      totalDays: 0,
      countedDays: 0,
      workDays: 0,
      breakdown: {
        green: 0,
        yellow: 0,
        absent: 0,
        excused: 0,
        absenceExcused: 0,
        absenceUnexcused: 0,
        absencePending: 0,
      },
    };
  }

  const team = user.team;
  const teamWorkDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

  // Determine effective start date using priority:
  // 1. First check-in date (most accurate - worker actually started working)
  // 2. NEXT DAY after teamJoinedAt (check-in requirement starts day after joining)
  // 3. NEXT DAY after createdAt (last resort)
  let baselineDate: Date;

  if (firstCheckin) {
    // If they already checked in, use that date (they were active)
    baselineDate = new Date(firstCheckin.createdAt);
  } else if (user.teamJoinedAt) {
    // No check-ins yet - requirement starts NEXT DAY after joining
    baselineDate = getStartOfNextDay(new Date(user.teamJoinedAt), timezone);
  } else {
    // Fallback - requirement starts NEXT DAY after account creation
    baselineDate = getStartOfNextDay(new Date(user.createdAt), timezone);
  }

  // Get baseline date string in company timezone for comparison
  const baselineDateStr = getDateStringInTimezone(baselineDate, timezone);
  const startDateStr = getDateStringInTimezone(startDate, timezone);
  const effectiveStartDate = startDateStr < baselineDateStr ? baselineDate : startDate;

  // Parallel query: Get attendance records, approved exceptions, holidays, AND absences
  const [attendanceRecords, approvedExceptions, holidays, absences] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: {
        userId,
        date: { gte: effectiveStartDate, lte: endDate },
      },
    }),
    prisma.exception.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    }),
    prisma.holiday.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: effectiveStartDate, lte: endDate },
      },
      select: { date: true },
    }),
    prisma.absence.findMany({
      where: {
        userId,
        absenceDate: { gte: effectiveStartDate, lte: endDate },
      },
    }),
  ]);

  // Build holiday set for quick lookup
  const holidayDates = new Set(holidays.map(h => getDateStringInTimezone(h.date, timezone)));

  // Create a map for quick lookup by date (using company timezone)
  const attendanceMap = new Map<string, typeof attendanceRecords[0]>();
  for (const record of attendanceRecords) {
    const dateKey = getDateStringInTimezone(record.date, timezone);
    attendanceMap.set(dateKey, record);
  }

  // Build absence map for quick lookup by date
  const absenceMap = new Map<string, typeof absences[0]>();
  for (const absence of absences) {
    const dateKey = getDateStringInTimezone(absence.absenceDate, timezone);
    absenceMap.set(dateKey, absence);
  }

  // Helper to check if a date is covered by an approved exception
  // End date = LAST DAY of exemption (not return date)
  // If exemption ends Jan 6 → Jan 6 is excused → Jan 7 is first required check-in
  const isDateExcused = (dateStr: string): boolean => {
    for (const exception of approvedExceptions) {
      if (!exception.startDate || !exception.endDate) continue;
      const exStartStr = getDateStringInTimezone(exception.startDate, timezone);
      const exEndStr = getDateStringInTimezone(exception.endDate, timezone);

      // Include the end date as last day of exemption (use <= instead of <)
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return true;
      }
    }
    return false;
  };

  // Iterate through all days in the period (starting from effective start date)
  const breakdown = {
    green: 0,
    yellow: 0,
    absent: 0,
    excused: 0,
    absenceExcused: 0,
    absenceUnexcused: 0,
    absencePending: 0,
  };
  let totalScore = 0;
  let countedDays = 0;
  let workDaysCount = 0;

  // Get today's date string in company timezone for "past day" comparison
  const todayStr = getDateStringInTimezone(new Date(), timezone);

  let current = toDateTime(effectiveStartDate, timezone).startOf('day');
  const end = toDateTime(endDate, timezone).startOf('day');

  while (current <= end) {
    // Get day name in company timezone
    const dayOfWeek = getDayOfWeekInTimezone(current.toJSDate(), timezone);
    const dayName = DAY_NAMES[dayOfWeek];
    const dateKey = current.toFormat('yyyy-MM-dd');

    // Only process work days for this team AND not holidays
    if (teamWorkDays.includes(dayName) && !holidayDates.has(dateKey)) {
      workDaysCount++;
      const record = attendanceMap.get(dateKey);

      if (record) {
        // Has attendance record - use its status
        switch (record.status) {
          case 'GREEN':
            breakdown.green++;
            totalScore += ATTENDANCE_SCORES.GREEN;
            countedDays++;
            break;
          case 'YELLOW':
            breakdown.yellow++;
            totalScore += ATTENDANCE_SCORES.YELLOW;
            countedDays++;
            break;
          case 'ABSENT':
            breakdown.absent++;
            totalScore += ATTENDANCE_SCORES.ABSENT;
            countedDays++;
            break;
          case 'EXCUSED':
            breakdown.excused++;
            // Not counted
            break;
        }
      } else if (isDateExcused(dateKey)) {
        // No attendance record but has approved exception
        breakdown.excused++;
        // Not counted
      } else {
        // Check for absence record
        const absence = absenceMap.get(dateKey);

        if (absence) {
          // Has absence record - check status
          switch (absence.status) {
            case 'EXCUSED':
              // Absence excused by TL - no penalty, not counted
              breakdown.absenceExcused++;
              // Not counted in score
              break;
            case 'UNEXCUSED':
              // Absence not excused - 0 points, counted
              breakdown.absenceUnexcused++;
              totalScore += 0;
              countedDays++;
              break;
            case 'PENDING_JUSTIFICATION':
            default:
              // Pending justification or review - 0 points until resolved
              breakdown.absencePending++;
              totalScore += 0;
              countedDays++;
              break;
          }
        } else {
          // No record and no exception and no absence = ABSENT (only for past days in company timezone)
          if (dateKey < todayStr) {
            breakdown.absent++;
            totalScore += ATTENDANCE_SCORES.ABSENT;
            countedDays++;
          }
          // Future days are not counted as absent yet
        }
      }
    }

    current = current.plus({ days: 1 });
  }

  const score = countedDays > 0 ? Math.round((totalScore / countedDays) * 10) / 10 : 0;

  return { score, totalDays: workDaysCount, countedDays, workDays: workDaysCount, breakdown };
}

/**
 * Get performance grade based on score (A-D letter grade)
 */
export function getPerformanceGrade(score: number): { grade: string; label: string } {
  if (score >= 90) return { grade: 'A', label: 'Excellent' };
  if (score >= 80) return { grade: 'B', label: 'Good' };
  if (score >= 70) return { grade: 'C', label: 'Fair' };
  return { grade: 'D', label: 'Poor' };
}

/**
 * Get daily attendance records with lazy evaluation.
 * Returns an array of attendance records for each work day in the period.
 *
 * IMPORTANT: Uses company timezone for all date calculations
 */
export async function getAttendanceHistory(
  userId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<DailyAttendanceRecord[]> {
  // Parallel query: Get user with team info AND first check-in date
  const [user, firstCheckin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { team: true },
    }),
    prisma.checkin.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  if (!user?.team) {
    return [];
  }

  const team = user.team;
  const teamWorkDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

  // Determine effective start date using priority:
  // 1. First check-in date (most accurate - worker actually started working)
  // 2. NEXT DAY after teamJoinedAt (check-in requirement starts day after joining)
  // 3. NEXT DAY after createdAt (last resort)
  let baselineDate: Date;

  if (firstCheckin) {
    // If they already checked in, use that date (they were active)
    baselineDate = new Date(firstCheckin.createdAt);
  } else if (user.teamJoinedAt) {
    // No check-ins yet - requirement starts NEXT DAY after joining
    baselineDate = getStartOfNextDay(new Date(user.teamJoinedAt), timezone);
  } else {
    // Fallback - requirement starts NEXT DAY after account creation
    baselineDate = getStartOfNextDay(new Date(user.createdAt), timezone);
  }

  // Get baseline date string in company timezone for comparison
  const baselineDateStr = getDateStringInTimezone(baselineDate, timezone);
  const startDateStr = getDateStringInTimezone(startDate, timezone);
  const effectiveStartDate = startDateStr < baselineDateStr ? baselineDate : startDate;

  // Parallel query: Get attendance records, approved exceptions, holidays, AND absences
  const [attendanceRecords, approvedExceptions, holidays, absencesHistory] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: {
        userId,
        date: { gte: effectiveStartDate, lte: endDate },
      },
      include: {
        exception: { select: { type: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.exception.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    }),
    prisma.holiday.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: effectiveStartDate, lte: endDate },
      },
      select: { date: true },
    }),
    prisma.absence.findMany({
      where: {
        userId,
        absenceDate: { gte: effectiveStartDate, lte: endDate },
      },
    }),
  ]);

  // Build holiday set for quick lookup
  const holidayDates = new Set(holidays.map(h => getDateStringInTimezone(h.date, timezone)));

  // Create a map for quick lookup by date (using company timezone)
  const attendanceMap = new Map<string, typeof attendanceRecords[0]>();
  for (const record of attendanceRecords) {
    const dateKey = getDateStringInTimezone(record.date, timezone);
    attendanceMap.set(dateKey, record);
  }

  // Build absence map for quick lookup by date
  const absenceHistoryMap = new Map<string, typeof absencesHistory[0]>();
  for (const absence of absencesHistory) {
    const dateKey = getDateStringInTimezone(absence.absenceDate, timezone);
    absenceHistoryMap.set(dateKey, absence);
  }

  // Helper to get exception type for a date (using date string comparison)
  // End date = LAST DAY of exemption (not return date)
  const getExceptionForDate = (dateStr: string) => {
    for (const exception of approvedExceptions) {
      if (!exception.startDate || !exception.endDate) continue;
      const exStartStr = getDateStringInTimezone(exception.startDate, timezone);
      const exEndStr = getDateStringInTimezone(exception.endDate, timezone);

      // Include the end date as last day of exemption (use <= instead of <)
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return exception;
      }
    }
    return null;
  };

  const records: DailyAttendanceRecord[] = [];

  // Get today's date string in company timezone for "past day" comparison
  const todayStr = getDateStringInTimezone(new Date(), timezone);

  // Iterate from endDate to effectiveStartDate (newest first)
  let current = toDateTime(endDate, timezone).startOf('day');
  const start = toDateTime(effectiveStartDate, timezone).startOf('day');

  while (current >= start) {
    // Get day name in company timezone
    const dayOfWeek = getDayOfWeekInTimezone(current.toJSDate(), timezone);
    const dayName = DAY_NAMES[dayOfWeek];
    const dateKey = current.toFormat('yyyy-MM-dd');

    // Only process work days that are NOT holidays
    if (teamWorkDays.includes(dayName) && !holidayDates.has(dateKey)) {
      const record = attendanceMap.get(dateKey);

      if (record) {
        records.push({
          date: dateKey,
          status: record.status as AttendanceStatus,
          score: record.score,
          isCounted: record.isCounted,
          checkInTime: record.checkInTime,
          minutesLate: record.minutesLate,
          exceptionType: record.exception?.type || null,
        });
      } else {
        const exception = getExceptionForDate(dateKey);

        if (exception) {
          // Has approved exception
          records.push({
            date: dateKey,
            status: 'EXCUSED',
            score: null,
            isCounted: false,
            exceptionType: exception.type,
          });
        } else {
          // Check for absence record
          const absence = absenceHistoryMap.get(dateKey);

          if (absence) {
            // Has absence record - include absence info
            const absenceInfo = {
              status: absence.status,
              reasonCategory: absence.reasonCategory,
              justifiedAt: absence.justifiedAt,
              reviewedAt: absence.reviewedAt,
            };

            if (absence.status === 'EXCUSED') {
              // Absence excused - no penalty
              records.push({
                date: dateKey,
                status: 'EXCUSED',
                score: null,
                isCounted: false,
                absenceInfo,
              });
            } else {
              // Pending or unexcused - 0 points
              records.push({
                date: dateKey,
                status: 'ABSENT',
                score: 0,
                isCounted: true,
                absenceInfo,
              });
            }
          } else if (dateKey < todayStr) {
            // Past work day with no check-in, no exception, and no absence = ABSENT
            records.push({
              date: dateKey,
              status: 'ABSENT',
              score: 0,
              isCounted: true,
            });
          }
          // Skip future days
        }
      }
    }

    current = current.minus({ days: 1 });
  }

  return records;
}

// ===========================================
// HELPER
// ===========================================

/**
 * Get date only (without time) for DB queries
 */
export function getDateOnly(date: Date): Date {
  return toDateTime(date, DEFAULT_TIMEZONE).startOf('day').toJSDate();
}

/**
 * Calculate attendance statistics for a team
 */
export async function getTeamAttendanceStats(
  teamId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): Promise<{
  totalCheckins: number;
  onTime: number;
  late: number;
  absent: number;
  excused: number;
  complianceRate: number;
}> {
  const attendanceRecords = await prisma.dailyAttendance.findMany({
    where: {
      teamId,
      date: { gte: startDate, lte: endDate },
    },
  });

  let onTime = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const record of attendanceRecords) {
    switch (record.status) {
      case 'GREEN':
        onTime++;
        break;
      case 'YELLOW':
        late++;
        break;
      case 'ABSENT':
        absent++;
        break;
      case 'EXCUSED':
        excused++;
        break;
    }
  }

  const totalCheckins = onTime + late;
  const totalCountable = totalCheckins + absent;
  const complianceRate = totalCountable > 0
    ? Math.round((totalCheckins / totalCountable) * 100)
    : 0;

  return {
    totalCheckins,
    onTime,
    late,
    absent,
    excused,
    complianceRate,
  };
}
