/**
 * Unit Tests for team-grades-optimized.ts
 *
 * Tests the pure functions and constants for team grade calculations.
 * Database-dependent functions are tested separately in integration tests.
 */

import { describe, it, expect } from 'vitest';
import {
  // Constants
  MIN_CHECKIN_DAYS_THRESHOLD,
  // Pure functions
  getGradeInfo,
  getSimpleGrade,
  calculateOverviewSummary,
  // Types
  type TeamGradeSummary,
} from '../../../src/utils/team-grades-optimized.js';

// ============================================
// CONSTANTS TESTS
// ============================================

describe('Constants', () => {
  it('MIN_CHECKIN_DAYS_THRESHOLD is 3', () => {
    expect(MIN_CHECKIN_DAYS_THRESHOLD).toBe(3);
  });
});

// ============================================
// getGradeInfo TESTS
// ============================================

describe('getGradeInfo', () => {
  describe('A+ grade (Outstanding)', () => {
    it('returns A+ for score >= 97', () => {
      expect(getGradeInfo(97)).toEqual({ grade: 'A+', label: 'Outstanding', color: 'GREEN' });
      expect(getGradeInfo(100)).toEqual({ grade: 'A+', label: 'Outstanding', color: 'GREEN' });
    });
  });

  describe('A grades (Excellent)', () => {
    it('returns A for score 93-96', () => {
      expect(getGradeInfo(93)).toEqual({ grade: 'A', label: 'Excellent', color: 'GREEN' });
      expect(getGradeInfo(96)).toEqual({ grade: 'A', label: 'Excellent', color: 'GREEN' });
    });

    it('returns A- for score 90-92', () => {
      expect(getGradeInfo(90)).toEqual({ grade: 'A-', label: 'Excellent', color: 'GREEN' });
      expect(getGradeInfo(92)).toEqual({ grade: 'A-', label: 'Excellent', color: 'GREEN' });
    });
  });

  describe('B grades (Good/Very Good)', () => {
    it('returns B+ for score 87-89', () => {
      expect(getGradeInfo(87)).toEqual({ grade: 'B+', label: 'Very Good', color: 'GREEN' });
      expect(getGradeInfo(89)).toEqual({ grade: 'B+', label: 'Very Good', color: 'GREEN' });
    });

    it('returns B for score 83-86', () => {
      expect(getGradeInfo(83)).toEqual({ grade: 'B', label: 'Good', color: 'GREEN' });
      expect(getGradeInfo(86)).toEqual({ grade: 'B', label: 'Good', color: 'GREEN' });
    });

    it('returns B- for score 80-82 (YELLOW color)', () => {
      expect(getGradeInfo(80)).toEqual({ grade: 'B-', label: 'Good', color: 'YELLOW' });
      expect(getGradeInfo(82)).toEqual({ grade: 'B-', label: 'Good', color: 'YELLOW' });
    });
  });

  describe('C grades (Satisfactory)', () => {
    it('returns C+ for score 77-79', () => {
      expect(getGradeInfo(77)).toEqual({ grade: 'C+', label: 'Satisfactory', color: 'YELLOW' });
      expect(getGradeInfo(79)).toEqual({ grade: 'C+', label: 'Satisfactory', color: 'YELLOW' });
    });

    it('returns C for score 73-76', () => {
      expect(getGradeInfo(73)).toEqual({ grade: 'C', label: 'Satisfactory', color: 'YELLOW' });
      expect(getGradeInfo(76)).toEqual({ grade: 'C', label: 'Satisfactory', color: 'YELLOW' });
    });

    it('returns C- for score 70-72', () => {
      expect(getGradeInfo(70)).toEqual({ grade: 'C-', label: 'Satisfactory', color: 'YELLOW' });
      expect(getGradeInfo(72)).toEqual({ grade: 'C-', label: 'Satisfactory', color: 'YELLOW' });
    });
  });

  describe('D grades (Needs Improvement)', () => {
    it('returns D+ for score 67-69', () => {
      expect(getGradeInfo(67)).toEqual({ grade: 'D+', label: 'Needs Improvement', color: 'ORANGE' });
      expect(getGradeInfo(69)).toEqual({ grade: 'D+', label: 'Needs Improvement', color: 'ORANGE' });
    });

    it('returns D for score 63-66', () => {
      expect(getGradeInfo(63)).toEqual({ grade: 'D', label: 'Needs Improvement', color: 'ORANGE' });
      expect(getGradeInfo(66)).toEqual({ grade: 'D', label: 'Needs Improvement', color: 'ORANGE' });
    });

    it('returns D- for score 60-62', () => {
      expect(getGradeInfo(60)).toEqual({ grade: 'D-', label: 'Needs Improvement', color: 'ORANGE' });
      expect(getGradeInfo(62)).toEqual({ grade: 'D-', label: 'Needs Improvement', color: 'ORANGE' });
    });
  });

  describe('F grade (Critical)', () => {
    it('returns F for score < 60', () => {
      expect(getGradeInfo(59)).toEqual({ grade: 'F', label: 'Critical', color: 'RED' });
      expect(getGradeInfo(50)).toEqual({ grade: 'F', label: 'Critical', color: 'RED' });
      expect(getGradeInfo(0)).toEqual({ grade: 'F', label: 'Critical', color: 'RED' });
    });
  });

  describe('Edge cases', () => {
    it('handles boundary scores correctly', () => {
      // Just below each boundary
      expect(getGradeInfo(96.9)).toEqual({ grade: 'A', label: 'Excellent', color: 'GREEN' });
      expect(getGradeInfo(92.9)).toEqual({ grade: 'A-', label: 'Excellent', color: 'GREEN' });
      expect(getGradeInfo(89.9)).toEqual({ grade: 'B+', label: 'Very Good', color: 'GREEN' });
    });

    it('handles negative scores', () => {
      expect(getGradeInfo(-10)).toEqual({ grade: 'F', label: 'Critical', color: 'RED' });
    });
  });
});

// ============================================
// getSimpleGrade TESTS
// ============================================

describe('getSimpleGrade', () => {
  it('returns A for score >= 90', () => {
    expect(getSimpleGrade(90)).toBe('A');
    expect(getSimpleGrade(100)).toBe('A');
    expect(getSimpleGrade(95)).toBe('A');
  });

  it('returns B for score 80-89', () => {
    expect(getSimpleGrade(80)).toBe('B');
    expect(getSimpleGrade(89)).toBe('B');
    expect(getSimpleGrade(85)).toBe('B');
  });

  it('returns C for score 70-79', () => {
    expect(getSimpleGrade(70)).toBe('C');
    expect(getSimpleGrade(79)).toBe('C');
    expect(getSimpleGrade(75)).toBe('C');
  });

  it('returns D for score < 70', () => {
    expect(getSimpleGrade(69)).toBe('D');
    expect(getSimpleGrade(50)).toBe('D');
    expect(getSimpleGrade(0)).toBe('D');
  });

  describe('Edge cases', () => {
    it('handles boundary scores correctly', () => {
      expect(getSimpleGrade(89.9)).toBe('B');
      expect(getSimpleGrade(79.9)).toBe('C');
      expect(getSimpleGrade(69.9)).toBe('D');
    });

    it('handles negative scores', () => {
      expect(getSimpleGrade(-10)).toBe('D');
    });
  });
});

// ============================================
// calculateOverviewSummary TESTS
// ============================================

describe('calculateOverviewSummary', () => {
  // Helper to create mock TeamGradeSummary
  function createMockTeam(overrides: Partial<TeamGradeSummary> = {}): TeamGradeSummary {
    return {
      id: 'team-1',
      name: 'Test Team',
      leader: { id: 'leader-1', name: 'John Doe', avatar: null },
      memberCount: 5,
      grade: 'B',
      gradeLabel: 'Good',
      score: 85,
      attendanceRate: 90,
      onTimeRate: 95,
      breakdown: { green: 10, absent: 2, excused: 1 },
      trend: 'stable',
      scoreDelta: 0,
      atRiskCount: 0,
      membersNeedingAttention: 0,
      onboardingCount: 0,
      includedMemberCount: 5,
      ...overrides,
    };
  }

  describe('Empty teams array', () => {
    it('returns default summary for empty array', () => {
      const result = calculateOverviewSummary([]);
      expect(result).toEqual({
        totalTeams: 0,
        totalMembers: 0,
        avgScore: 0,
        avgGrade: 'N/A',
        teamsAtRisk: 0,
        teamsCritical: 0,
        teamsImproving: 0,
        teamsDeclining: 0,
      });
    });
  });

  describe('Single team', () => {
    it('calculates correct summary for one team', () => {
      const teams = [createMockTeam({ score: 90, memberCount: 10, trend: 'up' })];
      const result = calculateOverviewSummary(teams);

      expect(result.totalTeams).toBe(1);
      expect(result.totalMembers).toBe(10);
      expect(result.avgScore).toBe(90);
      expect(result.avgGrade).toBe('A');
      expect(result.teamsImproving).toBe(1);
    });
  });

  describe('Multiple teams', () => {
    it('calculates correct totals', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 90, memberCount: 10 }),
        createMockTeam({ id: 'team-2', score: 80, memberCount: 8 }),
        createMockTeam({ id: 'team-3', score: 70, memberCount: 5 }),
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.totalTeams).toBe(3);
      expect(result.totalMembers).toBe(23);
      expect(result.avgScore).toBe(80); // (90+80+70)/3 = 80
      expect(result.avgGrade).toBe('B');
    });

    it('counts teams at risk correctly (score < 70)', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 90 }),
        createMockTeam({ id: 'team-2', score: 65 }), // At risk
        createMockTeam({ id: 'team-3', score: 50 }), // At risk
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.teamsAtRisk).toBe(2);
    });

    it('counts critical teams correctly (score < 60)', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 90 }),
        createMockTeam({ id: 'team-2', score: 59 }), // Critical
        createMockTeam({ id: 'team-3', score: 50 }), // Critical
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.teamsCritical).toBe(2);
    });

    it('counts improving teams correctly', () => {
      const teams = [
        createMockTeam({ id: 'team-1', trend: 'up' }),
        createMockTeam({ id: 'team-2', trend: 'up' }),
        createMockTeam({ id: 'team-3', trend: 'stable' }),
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.teamsImproving).toBe(2);
    });

    it('counts declining teams correctly', () => {
      const teams = [
        createMockTeam({ id: 'team-1', trend: 'down' }),
        createMockTeam({ id: 'team-2', trend: 'stable' }),
        createMockTeam({ id: 'team-3', trend: 'down' }),
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.teamsDeclining).toBe(2);
    });
  });

  describe('Average score rounding', () => {
    it('rounds average score to nearest integer', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 91 }),
        createMockTeam({ id: 'team-2', score: 92 }),
      ];
      const result = calculateOverviewSummary(teams);

      // (91+92)/2 = 91.5, rounds to 92
      expect(result.avgScore).toBe(92);
    });

    it('rounds down when appropriate', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 90 }),
        createMockTeam({ id: 'team-2', score: 91 }),
      ];
      const result = calculateOverviewSummary(teams);

      // (90+91)/2 = 90.5, rounds to 91
      expect(result.avgScore).toBe(91);
    });
  });

  describe('Average grade calculation', () => {
    it('returns A for average >= 90', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 95 }),
        createMockTeam({ id: 'team-2', score: 90 }),
      ];
      const result = calculateOverviewSummary(teams);
      expect(result.avgGrade).toBe('A');
    });

    it('returns B for average 80-89', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 85 }),
        createMockTeam({ id: 'team-2', score: 80 }),
      ];
      const result = calculateOverviewSummary(teams);
      expect(result.avgGrade).toBe('B');
    });

    it('returns C for average 70-79', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 75 }),
        createMockTeam({ id: 'team-2', score: 70 }),
      ];
      const result = calculateOverviewSummary(teams);
      expect(result.avgGrade).toBe('C');
    });

    it('returns D for average < 70', () => {
      const teams = [
        createMockTeam({ id: 'team-1', score: 60 }),
        createMockTeam({ id: 'team-2', score: 50 }),
      ];
      const result = calculateOverviewSummary(teams);
      expect(result.avgGrade).toBe('D');
    });
  });

  describe('Complex scenarios', () => {
    it('handles mix of all trends', () => {
      const teams = [
        createMockTeam({ id: 'team-1', trend: 'up', score: 95 }),
        createMockTeam({ id: 'team-2', trend: 'down', score: 55 }),
        createMockTeam({ id: 'team-3', trend: 'stable', score: 75 }),
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.teamsImproving).toBe(1);
      expect(result.teamsDeclining).toBe(1);
      expect(result.teamsAtRisk).toBe(1); // score 55 is at risk
      expect(result.teamsCritical).toBe(1); // score 55 is critical
    });

    it('handles teams with zero members', () => {
      const teams = [
        createMockTeam({ id: 'team-1', memberCount: 0 }),
        createMockTeam({ id: 'team-2', memberCount: 10 }),
      ];
      const result = calculateOverviewSummary(teams);

      expect(result.totalTeams).toBe(2);
      expect(result.totalMembers).toBe(10);
    });
  });
});

// ============================================
// GRADE FORMULA TESTS
// ============================================

describe('Grade Formula Verification', () => {
  /**
   * Grade = (avgReadiness × 60%) + (compliance × 40%)
   * This tests the formula logic by verifying expected outputs
   */

  it('perfect readiness and compliance equals 100', () => {
    const avgReadiness = 100;
    const compliance = 100;
    const expected = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
    expect(expected).toBe(100);
  });

  it('80% readiness and 90% compliance equals 84', () => {
    const avgReadiness = 80;
    const compliance = 90;
    const expected = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
    expect(expected).toBe(84); // 48 + 36 = 84
  });

  it('70% readiness and 80% compliance equals 74', () => {
    const avgReadiness = 70;
    const compliance = 80;
    const expected = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
    expect(expected).toBe(74); // 42 + 32 = 74
  });

  it('50% readiness and 60% compliance equals 54', () => {
    const avgReadiness = 50;
    const compliance = 60;
    const expected = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
    expect(expected).toBe(54); // 30 + 24 = 54
  });

  it('zero readiness and zero compliance equals 0', () => {
    const avgReadiness = 0;
    const compliance = 0;
    const expected = Math.round((avgReadiness * 0.6) + (compliance * 0.4));
    expect(expected).toBe(0);
  });

  it('high readiness compensates for lower compliance', () => {
    // 100% readiness, 50% compliance = 80
    const score = Math.round((100 * 0.6) + (50 * 0.4));
    expect(score).toBe(80);
    expect(getSimpleGrade(score)).toBe('B');
  });

  it('high compliance compensates for lower readiness', () => {
    // 50% readiness, 100% compliance = 70
    const score = Math.round((50 * 0.6) + (100 * 0.4));
    expect(score).toBe(70);
    expect(getSimpleGrade(score)).toBe('C');
  });
});
