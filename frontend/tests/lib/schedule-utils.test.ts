/**
 * Schedule Utils Tests
 *
 * Tests for work schedule and check-in logic utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseWorkDays,
  isWorkDay,
  formatWorkDays,
  getWorkDaysDisplay,
  parseShiftTime,
  getShiftTimeAsDate,
  isWithinShiftHours,
  formatShiftHours,
  getCheckinInfo,
  getNextWorkDay,
  getTimeUntilCheckin,
  type Team,
} from '../../src/lib/schedule-utils';

// ============================================
// PARSE WORK DAYS TESTS
// ============================================

describe('parseWorkDays', () => {
  it('parses comma-separated work days', () => {
    const result = parseWorkDays('MON,TUE,WED,THU,FRI');
    expect(result).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  });

  it('handles empty string', () => {
    expect(parseWorkDays('')).toEqual([]);
  });

  it('handles single day', () => {
    expect(parseWorkDays('MON')).toEqual(['MON']);
  });

  it('trims whitespace', () => {
    const result = parseWorkDays('MON , TUE , WED');
    expect(result).toEqual(['MON', 'TUE', 'WED']);
  });

  it('handles full week', () => {
    const result = parseWorkDays('SUN,MON,TUE,WED,THU,FRI,SAT');
    expect(result.length).toBe(7);
  });
});

// ============================================
// IS WORK DAY TESTS
// ============================================

describe('isWorkDay', () => {
  it('returns true for work day', () => {
    // Monday Jan 13, 2025
    const monday = new Date(2025, 0, 13);
    expect(isWorkDay(monday, 'MON,TUE,WED,THU,FRI')).toBe(true);
  });

  it('returns false for non-work day', () => {
    // Saturday Jan 18, 2025
    const saturday = new Date(2025, 0, 18);
    expect(isWorkDay(saturday, 'MON,TUE,WED,THU,FRI')).toBe(false);
  });

  it('returns false for Sunday with standard schedule', () => {
    // Sunday Jan 12, 2025
    const sunday = new Date(2025, 0, 12);
    expect(isWorkDay(sunday, 'MON,TUE,WED,THU,FRI')).toBe(false);
  });

  it('returns true for Saturday with Mon-Sat schedule', () => {
    const saturday = new Date(2025, 0, 18);
    expect(isWorkDay(saturday, 'MON,TUE,WED,THU,FRI,SAT')).toBe(true);
  });

  it('handles empty work days', () => {
    const monday = new Date(2025, 0, 13);
    expect(isWorkDay(monday, '')).toBe(false);
  });
});

// ============================================
// FORMAT WORK DAYS TESTS
// ============================================

describe('formatWorkDays', () => {
  it('formats standard weekdays as "Monday - Friday"', () => {
    expect(formatWorkDays('MON,TUE,WED,THU,FRI', 'full')).toBe('Monday - Friday');
  });

  it('formats standard weekdays short as "M-F"', () => {
    expect(formatWorkDays('MON,TUE,WED,THU,FRI', 'short')).toBe('M-F');
  });

  it('formats non-standard days individually (full)', () => {
    expect(formatWorkDays('MON,WED,FRI', 'full')).toBe('Monday, Wednesday, Friday');
  });

  it('formats non-standard days individually (short)', () => {
    expect(formatWorkDays('MON,WED,FRI', 'short')).toBe('MWF');
  });

  it('handles empty work days', () => {
    expect(formatWorkDays('')).toBe('No work days set');
  });

  it('handles 6-day week', () => {
    const result = formatWorkDays('MON,TUE,WED,THU,FRI,SAT', 'full');
    expect(result).toContain('Monday');
    expect(result).toContain('Saturday');
  });

  it('defaults to full format', () => {
    expect(formatWorkDays('MON,TUE,WED,THU,FRI')).toBe('Monday - Friday');
  });
});

// ============================================
// GET WORK DAYS DISPLAY TESTS
// ============================================

describe('getWorkDaysDisplay', () => {
  it('returns all 7 days', () => {
    const result = getWorkDaysDisplay('MON,TUE,WED,THU,FRI');
    expect(result.length).toBe(7);
  });

  it('marks work days correctly', () => {
    const result = getWorkDaysDisplay('MON,TUE,WED,THU,FRI');

    // Monday should be work day
    const monday = result.find((d) => d.code === 'MON');
    expect(monday?.isWorkDay).toBe(true);

    // Saturday should not be work day
    const saturday = result.find((d) => d.code === 'SAT');
    expect(saturday?.isWorkDay).toBe(false);
  });

  it('includes short day names', () => {
    const result = getWorkDaysDisplay('MON,TUE,WED,THU,FRI');

    const monday = result.find((d) => d.code === 'MON');
    expect(monday?.short).toBe('M');

    const sunday = result.find((d) => d.code === 'SUN');
    expect(sunday?.short).toBe('S');
  });

  it('starts with Sunday', () => {
    const result = getWorkDaysDisplay('MON,TUE,WED,THU,FRI');
    expect(result[0].code).toBe('SUN');
  });

  it('ends with Saturday', () => {
    const result = getWorkDaysDisplay('MON,TUE,WED,THU,FRI');
    expect(result[6].code).toBe('SAT');
  });
});

// ============================================
// PARSE SHIFT TIME TESTS
// ============================================

describe('parseShiftTime', () => {
  it('parses standard time', () => {
    const result = parseShiftTime('08:00');
    expect(result).toEqual({ hours: 8, minutes: 0 });
  });

  it('parses afternoon time', () => {
    const result = parseShiftTime('17:30');
    expect(result).toEqual({ hours: 17, minutes: 30 });
  });

  it('handles midnight', () => {
    const result = parseShiftTime('00:00');
    expect(result).toEqual({ hours: 0, minutes: 0 });
  });

  it('handles empty string', () => {
    const result = parseShiftTime('');
    expect(result).toEqual({ hours: 0, minutes: 0 });
  });

  it('parses single digit hours', () => {
    const result = parseShiftTime('9:00');
    expect(result).toEqual({ hours: 9, minutes: 0 });
  });
});

// ============================================
// GET SHIFT TIME AS DATE TESTS
// ============================================

describe('getShiftTimeAsDate', () => {
  it('returns date with correct time', () => {
    const baseDate = new Date(2025, 0, 15);
    const result = getShiftTimeAsDate('08:30', baseDate);

    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });

  it('preserves date from input', () => {
    const baseDate = new Date(2025, 0, 15);
    const result = getShiftTimeAsDate('17:00', baseDate);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it('uses current date if not provided', () => {
    const result = getShiftTimeAsDate('08:00');
    const now = new Date();

    expect(result.getDate()).toBe(now.getDate());
  });
});

// ============================================
// IS WITHIN SHIFT HOURS TESTS
// ============================================

describe('isWithinShiftHours', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true during shift hours', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0)); // 10:00 AM
    expect(isWithinShiftHours('08:00', '17:00')).toBe(true);
  });

  it('returns false before shift (no grace)', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 7, 0)); // 7:00 AM
    expect(isWithinShiftHours('08:00', '17:00', 0)).toBe(false);
  });

  it('returns true within grace period before shift', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 7, 40)); // 7:40 AM
    expect(isWithinShiftHours('08:00', '17:00', 30)).toBe(true); // 30 min grace
  });

  it('returns false after shift ends', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 18, 0)); // 6:00 PM
    expect(isWithinShiftHours('08:00', '17:00')).toBe(false);
  });

  it('returns true at shift start', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 8, 0)); // 8:00 AM
    expect(isWithinShiftHours('08:00', '17:00')).toBe(true);
  });

  it('returns true at shift end', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 17, 0)); // 5:00 PM
    expect(isWithinShiftHours('08:00', '17:00')).toBe(true);
  });
});

// ============================================
// FORMAT SHIFT HOURS TESTS
// ============================================

describe('formatShiftHours', () => {
  it('formats standard shift', () => {
    const result = formatShiftHours('08:00', '17:00');
    expect(result).toBe('8:00 AM - 5:00 PM');
  });

  it('formats night shift', () => {
    const result = formatShiftHours('22:00', '06:00');
    expect(result).toBe('10:00 PM - 6:00 AM');
  });

  it('formats noon to midnight', () => {
    const result = formatShiftHours('12:00', '00:00');
    expect(result).toBe('12:00 PM - 12:00 AM');
  });
});

// ============================================
// GET NEXT WORK DAY TESTS
// ============================================

describe('getNextWorkDay', () => {
  it('returns next work day from Friday (should be Monday)', () => {
    const friday = new Date(2025, 0, 17); // Friday Jan 17
    const result = getNextWorkDay('MON,TUE,WED,THU,FRI', friday);

    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(20); // Jan 20
  });

  it('returns next day if it is a work day', () => {
    const monday = new Date(2025, 0, 13); // Monday Jan 13
    const result = getNextWorkDay('MON,TUE,WED,THU,FRI', monday);

    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getDate()).toBe(14);
  });

  it('skips weekend for standard schedule', () => {
    const saturday = new Date(2025, 0, 18); // Saturday
    const result = getNextWorkDay('MON,TUE,WED,THU,FRI', saturday);

    expect(result.getDay()).toBe(1); // Monday
  });

  it('handles empty work days', () => {
    const today = new Date(2025, 0, 15);
    const result = getNextWorkDay('', today);

    expect(result.getDate()).toBe(today.getDate() + 1);
  });
});

// ============================================
// GET TIME UNTIL CHECKIN TESTS
// ============================================

describe('getTimeUntilCheckin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Now" for past time', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0));
    const pastTime = new Date(2025, 0, 15, 8, 0);

    expect(getTimeUntilCheckin(pastTime)).toBe('Now');
  });

  it('returns minutes for short time', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 7, 30));
    const futureTime = new Date(2025, 0, 15, 8, 0);

    expect(getTimeUntilCheckin(futureTime)).toBe('30 minutes');
  });

  it('returns singular minute', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 7, 59));
    const futureTime = new Date(2025, 0, 15, 8, 0);

    expect(getTimeUntilCheckin(futureTime)).toBe('1 minute');
  });

  it('returns hours and minutes for longer time', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 6, 0));
    const futureTime = new Date(2025, 0, 15, 8, 30);

    expect(getTimeUntilCheckin(futureTime)).toBe('2h 30m');
  });

  it('returns days for very long time', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0));
    const futureTime = new Date(2025, 0, 18, 8, 0); // 3 days later

    expect(getTimeUntilCheckin(futureTime)).toContain('day');
  });

  it('returns singular day', () => {
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0));
    const futureTime = new Date(2025, 0, 16, 18, 0); // ~32 hours = 1 day

    expect(getTimeUntilCheckin(futureTime)).toBe('1 day');
  });
});

// ============================================
// GET CHECKIN INFO TESTS
// ============================================

describe('getCheckinInfo', () => {
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Test Team',
    workDays: 'MON,TUE,WED,THU,FRI',
    shiftStart: '08:00',
    shiftEnd: '17:00',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when no team', () => {
    it('returns cannot check in', () => {
      const result = getCheckinInfo(null, false);

      expect(result.canCheckin).toBe(false);
      expect(result.message).toContain('assigned to a team');
    });

    it('handles undefined team', () => {
      const result = getCheckinInfo(undefined, false);

      expect(result.canCheckin).toBe(false);
    });
  });

  describe('when already checked in', () => {
    it('returns cannot check in', () => {
      vi.setSystemTime(new Date(2025, 0, 13, 10, 0)); // Monday 10 AM
      const result = getCheckinInfo(mockTeam, true);

      expect(result.canCheckin).toBe(false);
      expect(result.message).toContain('already checked in');
    });
  });

  describe('on non-work day', () => {
    it('returns cannot check in on Saturday', () => {
      vi.setSystemTime(new Date(2025, 0, 18, 10, 0)); // Saturday 10 AM
      const result = getCheckinInfo(mockTeam, false);

      expect(result.canCheckin).toBe(false);
      expect(result.isWorkDay).toBe(false);
      expect(result.message).toContain('not a scheduled work day');
    });

    it('returns cannot check in on Sunday', () => {
      vi.setSystemTime(new Date(2025, 0, 19, 10, 0)); // Sunday 10 AM
      const result = getCheckinInfo(mockTeam, false);

      expect(result.canCheckin).toBe(false);
      expect(result.isWorkDay).toBe(false);
    });

    it('includes next check-in time', () => {
      vi.setSystemTime(new Date(2025, 0, 18, 10, 0)); // Saturday
      const result = getCheckinInfo(mockTeam, false);

      expect(result.nextCheckinTime).toBeDefined();
    });
  });

  describe('before shift hours', () => {
    it('returns cannot check in', () => {
      vi.setSystemTime(new Date(2025, 0, 13, 6, 0)); // Monday 6 AM
      const result = getCheckinInfo(mockTeam, false);

      expect(result.canCheckin).toBe(false);
      expect(result.message).toContain('opens at');
    });
  });

  describe('after shift hours', () => {
    it('returns cannot check in', () => {
      vi.setSystemTime(new Date(2025, 0, 13, 18, 0)); // Monday 6 PM
      const result = getCheckinInfo(mockTeam, false);

      expect(result.canCheckin).toBe(false);
      expect(result.message).toContain('closed');
    });
  });

  describe('during shift hours on work day', () => {
    it('returns can check in', () => {
      vi.setSystemTime(new Date(2025, 0, 13, 10, 0)); // Monday 10 AM
      const result = getCheckinInfo(mockTeam, false);

      expect(result.canCheckin).toBe(true);
      expect(result.isWithinShift).toBe(true);
      expect(result.isWorkDay).toBe(true);
      expect(result.message).toContain('Ready');
    });
  });
});
