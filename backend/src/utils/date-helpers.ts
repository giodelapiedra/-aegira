/**
 * Centralized date utility functions for backend using Luxon
 * ALL date operations should use these functions with company timezone
 *
 * IMPORTANT: Always pass the company timezone to these functions
 * The timezone is stored in Company.timezone (IANA format, e.g., "Asia/Manila")
 */

import { DateTime, Interval, Settings } from 'luxon';

// ============================================
// CONSTANTS
// ============================================

export const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type DayName = (typeof DAY_NAMES)[number];

export const DEFAULT_TIMEZONE = 'Asia/Manila';

// Configure Luxon defaults
Settings.defaultZone = DEFAULT_TIMEZONE;

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Convert Luxon weekday (1=Mon..7=Sun) to JS weekday (0=Sun..6=Sat)
 */
function luxonWeekdayToJS(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

/**
 * Parse work days string to array
 */
function parseWorkDays(workDays: string): string[] {
  return workDays.split(',').map(d => d.trim().toUpperCase());
}

// ============================================
// TIMEZONE-AWARE CORE FUNCTIONS
// ============================================

/**
 * Get current DateTime in a specific timezone
 * This is the BASE function - all other functions should use this
 */
export function getNowDT(timezone: string = DEFAULT_TIMEZONE): DateTime {
  return DateTime.now().setZone(timezone);
}

/**
 * Get current date/time in a specific timezone as JS Date
 * @deprecated Prefer getNowDT() for better type safety
 */
export function getNow(timezone: string = DEFAULT_TIMEZONE): Date {
  return getNowDT(timezone).toJSDate();
}

/**
 * Convert a JS Date to DateTime in a specific timezone
 */
export function toDateTime(date: Date, timezone: string = DEFAULT_TIMEZONE): DateTime {
  return DateTime.fromJSDate(date).setZone(timezone);
}

/**
 * Convert a UTC date to a specific timezone (returns JS Date)
 * @deprecated Prefer toDateTime() for better type safety
 */
export function toTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  return toDateTime(date, timezone).toJSDate();
}

/**
 * Get the current date parts in a timezone (year, month, day, hour, etc.)
 */
export function getDateParts(timezone: string = DEFAULT_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
  dayName: DayName;
} {
  const dt = getNowDT(timezone);
  const dayOfWeek = luxonWeekdayToJS(dt.weekday);

  return {
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second,
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
  };
}

// ============================================
// TODAY'S DATE RANGE (Timezone-Aware)
// ============================================

/**
 * Get start of today (midnight) in company timezone
 */
export function getTodayStart(timezone: string = DEFAULT_TIMEZONE): Date {
  return getNowDT(timezone).startOf('day').toJSDate();
}

/**
 * Get end of today (23:59:59.999) in company timezone
 */
export function getTodayEnd(timezone: string = DEFAULT_TIMEZONE): Date {
  return getNowDT(timezone).endOf('day').toJSDate();
}

/**
 * Get today's date range for database queries
 */
export function getTodayRange(timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const now = getNowDT(timezone);
  return {
    start: now.startOf('day').toJSDate(),
    end: now.endOf('day').toJSDate(),
  };
}

/**
 * Get today's date for @db.Date columns (date-only fields)
 * Creates a Date at noon UTC with the correct date components from timezone
 * This avoids timezone issues where Jan 7 Manila becomes Jan 6 in DB
 *
 * Example:
 * - Today in Manila: Jan 7, 2025
 * - Returns: Date(2025-01-07T12:00:00Z)
 * - PostgreSQL stores: 2025-01-07 ✓
 */
export function getTodayForDbDate(timezone: string = DEFAULT_TIMEZONE): Date {
  const now = getNowDT(timezone);
  // Use noon UTC to avoid timezone edge cases
  return new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0, 0));
}

/**
 * Convert any date to a @db.Date safe format
 * Extracts year/month/day in timezone and creates noon UTC date
 */
export function toDbDate(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  const dt = toDateTime(date, timezone);
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, 12, 0, 0, 0));
}

// ============================================
// DATE RANGE HELPERS (Timezone-Aware)
// ============================================

/**
 * Get start of a specific date in timezone
 */
export function getStartOfDay(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  return toDateTime(date, timezone).startOf('day').toJSDate();
}

/**
 * Get end of a specific date in timezone
 */
export function getEndOfDay(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  return toDateTime(date, timezone).endOf('day').toJSDate();
}

/**
 * Get date range for last N days
 */
export function getLastNDaysRange(
  days: number,
  timezone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  const now = getNowDT(timezone);
  return {
    start: now.minus({ days }).startOf('day').toJSDate(),
    end: now.endOf('day').toJSDate(),
  };
}

/**
 * Get date range for period type
 */
export function getPeriodRange(
  period: 'today' | 'week' | 'month' | 'quarter' | 'custom',
  timezone: string = DEFAULT_TIMEZONE,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  const now = getNowDT(timezone);

  switch (period) {
    case 'today':
      return getTodayRange(timezone);
    case 'week':
      return getLastNDaysRange(7, timezone);
    case 'month':
      return getLastNDaysRange(30, timezone);
    case 'quarter':
      return getLastNDaysRange(90, timezone);
    case 'custom':
      if (customStart && customEnd) {
        return {
          start: getStartOfDay(customStart, timezone),
          end: getEndOfDay(customEnd, timezone),
        };
      }
      return getLastNDaysRange(7, timezone);
    default:
      return getLastNDaysRange(7, timezone);
  }
}

/**
 * Get date range for current week (Monday to Sunday)
 */
export function getCurrentWeekRange(timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const now = getNowDT(timezone);
  return {
    start: now.startOf('week').toJSDate(),
    end: now.endOf('week').toJSDate(),
  };
}

/**
 * Get date range for current month
 */
export function getCurrentMonthRange(timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const now = getNowDT(timezone);
  return {
    start: now.startOf('month').toJSDate(),
    end: now.endOf('month').toJSDate(),
  };
}

// ============================================
// DAY HELPERS (Timezone-Aware)
// ============================================

/**
 * Get day name from date in timezone
 */
export function getDayName(date: Date, timezone: string = DEFAULT_TIMEZONE): DayName {
  const dt = toDateTime(date, timezone);
  const dayOfWeek = luxonWeekdayToJS(dt.weekday);
  return DAY_NAMES[dayOfWeek];
}

/**
 * Get current day name in timezone
 */
export function getCurrentDayName(timezone: string = DEFAULT_TIMEZONE): DayName {
  const dt = getNowDT(timezone);
  const dayOfWeek = luxonWeekdayToJS(dt.weekday);
  return DAY_NAMES[dayOfWeek];
}

/**
 * Check if a date is a work day
 */
export function isWorkDay(
  date: Date,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const dayName = getDayName(date, timezone);
  const workDaysList = parseWorkDays(workDays);
  return workDaysList.includes(dayName);
}

/**
 * Check if today is a work day
 */
export function isTodayWorkDay(workDays: string, timezone: string = DEFAULT_TIMEZONE): boolean {
  const dayName = getCurrentDayName(timezone);
  const workDaysList = parseWorkDays(workDays);
  return workDaysList.includes(dayName);
}

/**
 * Count work days in a date range
 */
export function countWorkDaysInRange(
  startDate: Date,
  endDate: Date,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const workDaysList = parseWorkDays(workDays);
  let count = 0;

  let current = toDateTime(startDate, timezone).startOf('day');
  const end = toDateTime(endDate, timezone).startOf('day');

  while (current <= end) {
    const dayOfWeek = luxonWeekdayToJS(current.weekday);
    if (workDaysList.includes(DAY_NAMES[dayOfWeek])) {
      count++;
    }
    current = current.plus({ days: 1 });
  }

  return count;
}

// ============================================
// SHIFT TIME HELPERS (Timezone-Aware)
// ============================================

/**
 * Parse shift time string to DateTime object for today in timezone
 */
export function parseShiftTime(timeStr: string, timezone: string = DEFAULT_TIMEZONE): DateTime {
  const today = getNowDT(timezone).toISODate();
  return DateTime.fromISO(`${today}T${timeStr}`, { zone: timezone });
}

/**
 * Parse shift time string to JS Date object for today in timezone
 */
export function parseShiftTimeAsDate(timeStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  return parseShiftTime(timeStr, timezone).toJSDate();
}

/**
 * Check if current time is within shift hours
 */
export function isWithinShiftHours(
  shiftStart: string,
  shiftEnd: string,
  timezone: string = DEFAULT_TIMEZONE,
  gracePeriodMinutes: number = 30
): boolean {
  const now = getNowDT(timezone);
  const start = parseShiftTime(shiftStart, timezone).minus({ minutes: gracePeriodMinutes });
  const end = parseShiftTime(shiftEnd, timezone);

  return now >= start && now <= end;
}

/**
 * Get check-in window for a shift
 */
export function getCheckinWindow(
  shiftStart: string,
  shiftEnd: string,
  timezone: string = DEFAULT_TIMEZONE,
  gracePeriodMinutes: number = 30
): { windowStart: Date; windowEnd: Date; shiftStart: Date; shiftEnd: Date } {
  const startDt = parseShiftTime(shiftStart, timezone);
  const endDt = parseShiftTime(shiftEnd, timezone);
  const windowStartDt = startDt.minus({ minutes: gracePeriodMinutes });

  return {
    windowStart: windowStartDt.toJSDate(),
    windowEnd: endDt.toJSDate(),
    shiftStart: startDt.toJSDate(),
    shiftEnd: endDt.toJSDate(),
  };
}

/**
 * Calculate minutes late from check-in time vs shift start
 */
export function calculateLateMinutes(
  checkInTime: Date,
  shiftStart: string,
  gracePeriodMinutes: number,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const checkIn = toDateTime(checkInTime, timezone);
  const shiftStartDt = parseShiftTime(shiftStart, timezone);
  const graceEnd = shiftStartDt.plus({ minutes: gracePeriodMinutes });

  if (checkIn <= graceEnd) return 0;

  return Math.floor(checkIn.diff(graceEnd, 'minutes').minutes);
}

// ============================================
// FORMATTING HELPERS (Timezone-Aware)
// ============================================

/**
 * Format date to local date string (YYYY-MM-DD) in timezone
 */
export function formatLocalDate(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timezone).toFormat('yyyy-MM-dd');
}

/**
 * Format date to ISO string in timezone
 */
export function formatISODate(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timezone).toISO() || '';
}

/**
 * Parse local date string to Date object (assumes date is in timezone)
 */
export function parseLocalDate(dateStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  return DateTime.fromISO(dateStr, { zone: timezone }).startOf('day').toJSDate();
}

/**
 * Format date for display (e.g., "Dec 30, 2024")
 */
export function formatDisplayDate(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timezone).toLocaleString(DateTime.DATE_MED);
}

/**
 * Format date and time for display (e.g., "Dec 30, 2024, 3:45 PM")
 */
export function formatDisplayDateTime(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timezone).toLocaleString(DateTime.DATETIME_MED);
}

/**
 * Format time only (e.g., "3:45 PM")
 */
export function formatDisplayTime(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timezone).toLocaleString(DateTime.TIME_SIMPLE);
}

/**
 * Format date with custom format string
 */
export function formatDate(
  date: Date,
  format: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return toDateTime(date, timezone).toFormat(format);
}

// ============================================
// STREAK CALCULATION HELPERS (Timezone-Aware)
// ============================================

/**
 * Calculate if streak continues based on check-in dates
 */
export function calculateStreakContinuation(
  lastCheckinDate: Date | null,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE,
  maxGapDays: number = 3
): boolean {
  if (!lastCheckinDate) return false;

  const today = getNowDT(timezone).startOf('day');
  const lastCheckin = toDateTime(lastCheckinDate, timezone).startOf('day');
  const daysDiff = Math.floor(today.diff(lastCheckin, 'days').days);

  // Same day - streak continues
  if (daysDiff === 0) return true;

  // Too long gap - streak broken
  if (daysDiff > maxGapDays) return false;

  // Check if gap only contains non-work days
  const workDaysList = parseWorkDays(workDays);
  for (let i = 1; i < daysDiff; i++) {
    const checkDate = lastCheckin.plus({ days: i });
    const dayOfWeek = luxonWeekdayToJS(checkDate.weekday);
    if (workDaysList.includes(DAY_NAMES[dayOfWeek])) {
      // Missed a work day - streak broken
      return false;
    }
  }

  return true;
}

/**
 * Calculate actual streak value considering missed work days
 */
export function calculateActualStreak(
  storedStreak: number,
  lastCheckinDate: Date | string | null,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  if (!lastCheckinDate || storedStreak === 0) {
    return 0;
  }

  const lastCheckin = typeof lastCheckinDate === 'string'
    ? new Date(lastCheckinDate)
    : lastCheckinDate;
  const continues = calculateStreakContinuation(lastCheckin, workDays, timezone);

  return continues ? storedStreak : 0;
}

// ============================================
// TIME EXTRACTION HELPERS (Timezone-Aware)
// ============================================

/**
 * Get hour and minute from a Date in a specific timezone
 */
export function getTimeInTimezone(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): { hour: number; minute: number } {
  const dt = toDateTime(date, timezone);
  return { hour: dt.hour, minute: dt.minute };
}

/**
 * Get day of week (0-6, 0=Sunday) from a Date in a specific timezone
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): number {
  const dt = toDateTime(date, timezone);
  return luxonWeekdayToJS(dt.weekday);
}

/**
 * Get date string (YYYY-MM-DD) from a Date in a specific timezone
 */
export function getDateStringInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatLocalDate(date, timezone);
}

// ============================================
// COMPARISON HELPERS
// ============================================

/**
 * Check if two dates are the same day in timezone
 */
export function isSameDay(
  date1: Date,
  date2: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  return toDateTime(date1, timezone).hasSame(toDateTime(date2, timezone), 'day');
}

/**
 * Check if a date is today in timezone
 */
export function isToday(date: Date, timezone: string = DEFAULT_TIMEZONE): boolean {
  return toDateTime(date, timezone).hasSame(getNowDT(timezone), 'day');
}

/**
 * Check if a date is in the past (before today) in timezone
 */
export function isPast(date: Date, timezone: string = DEFAULT_TIMEZONE): boolean {
  return toDateTime(date, timezone).startOf('day') < getNowDT(timezone).startOf('day');
}

/**
 * Check if a date is in the future (after today) in timezone
 */
export function isFuture(date: Date, timezone: string = DEFAULT_TIMEZONE): boolean {
  return toDateTime(date, timezone).startOf('day') > getNowDT(timezone).startOf('day');
}

/**
 * Get days difference between two dates (date2 - date1)
 */
export function getDaysDifference(
  date1: Date,
  date2: Date,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const d1 = toDateTime(date1, timezone).startOf('day');
  const d2 = toDateTime(date2, timezone).startOf('day');
  return Math.floor(d2.diff(d1, 'days').days);
}

// ============================================
// WORK DAY ADJUSTMENT HELPERS
// ============================================

/**
 * Get the next work day from a given date
 * If the given date is already a work day, returns that date
 */
export function getNextWorkDay(
  date: Date,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const workDaysList = parseWorkDays(workDays);
  let current = toDateTime(date, timezone).startOf('day');

  // Check up to 7 days ahead (worst case: all days except one are non-work days)
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = luxonWeekdayToJS(current.weekday);
    if (workDaysList.includes(DAY_NAMES[dayOfWeek])) {
      return current.toJSDate();
    }
    current = current.plus({ days: 1 });
  }

  // Fallback: return original date if no work day found (shouldn't happen)
  return toDateTime(date, timezone).startOf('day').toJSDate();
}

/**
 * Adjust a date to the next work day if it falls on a non-work day
 */
export function adjustToWorkDay(
  date: Date,
  workDays: string,
  timezone: string = DEFAULT_TIMEZONE
): {
  adjustedDate: Date;
  wasAdjusted: boolean;
  originalDayName: DayName;
  adjustedDayName: DayName;
} {
  const originalDayName = getDayName(date, timezone);
  const isAlreadyWorkDay = isWorkDay(date, workDays, timezone);

  if (isAlreadyWorkDay) {
    return {
      adjustedDate: toDateTime(date, timezone).startOf('day').toJSDate(),
      wasAdjusted: false,
      originalDayName,
      adjustedDayName: originalDayName,
    };
  }

  const adjustedDate = getNextWorkDay(date, workDays, timezone);
  const adjustedDayName = getDayName(adjustedDate, timezone);

  return {
    adjustedDate,
    wasAdjusted: true,
    originalDayName,
    adjustedDayName,
  };
}

// ============================================
// LEAVE PERIOD HELPERS (Luxon Interval)
// ============================================

/**
 * Check if a date falls within a leave period
 */
export function isDateInLeavePeriod(
  date: Date,
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const checkDt = toDateTime(date, timezone);
  const interval = Interval.fromDateTimes(
    toDateTime(startDate, timezone).startOf('day'),
    toDateTime(endDate, timezone).endOf('day')
  );
  return interval.contains(checkDt);
}

/**
 * Check if two date ranges overlap
 */
export function doPeriodsOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const interval1 = Interval.fromDateTimes(
    toDateTime(start1, timezone).startOf('day'),
    toDateTime(end1, timezone).endOf('day')
  );
  const interval2 = Interval.fromDateTimes(
    toDateTime(start2, timezone).startOf('day'),
    toDateTime(end2, timezone).endOf('day')
  );
  return interval1.overlaps(interval2);
}

/**
 * Get the number of days in a period
 */
export function getPeriodDays(
  startDate: Date,
  endDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): number {
  const start = toDateTime(startDate, timezone).startOf('day');
  const end = toDateTime(endDate, timezone).startOf('day');
  return Math.floor(end.diff(start, 'days').days) + 1;
}

// ============================================
// DURATION HELPERS
// ============================================

/**
 * Get human-readable duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = toDateTime(date, timezone);
  return dt.toRelative() || '';
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate if a string is a valid IANA timezone
 */
export function isValidTimezone(tz: string): boolean {
  try {
    const dt = DateTime.now().setZone(tz);
    return dt.isValid && dt.zoneName === tz;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid time format (HH:mm)
 */
export function isValidTimeFormat(time: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Validate if a string is a valid date format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr: string): boolean {
  const dt = DateTime.fromISO(dateStr);
  return dt.isValid;
}
