/**
 * Unit Tests for attendance.ts
 *
 * Tests the pure functions for attendance calculation.
 * Database-dependent functions are tested in integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateAttendanceStatus,
  getPerformanceGrade,
  getDateOnly,
  ATTENDANCE_SCORES,
  type AttendanceStatus,
} from '../../../src/utils/attendance.js';

// ============================================
// CONSTANTS TESTS
// ============================================

describe('ATTENDANCE_SCORES', () => {
  it('has correct GREEN score', () => {
    expect(ATTENDANCE_SCORES.GREEN).toBe(100);
  });

  it('has correct ABSENT score', () => {
    expect(ATTENDANCE_SCORES.ABSENT).toBe(0);
  });

  it('has null for EXCUSED (not counted)', () => {
    expect(ATTENDANCE_SCORES.EXCUSED).toBe(null);
  });
});

// ============================================
// calculateAttendanceStatus TESTS
// ============================================

describe('calculateAttendanceStatus', () => {
  describe('Basic functionality', () => {
    it('always returns GREEN status when checking in', () => {
      // Any check-in within shift window is GREEN
      const checkIn = new Date('2025-01-15T08:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'UTC');

      expect(result.status).toBe('GREEN');
      expect(result.score).toBe(100);
      expect(result.isCounted).toBe(true);
    });

    it('returns GREEN even for late check-in within shift', () => {
      // Check-in 2 hours after shift start is still GREEN
      const checkIn = new Date('2025-01-15T10:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'UTC');

      expect(result.status).toBe('GREEN');
      expect(result.score).toBe(100);
      expect(result.isCounted).toBe(true);
    });

    it('returns GREEN for check-in right at shift start', () => {
      const checkIn = new Date('2025-01-15T08:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'UTC');

      expect(result.status).toBe('GREEN');
    });

    it('returns GREEN for check-in right before shift end', () => {
      const checkIn = new Date('2025-01-15T16:59:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'UTC');

      expect(result.status).toBe('GREEN');
    });
  });

  describe('Timezone handling', () => {
    it('uses provided timezone', () => {
      // Check-in at 8 AM Manila time (which is midnight UTC)
      const checkIn = new Date('2025-01-15T00:00:00Z'); // 8 AM in Manila (UTC+8)
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'Asia/Manila');

      expect(result.status).toBe('GREEN');
    });

    it('uses default timezone when not provided', () => {
      const checkIn = new Date('2025-01-15T08:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00');

      expect(result.status).toBe('GREEN');
    });
  });

  describe('Different shift times', () => {
    it('handles morning shift (6 AM - 2 PM)', () => {
      const checkIn = new Date('2025-01-15T06:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '06:00', '14:00', 'UTC');

      expect(result.status).toBe('GREEN');
    });

    it('handles afternoon shift (2 PM - 10 PM)', () => {
      const checkIn = new Date('2025-01-15T14:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '14:00', '22:00', 'UTC');

      expect(result.status).toBe('GREEN');
    });

    it('handles night shift (10 PM - 6 AM)', () => {
      const checkIn = new Date('2025-01-15T22:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '22:00', '06:00', 'UTC');

      expect(result.status).toBe('GREEN');
    });
  });

  describe('Result structure', () => {
    it('returns correct structure', () => {
      const checkIn = new Date('2025-01-15T08:00:00Z');
      const result = calculateAttendanceStatus(checkIn, '08:00', '17:00', 'UTC');

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('isCounted');
      expect(typeof result.status).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(typeof result.isCounted).toBe('boolean');
    });
  });
});

// ============================================
// getPerformanceGrade TESTS
// ============================================

describe('getPerformanceGrade', () => {
  describe('Grade A (Excellent)', () => {
    it('returns A for score >= 90', () => {
      expect(getPerformanceGrade(90)).toEqual({ grade: 'A', label: 'Excellent' });
      expect(getPerformanceGrade(95)).toEqual({ grade: 'A', label: 'Excellent' });
      expect(getPerformanceGrade(100)).toEqual({ grade: 'A', label: 'Excellent' });
    });
  });

  describe('Grade B (Good)', () => {
    it('returns B for score 80-89', () => {
      expect(getPerformanceGrade(80)).toEqual({ grade: 'B', label: 'Good' });
      expect(getPerformanceGrade(85)).toEqual({ grade: 'B', label: 'Good' });
      expect(getPerformanceGrade(89)).toEqual({ grade: 'B', label: 'Good' });
    });

    it('returns B not A for score 89.9', () => {
      expect(getPerformanceGrade(89.9)).toEqual({ grade: 'B', label: 'Good' });
    });
  });

  describe('Grade C (Fair)', () => {
    it('returns C for score 70-79', () => {
      expect(getPerformanceGrade(70)).toEqual({ grade: 'C', label: 'Fair' });
      expect(getPerformanceGrade(75)).toEqual({ grade: 'C', label: 'Fair' });
      expect(getPerformanceGrade(79)).toEqual({ grade: 'C', label: 'Fair' });
    });
  });

  describe('Grade D (Poor)', () => {
    it('returns D for score < 70', () => {
      expect(getPerformanceGrade(69)).toEqual({ grade: 'D', label: 'Poor' });
      expect(getPerformanceGrade(50)).toEqual({ grade: 'D', label: 'Poor' });
      expect(getPerformanceGrade(0)).toEqual({ grade: 'D', label: 'Poor' });
    });

    it('returns D for negative scores', () => {
      expect(getPerformanceGrade(-10)).toEqual({ grade: 'D', label: 'Poor' });
    });
  });

  describe('Boundary values', () => {
    it('exactly 90 is A', () => {
      expect(getPerformanceGrade(90).grade).toBe('A');
    });

    it('exactly 80 is B', () => {
      expect(getPerformanceGrade(80).grade).toBe('B');
    });

    it('exactly 70 is C', () => {
      expect(getPerformanceGrade(70).grade).toBe('C');
    });

    it('69 is D', () => {
      expect(getPerformanceGrade(69).grade).toBe('D');
    });
  });
});

// ============================================
// getDateOnly TESTS
// ============================================

describe('getDateOnly', () => {
  it('strips time from date', () => {
    const dateWithTime = new Date('2025-01-15T14:30:45.123Z');
    const dateOnly = getDateOnly(dateWithTime);

    // Check that time is stripped (start of day in default timezone)
    expect(dateOnly.getUTCHours()).toBeLessThanOrEqual(16); // Manila is +8, so midnight Manila = 16:00 UTC prev day
    expect(dateOnly.getUTCMinutes()).toBe(0);
    expect(dateOnly.getUTCSeconds()).toBe(0);
    expect(dateOnly.getUTCMilliseconds()).toBe(0);
  });

  it('returns a Date object', () => {
    const date = new Date('2025-01-15T08:00:00Z');
    const result = getDateOnly(date);

    expect(result).toBeInstanceOf(Date);
  });

  it('handles midnight dates', () => {
    const midnight = new Date('2025-01-15T00:00:00Z');
    const result = getDateOnly(midnight);

    expect(result).toBeInstanceOf(Date);
  });
});

// ============================================
// AttendanceStatus Type TESTS
// ============================================

describe('AttendanceStatus type', () => {
  it('GREEN is valid status', () => {
    const status: AttendanceStatus = 'GREEN';
    expect(status).toBe('GREEN');
  });

  it('ABSENT is valid status', () => {
    const status: AttendanceStatus = 'ABSENT';
    expect(status).toBe('ABSENT');
  });

  it('EXCUSED is valid status', () => {
    const status: AttendanceStatus = 'EXCUSED';
    expect(status).toBe('EXCUSED');
  });
});

// ============================================
// SCORE CALCULATIONS TESTS
// ============================================

describe('Score calculations', () => {
  describe('Average calculation scenarios', () => {
    it('perfect attendance = 100', () => {
      // 10 GREEN days
      const totalScore = 10 * ATTENDANCE_SCORES.GREEN;
      const countedDays = 10;
      const avg = totalScore / countedDays;
      expect(avg).toBe(100);
    });

    it('50% attendance = 50', () => {
      // 5 GREEN + 5 ABSENT
      const totalScore = (5 * ATTENDANCE_SCORES.GREEN) + (5 * ATTENDANCE_SCORES.ABSENT);
      const countedDays = 10;
      const avg = totalScore / countedDays;
      expect(avg).toBe(50);
    });

    it('all absent = 0', () => {
      const totalScore = 10 * ATTENDANCE_SCORES.ABSENT;
      const countedDays = 10;
      const avg = totalScore / countedDays;
      expect(avg).toBe(0);
    });

    it('excused days are not counted', () => {
      // 3 GREEN + 2 ABSENT + 5 EXCUSED
      // Only 5 days counted (3 GREEN + 2 ABSENT)
      const totalScore = (3 * ATTENDANCE_SCORES.GREEN) + (2 * ATTENDANCE_SCORES.ABSENT);
      const countedDays = 5;
      const avg = totalScore / countedDays;
      expect(avg).toBe(60); // 300/5 = 60
    });
  });

  describe('Grade from score scenarios', () => {
    it('100% attendance gets A', () => {
      const score = 100;
      expect(getPerformanceGrade(score).grade).toBe('A');
    });

    it('85% attendance gets B', () => {
      const score = 85;
      expect(getPerformanceGrade(score).grade).toBe('B');
    });

    it('70% attendance gets C', () => {
      const score = 70;
      expect(getPerformanceGrade(score).grade).toBe('C');
    });

    it('50% attendance gets D', () => {
      const score = 50;
      expect(getPerformanceGrade(score).grade).toBe('D');
    });
  });
});
