/**
 * Utility functions for Check-in Page
 */

import { getNowInTimezone } from '../../../lib/date-utils';
import type { TeamDetails } from '../../../services/team.service';
import type { CheckinAvailability } from './types';

/**
 * Check if check-in is available based on team schedule and current time
 * Uses company timezone for all calculations
 */
export function checkCheckinAvailability(team: TeamDetails): CheckinAvailability {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Use company timezone for all calculations (centralized)
  const timezone = team.company?.timezone || 'Asia/Manila';
  const nowInTz = getNowInTimezone(timezone);
  const currentDay = dayNames[nowInTz.dayOfWeek];
  const workDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

  // Check if today is a work day (in company timezone)
  if (!workDays.includes(currentDay)) {
    return {
      available: false,
      reason: 'NOT_WORK_DAY',
      message: `Today (${currentDay}) is not a scheduled work day. Work days: ${workDays.join(', ')}`,
    };
  }

  // Check time (in company timezone)
  const currentTimeMinutes = nowInTz.hour * 60 + nowInTz.minute;

  const [shiftStartHour, shiftStartMin] = team.shiftStart.split(':').map(Number);
  const [shiftEndHour, shiftEndMin] = team.shiftEnd.split(':').map(Number);
  const shiftStartMinutes = shiftStartHour * 60 + shiftStartMin;
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;

  // Allow 30 minutes early check-in
  const gracePeriod = 30;
  const allowedStartMinutes = shiftStartMinutes - gracePeriod;

  if (currentTimeMinutes < allowedStartMinutes) {
    return {
      available: false,
      reason: 'TOO_EARLY',
      message: `Check-in is not yet available. You can check in starting ${gracePeriod} minutes before your shift.`,
      shiftStart: team.shiftStart,
    };
  }

  if (currentTimeMinutes > shiftEndMinutes) {
    return {
      available: false,
      reason: 'TOO_LATE',
      message: `Check-in time has ended. Your shift ended at ${team.shiftEnd}.`,
      shiftEnd: team.shiftEnd,
    };
  }

  return { available: true };
}

/**
 * Format exception type for display
 * e.g., 'SICK_LEAVE' -> 'Sick Leave'
 */
export function formatExceptionType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check-in error codes
 */
export type CheckinErrorCode =
  | 'NO_TEAM'
  | 'NOT_WORK_DAY'
  | 'TOO_EARLY'
  | 'TOO_LATE'
  | 'ALREADY_CHECKED_IN'
  | 'NOT_MEMBER_ROLE'
  | 'ON_LEAVE';

export interface CheckinErrorResponse {
  error: string;
  code?: CheckinErrorCode;
}
