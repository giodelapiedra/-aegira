/**
 * Unit Tests for daily-summary.ts
 *
 * Tests the aggregateSummaries pure function.
 */

import { describe, it, expect } from 'vitest';
import { aggregateSummaries } from '../../../src/utils/daily-summary.js';

// Type for test data
interface DailyTeamSummaryData {
  teamId: string;
  companyId: string;
  date: Date;
  isWorkDay: boolean;
  isHoliday: boolean;
  totalMembers: number;
  onLeaveCount: number;
  expectedToCheckIn: number;
  checkedInCount: number;
  notCheckedInCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  absentCount: number;
  excusedCount: number;
  avgReadinessScore: number | null;
  complianceRate: number | null;
}

// Helper to create test summary data
function createSummary(overrides: Partial<DailyTeamSummaryData> = {}): DailyTeamSummaryData {
  return {
    teamId: 'team-123',
    companyId: 'company-123',
    date: new Date('2025-01-15'),
    isWorkDay: true,
    isHoliday: false,
    totalMembers: 10,
    onLeaveCount: 0,
    expectedToCheckIn: 10,
    checkedInCount: 10,
    notCheckedInCount: 0,
    greenCount: 8,
    yellowCount: 2,
    redCount: 0,
    absentCount: 0,
    excusedCount: 0,
    avgReadinessScore: 85,
    complianceRate: 100,
    ...overrides,
  };
}

// ============================================
// aggregateSummaries TESTS
// ============================================

describe('aggregateSummaries', () => {
  describe('Basic functionality', () => {
    it('returns correct totals for single summary', () => {
      const summaries = [createSummary()];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(1);
      expect(result.totalExpected).toBe(10);
      expect(result.totalCheckedIn).toBe(10);
      expect(result.totalGreen).toBe(8);
      expect(result.totalYellow).toBe(2);
      expect(result.totalRed).toBe(0);
    });

    it('returns correct totals for multiple summaries', () => {
      const summaries = [
        createSummary({ date: new Date('2025-01-13'), greenCount: 7, yellowCount: 2, redCount: 1 }),
        createSummary({ date: new Date('2025-01-14'), greenCount: 8, yellowCount: 1, redCount: 1 }),
        createSummary({ date: new Date('2025-01-15'), greenCount: 9, yellowCount: 1, redCount: 0 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(3);
      expect(result.totalExpected).toBe(30); // 10 * 3
      expect(result.totalCheckedIn).toBe(30); // 10 * 3
      expect(result.totalGreen).toBe(24); // 7 + 8 + 9
      expect(result.totalYellow).toBe(4); // 2 + 1 + 1
      expect(result.totalRed).toBe(2); // 1 + 1 + 0
    });
  });

  describe('Non-work days filtering', () => {
    it('excludes non-work days from totals', () => {
      const summaries = [
        createSummary({ isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 10 }),
        createSummary({ isWorkDay: false, expectedToCheckIn: 0, checkedInCount: 0 }), // Weekend
        createSummary({ isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 8 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(2); // Only work days
      expect(result.totalExpected).toBe(20);
      expect(result.totalCheckedIn).toBe(18);
    });

    it('excludes holidays from totals', () => {
      const summaries = [
        createSummary({ isWorkDay: true, isHoliday: false }),
        createSummary({ isWorkDay: true, isHoliday: true }), // Holiday
        createSummary({ isWorkDay: true, isHoliday: false }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(2); // Excludes holiday
    });

    it('excludes day that is both work day and holiday', () => {
      const summaries = [
        createSummary({ isWorkDay: true, isHoliday: true }), // Work day but holiday
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(0);
    });
  });

  describe('Compliance rate calculation', () => {
    it('calculates compliance rate correctly', () => {
      const summaries = [
        createSummary({ expectedToCheckIn: 10, checkedInCount: 8 }), // 80%
        createSummary({ expectedToCheckIn: 10, checkedInCount: 10 }), // 100%
      ];
      const result = aggregateSummaries(summaries);

      // Compliance = totalCheckedIn / totalExpected * 100
      // = 18 / 20 * 100 = 90%
      expect(result.avgComplianceRate).toBe(90);
    });

    it('returns 100% compliance when all check in', () => {
      const summaries = [
        createSummary({ expectedToCheckIn: 10, checkedInCount: 10 }),
        createSummary({ expectedToCheckIn: 10, checkedInCount: 10 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.avgComplianceRate).toBe(100);
    });

    it('returns 0% compliance when none check in', () => {
      const summaries = [
        createSummary({ expectedToCheckIn: 10, checkedInCount: 0 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.avgComplianceRate).toBe(0);
    });

    it('returns null when no expected check-ins', () => {
      const summaries = [
        createSummary({ isWorkDay: false, expectedToCheckIn: 0, checkedInCount: 0 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.avgComplianceRate).toBe(null);
    });
  });

  describe('Average readiness calculation', () => {
    it('calculates average readiness from days with check-ins', () => {
      const summaries = [
        createSummary({ avgReadinessScore: 80 }),
        createSummary({ avgReadinessScore: 90 }),
      ];
      const result = aggregateSummaries(summaries);

      // Average of 80 and 90 = 85
      expect(result.avgReadinessScore).toBe(85);
    });

    it('excludes days with null readiness score', () => {
      const summaries = [
        createSummary({ avgReadinessScore: 80 }),
        createSummary({ avgReadinessScore: null }), // No check-ins
        createSummary({ avgReadinessScore: 90 }),
      ];
      const result = aggregateSummaries(summaries);

      // Average of 80 and 90 only = 85
      expect(result.avgReadinessScore).toBe(85);
    });

    it('returns null when no days have readiness scores', () => {
      const summaries = [
        createSummary({ avgReadinessScore: null }),
        createSummary({ avgReadinessScore: null }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.avgReadinessScore).toBe(null);
    });
  });

  describe('Empty data handling', () => {
    it('returns zeros for empty summaries array', () => {
      const result = aggregateSummaries([]);

      expect(result.totalDays).toBe(0);
      expect(result.totalExpected).toBe(0);
      expect(result.totalCheckedIn).toBe(0);
      expect(result.avgComplianceRate).toBe(null);
      expect(result.avgReadinessScore).toBe(null);
      expect(result.totalGreen).toBe(0);
      expect(result.totalYellow).toBe(0);
      expect(result.totalRed).toBe(0);
    });

    it('returns zeros when all days are non-work days', () => {
      const summaries = [
        createSummary({ isWorkDay: false }),
        createSummary({ isWorkDay: false }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(0);
      expect(result.totalExpected).toBe(0);
      expect(result.avgComplianceRate).toBe(null);
    });

    it('returns zeros when all days are holidays', () => {
      const summaries = [
        createSummary({ isWorkDay: true, isHoliday: true }),
        createSummary({ isWorkDay: true, isHoliday: true }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(0);
      expect(result.totalExpected).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('handles a typical week (Mon-Fri with weekend)', () => {
      const summaries = [
        createSummary({ date: new Date('2025-01-13'), isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 9, greenCount: 7, yellowCount: 2 }), // Mon
        createSummary({ date: new Date('2025-01-14'), isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 10, greenCount: 8, yellowCount: 2 }), // Tue
        createSummary({ date: new Date('2025-01-15'), isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 8, greenCount: 6, yellowCount: 1, redCount: 1 }), // Wed
        createSummary({ date: new Date('2025-01-16'), isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 10, greenCount: 9, yellowCount: 1 }), // Thu
        createSummary({ date: new Date('2025-01-17'), isWorkDay: true, expectedToCheckIn: 10, checkedInCount: 9, greenCount: 7, yellowCount: 2 }), // Fri
        createSummary({ date: new Date('2025-01-18'), isWorkDay: false, expectedToCheckIn: 0, checkedInCount: 0, greenCount: 0, yellowCount: 0 }), // Sat
        createSummary({ date: new Date('2025-01-19'), isWorkDay: false, expectedToCheckIn: 0, checkedInCount: 0, greenCount: 0, yellowCount: 0 }), // Sun
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(5); // Only work days
      expect(result.totalExpected).toBe(50);
      expect(result.totalCheckedIn).toBe(46); // 9+10+8+10+9
      expect(result.totalGreen).toBe(37); // 7+8+6+9+7
      expect(result.totalYellow).toBe(8); // 2+2+1+1+2
      expect(result.totalRed).toBe(1);
      expect(result.avgComplianceRate).toBe(92); // 46/50 * 100
    });

    it('handles week with holiday', () => {
      const summaries = [
        createSummary({ date: new Date('2025-01-13'), isWorkDay: true, isHoliday: false, expectedToCheckIn: 10, checkedInCount: 10 }),
        createSummary({ date: new Date('2025-01-14'), isWorkDay: true, isHoliday: false, expectedToCheckIn: 10, checkedInCount: 10 }),
        createSummary({ date: new Date('2025-01-15'), isWorkDay: true, isHoliday: true, expectedToCheckIn: 0, checkedInCount: 0 }), // Holiday
        createSummary({ date: new Date('2025-01-16'), isWorkDay: true, isHoliday: false, expectedToCheckIn: 10, checkedInCount: 10 }),
        createSummary({ date: new Date('2025-01-17'), isWorkDay: true, isHoliday: false, expectedToCheckIn: 10, checkedInCount: 10 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(4); // 5 days - 1 holiday
      expect(result.totalExpected).toBe(40);
      expect(result.totalCheckedIn).toBe(40);
      expect(result.avgComplianceRate).toBe(100);
    });

    it('handles team with leave and excused members', () => {
      const summaries = [
        createSummary({
          totalMembers: 10,
          onLeaveCount: 2,
          excusedCount: 1,
          expectedToCheckIn: 7, // 10 - 2 - 1
          checkedInCount: 7,
        }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalExpected).toBe(7);
      expect(result.totalCheckedIn).toBe(7);
      expect(result.avgComplianceRate).toBe(100);
    });

    it('handles varying readiness scores', () => {
      const summaries = [
        createSummary({ avgReadinessScore: 70 }),
        createSummary({ avgReadinessScore: 75 }),
        createSummary({ avgReadinessScore: 80 }),
        createSummary({ avgReadinessScore: 85 }),
        createSummary({ avgReadinessScore: 90 }),
      ];
      const result = aggregateSummaries(summaries);

      // Average = (70+75+80+85+90) / 5 = 80
      expect(result.avgReadinessScore).toBe(80);
    });

    it('handles low compliance scenario', () => {
      const summaries = [
        createSummary({ expectedToCheckIn: 10, checkedInCount: 5, avgReadinessScore: 60 }),
        createSummary({ expectedToCheckIn: 10, checkedInCount: 4, avgReadinessScore: 55 }),
        createSummary({ expectedToCheckIn: 10, checkedInCount: 6, avgReadinessScore: 50 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalExpected).toBe(30);
      expect(result.totalCheckedIn).toBe(15);
      expect(result.avgComplianceRate).toBe(50); // 15/30 * 100
      expect(result.avgReadinessScore).toBe(55); // (60+55+50) / 3
    });
  });

  describe('Edge cases', () => {
    it('handles single work day with no check-ins', () => {
      const summaries = [
        createSummary({
          expectedToCheckIn: 10,
          checkedInCount: 0,
          avgReadinessScore: null, // No check-ins = no score
        }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalDays).toBe(1);
      expect(result.totalExpected).toBe(10);
      expect(result.totalCheckedIn).toBe(0);
      expect(result.avgComplianceRate).toBe(0);
      expect(result.avgReadinessScore).toBe(null);
    });

    it('handles very large numbers', () => {
      const summaries = [
        createSummary({ expectedToCheckIn: 1000, checkedInCount: 950, avgReadinessScore: 75 }),
        createSummary({ expectedToCheckIn: 1000, checkedInCount: 900, avgReadinessScore: 80 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.totalExpected).toBe(2000);
      expect(result.totalCheckedIn).toBe(1850);
      expect(result.avgComplianceRate).toBe(92.5); // 1850/2000 * 100
    });

    it('handles decimal readiness scores', () => {
      const summaries = [
        createSummary({ avgReadinessScore: 75.5 }),
        createSummary({ avgReadinessScore: 80.5 }),
      ];
      const result = aggregateSummaries(summaries);

      expect(result.avgReadinessScore).toBe(78); // (75.5 + 80.5) / 2
    });
  });
});
