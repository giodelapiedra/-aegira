/**
 * Date Utils Tests
 *
 * Tests for centralized date utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatLocalDate,
  formatDisplayDate,
  formatDisplayDateTime,
  formatTime,
  formatDisplayTime,
  formatRelativeTime,
  formatShiftTime,
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getEndOfWeek,
  getDayCode,
  isSameDay,
  isToday,
  isPast,
  isFuture,
  addDays,
  subtractDays,
  getDaysDifference,
  getWeekCalendar,
} from '../../src/lib/date-utils';

// ============================================
// FORMAT LOCAL DATE TESTS
// ============================================

describe('formatLocalDate', () => {
  it('formats date to YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    expect(formatLocalDate(date)).toBe('2025-01-15');
  });

  it('pads single digit month', () => {
    const date = new Date(2025, 4, 5); // May 5, 2025
    expect(formatLocalDate(date)).toBe('2025-05-05');
  });

  it('pads single digit day', () => {
    const date = new Date(2025, 11, 9); // Dec 9, 2025
    expect(formatLocalDate(date)).toBe('2025-12-09');
  });
});

// ============================================
// FORMAT DISPLAY DATE TESTS
// ============================================

describe('formatDisplayDate', () => {
  it('formats date to display format', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    const result = formatDisplayDate(date);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('accepts string date input', () => {
    const result = formatDisplayDate('2025-01-15');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('accepts timezone parameter', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const result = formatDisplayDate(date, 'Asia/Manila');
    expect(result).toBeDefined();
  });
});

// ============================================
// FORMAT DISPLAY DATE TIME TESTS
// ============================================

describe('formatDisplayDateTime', () => {
  it('formats date and time', () => {
    const date = new Date(2025, 0, 15, 14, 30); // Jan 15, 2025 2:30 PM
    const result = formatDisplayDateTime(date);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('accepts string date input', () => {
    const result = formatDisplayDateTime('2025-01-15T14:30:00');
    expect(result).toContain('Jan');
  });
});

// ============================================
// FORMAT TIME TESTS
// ============================================

describe('formatTime', () => {
  it('formats time to 12-hour format', () => {
    const date = new Date(2025, 0, 15, 14, 30);
    const result = formatTime(date);
    expect(result).toContain('2:30');
  });

  it('accepts string date input', () => {
    const result = formatTime('2025-01-15T14:30:00');
    expect(result).toContain('30');
  });
});

describe('formatDisplayTime', () => {
  it('is alias for formatTime', () => {
    const date = new Date(2025, 0, 15, 14, 30);
    expect(formatDisplayTime(date)).toBe(formatTime(date));
  });
});

// ============================================
// FORMAT RELATIVE TIME TESTS
// ============================================

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for recent times', () => {
    const date = new Date('2025-01-15T11:59:30');
    expect(formatRelativeTime(date)).toBe('Just now');
  });

  it('returns minutes ago', () => {
    const date = new Date('2025-01-15T11:55:00');
    expect(formatRelativeTime(date)).toContain('minute');
  });

  it('returns hours ago', () => {
    const date = new Date('2025-01-15T10:00:00');
    expect(formatRelativeTime(date)).toContain('hour');
  });

  it('returns "Yesterday"', () => {
    const date = new Date('2025-01-14T12:00:00');
    expect(formatRelativeTime(date)).toBe('Yesterday');
  });

  it('returns days ago', () => {
    const date = new Date('2025-01-12T12:00:00');
    expect(formatRelativeTime(date)).toContain('days ago');
  });

  it('returns short format when requested', () => {
    const date = new Date('2025-01-15T10:00:00');
    expect(formatRelativeTime(date, { short: true })).toContain('h ago');
  });

  it('returns date for older than a week', () => {
    const date = new Date('2025-01-01T12:00:00');
    const result = formatRelativeTime(date);
    expect(result).toContain('Jan');
  });
});

// ============================================
// FORMAT SHIFT TIME TESTS
// ============================================

describe('formatShiftTime', () => {
  it('formats 24-hour time to 12-hour', () => {
    expect(formatShiftTime('08:00')).toBe('8:00 AM');
    expect(formatShiftTime('14:30')).toBe('2:30 PM');
  });

  it('handles noon', () => {
    expect(formatShiftTime('12:00')).toBe('12:00 PM');
  });

  it('handles midnight', () => {
    expect(formatShiftTime('00:00')).toBe('12:00 AM');
  });

  it('returns empty string for empty input', () => {
    expect(formatShiftTime('')).toBe('');
  });
});

// ============================================
// GET START/END OF DAY TESTS
// ============================================

describe('getStartOfDay', () => {
  it('returns midnight', () => {
    const date = new Date(2025, 0, 15, 14, 30, 45);
    const start = getStartOfDay(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('uses current date if not provided', () => {
    const start = getStartOfDay();
    expect(start.getHours()).toBe(0);
  });
});

describe('getEndOfDay', () => {
  it('returns 23:59:59.999', () => {
    const date = new Date(2025, 0, 15, 14, 30, 45);
    const end = getEndOfDay(date);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('uses current date if not provided', () => {
    const end = getEndOfDay();
    expect(end.getHours()).toBe(23);
  });
});

// ============================================
// GET START/END OF WEEK TESTS
// ============================================

describe('getStartOfWeek', () => {
  it('returns Sunday at midnight', () => {
    const date = new Date(2025, 0, 15); // Wednesday
    const start = getStartOfWeek(date);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getHours()).toBe(0);
  });
});

describe('getEndOfWeek', () => {
  it('returns Saturday at 23:59:59.999', () => {
    const date = new Date(2025, 0, 15); // Wednesday
    const end = getEndOfWeek(date);
    expect(end.getDay()).toBe(6); // Saturday
    expect(end.getHours()).toBe(23);
  });
});

// ============================================
// GET DAY CODE TESTS
// ============================================

describe('getDayCode', () => {
  it('returns correct day codes', () => {
    // Sunday = 0
    const sunday = new Date(2025, 0, 12);
    expect(getDayCode(sunday)).toBe('SUN');

    // Monday = 1
    const monday = new Date(2025, 0, 13);
    expect(getDayCode(monday)).toBe('MON');

    // Wednesday = 3
    const wednesday = new Date(2025, 0, 15);
    expect(getDayCode(wednesday)).toBe('WED');

    // Saturday = 6
    const saturday = new Date(2025, 0, 18);
    expect(getDayCode(saturday)).toBe('SAT');
  });
});

// ============================================
// IS SAME DAY TESTS
// ============================================

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const date1 = new Date(2025, 0, 15, 10, 0);
    const date2 = new Date(2025, 0, 15, 20, 0);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 0, 16);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different months', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 1, 15);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different years', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2024, 0, 15);
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

// ============================================
// IS TODAY TESTS
// ============================================

describe('isToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for today', () => {
    const today = new Date('2025-01-15T10:00:00');
    expect(isToday(today)).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date('2025-01-14T12:00:00');
    expect(isToday(yesterday)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date('2025-01-16T12:00:00');
    expect(isToday(tomorrow)).toBe(false);
  });
});

// ============================================
// IS PAST/FUTURE TESTS
// ============================================

describe('isPast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for past dates', () => {
    const past = new Date('2025-01-14T12:00:00');
    expect(isPast(past)).toBe(true);
  });

  it('returns false for future dates', () => {
    const future = new Date('2025-01-16T12:00:00');
    expect(isPast(future)).toBe(false);
  });
});

describe('isFuture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for future dates', () => {
    const future = new Date('2025-01-16T12:00:00');
    expect(isFuture(future)).toBe(true);
  });

  it('returns false for past dates', () => {
    const past = new Date('2025-01-14T12:00:00');
    expect(isFuture(past)).toBe(false);
  });
});

// ============================================
// ADD/SUBTRACT DAYS TESTS
// ============================================

describe('addDays', () => {
  it('adds days correctly', () => {
    const date = new Date(2025, 0, 15);
    const result = addDays(date, 5);
    expect(result.getDate()).toBe(20);
  });

  it('handles month boundary', () => {
    const date = new Date(2025, 0, 30);
    const result = addDays(date, 5);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });

  it('handles negative days', () => {
    const date = new Date(2025, 0, 15);
    const result = addDays(date, -5);
    expect(result.getDate()).toBe(10);
  });
});

describe('subtractDays', () => {
  it('subtracts days correctly', () => {
    const date = new Date(2025, 0, 15);
    const result = subtractDays(date, 5);
    expect(result.getDate()).toBe(10);
  });

  it('handles month boundary', () => {
    const date = new Date(2025, 1, 3);
    const result = subtractDays(date, 5);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(29);
  });
});

// ============================================
// GET DAYS DIFFERENCE TESTS
// ============================================

describe('getDaysDifference', () => {
  it('returns correct difference', () => {
    const date1 = new Date(2025, 0, 10);
    const date2 = new Date(2025, 0, 15);
    expect(getDaysDifference(date1, date2)).toBe(5);
  });

  it('returns negative for reverse order', () => {
    const date1 = new Date(2025, 0, 15);
    const date2 = new Date(2025, 0, 10);
    expect(getDaysDifference(date1, date2)).toBe(-5);
  });

  it('returns 0 for same day', () => {
    const date1 = new Date(2025, 0, 15, 10, 0);
    const date2 = new Date(2025, 0, 15, 20, 0);
    expect(getDaysDifference(date1, date2)).toBe(0);
  });
});

// ============================================
// GET WEEK CALENDAR TESTS
// ============================================

describe('getWeekCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 7 days by default', () => {
    const calendar = getWeekCalendar();
    expect(calendar.length).toBe(7);
  });

  it('last day is today', () => {
    const calendar = getWeekCalendar();
    const lastDay = calendar[calendar.length - 1];
    expect(lastDay.isToday).toBe(true);
  });

  it('all previous days are past', () => {
    const calendar = getWeekCalendar();
    for (let i = 0; i < calendar.length - 1; i++) {
      expect(calendar[i].isPast).toBe(true);
    }
  });

  it('includes day codes', () => {
    const calendar = getWeekCalendar();
    const validCodes = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    calendar.forEach((day) => {
      expect(validCodes).toContain(day.dayCode);
    });
  });
});
