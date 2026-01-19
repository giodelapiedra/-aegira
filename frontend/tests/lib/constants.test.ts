/**
 * Constants Tests
 *
 * Tests for application-wide constants.
 */

import { describe, it, expect } from 'vitest';
import {
  DAY_CODES,
  DEFAULT_WORK_DAYS,
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT,
  DAY_INDEX_TO_CODE,
  CHECKIN_GRACE_PERIOD_MINUTES,
  CHECKIN_STREAK_WINDOW_DAYS,
  CHECKIN_SLIDER_DEFAULTS,
  CHECKIN_SLIDER_CONFIG,
  READINESS_THRESHOLDS,
  PAGINATION_LIMITS,
  DEFAULT_PAGE_SIZE,
  ROLES,
  READINESS_STATUS,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  EXCEPTION_STATUS,
  EXCEPTION_TYPE,
  INCIDENT_TYPE,
  VALIDATION,
  API_TIMEOUTS,
  STORAGE_KEYS,
} from '../../src/lib/constants';

// ============================================
// DAY CODES TESTS
// ============================================

describe('DAY_CODES', () => {
  it('contains all 7 days', () => {
    expect(DAY_CODES.length).toBe(7);
  });

  it('starts with Sunday', () => {
    expect(DAY_CODES[0]).toBe('SUN');
  });

  it('ends with Saturday', () => {
    expect(DAY_CODES[6]).toBe('SAT');
  });

  it('has correct weekday order', () => {
    expect(DAY_CODES).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  });
});

describe('DEFAULT_WORK_DAYS', () => {
  it('contains 5 work days (Mon-Fri)', () => {
    expect(DEFAULT_WORK_DAYS.length).toBe(5);
  });

  it('starts with Monday', () => {
    expect(DEFAULT_WORK_DAYS[0]).toBe('MON');
  });

  it('ends with Friday', () => {
    expect(DEFAULT_WORK_DAYS[4]).toBe('FRI');
  });

  it('does not include weekend', () => {
    expect(DEFAULT_WORK_DAYS).not.toContain('SUN');
    expect(DEFAULT_WORK_DAYS).not.toContain('SAT');
  });
});

describe('DAY_CODE_TO_NAME', () => {
  it('maps all day codes to full names', () => {
    expect(DAY_CODE_TO_NAME.SUN).toBe('Sunday');
    expect(DAY_CODE_TO_NAME.MON).toBe('Monday');
    expect(DAY_CODE_TO_NAME.TUE).toBe('Tuesday');
    expect(DAY_CODE_TO_NAME.WED).toBe('Wednesday');
    expect(DAY_CODE_TO_NAME.THU).toBe('Thursday');
    expect(DAY_CODE_TO_NAME.FRI).toBe('Friday');
    expect(DAY_CODE_TO_NAME.SAT).toBe('Saturday');
  });
});

describe('DAY_CODE_TO_SHORT', () => {
  it('maps day codes to single characters', () => {
    expect(DAY_CODE_TO_SHORT.SUN).toBe('S');
    expect(DAY_CODE_TO_SHORT.MON).toBe('M');
    expect(DAY_CODE_TO_SHORT.TUE).toBe('T');
    expect(DAY_CODE_TO_SHORT.WED).toBe('W');
    expect(DAY_CODE_TO_SHORT.THU).toBe('T');
    expect(DAY_CODE_TO_SHORT.FRI).toBe('F');
    expect(DAY_CODE_TO_SHORT.SAT).toBe('S');
  });
});

describe('DAY_INDEX_TO_CODE', () => {
  it('maps JavaScript day index to day code', () => {
    expect(DAY_INDEX_TO_CODE[0]).toBe('SUN');
    expect(DAY_INDEX_TO_CODE[1]).toBe('MON');
    expect(DAY_INDEX_TO_CODE[2]).toBe('TUE');
    expect(DAY_INDEX_TO_CODE[3]).toBe('WED');
    expect(DAY_INDEX_TO_CODE[4]).toBe('THU');
    expect(DAY_INDEX_TO_CODE[5]).toBe('FRI');
    expect(DAY_INDEX_TO_CODE[6]).toBe('SAT');
  });
});

// ============================================
// CHECK-IN CONFIGURATION TESTS
// ============================================

describe('CHECKIN_GRACE_PERIOD_MINUTES', () => {
  it('is 30 minutes', () => {
    expect(CHECKIN_GRACE_PERIOD_MINUTES).toBe(30);
  });
});

describe('CHECKIN_STREAK_WINDOW_DAYS', () => {
  it('is 3 days', () => {
    expect(CHECKIN_STREAK_WINDOW_DAYS).toBe(3);
  });
});

describe('CHECKIN_SLIDER_DEFAULTS', () => {
  it('has positive mood default', () => {
    expect(CHECKIN_SLIDER_DEFAULTS.MOOD).toBe(7);
  });

  it('has low stress default', () => {
    expect(CHECKIN_SLIDER_DEFAULTS.STRESS).toBe(3);
  });

  it('has good sleep default', () => {
    expect(CHECKIN_SLIDER_DEFAULTS.SLEEP).toBe(7);
  });

  it('has good physical health default', () => {
    expect(CHECKIN_SLIDER_DEFAULTS.PHYSICAL_HEALTH).toBe(7);
  });
});

describe('CHECKIN_SLIDER_CONFIG', () => {
  it('has minimum of 1', () => {
    expect(CHECKIN_SLIDER_CONFIG.MIN).toBe(1);
  });

  it('has maximum of 10', () => {
    expect(CHECKIN_SLIDER_CONFIG.MAX).toBe(10);
  });

  it('has step of 1', () => {
    expect(CHECKIN_SLIDER_CONFIG.STEP).toBe(1);
  });
});

// ============================================
// READINESS THRESHOLDS TESTS
// ============================================

describe('READINESS_THRESHOLDS', () => {
  it('defines GREEN threshold at 70', () => {
    expect(READINESS_THRESHOLDS.GREEN).toBe(70);
  });

  it('defines YELLOW threshold at 40', () => {
    expect(READINESS_THRESHOLDS.YELLOW).toBe(40);
  });

  it('implies RED is below 40', () => {
    expect(READINESS_THRESHOLDS.YELLOW).toBeLessThan(READINESS_THRESHOLDS.GREEN);
  });
});

// ============================================
// PAGINATION TESTS
// ============================================

describe('PAGINATION_LIMITS', () => {
  it('defines small limit', () => {
    expect(PAGINATION_LIMITS.SMALL).toBe(5);
  });

  it('defines medium limit', () => {
    expect(PAGINATION_LIMITS.MEDIUM).toBe(10);
  });

  it('defines large limit', () => {
    expect(PAGINATION_LIMITS.LARGE).toBe(20);
  });

  it('defines extra large limit', () => {
    expect(PAGINATION_LIMITS.EXTRA_LARGE).toBe(50);
  });

  it('defines max limit', () => {
    expect(PAGINATION_LIMITS.MAX).toBe(100);
  });
});

describe('DEFAULT_PAGE_SIZE', () => {
  it('equals PAGINATION_LIMITS.MEDIUM', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(PAGINATION_LIMITS.MEDIUM);
  });
});

// ============================================
// ROLES TESTS
// ============================================

describe('ROLES', () => {
  it('defines EXECUTIVE role', () => {
    expect(ROLES.EXECUTIVE).toBe('EXECUTIVE');
  });

  it('defines ADMIN role', () => {
    expect(ROLES.ADMIN).toBe('ADMIN');
  });

  it('defines SUPERVISOR role', () => {
    expect(ROLES.SUPERVISOR).toBe('SUPERVISOR');
  });

  it('defines TEAM_LEAD role', () => {
    expect(ROLES.TEAM_LEAD).toBe('TEAM_LEAD');
  });

  it('defines MEMBER role', () => {
    expect(ROLES.MEMBER).toBe('MEMBER');
  });
});

// ============================================
// STATUS TYPES TESTS
// ============================================

describe('READINESS_STATUS', () => {
  it('defines all readiness statuses', () => {
    expect(READINESS_STATUS.GREEN).toBe('GREEN');
    expect(READINESS_STATUS.YELLOW).toBe('YELLOW');
    expect(READINESS_STATUS.RED).toBe('RED');
  });
});

describe('INCIDENT_STATUS', () => {
  it('defines all incident statuses', () => {
    expect(INCIDENT_STATUS.OPEN).toBe('OPEN');
    expect(INCIDENT_STATUS.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(INCIDENT_STATUS.RESOLVED).toBe('RESOLVED');
    expect(INCIDENT_STATUS.CLOSED).toBe('CLOSED');
  });
});

describe('INCIDENT_SEVERITY', () => {
  it('defines all severity levels', () => {
    expect(INCIDENT_SEVERITY.LOW).toBe('LOW');
    expect(INCIDENT_SEVERITY.MEDIUM).toBe('MEDIUM');
    expect(INCIDENT_SEVERITY.HIGH).toBe('HIGH');
    expect(INCIDENT_SEVERITY.CRITICAL).toBe('CRITICAL');
  });
});

describe('EXCEPTION_STATUS', () => {
  it('defines all exception statuses', () => {
    expect(EXCEPTION_STATUS.PENDING).toBe('PENDING');
    expect(EXCEPTION_STATUS.APPROVED).toBe('APPROVED');
    expect(EXCEPTION_STATUS.REJECTED).toBe('REJECTED');
  });
});

describe('EXCEPTION_TYPE', () => {
  it('defines all exception types', () => {
    expect(EXCEPTION_TYPE.SICK_LEAVE).toBe('SICK_LEAVE');
    expect(EXCEPTION_TYPE.PERSONAL_LEAVE).toBe('PERSONAL_LEAVE');
    expect(EXCEPTION_TYPE.MEDICAL_APPOINTMENT).toBe('MEDICAL_APPOINTMENT');
    expect(EXCEPTION_TYPE.FAMILY_EMERGENCY).toBe('FAMILY_EMERGENCY');
    expect(EXCEPTION_TYPE.OTHER).toBe('OTHER');
  });
});

describe('INCIDENT_TYPE', () => {
  it('defines all incident types', () => {
    expect(INCIDENT_TYPE.INJURY).toBe('INJURY');
    expect(INCIDENT_TYPE.ILLNESS).toBe('ILLNESS');
    expect(INCIDENT_TYPE.MENTAL_HEALTH).toBe('MENTAL_HEALTH');
    expect(INCIDENT_TYPE.MEDICAL_EMERGENCY).toBe('MEDICAL_EMERGENCY');
    expect(INCIDENT_TYPE.HEALTH_SAFETY).toBe('HEALTH_SAFETY');
    expect(INCIDENT_TYPE.OTHER).toBe('OTHER');
  });
});

// ============================================
// VALIDATION TESTS
// ============================================

describe('VALIDATION', () => {
  it('defines password minimum length', () => {
    expect(VALIDATION.PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('defines name length constraints', () => {
    expect(VALIDATION.NAME_MIN_LENGTH).toBe(2);
    expect(VALIDATION.NAME_MAX_LENGTH).toBe(50);
  });

  it('defines search length constraints', () => {
    expect(VALIDATION.SEARCH_MIN_LENGTH).toBe(2);
    expect(VALIDATION.SEARCH_MAX_LENGTH).toBe(100);
  });
});

// ============================================
// API TIMEOUTS TESTS
// ============================================

describe('API_TIMEOUTS', () => {
  it('defines default timeout (30 seconds)', () => {
    expect(API_TIMEOUTS.DEFAULT).toBe(30000);
  });

  it('defines long timeout (1 minute)', () => {
    expect(API_TIMEOUTS.LONG).toBe(60000);
  });

  it('defines upload timeout (2 minutes)', () => {
    expect(API_TIMEOUTS.UPLOAD).toBe(120000);
  });
});

// ============================================
// STORAGE KEYS TESTS
// ============================================

describe('STORAGE_KEYS', () => {
  it('defines auth token key', () => {
    expect(STORAGE_KEYS.AUTH_TOKEN).toBe('aegira_auth_token');
  });

  it('defines refresh token key', () => {
    expect(STORAGE_KEYS.REFRESH_TOKEN).toBe('aegira_refresh_token');
  });

  it('defines user data key', () => {
    expect(STORAGE_KEYS.USER_DATA).toBe('aegira_user_data');
  });

  it('defines theme key', () => {
    expect(STORAGE_KEYS.THEME).toBe('aegira_theme');
  });

  it('all keys have aegira_ prefix', () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      expect(key).toMatch(/^aegira_/);
    });
  });
});
