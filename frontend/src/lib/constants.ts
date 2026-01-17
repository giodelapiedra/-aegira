/**
 * Application-wide constants
 * Centralized to avoid hardcoded values scattered across the codebase
 */

// ============================================
// WORK DAYS & SCHEDULE
// ============================================

export const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type DayCode = (typeof DAY_CODES)[number];

export const DEFAULT_WORK_DAYS: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

export const DAY_CODE_TO_NAME: Record<DayCode, string> = {
  SUN: 'Sunday',
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

export const DAY_CODE_TO_SHORT: Record<DayCode, string> = {
  SUN: 'S',
  MON: 'M',
  TUE: 'T',
  WED: 'W',
  THU: 'T',
  FRI: 'F',
  SAT: 'S',
};

export const DAY_INDEX_TO_CODE: Record<number, DayCode> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

// ============================================
// CHECK-IN CONFIGURATION
// ============================================

export const CHECKIN_GRACE_PERIOD_MINUTES = 30;
export const CHECKIN_STREAK_WINDOW_DAYS = 3;

export const CHECKIN_SLIDER_DEFAULTS = {
  MOOD: 7,
  STRESS: 3,
  SLEEP: 7,
  PHYSICAL_HEALTH: 7,
} as const;

export const CHECKIN_SLIDER_CONFIG = {
  MIN: 1,
  MAX: 10,
  STEP: 1,
} as const;

// ============================================
// READINESS THRESHOLDS
// ============================================

export const READINESS_THRESHOLDS = {
  GREEN: 70,  // >= 70 is GREEN
  YELLOW: 40, // >= 40 and < 70 is YELLOW
  // < 40 is RED
} as const;

// ============================================
// PAGINATION
// ============================================

export const PAGINATION_LIMITS = {
  SMALL: 5,
  MEDIUM: 10,
  LARGE: 20,
  EXTRA_LARGE: 50,
  MAX: 100,
} as const;

export const DEFAULT_PAGE_SIZE = PAGINATION_LIMITS.MEDIUM;

// ============================================
// ROLES
// ============================================

export const ROLES = {
  EXECUTIVE: 'EXECUTIVE',
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  TEAM_LEAD: 'TEAM_LEAD',
  MEMBER: 'MEMBER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ============================================
// STATUS TYPES
// ============================================

export const READINESS_STATUS = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
} as const;

export type ReadinessStatus = (typeof READINESS_STATUS)[keyof typeof READINESS_STATUS];

export const INCIDENT_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

export const INCIDENT_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[keyof typeof INCIDENT_SEVERITY];

export const EXCEPTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ExceptionStatus = (typeof EXCEPTION_STATUS)[keyof typeof EXCEPTION_STATUS];

export const EXCEPTION_TYPE = {
  SICK_LEAVE: 'SICK_LEAVE',
  PERSONAL_LEAVE: 'PERSONAL_LEAVE',
  MEDICAL_APPOINTMENT: 'MEDICAL_APPOINTMENT',
  FAMILY_EMERGENCY: 'FAMILY_EMERGENCY',
  OTHER: 'OTHER',
} as const;

export type ExceptionType = (typeof EXCEPTION_TYPE)[keyof typeof EXCEPTION_TYPE];

export const INCIDENT_TYPE = {
  INJURY: 'INJURY',
  ILLNESS: 'ILLNESS',
  MENTAL_HEALTH: 'MENTAL_HEALTH',
  MEDICAL_EMERGENCY: 'MEDICAL_EMERGENCY',
  HEALTH_SAFETY: 'HEALTH_SAFETY',
  OTHER: 'OTHER',
} as const;

export type IncidentType = (typeof INCIDENT_TYPE)[keyof typeof INCIDENT_TYPE];

// ============================================
// VALIDATION
// ============================================

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  SEARCH_MIN_LENGTH: 2,
  SEARCH_MAX_LENGTH: 100,
} as const;

// ============================================
// API TIMEOUTS
// ============================================

export const API_TIMEOUTS = {
  DEFAULT: 30000,   // 30 seconds
  LONG: 60000,      // 1 minute
  UPLOAD: 120000,   // 2 minutes
} as const;

// ============================================
// LOCAL STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'aegira_auth_token',
  REFRESH_TOKEN: 'aegira_refresh_token',
  USER_DATA: 'aegira_user_data',
  THEME: 'aegira_theme',
} as const;
