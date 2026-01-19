/**
 * Unit Tests for date-helpers.ts
 *
 * Tests all timezone-aware date utility functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // Constants
  DAY_NAMES,
  DEFAULT_TIMEZONE,
  // Core functions
  getNowDT,
  getNow,
  toDateTime,
  toTimezone,
  getDateParts,
  // Today's date range
  getTodayStart,
  getTodayEnd,
  getStartOfNextDay,
  getFirstWorkDayAfter,
  getTodayRange,
  getTodayForDbDate,
  toDbDate,
  // Date range helpers
  getStartOfDay,
  getEndOfDay,
  getLastNDaysRange,
  getPeriodRange,
  getCurrentWeekRange,
  getCurrentMonthRange,
  // Day helpers
  getDayName,
  getCurrentDayName,
  isWorkDay,
  isTodayWorkDay,
  countWorkDaysInRange,
  // Shift time helpers
  parseShiftTime,
  parseShiftTimeAsDate,
  isWithinShiftHours,
  getCheckinWindow,
  calculateLateMinutes,
  // Formatting helpers
  formatLocalDate,
  formatISODate,
  parseLocalDate,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
  formatDate,
  // Streak helpers
  calculateStreakContinuation,
  calculateActualStreak,
  // Time extraction
  getTimeInTimezone,
  getDayOfWeekInTimezone,
  getDateStringInTimezone,
  // Comparison helpers
  isSameDay,
  isToday,
  isPast,
  isFuture,
  getDaysDifference,
  // Work day adjustment
  getNextWorkDay,
  adjustToWorkDay,
  // Leave period helpers
  isDateInLeavePeriod,
  doPeriodsOverlap,
  getPeriodDays,
  // Duration helpers
  formatDuration,
  getRelativeTime,
  // Validation helpers
  isValidTimezone,
  isValidTimeFormat,
  isValidDateFormat,
} from '../../../src/utils/date-helpers.js';
import { DateTime } from 'luxon';

// ============================================
// CONSTANTS TESTS
// ============================================

describe('Constants', () => {
  it('DAY_NAMES has correct values', () => {
    expect(DAY_NAMES).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    expect(DAY_NAMES.length).toBe(7);
  });

  it('DEFAULT_TIMEZONE is Asia/Manila', () => {
    expect(DEFAULT_TIMEZONE).toBe('Asia/Manila');
  });
});

// ============================================
// CORE FUNCTIONS TESTS
// ============================================

describe('Core Functions', () => {
  describe('getNowDT', () => {
    it('returns DateTime in default timezone', () => {
      const dt = getNowDT();
      expect(dt.zoneName).toBe('Asia/Manila');
      expect(dt.isValid).toBe(true);
    });

    it('returns DateTime in specified timezone', () => {
      const dt = getNowDT('America/New_York');
      expect(dt.zoneName).toBe('America/New_York');
      expect(dt.isValid).toBe(true);
    });

    it('returns DateTime in UTC', () => {
      const dt = getNowDT('UTC');
      expect(dt.zoneName).toBe('UTC');
      expect(dt.isValid).toBe(true);
    });
  });

  describe('getNow', () => {
    it('returns JS Date', () => {
      const date = getNow();
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('toDateTime', () => {
    it('converts JS Date to DateTime in timezone', () => {
      const jsDate = new Date('2025-01-15T10:00:00Z');
      const dt = toDateTime(jsDate, 'Asia/Manila');
      expect(dt.zoneName).toBe('Asia/Manila');
      expect(dt.isValid).toBe(true);
    });
  });

  describe('getDateParts', () => {
    it('returns correct date parts', () => {
      const parts = getDateParts('UTC');
      expect(parts).toHaveProperty('year');
      expect(parts).toHaveProperty('month');
      expect(parts).toHaveProperty('day');
      expect(parts).toHaveProperty('hour');
      expect(parts).toHaveProperty('minute');
      expect(parts).toHaveProperty('second');
      expect(parts).toHaveProperty('dayOfWeek');
      expect(parts).toHaveProperty('dayName');
      expect(DAY_NAMES).toContain(parts.dayName);
    });

    it('returns dayOfWeek as 0-6 (Sunday=0)', () => {
      const parts = getDateParts();
      expect(parts.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(parts.dayOfWeek).toBeLessThanOrEqual(6);
    });
  });
});

// ============================================
// TODAY'S DATE RANGE TESTS
// ============================================

describe('Today Date Range Functions', () => {
  describe('getTodayStart', () => {
    it('returns midnight of today', () => {
      const start = getTodayStart('UTC');
      const dt = DateTime.fromJSDate(start, { zone: 'UTC' });
      expect(dt.hour).toBe(0);
      expect(dt.minute).toBe(0);
      expect(dt.second).toBe(0);
    });
  });

  describe('getTodayEnd', () => {
    it('returns end of today (23:59:59)', () => {
      const end = getTodayEnd('UTC');
      const dt = DateTime.fromJSDate(end, { zone: 'UTC' });
      expect(dt.hour).toBe(23);
      expect(dt.minute).toBe(59);
      expect(dt.second).toBe(59);
    });
  });

  describe('getTodayRange', () => {
    it('returns start and end of today', () => {
      const range = getTodayRange('UTC');
      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      expect(range.start.getTime()).toBeLessThan(range.end.getTime());
    });

    it('returns correct range for Asia/Manila', () => {
      const range = getTodayRange('Asia/Manila');
      const startDt = DateTime.fromJSDate(range.start, { zone: 'Asia/Manila' });
      const endDt = DateTime.fromJSDate(range.end, { zone: 'Asia/Manila' });
      expect(startDt.hour).toBe(0);
      expect(endDt.hour).toBe(23);
    });
  });

  describe('getStartOfNextDay', () => {
    it('returns next day midnight', () => {
      const today = new Date('2025-01-15T10:00:00Z');
      const nextDay = getStartOfNextDay(today, 'UTC');
      const dt = DateTime.fromJSDate(nextDay, { zone: 'UTC' });
      expect(dt.day).toBe(16);
      expect(dt.hour).toBe(0);
    });
  });

  describe('getFirstWorkDayAfter', () => {
    it('returns next day when no workDays specified', () => {
      const friday = new Date('2025-01-17T10:00:00Z'); // Friday
      const result = getFirstWorkDayAfter(friday, 'UTC');
      const dt = DateTime.fromJSDate(result, { zone: 'UTC' });
      expect(dt.day).toBe(18); // Saturday
    });

    it('skips weekend when workDays is Mon-Fri', () => {
      const friday = new Date('2025-01-17T10:00:00Z'); // Friday
      const result = getFirstWorkDayAfter(friday, 'UTC', 'MON,TUE,WED,THU,FRI');
      const dt = DateTime.fromJSDate(result, { zone: 'UTC' });
      expect(dt.day).toBe(20); // Monday
      expect(dt.weekday).toBe(1); // Monday in Luxon
    });

    it('returns next day when already work day', () => {
      const monday = new Date('2025-01-13T10:00:00Z'); // Monday
      const result = getFirstWorkDayAfter(monday, 'UTC', 'MON,TUE,WED,THU,FRI');
      const dt = DateTime.fromJSDate(result, { zone: 'UTC' });
      expect(dt.day).toBe(14); // Tuesday
    });
  });

  describe('getTodayForDbDate', () => {
    it('returns date at noon UTC', () => {
      const dbDate = getTodayForDbDate('Asia/Manila');
      expect(dbDate.getUTCHours()).toBe(12);
      expect(dbDate.getUTCMinutes()).toBe(0);
    });
  });

  describe('toDbDate', () => {
    it('converts date to noon UTC preserving date in timezone', () => {
      const date = new Date('2025-01-15T20:00:00Z'); // 4 AM Jan 16 in Manila
      const dbDate = toDbDate(date, 'Asia/Manila');
      expect(dbDate.getUTCHours()).toBe(12);
      // Date should be Jan 16 in Manila
      expect(dbDate.getUTCDate()).toBe(16);
    });
  });
});

// ============================================
// DATE RANGE HELPERS TESTS
// ============================================

describe('Date Range Helpers', () => {
  describe('getStartOfDay', () => {
    it('returns midnight of given date', () => {
      const date = new Date('2025-01-15T15:30:00Z');
      const start = getStartOfDay(date, 'UTC');
      const dt = DateTime.fromJSDate(start, { zone: 'UTC' });
      expect(dt.hour).toBe(0);
      expect(dt.minute).toBe(0);
    });
  });

  describe('getEndOfDay', () => {
    it('returns 23:59:59 of given date', () => {
      const date = new Date('2025-01-15T15:30:00Z');
      const end = getEndOfDay(date, 'UTC');
      const dt = DateTime.fromJSDate(end, { zone: 'UTC' });
      expect(dt.hour).toBe(23);
      expect(dt.minute).toBe(59);
    });
  });

  describe('getLastNDaysRange', () => {
    it('returns correct range for 7 days', () => {
      const range = getLastNDaysRange(7, 'UTC');
      const daysDiff = Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(7);
    });
  });

  describe('getPeriodRange', () => {
    it('returns today range for "today"', () => {
      const range = getPeriodRange('today', 'UTC');
      const todayRange = getTodayRange('UTC');
      expect(range.start.getTime()).toBe(todayRange.start.getTime());
    });

    it('returns 7 days for "week"', () => {
      const range = getPeriodRange('week', 'UTC');
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });

    it('returns 30 days for "month"', () => {
      const range = getPeriodRange('month', 'UTC');
      expect(range.start).toBeInstanceOf(Date);
    });

    it('returns 90 days for "quarter"', () => {
      const range = getPeriodRange('quarter', 'UTC');
      expect(range.start).toBeInstanceOf(Date);
    });

    it('uses custom dates for "custom"', () => {
      const customStart = new Date('2025-01-01');
      const customEnd = new Date('2025-01-10');
      const range = getPeriodRange('custom', 'UTC', customStart, customEnd);
      expect(range.start.getTime()).toBeLessThanOrEqual(customStart.getTime() + 86400000);
    });
  });

  describe('getCurrentWeekRange', () => {
    it('returns valid week range', () => {
      const range = getCurrentWeekRange('UTC');
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      expect(range.start.getTime()).toBeLessThan(range.end.getTime());
    });
  });

  describe('getCurrentMonthRange', () => {
    it('returns valid month range', () => {
      const range = getCurrentMonthRange('UTC');
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });
  });
});

// ============================================
// DAY HELPERS TESTS
// ============================================

describe('Day Helpers', () => {
  describe('getDayName', () => {
    it('returns correct day name for Monday', () => {
      const monday = new Date('2025-01-13T12:00:00Z'); // Monday
      expect(getDayName(monday, 'UTC')).toBe('MON');
    });

    it('returns correct day name for Sunday', () => {
      const sunday = new Date('2025-01-19T12:00:00Z'); // Sunday
      expect(getDayName(sunday, 'UTC')).toBe('SUN');
    });

    it('returns correct day name for Saturday', () => {
      const saturday = new Date('2025-01-18T12:00:00Z'); // Saturday
      expect(getDayName(saturday, 'UTC')).toBe('SAT');
    });
  });

  describe('getCurrentDayName', () => {
    it('returns valid day name', () => {
      const dayName = getCurrentDayName('UTC');
      expect(DAY_NAMES).toContain(dayName);
    });
  });

  describe('isWorkDay', () => {
    it('returns true for Monday when Mon is work day', () => {
      const monday = new Date('2025-01-13T12:00:00Z');
      expect(isWorkDay(monday, 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(true);
    });

    it('returns false for Saturday when Mon-Fri work days', () => {
      const saturday = new Date('2025-01-18T12:00:00Z');
      expect(isWorkDay(saturday, 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(false);
    });

    it('returns true for Saturday when Mon-Sat work days', () => {
      const saturday = new Date('2025-01-18T12:00:00Z');
      expect(isWorkDay(saturday, 'MON,TUE,WED,THU,FRI,SAT', 'UTC')).toBe(true);
    });

    it('handles lowercase work days', () => {
      const monday = new Date('2025-01-13T12:00:00Z');
      expect(isWorkDay(monday, 'mon,tue,wed,thu,fri', 'UTC')).toBe(true);
    });
  });

  describe('countWorkDaysInRange', () => {
    it('counts work days correctly', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-17T00:00:00Z'); // Friday
      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(count).toBe(5);
    });

    it('excludes holidays', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-17T00:00:00Z'); // Friday
      const holidays = ['2025-01-15']; // Wednesday is holiday
      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(4);
    });

    it('returns 0 for weekend-only range with Mon-Fri schedule', () => {
      const start = new Date('2025-01-18T00:00:00Z'); // Saturday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(count).toBe(0);
    });
  });
});

// ============================================
// SHIFT TIME HELPERS TESTS
// ============================================

describe('Shift Time Helpers', () => {
  describe('parseShiftTime', () => {
    it('parses time string correctly', () => {
      const dt = parseShiftTime('08:00', 'UTC');
      expect(dt.hour).toBe(8);
      expect(dt.minute).toBe(0);
    });

    it('parses afternoon time correctly', () => {
      const dt = parseShiftTime('17:30', 'UTC');
      expect(dt.hour).toBe(17);
      expect(dt.minute).toBe(30);
    });
  });

  describe('parseShiftTimeAsDate', () => {
    it('returns JS Date', () => {
      const date = parseShiftTimeAsDate('08:00', 'UTC');
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('isWithinShiftHours', () => {
    it('returns true when within shift hours', () => {
      // Mock current time to 10:00 AM
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00Z'));

      const result = isWithinShiftHours('08:00', '17:00', 'UTC', 30);
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it('returns false when before shift start', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T06:00:00Z'));

      const result = isWithinShiftHours('08:00', '17:00', 'UTC', 30);
      expect(result).toBe(false);

      vi.useRealTimers();
    });

    it('returns true within grace period before shift', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T07:45:00Z')); // 15 mins before shift

      const result = isWithinShiftHours('08:00', '17:00', 'UTC', 30);
      expect(result).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('getCheckinWindow', () => {
    it('returns correct window times', () => {
      const window = getCheckinWindow('08:00', '17:00', 'UTC', 30);
      expect(window).toHaveProperty('windowStart');
      expect(window).toHaveProperty('windowEnd');
      expect(window).toHaveProperty('shiftStart');
      expect(window).toHaveProperty('shiftEnd');

      const windowStartDt = DateTime.fromJSDate(window.windowStart, { zone: 'UTC' });
      expect(windowStartDt.hour).toBe(7);
      expect(windowStartDt.minute).toBe(30);
    });
  });

  describe('calculateLateMinutes', () => {
    it('returns 0 when on time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const checkIn = new Date('2025-01-15T08:00:00Z');
      const late = calculateLateMinutes(checkIn, '08:00', 15, 'UTC');
      expect(late).toBe(0);

      vi.useRealTimers();
    });

    it('returns 0 within grace period', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const checkIn = new Date('2025-01-15T08:10:00Z');
      const late = calculateLateMinutes(checkIn, '08:00', 15, 'UTC');
      expect(late).toBe(0);

      vi.useRealTimers();
    });

    it('returns correct minutes when late', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const checkIn = new Date('2025-01-15T08:30:00Z');
      const late = calculateLateMinutes(checkIn, '08:00', 15, 'UTC');
      expect(late).toBe(15); // 30 - 15 grace = 15 minutes late

      vi.useRealTimers();
    });
  });
});

// ============================================
// FORMATTING HELPERS TESTS
// ============================================

describe('Formatting Helpers', () => {
  describe('formatLocalDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const formatted = formatLocalDate(date, 'UTC');
      expect(formatted).toBe('2025-01-15');
    });

    it('respects timezone', () => {
      // 11 PM UTC = 7 AM next day in Manila (+8)
      const date = new Date('2025-01-15T23:00:00Z');
      const formatted = formatLocalDate(date, 'Asia/Manila');
      expect(formatted).toBe('2025-01-16');
    });
  });

  describe('formatISODate', () => {
    it('returns ISO string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const formatted = formatISODate(date, 'UTC');
      expect(formatted).toContain('2025-01-15');
    });
  });

  describe('parseLocalDate', () => {
    it('parses date string to Date', () => {
      const date = parseLocalDate('2025-01-15', 'UTC');
      expect(date).toBeInstanceOf(Date);
      const dt = DateTime.fromJSDate(date, { zone: 'UTC' });
      expect(dt.year).toBe(2025);
      expect(dt.month).toBe(1);
      expect(dt.day).toBe(15);
    });
  });

  describe('formatDisplayDate', () => {
    it('formats date for display', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const formatted = formatDisplayDate(date, 'UTC');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });
  });

  describe('formatDisplayDateTime', () => {
    it('formats date and time for display', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const formatted = formatDisplayDateTime(date, 'UTC');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });
  });

  describe('formatDisplayTime', () => {
    it('formats time only', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const formatted = formatDisplayTime(date, 'UTC');
      expect(formatted).toContain('2:30');
    });
  });

  describe('formatDate', () => {
    it('formats with custom format', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const formatted = formatDate(date, 'yyyy/MM/dd', 'UTC');
      expect(formatted).toBe('2025/01/15');
    });
  });
});

// ============================================
// STREAK HELPERS TESTS
// ============================================

describe('Streak Helpers', () => {
  describe('calculateStreakContinuation', () => {
    it('returns false when no last checkin', () => {
      expect(calculateStreakContinuation(null, 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(false);
    });

    it('returns true for same day checkin', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const lastCheckin = new Date('2025-01-15T08:00:00Z');
      expect(calculateStreakContinuation(lastCheckin, 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(true);

      vi.useRealTimers();
    });

    it('returns false when gap too large', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-20T12:00:00Z')); // Monday

      const lastCheckin = new Date('2025-01-13T08:00:00Z'); // Previous Monday (7 days ago)
      expect(calculateStreakContinuation(lastCheckin, 'MON,TUE,WED,THU,FRI', 'UTC', 3)).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('calculateActualStreak', () => {
    it('returns 0 when no stored streak', () => {
      expect(calculateActualStreak(0, new Date(), 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(0);
    });

    it('returns 0 when no last checkin', () => {
      expect(calculateActualStreak(5, null, 'MON,TUE,WED,THU,FRI', 'UTC')).toBe(0);
    });
  });
});

// ============================================
// TIME EXTRACTION HELPERS TESTS
// ============================================

describe('Time Extraction Helpers', () => {
  describe('getTimeInTimezone', () => {
    it('extracts hour and minute', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const time = getTimeInTimezone(date, 'UTC');
      expect(time.hour).toBe(14);
      expect(time.minute).toBe(30);
    });

    it('respects timezone', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const time = getTimeInTimezone(date, 'Asia/Manila'); // +8
      expect(time.hour).toBe(22);
      expect(time.minute).toBe(30);
    });
  });

  describe('getDayOfWeekInTimezone', () => {
    it('returns 0-6 (Sunday=0)', () => {
      const sunday = new Date('2025-01-19T12:00:00Z');
      expect(getDayOfWeekInTimezone(sunday, 'UTC')).toBe(0);

      const monday = new Date('2025-01-13T12:00:00Z');
      expect(getDayOfWeekInTimezone(monday, 'UTC')).toBe(1);

      const saturday = new Date('2025-01-18T12:00:00Z');
      expect(getDayOfWeekInTimezone(saturday, 'UTC')).toBe(6);
    });
  });

  describe('getDateStringInTimezone', () => {
    it('returns YYYY-MM-DD string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(getDateStringInTimezone(date, 'UTC')).toBe('2025-01-15');
    });
  });
});

// ============================================
// COMPARISON HELPERS TESTS
// ============================================

describe('Comparison Helpers', () => {
  describe('isSameDay', () => {
    it('returns true for same day', () => {
      const date1 = new Date('2025-01-15T08:00:00Z');
      const date2 = new Date('2025-01-15T20:00:00Z');
      expect(isSameDay(date1, date2, 'UTC')).toBe(true);
    });

    it('returns false for different days', () => {
      const date1 = new Date('2025-01-15T08:00:00Z');
      const date2 = new Date('2025-01-16T08:00:00Z');
      expect(isSameDay(date1, date2, 'UTC')).toBe(false);
    });

    it('handles timezone boundary correctly', () => {
      // 11 PM UTC Jan 15 = 7 AM Jan 16 in Manila
      const date1 = new Date('2025-01-15T23:00:00Z');
      const date2 = new Date('2025-01-16T01:00:00Z');

      // In UTC: different days
      expect(isSameDay(date1, date2, 'UTC')).toBe(false);

      // In Manila: same day (both Jan 16)
      expect(isSameDay(date1, date2, 'Asia/Manila')).toBe(true);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const today = new Date('2025-01-15T08:00:00Z');
      expect(isToday(today, 'UTC')).toBe(true);

      vi.useRealTimers();
    });

    it('returns false for yesterday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const yesterday = new Date('2025-01-14T12:00:00Z');
      expect(isToday(yesterday, 'UTC')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('isPast', () => {
    it('returns true for past date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const past = new Date('2025-01-14T12:00:00Z');
      expect(isPast(past, 'UTC')).toBe(true);

      vi.useRealTimers();
    });

    it('returns false for today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const today = new Date('2025-01-15T08:00:00Z');
      expect(isPast(today, 'UTC')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('isFuture', () => {
    it('returns true for future date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const future = new Date('2025-01-16T12:00:00Z');
      expect(isFuture(future, 'UTC')).toBe(true);

      vi.useRealTimers();
    });

    it('returns false for today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const today = new Date('2025-01-15T20:00:00Z');
      expect(isFuture(today, 'UTC')).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getDaysDifference', () => {
    it('calculates positive difference', () => {
      const date1 = new Date('2025-01-10T12:00:00Z');
      const date2 = new Date('2025-01-15T12:00:00Z');
      expect(getDaysDifference(date1, date2, 'UTC')).toBe(5);
    });

    it('calculates negative difference', () => {
      const date1 = new Date('2025-01-15T12:00:00Z');
      const date2 = new Date('2025-01-10T12:00:00Z');
      expect(getDaysDifference(date1, date2, 'UTC')).toBe(-5);
    });

    it('returns 0 for same day', () => {
      const date1 = new Date('2025-01-15T08:00:00Z');
      const date2 = new Date('2025-01-15T20:00:00Z');
      expect(getDaysDifference(date1, date2, 'UTC')).toBe(0);
    });
  });
});

// ============================================
// WORK DAY ADJUSTMENT HELPERS TESTS
// ============================================

describe('Work Day Adjustment Helpers', () => {
  describe('getNextWorkDay', () => {
    it('returns same day if already work day', () => {
      const monday = new Date('2025-01-13T12:00:00Z');
      const result = getNextWorkDay(monday, 'MON,TUE,WED,THU,FRI', 'UTC');
      const dt = DateTime.fromJSDate(result, { zone: 'UTC' });
      expect(dt.weekday).toBe(1); // Monday
    });

    it('skips to Monday from Saturday', () => {
      const saturday = new Date('2025-01-18T12:00:00Z');
      const result = getNextWorkDay(saturday, 'MON,TUE,WED,THU,FRI', 'UTC');
      const dt = DateTime.fromJSDate(result, { zone: 'UTC' });
      expect(dt.weekday).toBe(1); // Monday
      expect(dt.day).toBe(20);
    });
  });

  describe('adjustToWorkDay', () => {
    it('returns not adjusted for work day', () => {
      const monday = new Date('2025-01-13T12:00:00Z');
      const result = adjustToWorkDay(monday, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result.wasAdjusted).toBe(false);
      expect(result.originalDayName).toBe('MON');
    });

    it('adjusts from Saturday to Monday', () => {
      const saturday = new Date('2025-01-18T12:00:00Z');
      const result = adjustToWorkDay(saturday, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result.wasAdjusted).toBe(true);
      expect(result.originalDayName).toBe('SAT');
      expect(result.adjustedDayName).toBe('MON');
    });
  });
});

// ============================================
// LEAVE PERIOD HELPERS TESTS
// ============================================

describe('Leave Period Helpers', () => {
  describe('isDateInLeavePeriod', () => {
    it('returns true when date is within period', () => {
      const checkDate = new Date('2025-01-15T12:00:00Z');
      const start = new Date('2025-01-10T12:00:00Z');
      const end = new Date('2025-01-20T12:00:00Z');
      expect(isDateInLeavePeriod(checkDate, start, end, 'UTC')).toBe(true);
    });

    it('returns false when date is before period', () => {
      const checkDate = new Date('2025-01-05T12:00:00Z');
      const start = new Date('2025-01-10T12:00:00Z');
      const end = new Date('2025-01-20T12:00:00Z');
      expect(isDateInLeavePeriod(checkDate, start, end, 'UTC')).toBe(false);
    });

    it('returns false when date is after period', () => {
      const checkDate = new Date('2025-01-25T12:00:00Z');
      const start = new Date('2025-01-10T12:00:00Z');
      const end = new Date('2025-01-20T12:00:00Z');
      expect(isDateInLeavePeriod(checkDate, start, end, 'UTC')).toBe(false);
    });

    it('returns true for edge dates', () => {
      const start = new Date('2025-01-10T12:00:00Z');
      const end = new Date('2025-01-20T12:00:00Z');

      expect(isDateInLeavePeriod(start, start, end, 'UTC')).toBe(true);
      expect(isDateInLeavePeriod(end, start, end, 'UTC')).toBe(true);
    });
  });

  describe('doPeriodsOverlap', () => {
    it('returns true for overlapping periods', () => {
      const start1 = new Date('2025-01-10');
      const end1 = new Date('2025-01-20');
      const start2 = new Date('2025-01-15');
      const end2 = new Date('2025-01-25');
      expect(doPeriodsOverlap(start1, end1, start2, end2, 'UTC')).toBe(true);
    });

    it('returns false for non-overlapping periods', () => {
      const start1 = new Date('2025-01-10');
      const end1 = new Date('2025-01-15');
      const start2 = new Date('2025-01-20');
      const end2 = new Date('2025-01-25');
      expect(doPeriodsOverlap(start1, end1, start2, end2, 'UTC')).toBe(false);
    });
  });

  describe('getPeriodDays', () => {
    it('calculates days correctly', () => {
      const start = new Date('2025-01-10');
      const end = new Date('2025-01-15');
      expect(getPeriodDays(start, end, 'UTC')).toBe(6); // Inclusive
    });

    it('returns 1 for same day', () => {
      const date = new Date('2025-01-15');
      expect(getPeriodDays(date, date, 'UTC')).toBe(1);
    });
  });
});

// ============================================
// DURATION HELPERS TESTS
// ============================================

describe('Duration Helpers', () => {
  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(30)).toBe('30 minutes');
      expect(formatDuration(1)).toBe('1 minute');
    });

    it('formats hours only', () => {
      expect(formatDuration(60)).toBe('1 hour');
      expect(formatDuration(120)).toBe('2 hours');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1 hour 30 minutes');
      expect(formatDuration(125)).toBe('2 hours 5 minutes');
    });
  });

  describe('getRelativeTime', () => {
    it('returns relative time string', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const date = new Date('2025-01-15T10:00:00Z');
      const relative = getRelativeTime(date, 'UTC');
      expect(relative).toContain('hour');

      vi.useRealTimers();
    });
  });
});

// ============================================
// VALIDATION HELPERS TESTS
// ============================================

describe('Validation Helpers', () => {
  describe('isValidTimezone', () => {
    it('returns true for valid timezones', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('Asia/Manila')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
    });

    it('returns false for invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('NotATimezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidTimezone(null as any)).toBe(false);
      expect(isValidTimezone(undefined as any)).toBe(false);
    });
  });

  describe('isValidTimeFormat', () => {
    it('returns true for valid times', () => {
      expect(isValidTimeFormat('08:00')).toBe(true);
      expect(isValidTimeFormat('17:30')).toBe(true);
      expect(isValidTimeFormat('00:00')).toBe(true);
      expect(isValidTimeFormat('23:59')).toBe(true);
    });

    it('returns false for invalid times', () => {
      expect(isValidTimeFormat('25:00')).toBe(false);
      expect(isValidTimeFormat('12:60')).toBe(false);
      expect(isValidTimeFormat('8:00')).toBe(true); // Single digit hour OK
      expect(isValidTimeFormat('abc')).toBe(false);
      expect(isValidTimeFormat('')).toBe(false);
    });
  });

  describe('isValidDateFormat', () => {
    it('returns true for valid dates', () => {
      expect(isValidDateFormat('2025-01-15')).toBe(true);
      expect(isValidDateFormat('2025-12-31')).toBe(true);
    });

    it('returns false for invalid dates', () => {
      expect(isValidDateFormat('2025-13-01')).toBe(false); // Invalid month
      expect(isValidDateFormat('2025-01-32')).toBe(false); // Invalid day
      expect(isValidDateFormat('not-a-date')).toBe(false);
      expect(isValidDateFormat('')).toBe(false);
    });
  });
});
