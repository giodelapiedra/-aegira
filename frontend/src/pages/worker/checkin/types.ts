/**
 * Types for Check-in Page
 */

import type { TeamDetails } from '../../../services/team.service';
import type { Checkin } from '../../../types/user';
import type { CheckinWithAttendance, LeaveStatus, LowScoreReason } from '../../../services/checkin.service';
import type { Exemption, ExceptionType } from '../../../services/exemption.service';

// Re-export commonly used types
export type { TeamDetails, Checkin, CheckinWithAttendance, LeaveStatus, LowScoreReason, Exemption, ExceptionType };

/**
 * Check-in availability status
 */
export type CheckinAvailability =
  | { available: true }
  | { available: false; reason: 'NOT_WORK_DAY'; message: string }
  | { available: false; reason: 'TOO_EARLY'; message: string; shiftStart: string }
  | { available: false; reason: 'TOO_LATE'; message: string; shiftEnd: string }
  | { available: false; reason: 'HOLIDAY'; message: string; holidayName: string };

/**
 * Check-in form data
 */
export interface CheckinFormData {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes: string;
}

/**
 * Week stats data from API
 */
export interface WeekStats {
  weekStart: string;
  weekEnd: string;
  totalCheckins: number;
  scheduledDaysThisWeek: number;
  scheduledDaysSoFar: number;
  avgScore: number;
  avgStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
  dailyStatus: Record<string, { status: string; score: number } | null>;
  workDays: string[];
  currentStreak: number;
  longestStreak: number;
}

/**
 * Leave exception data
 */
export interface LeaveException {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Check-in error response
 */
export interface CheckinError {
  response?: {
    data?: {
      error?: string;
    };
  };
}
