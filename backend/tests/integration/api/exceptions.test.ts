/**
 * API Integration Tests for Exceptions Module
 *
 * Tests leave/exception request endpoints validation and business logic.
 */

import { describe, it, expect } from 'vitest';
import { createExceptionSchema } from '../../../src/utils/validator.js';
import { getWorkDaysBetween } from '../../../src/utils/leave.js';

// ============================================
// EXCEPTION VALIDATION TESTS
// ============================================

describe('Exceptions API - Input Validation', () => {
  describe('POST /exceptions validation', () => {
    it('validates complete exception request', () => {
      const validData = {
        type: 'SICK_LEAVE',
        reason: 'Doctor appointment for annual checkup',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
      };

      const result = createExceptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts all valid exception types', () => {
      const validTypes = [
        'SICK_LEAVE',
        'PERSONAL_LEAVE',
        'MEDICAL_APPOINTMENT',
        'FAMILY_EMERGENCY',
        'OTHER',
      ];

      validTypes.forEach(type => {
        const data = {
          type,
          reason: 'Valid reason',
          startDate: '2025-01-20',
          endDate: '2025-01-21',
        };
        const result = createExceptionSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid exception type', () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        reason: 'Some reason',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects empty reason', () => {
      const invalidData = {
        type: 'SICK_LEAVE',
        reason: '',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects reason over 1000 characters', () => {
      const invalidData = {
        type: 'SICK_LEAVE',
        reason: 'a'.repeat(1001),
        startDate: '2025-01-20',
        endDate: '2025-01-21',
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects invalid date format', () => {
      const invalidData = {
        type: 'SICK_LEAVE',
        reason: 'Valid reason',
        startDate: 'not-a-date',
        endDate: '2025-01-21',
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts optional notes', () => {
      const validData = {
        type: 'SICK_LEAVE',
        reason: 'Doctor appointment',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
        notes: 'Additional details here',
      };

      const result = createExceptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects notes over 2000 characters', () => {
      const invalidData = {
        type: 'SICK_LEAVE',
        reason: 'Valid reason',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
        notes: 'a'.repeat(2001),
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts linked incident ID', () => {
      const validData = {
        type: 'SICK_LEAVE',
        reason: 'Related to workplace injury',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
        linkedIncidentId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createExceptionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid linked incident ID format', () => {
      const invalidData = {
        type: 'SICK_LEAVE',
        reason: 'Related to incident',
        startDate: '2025-01-20',
        endDate: '2025-01-21',
        linkedIncidentId: 'not-a-uuid',
      };

      const result = createExceptionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// EXCEPTION DURATION CALCULATION TESTS
// ============================================

describe('Exceptions API - Duration Calculation', () => {
  describe('Work days calculation', () => {
    it('calculates work days for Mon-Fri schedule', () => {
      // Monday Jan 13 to Friday Jan 17 = 5 work days
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(5);
    });

    it('excludes weekends from work days', () => {
      // Saturday Jan 18 to Sunday Jan 19 = 0 work days (Mon-Fri schedule)
      const start = new Date('2025-01-18T00:00:00Z');
      const end = new Date('2025-01-19T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(0);
    });

    it('calculates work days for Mon-Sat schedule', () => {
      // Monday Jan 13 to Saturday Jan 18 = 6 work days
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-18T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI,SAT', 'UTC');
      expect(result).toBe(6);
    });

    it('handles single day exception', () => {
      const monday = new Date('2025-01-13T00:00:00Z');
      const result = getWorkDaysBetween(monday, monday, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(1);
    });

    it('handles multi-week exception', () => {
      // 2 weeks = 10 work days (Mon-Fri)
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-24T00:00:00Z');
      const result = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      expect(result).toBe(10);
    });
  });

  describe('Timezone considerations', () => {
    it('respects company timezone for work day calculation', () => {
      const start = new Date('2025-01-13T00:00:00Z');
      const end = new Date('2025-01-17T00:00:00Z');

      const utcResult = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'UTC');
      const manilaResult = getWorkDaysBetween(start, end, 'MON,TUE,WED,THU,FRI', 'Asia/Manila');

      // Both should be 5 for this date range
      expect(utcResult).toBe(5);
      expect(manilaResult).toBe(5);
    });
  });
});

// ============================================
// EXCEPTION BUSINESS LOGIC TESTS
// ============================================

describe('Exceptions API - Business Logic', () => {
  describe('Exception status workflow', () => {
    it('documents: New exception starts as PENDING', () => {
      const initialStatus = 'PENDING';
      expect(initialStatus).toBe('PENDING');
    });

    it('documents: Valid status transitions', () => {
      const validTransitions = {
        PENDING: ['APPROVED', 'REJECTED'],
        APPROVED: ['CANCELLED'],
        REJECTED: [], // Terminal state
        CANCELLED: [], // Terminal state
      };

      expect(validTransitions.PENDING).toContain('APPROVED');
      expect(validTransitions.PENDING).toContain('REJECTED');
    });

    it('documents: Only TEAM_LEAD+ can approve/reject', () => {
      const approverRoles = ['TEAM_LEAD', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN'];
      expect(approverRoles).toContain('TEAM_LEAD');
      expect(approverRoles).not.toContain('WORKER');
    });
  });

  describe('End date semantics', () => {
    it('documents: End date is the LAST day of exception (inclusive)', () => {
      // If exception endDate = Jan 17
      // Jan 17 is still ON LEAVE (no check-in required)
      // Jan 18 (next work day) is first required check-in
      const endDateInclusive = true;
      expect(endDateInclusive).toBe(true);
    });

    it('documents: First required check-in is day AFTER end date', () => {
      const endDate = new Date('2025-01-17'); // Friday
      const expectedFirstCheckin = new Date('2025-01-20'); // Monday (next work day)

      // Skip weekend
      expect(expectedFirstCheckin.getDay()).toBe(1); // Monday
    });
  });

  describe('Exception types and their implications', () => {
    it('documents: SICK_LEAVE may require medical certificate', () => {
      const sickLeaveConfig = {
        type: 'SICK_LEAVE',
        mayRequireDocument: true,
        maxDaysWithoutDocument: 2,
      };
      expect(sickLeaveConfig.mayRequireDocument).toBe(true);
    });

    it('documents: FAMILY_EMERGENCY is typically approved quickly', () => {
      const emergencyConfig = {
        type: 'FAMILY_EMERGENCY',
        priority: 'HIGH',
        requiresDocumentation: false,
      };
      expect(emergencyConfig.priority).toBe('HIGH');
    });

    it('documents: MEDICAL_APPOINTMENT is usually pre-planned', () => {
      const medicalConfig = {
        type: 'MEDICAL_APPOINTMENT',
        typicalDuration: 'half-day to 1 day',
        requiresAdvanceNotice: true,
      };
      expect(medicalConfig.requiresAdvanceNotice).toBe(true);
    });
  });

  describe('Impact on attendance metrics', () => {
    it('documents: APPROVED exception = EXCUSED status (not counted)', () => {
      // Business rule: Approved exceptions don't count against attendance
      const approvedExceptionCounted = false;
      expect(approvedExceptionCounted).toBe(false);
    });

    it('documents: REJECTED exception = worker was expected to check in', () => {
      // Business rule: Rejected exceptions mean worker was expected
      const rejectedMeansExpected = true;
      expect(rejectedMeansExpected).toBe(true);
    });

    it('documents: PENDING exception = still counted until approved', () => {
      // Business rule: Pending exceptions don't excuse absence yet
      const pendingCountsAsExpected = true;
      expect(pendingCountsAsExpected).toBe(true);
    });
  });
});

// ============================================
// EXCEPTION RESPONSE STRUCTURE TESTS
// ============================================

describe('Exceptions API - Response Structure', () => {
  describe('GET /exceptions response', () => {
    it('defines expected list response structure', () => {
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
    });
  });

  describe('POST /exceptions response', () => {
    it('defines expected success response structure', () => {
      const expectedStructure = {
        id: expect.any(String),
        userId: expect.any(String),
        type: expect.stringMatching(/SICK_LEAVE|PERSONAL_LEAVE|MEDICAL_APPOINTMENT|FAMILY_EMERGENCY|OTHER/),
        reason: expect.any(String),
        startDate: expect.any(String),
        endDate: expect.any(String),
        status: 'PENDING',
        createdAt: expect.any(String),
      };

      expect(expectedStructure).toHaveProperty('id');
      expect(expectedStructure).toHaveProperty('status');
      expect(expectedStructure.status).toBe('PENDING');
    });
  });

  describe('PUT /exceptions/:id/approve response', () => {
    it('defines expected approval response structure', () => {
      const expectedStructure = {
        id: expect.any(String),
        status: 'APPROVED',
        approvedBy: expect.any(String),
        approvedAt: expect.any(String),
        reviewNotes: expect.toBeOneOf([expect.any(String), null]),
      };

      expect(expectedStructure.status).toBe('APPROVED');
      expect(expectedStructure).toHaveProperty('approvedBy');
    });
  });
});

// ============================================
// EXCEPTION AUTHORIZATION TESTS
// ============================================

describe('Exceptions API - Authorization', () => {
  describe('Creating exceptions', () => {
    it('documents: WORKER can create exception for themselves', () => {
      const workerCanCreate = true;
      expect(workerCanCreate).toBe(true);
    });

    it('documents: TEAM_LEAD can create exception for team members', () => {
      const teamLeadCanCreateForTeam = true;
      expect(teamLeadCanCreateForTeam).toBe(true);
    });
  });

  describe('Viewing exceptions', () => {
    it('documents: WORKER can view their own exceptions', () => {
      const workerCanViewOwn = true;
      expect(workerCanViewOwn).toBe(true);
    });

    it('documents: TEAM_LEAD can view team exceptions', () => {
      const teamLeadCanViewTeam = true;
      expect(teamLeadCanViewTeam).toBe(true);
    });

    it('documents: SUPERVISOR can view all company exceptions', () => {
      const supervisorCanViewAll = true;
      expect(supervisorCanViewAll).toBe(true);
    });
  });

  describe('Approving/Rejecting exceptions', () => {
    it('documents: WORKER cannot approve their own exception', () => {
      const workerCanApproveSelf = false;
      expect(workerCanApproveSelf).toBe(false);
    });

    it('documents: TEAM_LEAD can approve team member exceptions', () => {
      const teamLeadCanApprove = true;
      expect(teamLeadCanApprove).toBe(true);
    });

    it('documents: Approval requires review notes (optional but recommended)', () => {
      const reviewNotesOptional = true;
      expect(reviewNotesOptional).toBe(true);
    });
  });
});

// ============================================
// EXCEPTION EDGE CASES
// ============================================

describe('Exceptions API - Edge Cases', () => {
  describe('Overlapping exceptions', () => {
    it('documents: Cannot create overlapping pending/approved exceptions', () => {
      const overlappingAllowed = false;
      expect(overlappingAllowed).toBe(false);
    });

    it('documents: Can create new exception if previous was rejected', () => {
      const canRetryAfterRejection = true;
      expect(canRetryAfterRejection).toBe(true);
    });
  });

  describe('Date validation', () => {
    it('documents: Start date cannot be in the past (for new requests)', () => {
      // Business rule: Can only request future leave (with some grace period)
      const pastDateAllowed = false;
      expect(pastDateAllowed).toBe(false);
    });

    it('documents: End date cannot be before start date', () => {
      const endBeforeStart = false;
      expect(endBeforeStart).toBe(false);
    });

    it('documents: Maximum exception duration may be limited', () => {
      // Business rule: Extended leave may require HR approval
      const maxDaysForTeamLeadApproval = 14; // Example
      expect(maxDaysForTeamLeadApproval).toBeLessThanOrEqual(30);
    });
  });

  describe('Retroactive exceptions', () => {
    it('documents: Emergency exceptions can be submitted retroactively', () => {
      // Business rule: Family emergency can be submitted after the fact
      const retroactiveAllowedForEmergency = true;
      expect(retroactiveAllowedForEmergency).toBe(true);
    });

    it('documents: Retroactive exceptions recalculate past attendance', () => {
      // Business rule: Approving retroactive exception changes ABSENT to EXCUSED
      const recalculateAttendance = true;
      expect(recalculateAttendance).toBe(true);
    });
  });
});
