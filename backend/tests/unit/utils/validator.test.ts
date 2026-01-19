/**
 * Unit Tests for validator.ts
 *
 * Tests validation utilities and Zod schemas.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  uuidSchema,
  dateSchema,
  paginationSchema,
  isValidUUID,
  parseOptionalUUID,
  createCheckinSchema,
  createIncidentSchema,
  createExceptionSchema,
} from '../../../src/utils/validator.js';

// ============================================
// isValidUUID TESTS
// ============================================

describe('isValidUUID', () => {
  it('returns true for valid UUID v4', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('returns true for UUID v1', () => {
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('returns false for invalid UUIDs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('123')).toBe(false);
    expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false); // Too short
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false); // Too long
  });

  it('is case insensitive', () => {
    expect(isValidUUID('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
    expect(isValidUUID('123e4567-E89B-12d3-A456-426614174000')).toBe(true);
  });

  it('returns false for UUID with invalid characters', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400g')).toBe(false); // 'g' is invalid
    expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400!')).toBe(false);
  });
});

// ============================================
// parseOptionalUUID TESTS
// ============================================

describe('parseOptionalUUID', () => {
  it('returns valid UUID unchanged', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(parseOptionalUUID(uuid)).toBe(uuid);
  });

  it('returns null for undefined', () => {
    expect(parseOptionalUUID(undefined)).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(parseOptionalUUID('')).toBe(null);
  });

  it('returns null for invalid UUID', () => {
    expect(parseOptionalUUID('not-a-uuid')).toBe(null);
    expect(parseOptionalUUID('123')).toBe(null);
  });
});

// ============================================
// ZOD SCHEMA TESTS
// ============================================

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user.name@domain.co.uk').success).toBe(true);
    expect(emailSchema.safeParse('user+tag@example.com').success).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('missing@').success).toBe(false);
    expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts valid passwords', () => {
    expect(passwordSchema.safeParse('Password1').success).toBe(true);
    expect(passwordSchema.safeParse('MyP@ssw0rd').success).toBe(true);
    expect(passwordSchema.safeParse('SecurePass123').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Pass1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without uppercase', () => {
    const result = passwordSchema.safeParse('password1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without lowercase', () => {
    const result = passwordSchema.safeParse('PASSWORD1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    const result = passwordSchema.safeParse('PasswordOnly');
    expect(result.success).toBe(false);
  });
});

describe('uuidSchema', () => {
  it('accepts valid UUIDs', () => {
    expect(uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(uuidSchema.safeParse('').success).toBe(false);
  });
});

describe('dateSchema', () => {
  it('accepts valid date strings', () => {
    expect(dateSchema.safeParse('2025-01-15').success).toBe(true);
    expect(dateSchema.safeParse('2025-01-15T08:00:00Z').success).toBe(true);
    expect(dateSchema.safeParse('January 15, 2025').success).toBe(true);
  });

  it('rejects invalid date strings', () => {
    expect(dateSchema.safeParse('not-a-date').success).toBe(false);
    expect(dateSchema.safeParse('').success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('accepts valid pagination params', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 20 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, limit: 20 });
  });

  it('coerces string numbers', () => {
    const result = paginationSchema.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 2, limit: 50 });
  });

  it('uses defaults when not provided', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, limit: 20 });
  });

  it('rejects page less than 1', () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 100', () => {
    const result = paginationSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects negative limit', () => {
    const result = paginationSchema.safeParse({ limit: -1 });
    expect(result.success).toBe(false);
  });
});

// ============================================
// CHECKIN SCHEMA TESTS
// ============================================

describe('createCheckinSchema', () => {
  it('accepts valid check-in data', () => {
    const data = {
      mood: 7,
      stress: 3,
      sleep: 8,
      physicalHealth: 9,
    };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts check-in with notes', () => {
    const data = {
      mood: 7,
      stress: 3,
      sleep: 8,
      physicalHealth: 9,
      notes: 'Feeling good today!',
    };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects mood below 1', () => {
    const data = { mood: 0, stress: 3, sleep: 8, physicalHealth: 9 };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects mood above 10', () => {
    const data = { mood: 11, stress: 3, sleep: 8, physicalHealth: 9 };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects stress below 1', () => {
    const data = { mood: 7, stress: 0, sleep: 8, physicalHealth: 9 };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer values', () => {
    const data = { mood: 7.5, stress: 3, sleep: 8, physicalHealth: 9 };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects notes over 1000 characters', () => {
    const data = {
      mood: 7,
      stress: 3,
      sleep: 8,
      physicalHealth: 9,
      notes: 'a'.repeat(1001),
    };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts boundary values (1 and 10)', () => {
    const data = { mood: 1, stress: 10, sleep: 1, physicalHealth: 10 };
    const result = createCheckinSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

// ============================================
// INCIDENT SCHEMA TESTS
// ============================================

describe('createIncidentSchema', () => {
  it('accepts valid incident data', () => {
    const data = {
      title: 'Workplace Injury',
      description: 'Slipped on wet floor',
      severity: 'MEDIUM',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts all incident types', () => {
    const types = ['INJURY', 'ILLNESS', 'MENTAL_HEALTH', 'MEDICAL_EMERGENCY', 'HEALTH_SAFETY', 'OTHER'];
    types.forEach(type => {
      const data = {
        type,
        title: 'Test Incident',
        description: 'Test description',
        severity: 'LOW',
      };
      const result = createIncidentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  it('accepts all severity levels', () => {
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    severities.forEach(severity => {
      const data = {
        title: 'Test Incident',
        description: 'Test description',
        severity,
      };
      const result = createIncidentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  it('rejects empty title', () => {
    const data = {
      title: '',
      description: 'Test description',
      severity: 'LOW',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const data = {
      title: 'Test Incident',
      description: '',
      severity: 'LOW',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 characters', () => {
    const data = {
      title: 'a'.repeat(201),
      description: 'Test description',
      severity: 'LOW',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects description over 5000 characters', () => {
    const data = {
      title: 'Test Incident',
      description: 'a'.repeat(5001),
      severity: 'LOW',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid severity', () => {
    const data = {
      title: 'Test Incident',
      description: 'Test description',
      severity: 'INVALID',
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const data = {
      title: 'Test Incident',
      description: 'Test description',
      severity: 'LOW',
      location: 'Factory Floor',
      incidentDate: '2025-01-15',
      requestException: true,
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects more than 10 attachments', () => {
    const data = {
      title: 'Test Incident',
      description: 'Test description',
      severity: 'LOW',
      attachments: Array(11).fill('https://example.com/image.jpg'),
    };
    const result = createIncidentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================
// EXCEPTION SCHEMA TESTS
// ============================================

describe('createExceptionSchema', () => {
  it('accepts valid exception data', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Doctor appointment',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('accepts all exception types', () => {
    const types = ['SICK_LEAVE', 'PERSONAL_LEAVE', 'MEDICAL_APPOINTMENT', 'FAMILY_EMERGENCY', 'OTHER'];
    types.forEach(type => {
      const data = {
        type,
        reason: 'Test reason',
        startDate: '2025-01-15',
        endDate: '2025-01-16',
      };
      const result = createExceptionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  it('rejects empty reason', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: '',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects reason over 1000 characters', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'a'.repeat(1001),
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid dates', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Test reason',
      startDate: 'not-a-date',
      endDate: '2025-01-16',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts optional notes', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Doctor appointment',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      notes: 'Additional details',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects notes over 2000 characters', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Test reason',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      notes: 'a'.repeat(2001),
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('accepts linked incident ID', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Related to incident',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      linkedIncidentId: '123e4567-e89b-12d3-a456-426614174000',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects invalid linked incident ID', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Related to incident',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      linkedIncidentId: 'not-a-uuid',
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 attachments', () => {
    const data = {
      type: 'SICK_LEAVE',
      reason: 'Test reason',
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      attachments: Array(6).fill('https://example.com/doc.pdf'),
    };
    const result = createExceptionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
