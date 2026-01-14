/**
 * Library Index
 * Central export for all utility modules
 *
 * Usage:
 *   import { cn, formatDisplayDateTime, ROLES } from '@/lib';
 *   import { getStatusConfig, getScoreColor } from '@/lib';
 */

// Core utilities
export { cn, getInitials } from './utils';

// Constants
export {
  ROLES,
  READINESS_STATUS,
  EXCEPTION_STATUS,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_TYPE,
  EXCEPTION_TYPE,
  DEFAULT_PAGE_SIZE,
  DAY_CODES,
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT,
  DAY_INDEX_TO_CODE,
  DEFAULT_WORK_DAYS,
  VALIDATION,
} from './constants';

// Date utilities
export {
  formatLocalDate,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
  formatRelativeTime,
  getWeekCalendar,
  isToday,
  isFuture,
  isPast,
  getDaysDifference,
  getDayCode,
  isSameDay,
  addDays,
  subtractDays,
  getStartOfDay,
  getEndOfDay,
} from './date-utils';

// Status configuration
export {
  getStatusConfig,
  getScoreColor,
  getVariantClasses,
  readinessStatusConfig,
  exceptionStatusConfig,
  incidentStatusConfig,
  incidentSeverityConfig,
  type StatusVariant,
  type StatusConfig,
} from './status-config';

// Schedule utilities
export {
  isWorkDay,
  formatWorkDays,
  parseWorkDays,
  getCheckinInfo,
  isWithinShiftHours,
  type CheckinInfo,
} from './schedule-utils';

// Query utilities
export { invalidateRelatedQueries, invalidateAllQueries } from './query-utils';
