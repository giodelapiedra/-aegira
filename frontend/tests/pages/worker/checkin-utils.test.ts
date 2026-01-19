/**
 * Check-in Utils Tests
 *
 * Tests for check-in page utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkCheckinAvailability, formatExceptionType } from '../../../src/pages/worker/checkin/utils';

// Mock date-utils module
vi.mock('../../../src/lib/date-utils', () => ({
  getNowInTimezone: vi.fn(),
}));

import { getNowInTimezone } from '../../../src/lib/date-utils';

const mockedGetNowInTimezone = vi.mocked(getNowInTimezone);

// ============================================
// FORMAT EXCEPTION TYPE TESTS
// ============================================

describe('formatExceptionType', () => {
  it('formats SICK_LEAVE correctly', () => {
    expect(formatExceptionType('SICK_LEAVE')).toBe('Sick Leave');
  });

  it('formats PERSONAL_LEAVE correctly', () => {
    expect(formatExceptionType('PERSONAL_LEAVE')).toBe('Personal Leave');
  });

  it('formats MEDICAL_APPOINTMENT correctly', () => {
    expect(formatExceptionType('MEDICAL_APPOINTMENT')).toBe('Medical Appointment');
  });

  it('formats FAMILY_EMERGENCY correctly', () => {
    expect(formatExceptionType('FAMILY_EMERGENCY')).toBe('Family Emergency');
  });

  it('formats OTHER correctly', () => {
    expect(formatExceptionType('OTHER')).toBe('Other');
  });

  it('formats single word correctly', () => {
    expect(formatExceptionType('VACATION')).toBe('Vacation');
  });

  it('formats multi-word types correctly', () => {
    expect(formatExceptionType('WORK_FROM_HOME')).toBe('Work From Home');
  });

  it('handles lowercase input', () => {
    expect(formatExceptionType('sick_leave')).toBe('Sick Leave');
  });

  it('handles mixed case input', () => {
    expect(formatExceptionType('Sick_Leave')).toBe('Sick Leave');
  });

  it('handles empty string', () => {
    expect(formatExceptionType('')).toBe('');
  });

  it('handles single character', () => {
    expect(formatExceptionType('A')).toBe('A');
  });
});

// ============================================
// CHECK CHECKIN AVAILABILITY TESTS
// ============================================

describe('checkCheckinAvailability', () => {
  const mockTeam = {
    workDays: 'MON,TUE,WED,THU,FRI',
    shiftStart: '09:00',
    shiftEnd: '17:00',
  };

  const timezone = 'Asia/Manila';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('work day checks', () => {
    it('returns NOT_WORK_DAY when today is Saturday', () => {
      // Saturday = dayOfWeek 6
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-18T10:00:00'),
        dayOfWeek: 6, // Saturday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('NOT_WORK_DAY');
      expect(result.message).toContain('SAT');
      expect(result.message).toContain('not a scheduled work day');
    });

    it('returns NOT_WORK_DAY when today is Sunday', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-19T10:00:00'),
        dayOfWeek: 0, // Sunday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('NOT_WORK_DAY');
      expect(result.message).toContain('SUN');
    });

    it('allows check-in on Monday (work day)', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T10:00:00'),
        dayOfWeek: 1, // Monday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('allows check-in on Friday (work day)', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-17T10:00:00'),
        dayOfWeek: 5, // Friday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(true);
    });
  });

  describe('time checks', () => {
    it('returns TOO_EARLY when before shift start', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T08:00:00'),
        dayOfWeek: 1, // Monday
        hour: 8,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('TOO_EARLY');
      expect(result.message).toContain('09:00');
      expect(result.shiftStart).toBe('09:00');
    });

    it('returns TOO_EARLY when 1 minute before shift', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T08:59:00'),
        dayOfWeek: 1,
        hour: 8,
        minute: 59,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('TOO_EARLY');
    });

    it('allows check-in exactly at shift start', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T09:00:00'),
        dayOfWeek: 1,
        hour: 9,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('allows check-in during shift hours', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T12:30:00'),
        dayOfWeek: 1,
        hour: 12,
        minute: 30,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('allows check-in exactly at shift end', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T17:00:00'),
        dayOfWeek: 1,
        hour: 17,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('returns TOO_LATE when after shift end', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T17:01:00'),
        dayOfWeek: 1,
        hour: 17,
        minute: 1,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('TOO_LATE');
      expect(result.message).toContain('17:00');
      expect(result.shiftEnd).toBe('17:00');
    });

    it('returns TOO_LATE late at night', () => {
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T23:00:00'),
        dayOfWeek: 1,
        hour: 23,
        minute: 0,
      });

      const result = checkCheckinAvailability(mockTeam, timezone);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('TOO_LATE');
    });
  });

  describe('custom schedules', () => {
    it('handles weekend-only work schedule', () => {
      const weekendTeam = {
        workDays: 'SAT,SUN',
        shiftStart: '10:00',
        shiftEnd: '18:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-18T12:00:00'),
        dayOfWeek: 6, // Saturday
        hour: 12,
        minute: 0,
      });

      const result = checkCheckinAvailability(weekendTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles early morning shift', () => {
      const earlyTeam = {
        workDays: 'MON,TUE,WED,THU,FRI',
        shiftStart: '06:00',
        shiftEnd: '14:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T06:00:00'),
        dayOfWeek: 1,
        hour: 6,
        minute: 0,
      });

      const result = checkCheckinAvailability(earlyTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles late night shift', () => {
      const nightTeam = {
        workDays: 'MON,TUE,WED,THU,FRI',
        shiftStart: '22:00',
        shiftEnd: '23:59',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T22:30:00'),
        dayOfWeek: 1,
        hour: 22,
        minute: 30,
      });

      const result = checkCheckinAvailability(nightTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles single work day', () => {
      const singleDayTeam = {
        workDays: 'WED',
        shiftStart: '09:00',
        shiftEnd: '17:00',
      };

      // On Wednesday
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-15T10:00:00'),
        dayOfWeek: 3, // Wednesday
        hour: 10,
        minute: 0,
      });

      expect(checkCheckinAvailability(singleDayTeam, timezone).available).toBe(true);

      // On Thursday
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-16T10:00:00'),
        dayOfWeek: 4, // Thursday
        hour: 10,
        minute: 0,
      });

      expect(checkCheckinAvailability(singleDayTeam, timezone).available).toBe(false);
    });

    it('handles work days with spaces in string', () => {
      const spacedTeam = {
        workDays: 'MON, TUE, WED, THU, FRI',
        shiftStart: '09:00',
        shiftEnd: '17:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T10:00:00'),
        dayOfWeek: 1, // Monday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(spacedTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles lowercase work days', () => {
      const lowerTeam = {
        workDays: 'mon,tue,wed,thu,fri',
        shiftStart: '09:00',
        shiftEnd: '17:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T10:00:00'),
        dayOfWeek: 1, // Monday
        hour: 10,
        minute: 0,
      });

      const result = checkCheckinAvailability(lowerTeam, timezone);

      expect(result.available).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles midnight shift start', () => {
      const midnightTeam = {
        workDays: 'MON,TUE,WED,THU,FRI',
        shiftStart: '00:00',
        shiftEnd: '08:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T00:00:00'),
        dayOfWeek: 1,
        hour: 0,
        minute: 0,
      });

      const result = checkCheckinAvailability(midnightTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles shift spanning multiple hours', () => {
      const longTeam = {
        workDays: 'MON,TUE,WED,THU,FRI',
        shiftStart: '08:00',
        shiftEnd: '20:00',
      };

      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-13T15:30:00'),
        dayOfWeek: 1,
        hour: 15,
        minute: 30,
      });

      const result = checkCheckinAvailability(longTeam, timezone);

      expect(result.available).toBe(true);
    });

    it('handles all 7 work days', () => {
      const everydayTeam = {
        workDays: 'SUN,MON,TUE,WED,THU,FRI,SAT',
        shiftStart: '09:00',
        shiftEnd: '17:00',
      };

      // Sunday should be valid
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-19T10:00:00'),
        dayOfWeek: 0,
        hour: 10,
        minute: 0,
      });

      expect(checkCheckinAvailability(everydayTeam, timezone).available).toBe(true);

      // Saturday should be valid
      mockedGetNowInTimezone.mockReturnValue({
        date: new Date('2025-01-18T10:00:00'),
        dayOfWeek: 6,
        hour: 10,
        minute: 0,
      });

      expect(checkCheckinAvailability(everydayTeam, timezone).available).toBe(true);
    });
  });
});

// ============================================
// REAL-WORLD SCENARIOS
// ============================================

describe('Check-in Utils - Real-world Scenarios', () => {
  const standardTeam = {
    workDays: 'MON,TUE,WED,THU,FRI',
    shiftStart: '09:00',
    shiftEnd: '17:00',
  };

  const timezone = 'Asia/Manila';

  it('worker arrives early (8:30 AM) on Monday', () => {
    mockedGetNowInTimezone.mockReturnValue({
      date: new Date('2025-01-13T08:30:00'),
      dayOfWeek: 1,
      hour: 8,
      minute: 30,
    });

    const result = checkCheckinAvailability(standardTeam, timezone);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('TOO_EARLY');
  });

  it('worker arrives on time (9:15 AM) on Tuesday', () => {
    mockedGetNowInTimezone.mockReturnValue({
      date: new Date('2025-01-14T09:15:00'),
      dayOfWeek: 2,
      hour: 9,
      minute: 15,
    });

    const result = checkCheckinAvailability(standardTeam, timezone);

    expect(result.available).toBe(true);
  });

  it('worker tries to check in on Saturday', () => {
    mockedGetNowInTimezone.mockReturnValue({
      date: new Date('2025-01-18T10:00:00'),
      dayOfWeek: 6,
      hour: 10,
      minute: 0,
    });

    const result = checkCheckinAvailability(standardTeam, timezone);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('NOT_WORK_DAY');
  });

  it('worker forgot to check in and tries at 6 PM', () => {
    mockedGetNowInTimezone.mockReturnValue({
      date: new Date('2025-01-13T18:00:00'),
      dayOfWeek: 1,
      hour: 18,
      minute: 0,
    });

    const result = checkCheckinAvailability(standardTeam, timezone);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('TOO_LATE');
  });

  it('format exception types for display in UI', () => {
    // All common exception types should format nicely
    const types = [
      { input: 'SICK_LEAVE', expected: 'Sick Leave' },
      { input: 'PERSONAL_LEAVE', expected: 'Personal Leave' },
      { input: 'MEDICAL_APPOINTMENT', expected: 'Medical Appointment' },
      { input: 'FAMILY_EMERGENCY', expected: 'Family Emergency' },
      { input: 'OTHER', expected: 'Other' },
    ];

    types.forEach(({ input, expected }) => {
      expect(formatExceptionType(input)).toBe(expected);
    });
  });
});
