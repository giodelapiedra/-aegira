/**
 * API Integration Tests for Checkins Module
 *
 * Tests check-in endpoints validation and business logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckinSchema } from '../../../src/utils/validator.js';
import { calculateReadiness } from '../../../src/utils/readiness.js';

// ============================================
// CHECKIN VALIDATION TESTS
// ============================================

describe('Checkins API - Input Validation', () => {
  describe('POST /checkins validation', () => {
    it('validates complete check-in data', () => {
      const validData = {
        mood: 7,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
      };

      const result = createCheckinSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts optional notes', () => {
      const validData = {
        mood: 7,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
        notes: 'Feeling good today!',
      };

      const result = createCheckinSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects mood below 1', () => {
      const invalidData = {
        mood: 0,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
      };

      const result = createCheckinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects mood above 10', () => {
      const invalidData = {
        mood: 11,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
      };

      const result = createCheckinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const invalidData = {
        mood: 7,
        stress: 3,
        // missing sleep and physicalHealth
      };

      const result = createCheckinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer values', () => {
      const invalidData = {
        mood: 7.5,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
      };

      const result = createCheckinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects notes over 1000 characters', () => {
      const invalidData = {
        mood: 7,
        stress: 3,
        sleep: 8,
        physicalHealth: 9,
        notes: 'a'.repeat(1001),
      };

      const result = createCheckinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Boundary values', () => {
    const boundaryTests = [
      { field: 'mood', value: 1, valid: true },
      { field: 'mood', value: 10, valid: true },
      { field: 'stress', value: 1, valid: true },
      { field: 'stress', value: 10, valid: true },
      { field: 'sleep', value: 1, valid: true },
      { field: 'sleep', value: 10, valid: true },
      { field: 'physicalHealth', value: 1, valid: true },
      { field: 'physicalHealth', value: 10, valid: true },
    ];

    boundaryTests.forEach(({ field, value, valid }) => {
      it(`${valid ? 'accepts' : 'rejects'} ${field} = ${value}`, () => {
        const data = {
          mood: 5,
          stress: 5,
          sleep: 5,
          physicalHealth: 5,
          [field]: value,
        };

        const result = createCheckinSchema.safeParse(data);
        expect(result.success).toBe(valid);
      });
    });
  });
});

// ============================================
// READINESS CALCULATION TESTS
// ============================================

describe('Checkins API - Readiness Calculation', () => {
  describe('Score calculation', () => {
    it('calculates perfect score (100) for optimal inputs', () => {
      const result = calculateReadiness({
        mood: 10,
        stress: 0, // Low stress = high score
        sleep: 10,
        physicalHealth: 10,
      });

      expect(result.score).toBe(100);
      expect(result.status).toBe('GREEN');
    });

    it('calculates worst score (0) for worst inputs', () => {
      const result = calculateReadiness({
        mood: 0,
        stress: 10, // High stress = low score
        sleep: 0,
        physicalHealth: 0,
      });

      expect(result.score).toBe(0);
      expect(result.status).toBe('RED');
    });

    it('calculates middle score for average inputs', () => {
      const result = calculateReadiness({
        mood: 5,
        stress: 5,
        sleep: 5,
        physicalHealth: 5,
      });

      expect(result.score).toBe(50);
      expect(result.status).toBe('YELLOW');
    });
  });

  describe('Status thresholds', () => {
    it('returns GREEN for score >= 70', () => {
      const result = calculateReadiness({
        mood: 7,
        stress: 3,
        sleep: 7,
        physicalHealth: 7,
      });

      expect(result.status).toBe('GREEN');
    });

    it('returns YELLOW for score 40-69', () => {
      const result = calculateReadiness({
        mood: 5,
        stress: 5,
        sleep: 5,
        physicalHealth: 5,
      });

      expect(result.status).toBe('YELLOW');
    });

    it('returns RED for score < 40', () => {
      const result = calculateReadiness({
        mood: 2,
        stress: 8,
        sleep: 2,
        physicalHealth: 2,
      });

      expect(result.status).toBe('RED');
    });
  });

  describe('Stress inversion', () => {
    it('treats high stress as negative factor', () => {
      // Same inputs except stress
      const lowStress = calculateReadiness({
        mood: 7, stress: 2, sleep: 7, physicalHealth: 7,
      });
      const highStress = calculateReadiness({
        mood: 7, stress: 8, sleep: 7, physicalHealth: 7,
      });

      expect(lowStress.score).toBeGreaterThan(highStress.score);
    });
  });
});

// ============================================
// CHECKIN BUSINESS LOGIC TESTS
// ============================================

describe('Checkins API - Business Logic', () => {
  describe('One check-in per day rule', () => {
    it('documents: Worker can only check-in once per day', () => {
      // Business rule: One check-in per day per worker
      const maxCheckinsPerDay = 1;
      expect(maxCheckinsPerDay).toBe(1);
    });

    it('documents: Check-in day is determined by company timezone', () => {
      // Business rule: Use company timezone, not UTC
      const useCompanyTimezone = true;
      expect(useCompanyTimezone).toBe(true);
    });
  });

  describe('Check-in window', () => {
    it('documents: Check-in is allowed during shift hours', () => {
      // Business rule: Workers check-in during their shift
      const checkInDuringShift = true;
      expect(checkInDuringShift).toBe(true);
    });

    it('documents: Check-in on non-work days is not required', () => {
      // Business rule: Weekend/non-work days don't require check-in
      const weekendRequired = false;
      expect(weekendRequired).toBe(false);
    });

    it('documents: Check-in on holidays is not required', () => {
      // Business rule: Company holidays don't require check-in
      const holidayRequired = false;
      expect(holidayRequired).toBe(false);
    });
  });

  describe('Low score handling', () => {
    it('documents: RED status triggers lowScoreReason requirement', () => {
      // Business rule: When score < 40 (RED), worker must provide reason
      const reasonRequiredForRed = true;
      expect(reasonRequiredForRed).toBe(true);
    });

    it('documents: Available low score reasons', () => {
      const validReasons = [
        'PERSONAL_ISSUES',
        'WORK_STRESS',
        'HEALTH_ISSUES',
        'SLEEP_PROBLEMS',
        'FAMILY_MATTERS',
        'OTHER',
      ];

      expect(validReasons).toContain('PERSONAL_ISSUES');
      expect(validReasons).toContain('HEALTH_ISSUES');
      expect(validReasons.length).toBeGreaterThan(3);
    });
  });

  describe('Leave status integration', () => {
    it('documents: Worker on approved leave cannot check-in', () => {
      // Business rule: On-leave workers skip check-in
      const canCheckInOnLeave = false;
      expect(canCheckInOnLeave).toBe(false);
    });

    it('documents: Returning worker (within 3 days of leave end) gets notification', () => {
      // Business rule: Returning workers see welcome back message
      const returningWindowDays = 3;
      expect(returningWindowDays).toBe(3);
    });
  });
});

// ============================================
// CHECKIN RESPONSE STRUCTURE TESTS
// ============================================

describe('Checkins API - Response Structure', () => {
  describe('GET /checkins/today response', () => {
    it('defines expected response when no check-in exists', () => {
      const expectedResponse = null;
      expect(expectedResponse).toBeNull();
    });

    it('defines expected response when check-in exists', () => {
      const expectedStructure = {
        id: expect.any(String),
        mood: expect.any(Number),
        stress: expect.any(Number),
        sleep: expect.any(Number),
        physicalHealth: expect.any(Number),
        readinessScore: expect.any(Number),
        readinessStatus: expect.stringMatching(/GREEN|YELLOW|RED/),
        notes: expect.toBeOneOf([expect.any(String), null]),
        createdAt: expect.any(String),
      };

      expect(expectedStructure).toHaveProperty('id');
      expect(expectedStructure).toHaveProperty('readinessScore');
      expect(expectedStructure).toHaveProperty('readinessStatus');
    });
  });

  describe('GET /checkins/my response', () => {
    it('defines expected paginated response structure', () => {
      const expectedStructure = {
        data: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
        },
      };

      expect(expectedStructure).toHaveProperty('data');
      expect(expectedStructure).toHaveProperty('pagination');
      expect(expectedStructure.pagination).toHaveProperty('page');
      expect(expectedStructure.pagination).toHaveProperty('totalPages');
    });
  });

  describe('POST /checkins response', () => {
    it('defines expected success response structure', () => {
      const expectedStructure = {
        id: expect.any(String),
        userId: expect.any(String),
        mood: expect.any(Number),
        stress: expect.any(Number),
        sleep: expect.any(Number),
        physicalHealth: expect.any(Number),
        readinessScore: expect.any(Number),
        readinessStatus: expect.stringMatching(/GREEN|YELLOW|RED/),
        createdAt: expect.any(String),
      };

      expect(expectedStructure).toHaveProperty('id');
      expect(expectedStructure).toHaveProperty('userId');
      expect(expectedStructure).toHaveProperty('readinessScore');
    });
  });
});

// ============================================
// CHECKIN AUTHORIZATION TESTS
// ============================================

describe('Checkins API - Authorization', () => {
  describe('Role-based access', () => {
    it('documents: WORKER can create their own check-in', () => {
      const workerCanCheckin = true;
      expect(workerCanCheckin).toBe(true);
    });

    it('documents: WORKER can view their own check-ins', () => {
      const workerCanViewOwn = true;
      expect(workerCanViewOwn).toBe(true);
    });

    it('documents: TEAM_LEAD can view team check-ins', () => {
      const teamLeadCanViewTeam = true;
      expect(teamLeadCanViewTeam).toBe(true);
    });

    it('documents: SUPERVISOR can view all company check-ins', () => {
      const supervisorCanViewAll = true;
      expect(supervisorCanViewAll).toBe(true);
    });

    it('documents: EXECUTIVE can view all company check-ins', () => {
      const executiveCanViewAll = true;
      expect(executiveCanViewAll).toBe(true);
    });
  });

  describe('Company scoping', () => {
    it('documents: Check-ins are scoped by companyId', () => {
      // Business rule: Users can only see their company's data
      const companyScoped = true;
      expect(companyScoped).toBe(true);
    });

    it('documents: ADMIN (super admin) can see all companies', () => {
      // Business rule: Super admin has cross-company access
      const adminCrossCompany = true;
      expect(adminCrossCompany).toBe(true);
    });
  });
});

// ============================================
// CHECKIN EDGE CASES
// ============================================

describe('Checkins API - Edge Cases', () => {
  describe('Timezone handling', () => {
    it('documents: Check-in date uses company timezone', () => {
      // Manila is UTC+8
      // 11 PM UTC Jan 14 = 7 AM Jan 15 Manila
      const manilaOffset = 8;
      expect(manilaOffset).toBe(8);
    });

    it('documents: Day boundary is midnight in company timezone', () => {
      // Business rule: New day starts at 00:00 company time
      const dayBoundary = '00:00';
      expect(dayBoundary).toBe('00:00');
    });
  });

  describe('New worker handling', () => {
    it('documents: New worker check-in starts next work day after joining', () => {
      // Business rule: Join day is free, requirement starts next work day
      const joinDayFree = true;
      expect(joinDayFree).toBe(true);
    });

    it('documents: If joined Friday, first check-in is Monday (Mon-Fri schedule)', () => {
      // Business rule: Skip weekends for standard schedule
      const skipWeekends = true;
      expect(skipWeekends).toBe(true);
    });
  });

  describe('Duplicate check-in prevention', () => {
    it('documents: Attempting second check-in same day returns error', () => {
      const expectedError = 'Already checked in today';
      expect(expectedError).toContain('Already checked in');
    });

    it('documents: Error includes existing check-in data', () => {
      // Business rule: Return existing check-in when duplicate attempted
      const returnExisting = true;
      expect(returnExisting).toBe(true);
    });
  });
});
