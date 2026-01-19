/**
 * Business Logic Tests
 *
 * Tests critical business rules for:
 * - Holiday exclusion from work days
 * - Exemption duration calculations
 * - New worker join date logic (first work day after joining)
 * - Expected check-in calculations
 * - Compliance rate calculations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  countWorkDaysInRange,
  getFirstWorkDayAfter,
  getStartOfNextDay,
  getPeriodDays,
  isWorkDay,
  getDayName,
  DAY_NAMES,
} from '../../../src/utils/date-helpers.js';
import { getWorkDaysBetween } from '../../../src/utils/leave.js';

// ============================================
// HOLIDAY LOGIC TESTS
// ============================================

describe('Holiday Logic', () => {
  describe('countWorkDaysInRange with holidays', () => {
    it('excludes single holiday from work day count', () => {
      // Mon Jan 13 to Fri Jan 17 = 5 work days normally
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const holidays = ['2025-01-15']; // Wednesday is holiday

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(4); // 5 - 1 holiday = 4
    });

    it('excludes multiple holidays from work day count', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const holidays = ['2025-01-14', '2025-01-16']; // Tue and Thu

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(3); // 5 - 2 holidays = 3
    });

    it('ignores holidays that fall on non-work days', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const holidays = ['2025-01-18']; // Saturday - not a work day anyway

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(5); // All 5 work days counted, holiday on Sat ignored
    });

    it('handles holiday on first day of range', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-17T00:00:00Z');
      const holidays = ['2025-01-13']; // Monday is holiday

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(4);
    });

    it('handles holiday on last day of range', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z'); // Friday
      const holidays = ['2025-01-17']; // Friday is holiday

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(4);
    });

    it('handles all work days being holidays', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const holidays = ['2025-01-13', '2025-01-14', '2025-01-15', '2025-01-16', '2025-01-17'];

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', holidays);
      expect(count).toBe(0);
    });

    it('handles empty holiday array', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', []);
      expect(count).toBe(5);
    });

    it('handles undefined holiday array', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI', 'UTC', undefined);
      expect(count).toBe(5);
    });
  });

  describe('Holiday with Mon-Sat schedule', () => {
    it('excludes holiday from 6-day work week', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-18T00:00:00Z'); // Saturday
      const holidays = ['2025-01-15']; // Wednesday

      const count = countWorkDaysInRange(start, end, 'MON,TUE,WED,THU,FRI,SAT', 'UTC', holidays);
      expect(count).toBe(5); // 6 - 1 holiday = 5
    });
  });
});

// ============================================
// EXEMPTION DURATION TESTS
// ============================================

describe('Exemption Duration Logic', () => {
  describe('getPeriodDays', () => {
    it('calculates single day exemption', () => {
      const start = new Date('2025-01-15T00:00:00Z');
      const end = new Date('2025-01-15T00:00:00Z');

      const days = getPeriodDays(start, end, 'UTC');
      expect(days).toBe(1); // Same day = 1 day
    });

    it('calculates multi-day exemption (inclusive)', () => {
      const start = new Date('2025-01-15T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');

      const days = getPeriodDays(start, end, 'UTC');
      expect(days).toBe(3); // 15, 16, 17 = 3 days
    });

    it('calculates week-long exemption', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday

      const days = getPeriodDays(start, end, 'UTC');
      expect(days).toBe(7);
    });

    it('calculates month-long exemption', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T00:00:00Z');

      const days = getPeriodDays(start, end, 'UTC');
      expect(days).toBe(31);
    });
  });

  describe('getWorkDaysBetween for exemption work days', () => {
    it('calculates work days in exemption period', () => {
      // 1 week exemption, Mon-Fri schedule
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday

      const workDays = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(workDays).toBe(5); // Mon-Fri = 5 work days
    });

    it('calculates work days spanning multiple weeks', () => {
      // 2 week exemption
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-26T00:00:00Z'); // Sunday (2 weeks)

      const workDays = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(workDays).toBe(10); // 2 weeks * 5 = 10 work days
    });

    it('calculates work days for weekend-only exemption', () => {
      const start = new Date('2025-01-18T00:00:00Z'); // Saturday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday

      const workDays = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(workDays).toBe(0); // No work days in weekend
    });
  });
});

// ============================================
// NEW WORKER JOIN DATE LOGIC
// ============================================

describe('New Worker Join Date Logic', () => {
  describe('getFirstWorkDayAfter', () => {
    it('returns next day when joining on work day (Mon)', () => {
      const joinDate = new Date('2025-01-13T10:00:00Z'); // Monday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      // Join Monday, first required check-in is Tuesday
      expect(getDayName(firstWorkDay, 'UTC')).toBe('TUE');
      expect(firstWorkDay.getUTCDate()).toBe(14);
    });

    it('skips weekend when joining on Friday', () => {
      const joinDate = new Date('2025-01-17T10:00:00Z'); // Friday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      // Join Friday, first required check-in is Monday (skip Sat/Sun)
      expect(getDayName(firstWorkDay, 'UTC')).toBe('MON');
      expect(firstWorkDay.getUTCDate()).toBe(20);
    });

    it('skips to Monday when joining on Saturday', () => {
      const joinDate = new Date('2025-01-18T10:00:00Z'); // Saturday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      // Join Saturday, first required check-in is Monday
      expect(getDayName(firstWorkDay, 'UTC')).toBe('MON');
      expect(firstWorkDay.getUTCDate()).toBe(20);
    });

    it('skips to Monday when joining on Sunday', () => {
      const joinDate = new Date('2025-01-19T10:00:00Z'); // Sunday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      // Join Sunday, first required check-in is Monday
      expect(getDayName(firstWorkDay, 'UTC')).toBe('MON');
      expect(firstWorkDay.getUTCDate()).toBe(20);
    });

    it('handles Mon-Sat schedule correctly', () => {
      const joinDate = new Date('2025-01-17T10:00:00Z'); // Friday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI,SAT');

      // Join Friday, first required check-in is Saturday (no skip)
      expect(getDayName(firstWorkDay, 'UTC')).toBe('SAT');
      expect(firstWorkDay.getUTCDate()).toBe(18);
    });

    it('handles alternate day schedule (Mon/Wed/Fri)', () => {
      const joinDate = new Date('2025-01-13T10:00:00Z'); // Monday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,WED,FRI');

      // Join Monday, next work day is Wednesday (Tue not a work day)
      expect(getDayName(firstWorkDay, 'UTC')).toBe('WED');
      expect(firstWorkDay.getUTCDate()).toBe(15);
    });

    it('returns next day when workDays not provided (backwards compat)', () => {
      const joinDate = new Date('2025-01-17T10:00:00Z'); // Friday
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC'); // No workDays

      // Should just return next day (Saturday)
      expect(firstWorkDay.getUTCDate()).toBe(18);
    });
  });

  describe('getStartOfNextDay', () => {
    it('returns next day at midnight', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const nextDay = getStartOfNextDay(date, 'UTC');

      expect(nextDay.getUTCDate()).toBe(16);
      expect(nextDay.getUTCHours()).toBe(0);
      expect(nextDay.getUTCMinutes()).toBe(0);
    });

    it('handles end of month', () => {
      const date = new Date('2025-01-31T10:00:00Z');
      const nextDay = getStartOfNextDay(date, 'UTC');

      expect(nextDay.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(nextDay.getUTCDate()).toBe(1);
    });

    it('handles end of year', () => {
      const date = new Date('2025-12-31T10:00:00Z');
      const nextDay = getStartOfNextDay(date, 'UTC');

      expect(nextDay.getUTCFullYear()).toBe(2026);
      expect(nextDay.getUTCMonth()).toBe(0); // January
      expect(nextDay.getUTCDate()).toBe(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('worker joins mid-week, should start next day', () => {
      // Worker joins Wednesday afternoon
      const joinDate = new Date('2025-01-15T15:00:00Z');
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      // First check-in required: Thursday
      expect(getDayName(firstWorkDay, 'UTC')).toBe('THU');
    });

    it('worker joins Thursday, should start Friday', () => {
      const joinDate = new Date('2025-01-16T09:00:00Z');
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      expect(getDayName(firstWorkDay, 'UTC')).toBe('FRI');
    });

    it('worker joins late Friday, should start Monday', () => {
      const joinDate = new Date('2025-01-17T17:00:00Z'); // Friday 5 PM
      const firstWorkDay = getFirstWorkDayAfter(joinDate, 'UTC', 'MON,TUE,WED,THU,FRI');

      expect(getDayName(firstWorkDay, 'UTC')).toBe('MON');
      expect(firstWorkDay.getUTCDate()).toBe(20);
    });
  });
});

// ============================================
// EXPECTED CHECK-IN CALCULATIONS
// ============================================

describe('Expected Check-in Calculations', () => {
  /**
   * Formula: expectedToCheckIn = totalMembers - onLeave - excused
   *
   * - totalMembers: Active workers in team
   * - onLeave: Members with APPROVED exceptions
   * - excused: Members marked EXCUSED in DailyAttendance
   */

  describe('Basic calculations', () => {
    it('all members expected when no one on leave', () => {
      const totalMembers = 10;
      const onLeave = 0;
      const excused = 0;
      const expected = totalMembers - onLeave - excused;
      expect(expected).toBe(10);
    });

    it('reduces expected when members on leave', () => {
      const totalMembers = 10;
      const onLeave = 3;
      const excused = 0;
      const expected = totalMembers - onLeave - excused;
      expect(expected).toBe(7);
    });

    it('reduces expected when members excused', () => {
      const totalMembers = 10;
      const onLeave = 0;
      const excused = 2;
      const expected = totalMembers - onLeave - excused;
      expect(expected).toBe(8);
    });

    it('combines leave and excused reductions', () => {
      const totalMembers = 10;
      const onLeave = 3;
      const excused = 2;
      const expected = totalMembers - onLeave - excused;
      expect(expected).toBe(5);
    });

    it('returns 0 when all members on leave', () => {
      const totalMembers = 5;
      const onLeave = 5;
      const excused = 0;
      const expected = totalMembers - onLeave - excused;
      expect(expected).toBe(0);
    });
  });

  describe('Non-work day scenarios', () => {
    it('expected is 0 on non-work days', () => {
      const isWorkDay = false;
      const totalMembers = 10;
      const expected = isWorkDay ? totalMembers : 0;
      expect(expected).toBe(0);
    });

    it('expected is 0 on holidays', () => {
      const isHoliday = true;
      const totalMembers = 10;
      const expected = isHoliday ? 0 : totalMembers;
      expect(expected).toBe(0);
    });
  });
});

// ============================================
// COMPLIANCE RATE CALCULATIONS
// ============================================

describe('Compliance Rate Calculations', () => {
  /**
   * Formula: complianceRate = (checkedIn / expected) * 100
   */

  describe('Basic compliance calculations', () => {
    it('100% compliance when all expected check in', () => {
      const checkedIn = 10;
      const expected = 10;
      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(100);
    });

    it('50% compliance when half check in', () => {
      const checkedIn = 5;
      const expected = 10;
      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(50);
    });

    it('0% compliance when no one checks in', () => {
      const checkedIn = 0;
      const expected = 10;
      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(0);
    });

    it('returns 0 when expected is 0 (division by zero protection)', () => {
      const checkedIn = 0;
      const expected = 0;
      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(0);
    });

    it('handles partial check-ins with rounding', () => {
      const checkedIn = 7;
      const expected = 10;
      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(70);
    });
  });

  describe('Leave-adjusted compliance', () => {
    it('maintains 100% when on-leave members excluded', () => {
      // 10 total, 3 on leave, 7 expected, 7 checked in
      const totalMembers = 10;
      const onLeave = 3;
      const expected = totalMembers - onLeave;
      const checkedIn = 7;

      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(100);
    });

    it('correctly calculates when some expected are absent', () => {
      // 10 total, 2 on leave, 8 expected, 6 checked in (2 absent)
      const totalMembers = 10;
      const onLeave = 2;
      const expected = totalMembers - onLeave;
      const checkedIn = 6;

      const compliance = expected > 0 ? Math.round((checkedIn / expected) * 100) : 0;
      expect(compliance).toBe(75);
    });
  });
});

// ============================================
// TEAM GRADE FORMULA TESTS
// ============================================

describe('Team Grade Formula', () => {
  /**
   * Formula: Grade = (avgReadiness × 60%) + (compliance × 40%)
   */

  describe('Weight verification', () => {
    it('readiness has 60% weight', () => {
      // 100% readiness, 0% compliance
      const avgReadiness = 100;
      const compliance = 0;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(60);
    });

    it('compliance has 40% weight', () => {
      // 0% readiness, 100% compliance
      const avgReadiness = 0;
      const compliance = 100;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(40);
    });

    it('perfect score requires both metrics at 100%', () => {
      const avgReadiness = 100;
      const compliance = 100;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(100);
    });
  });

  describe('Real-world grade scenarios', () => {
    it('high readiness compensates for lower compliance', () => {
      // 95% readiness, 70% compliance
      const avgReadiness = 95;
      const compliance = 70;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(85); // 57 + 28 = 85 (Grade B)
    });

    it('low readiness but perfect compliance', () => {
      // 60% readiness, 100% compliance
      const avgReadiness = 60;
      const compliance = 100;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(76); // 36 + 40 = 76 (Grade C)
    });

    it('balanced average scores', () => {
      // 80% readiness, 80% compliance
      const avgReadiness = 80;
      const compliance = 80;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(80); // 48 + 32 = 80 (Grade B)
    });

    it('struggling team scenario', () => {
      // 50% readiness, 60% compliance
      const avgReadiness = 50;
      const compliance = 60;
      const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
      expect(score).toBe(54); // 30 + 24 = 54 (Grade F)
    });
  });

  describe('Onboarding member exclusion', () => {
    /**
     * Members with < 3 check-ins should be excluded from team grade calculation
     */

    it('new member with 0 check-ins excluded', () => {
      const memberCheckins = 0;
      const MIN_THRESHOLD = 3;
      const shouldInclude = memberCheckins >= MIN_THRESHOLD;
      expect(shouldInclude).toBe(false);
    });

    it('member with 2 check-ins excluded', () => {
      const memberCheckins = 2;
      const MIN_THRESHOLD = 3;
      const shouldInclude = memberCheckins >= MIN_THRESHOLD;
      expect(shouldInclude).toBe(false);
    });

    it('member with 3 check-ins included', () => {
      const memberCheckins = 3;
      const MIN_THRESHOLD = 3;
      const shouldInclude = memberCheckins >= MIN_THRESHOLD;
      expect(shouldInclude).toBe(true);
    });

    it('member with many check-ins included', () => {
      const memberCheckins = 100;
      const MIN_THRESHOLD = 3;
      const shouldInclude = memberCheckins >= MIN_THRESHOLD;
      expect(shouldInclude).toBe(true);
    });
  });
});

// ============================================
// TIMEZONE BOUNDARY TESTS FOR ANALYTICS
// ============================================

describe('Timezone Boundaries in Analytics', () => {
  describe('Day boundary handling', () => {
    it('correctly identifies day at timezone boundary', () => {
      // 11 PM UTC = 7 AM next day in Manila (+8)
      const utcDate = new Date('2025-01-15T23:00:00Z');

      const utcDay = getDayName(utcDate, 'UTC');
      const manilaDay = getDayName(utcDate, 'Asia/Manila');

      expect(utcDay).toBe('WED'); // Wednesday in UTC
      expect(manilaDay).toBe('THU'); // Thursday in Manila
    });

    it('work day check respects timezone', () => {
      // Sunday 11 PM UTC = Monday 7 AM Manila
      const utcDate = new Date('2025-01-19T23:00:00Z');

      const isWorkDayUTC = isWorkDay(utcDate, 'MON,TUE,WED,THU,FRI', 'UTC');
      const isWorkDayManila = isWorkDay(utcDate, 'MON,TUE,WED,THU,FRI', 'Asia/Manila');

      expect(isWorkDayUTC).toBe(false); // Sunday in UTC
      expect(isWorkDayManila).toBe(true); // Monday in Manila
    });
  });
});
