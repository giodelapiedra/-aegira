/**
 * Centralized schedule utility functions
 * Handles work days, shift times, and check-in scheduling logic
 */

import {
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT,
  
  CHECKIN_GRACE_PERIOD_MINUTES,
  type DayCode,
} from './constants';
import { formatShiftTime, getDayCode, addDays, getStartOfDay } from './date-utils';

// ============================================
// TYPES
// ============================================

export interface Team {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
}

export interface CheckinInfo {
  canCheckin: boolean;
  message: string;
  nextCheckinTime?: Date;
  isWithinShift: boolean;
  isWorkDay: boolean;
}

// ============================================
// WORK DAY HELPERS
// ============================================

/**
 * Parse work days string to array of day codes
 * @param workDays - Comma-separated string (e.g., "MON,TUE,WED,THU,FRI")
 */
export function parseWorkDays(workDays: string): DayCode[] {
  if (!workDays) return [];
  return workDays.split(',').map((d) => d.trim() as DayCode);
}

/**
 * Check if a specific date is a work day
 */
export function isWorkDay(date: Date, workDays: string): boolean {
  const dayCode = getDayCode(date);
  const workDayList = parseWorkDays(workDays);
  return workDayList.includes(dayCode);
}

/**
 * Format work days for display
 * @param workDays - Comma-separated string (e.g., "MON,TUE,WED,THU,FRI")
 * @param format - 'full' for full names, 'short' for abbreviations
 */
export function formatWorkDays(workDays: string, format: 'full' | 'short' = 'full'): string {
  const days = parseWorkDays(workDays);
  if (days.length === 0) return 'No work days set';

  const mapping = format === 'full' ? DAY_CODE_TO_NAME : DAY_CODE_TO_SHORT;

  // Check for consecutive weekdays (Mon-Fri)
  const weekdays: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const isWeekdays = weekdays.every((d) => days.includes(d)) && days.length === 5;

  if (isWeekdays) {
    return format === 'full' ? 'Monday - Friday' : 'M-F';
  }

  return days.map((d) => mapping[d]).join(format === 'full' ? ', ' : '');
}

/**
 * Get work days as display array (for calendar view)
 */
export function getWorkDaysDisplay(workDays: string): { code: DayCode; short: string; isWorkDay: boolean }[] {
  const allDays: DayCode[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const workDayList = parseWorkDays(workDays);

  return allDays.map((code) => ({
    code,
    short: DAY_CODE_TO_SHORT[code],
    isWorkDay: workDayList.includes(code),
  }));
}

// ============================================
// SHIFT TIME HELPERS
// ============================================

/**
 * Parse shift time string to hours and minutes
 * @param time - Time string (e.g., "08:00" or "17:30")
 */
export function parseShiftTime(time: string): { hours: number; minutes: number } {
  if (!time) return { hours: 0, minutes: 0 };
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Get shift time as Date object for today
 */
export function getShiftTimeAsDate(time: string, date: Date = new Date()): Date {
  const { hours, minutes } = parseShiftTime(time);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Check if current time is within shift hours (with grace period)
 */
export function isWithinShiftHours(
  shiftStart: string,
  shiftEnd: string,
  gracePeriodMinutes: number = CHECKIN_GRACE_PERIOD_MINUTES
): boolean {
  const now = new Date();
  const start = getShiftTimeAsDate(shiftStart);
  const end = getShiftTimeAsDate(shiftEnd);

  // Apply grace period (allow check-in slightly before shift starts)
  const graceStart = new Date(start);
  graceStart.setMinutes(graceStart.getMinutes() - gracePeriodMinutes);

  return now >= graceStart && now <= end;
}

/**
 * Format shift hours for display (e.g., "8:00 AM - 5:00 PM")
 */
export function formatShiftHours(shiftStart: string, shiftEnd: string): string {
  return `${formatShiftTime(shiftStart)} - ${formatShiftTime(shiftEnd)}`;
}

// ============================================
// CHECK-IN LOGIC
// ============================================

/**
 * Get check-in status and next available check-in time
 */
export function getCheckinInfo(
  team: Team | null | undefined,
  hasCheckedInToday: boolean
): CheckinInfo {
  // No team assigned
  if (!team) {
    return {
      canCheckin: false,
      message: 'You must be assigned to a team before checking in',
      isWithinShift: false,
      isWorkDay: false,
    };
  }

  const today = new Date();
  const todayIsWorkDay = isWorkDay(today, team.workDays);
  const withinShift = isWithinShiftHours(team.shiftStart, team.shiftEnd);

  // Already checked in today
  if (hasCheckedInToday) {
    return {
      canCheckin: false,
      message: "You've already checked in today",
      isWithinShift: withinShift,
      isWorkDay: todayIsWorkDay,
    };
  }

  // Not a work day
  if (!todayIsWorkDay) {
    const nextWorkDay = getNextWorkDay(team.workDays);
    const nextCheckinTime = getShiftTimeAsDate(team.shiftStart, nextWorkDay);

    return {
      canCheckin: false,
      message: 'Today is not a scheduled work day',
      nextCheckinTime,
      isWithinShift: false,
      isWorkDay: false,
    };
  }

  // Outside shift hours
  if (!withinShift) {
    const now = new Date();
    const shiftStart = getShiftTimeAsDate(team.shiftStart);
    // shiftEnd removed - unused

    if (now < shiftStart) {
      // Before shift starts
      const graceStart = new Date(shiftStart);
      graceStart.setMinutes(graceStart.getMinutes() - CHECKIN_GRACE_PERIOD_MINUTES);

      return {
        canCheckin: false,
        message: `Check-in opens at ${formatShiftTime(team.shiftStart)}`,
        nextCheckinTime: graceStart,
        isWithinShift: false,
        isWorkDay: true,
      };
    } else {
      // After shift ends
      const nextWorkDay = getNextWorkDay(team.workDays);
      const nextCheckinTime = getShiftTimeAsDate(team.shiftStart, nextWorkDay);

      return {
        canCheckin: false,
        message: 'Check-in window has closed for today',
        nextCheckinTime,
        isWithinShift: false,
        isWorkDay: true,
      };
    }
  }

  // Can check in!
  return {
    canCheckin: true,
    message: 'Ready to check in',
    isWithinShift: true,
    isWorkDay: true,
  };
}

/**
 * Get the next work day from today
 */
export function getNextWorkDay(workDays: string, startDate: Date = new Date()): Date {
  const workDayList = parseWorkDays(workDays);
  if (workDayList.length === 0) {
    return addDays(startDate, 1);
  }

  let checkDate = getStartOfDay(addDays(startDate, 1));
  const maxDays = 8; // Prevent infinite loop

  for (let i = 0; i < maxDays; i++) {
    const dayCode = getDayCode(checkDate);
    if (workDayList.includes(dayCode)) {
      return checkDate;
    }
    checkDate = addDays(checkDate, 1);
  }

  // Fallback to tomorrow
  return addDays(startDate, 1);
}

/**
 * Calculate time remaining until next check-in
 */
export function getTimeUntilCheckin(nextCheckinTime: Date): string {
  const now = new Date();
  const diffMs = nextCheckinTime.getTime() - now.getTime();

  if (diffMs <= 0) return 'Now';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60;
    return `${diffHours}h ${remainingMinutes}m`;
  } else {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  }
}
