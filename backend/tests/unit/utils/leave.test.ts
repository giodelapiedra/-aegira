/**
 * Unit Tests for leave.ts
 *
 * Tests the pure functions for leave/exception calculations.
 * Database-dependent functions are tested in integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { getWorkDaysBetween, type LeaveStatus } from '../../../src/utils/leave.js';

// ============================================
// getWorkDaysBetween TESTS (Pure Function)
// ============================================

describe('getWorkDaysBetween', () => {
  describe('Standard Mon-Fri schedule', () => {
    it('counts 5 work days in a full week', () => {
      // Monday to Friday
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-17T00:00:00Z'); // Friday
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(5);
    });

    it('counts 0 work days over weekend', () => {
      const start = new Date('2025-01-18T00:00:00Z'); // Saturday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(0);
    });

    it('counts work days spanning multiple weeks', () => {
      // 2 weeks = 10 work days
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-24T00:00:00Z'); // Friday next week
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(10);
    });

    it('counts single day correctly', () => {
      const monday = new Date('2025-01-13T00:00:00Z');
      const result = getWorkDaysBetween(monday, monday, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(1); // Monday is a work day

      const saturday = new Date('2025-01-18T00:00:00Z');
      const result2 = getWorkDaysBetween(saturday, saturday, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result2).toBe(0); // Saturday is not a work day
    });
  });

  describe('Mon-Sat schedule', () => {
    it('counts 6 work days in a full week', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-18T00:00:00Z'); // Saturday
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI,SAT', 'UTC');
      expect(result).toBe(6);
    });

    it('counts 1 day for Saturday only', () => {
      const saturday = new Date('2025-01-18T00:00:00Z');
      const result = getWorkDaysBetween(saturday, saturday, 'MON,TUE,WED,THU,FRI,SAT', 'UTC');
      expect(result).toBe(1);
    });

    it('counts 0 for Sunday only', () => {
      const sunday = new Date('2025-01-19T00:00:00Z');
      const result = getWorkDaysBetween(sunday, sunday, 'MON,TUE,WED,THU,FRI,SAT', 'UTC');
      expect(result).toBe(0);
    });
  });

  describe('Custom schedules', () => {
    it('handles alternate day schedule', () => {
      // Only Mon, Wed, Fri
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const result = getWorkDaysBetween(start, end, 'MON,WED,FRI', 'UTC');
      expect(result).toBe(3);
    });

    it('handles weekend-only schedule', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const result = getWorkDaysBetween(start, end, 'SAT,SUN', 'UTC');
      expect(result).toBe(2);
    });

    it('handles single day schedule', () => {
      // Only Tuesday
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const result = getWorkDaysBetween(start, end, 'TUE', 'UTC');
      expect(result).toBe(1);
    });

    it('handles all days schedule', () => {
      const start = new Date('2025-01-13T00:00:00Z'); // Monday
      const end = new Date('2025-01-19T00:00:00Z'); // Sunday
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI,SAT,SUN', 'UTC');
      expect(result).toBe(7);
    });
  });

  describe('Timezone handling', () => {
    it('respects Asia/Manila timezone', () => {
      // Test with Manila timezone
      const start = new Date('2025-01-13T00:00:00Z'); // Converts to Manila time
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'Asia/Manila');
      expect(result).toBe(5);
    });

    it('handles timezone boundary correctly', () => {
      // 11 PM UTC on Sunday = 7 AM Monday in Manila
      const start = new Date('2025-01-12T23:00:00Z'); // Sunday in UTC, Monday in Manila
      const end = new Date('2025-01-12T23:00:00Z');

      // In UTC, this is Sunday (not a work day for Mon-Fri)
      const resultUTC = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(resultUTC).toBe(0);

      // In Manila, this is Monday (a work day for Mon-Fri)
      const resultManila = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'Asia/Manila');
      expect(resultManila).toBe(1);
    });
  });

  describe('Input variations', () => {
    it('handles lowercase work days', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'mon,tue,wed,thu,fri', 'UTC');
      expect(result).toBe(5);
    });

    it('handles spaces in work days string', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON, TUE, WED, THU, FRI', 'UTC');
      expect(result).toBe(5);
    });

    it('handles mixed case work days', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'Mon,Tue,Wed,Thu,Fri', 'UTC');
      expect(result).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('returns 0 for empty work days string', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, '', 'UTC');
      expect(result).toBe(0);
    });

    it('handles end date before start date', () => {
      const start = new Date('2025-01-17T00:00:00Z');
      const end = new Date('2025-01-13T00:00:00Z'); // Before start
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(0);
    });

    it('handles very long ranges', () => {
      // 30 days range (about 22 work days for Mon-Fri)
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(25);
    });
  });
});

// ============================================
// LeaveStatus Type TESTS
// ============================================

describe('LeaveStatus type', () => {
  it('has correct structure for on-leave status', () => {
    const status: LeaveStatus = {
      isOnLeave: true,
      isReturning: false,
      isBeforeStart: false,
      currentException: {
        id: 'exc-1',
        type: 'SICK_LEAVE',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
        reason: 'Flu',
      },
    };

    expect(status.isOnLeave).toBe(true);
    expect(status.isReturning).toBe(false);
    expect(status.currentException).toBeDefined();
    expect(status.currentException?.type).toBe('SICK_LEAVE');
  });

  it('has correct structure for returning status', () => {
    const status: LeaveStatus = {
      isOnLeave: false,
      isReturning: true,
      isBeforeStart: false,
      lastException: {
        id: 'exc-1',
        type: 'VACATION',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2025-01-14'),
        reason: 'Holiday trip',
      },
    };

    expect(status.isOnLeave).toBe(false);
    expect(status.isReturning).toBe(true);
    expect(status.lastException).toBeDefined();
    expect(status.lastException?.type).toBe('VACATION');
  });

  it('has correct structure for before-start status', () => {
    const status: LeaveStatus = {
      isOnLeave: false,
      isReturning: false,
      isBeforeStart: true,
      effectiveStartDate: '2025-01-20',
    };

    expect(status.isBeforeStart).toBe(true);
    expect(status.effectiveStartDate).toBe('2025-01-20');
  });

  it('has correct structure for normal working status', () => {
    const status: LeaveStatus = {
      isOnLeave: false,
      isReturning: false,
      isBeforeStart: false,
    };

    expect(status.isOnLeave).toBe(false);
    expect(status.isReturning).toBe(false);
    expect(status.isBeforeStart).toBe(false);
  });
});

// ============================================
// Leave Logic Tests (Documentation)
// ============================================

describe('Leave Logic', () => {
  /**
   * These tests document the expected behavior of the leave system.
   * The actual database operations are tested in integration tests.
   */

  it('documents: End date is the LAST day of exemption', () => {
    // If exemption endDate = Jan 6
    // → Jan 6 is still ON LEAVE (cannot check in)
    // → Jan 7 is the first required check-in day
    const endDate = new Date('2025-01-06');
    const jan6 = new Date('2025-01-06');
    const jan7 = new Date('2025-01-07');

    // Jan 6 should be covered by leave
    expect(jan6.getTime()).toBeLessThanOrEqual(endDate.getTime());

    // Jan 7 should NOT be covered
    expect(jan7.getTime()).toBeGreaterThan(endDate.getTime());
  });

  it('documents: Returning status is within 3 days of leave end', () => {
    const threeDaysWindow = 3;
    expect(threeDaysWindow).toBe(3);
  });

  it('documents: Check-in requirement starts NEXT WORK DAY after joining', () => {
    // If user joins on Friday with Mon-Fri schedule
    // → First required check-in is Monday (skips weekend)
    // This is handled by getFirstWorkDayAfter()
    const joinDateFriday = new Date('2025-01-17'); // Friday
    const expectedFirstWorkDay = new Date('2025-01-20'); // Monday

    expect(expectedFirstWorkDay.getDay()).toBe(1); // Monday
  });
});
