/**
 * Exemption Service
 * Handles exemption-related API calls
 */

import api from './api';
import { getNowInTimezone, createDateWithTimeInTimezone } from '../lib/date-utils';

// ============================================
// TYPES
// ============================================

export type ExceptionType =
  | 'SICK_LEAVE'
  | 'PERSONAL_LEAVE'
  | 'MEDICAL_APPOINTMENT'
  | 'FAMILY_EMERGENCY'
  | 'OTHER';

export type ExceptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExemptionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teamId?: string;
}

export interface ExemptionCheckin {
  id: string;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  notes?: string;
  createdAt: string;
}

export interface Exemption {
  id: string;
  userId: string;
  companyId: string;
  type: ExceptionType;
  reason: string;
  startDate: string | null;
  endDate: string | null;
  status: ExceptionStatus;
  reviewedById?: string;
  reviewNote?: string;
  approvedBy?: string;
  approvedAt?: string;
  isExemption: boolean;
  triggeredByCheckinId?: string;
  scoreAtRequest?: number;
  createdAt: string;
  updatedAt: string;
  user: ExemptionUser;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  triggeredByCheckin?: ExemptionCheckin;
}

export interface CreateExemptionData {
  type: ExceptionType;
  reason: string;
  checkinId: string;
}

export interface CreateExemptionForWorkerData {
  userId: string;
  type: ExceptionType;
  reason: string;
  endDate: string; // YYYY-MM-DD
  checkinId?: string;
  notes?: string;
}

export interface ApproveExemptionData {
  endDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface RejectExemptionData {
  notes?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Create an exemption request (worker)
 */
export async function createExemption(data: CreateExemptionData): Promise<Exemption> {
  const response = await api.post('/exemptions', data);
  return response.data;
}

/**
 * Create an exemption for a worker (Team Lead / Supervisor)
 * Auto-approved, worker is immediately on leave
 */
export async function createExemptionForWorker(data: CreateExemptionForWorkerData): Promise<Exemption> {
  const response = await api.post('/exemptions/create-for-worker', data);
  return response.data;
}

/**
 * Get pending exemptions for TL
 */
export async function getPendingExemptions(): Promise<Exemption[]> {
  const response = await api.get('/exemptions/pending');
  return response.data;
}

/**
 * Get active exemptions
 */
export async function getActiveExemptions(): Promise<Exemption[]> {
  const response = await api.get('/exemptions/active');
  return response.data;
}

/**
 * Get all exemptions with pagination
 */
export async function getExemptions(params?: {
  page?: number;
  limit?: number;
  status?: ExceptionStatus;
}): Promise<{
  data: Exemption[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const response = await api.get('/exemptions', { params });
  return response.data;
}

/**
 * Get exemption by ID
 */
export async function getExemptionById(id: string): Promise<Exemption> {
  const response = await api.get(`/exemptions/${id}`);
  return response.data;
}

/**
 * Approve exemption with return date (TL)
 */
export async function approveExemption(
  id: string,
  data: ApproveExemptionData
): Promise<Exemption> {
  const response = await api.patch(`/exemptions/${id}/approve`, data);
  return response.data;
}

/**
 * Reject exemption (TL)
 */
export async function rejectExemption(
  id: string,
  data: RejectExemptionData
): Promise<Exemption> {
  const response = await api.patch(`/exemptions/${id}/reject`, data);
  return response.data;
}

/**
 * End exemption early (TL)
 */
export async function endExemptionEarly(
  id: string,
  data?: { notes?: string }
): Promise<Exemption> {
  const response = await api.patch(`/exemptions/${id}/end-early`, data || {});
  return response.data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Exception type options for dropdowns
 */
export const EXCEPTION_TYPE_OPTIONS: { value: ExceptionType; label: string }[] = [
  { value: 'SICK_LEAVE', label: 'Sick Leave' },
  { value: 'PERSONAL_LEAVE', label: 'Personal Leave' },
  { value: 'MEDICAL_APPOINTMENT', label: 'Medical Appointment' },
  { value: 'FAMILY_EMERGENCY', label: 'Family Emergency' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Get display label for exception type
 */
export function getExceptionTypeLabel(type: ExceptionType): string {
  const found = EXCEPTION_TYPE_OPTIONS.find(o => o.value === type);
  return found?.label || type;
}

/**
 * Calculate days remaining for an exemption
 * @param endDate - End date string (YYYY-MM-DD or ISO string)
 * @param timezone - Company timezone (IANA format)
 */
export function getDaysRemaining(endDate: string | null, timezone: string): number {
  if (!endDate) return 0;

  // Get today in company timezone (start of day)
  const nowInTz = getNowInTimezone(timezone);
  const todayStart = createDateWithTimeInTimezone('00:00', nowInTz.date, timezone);

  // Parse end date and get start of that day in company timezone
  const endDateObj = new Date(endDate);
  const endStart = createDateWithTimeInTimezone('00:00', endDateObj, timezone);

  const diff = endStart.getTime() - todayStart.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get my pending exemption (if any)
 */
export async function getMyPendingExemption(): Promise<Exemption | null> {
  try {
    const response = await api.get('/exemptions/my-pending');
    return response.data;
  } catch (error: unknown) {
    // 404 means no pending exemption - this is expected
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
    }
    // Log unexpected errors but don't throw - return null as fallback
    console.error('Error fetching pending exemption:', error);
    return null;
  }
}

/**
 * Check if user has pending exemption for a specific check-in
 */
export async function hasExemptionForCheckin(checkinId: string): Promise<boolean> {
  try {
    const response = await api.get(`/exemptions/check/${checkinId}`);
    return response.data.hasExemption;
  } catch (error: unknown) {
    // 404 means no exemption - this is expected
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return false;
      }
    }
    // Log unexpected errors but don't throw - return false as fallback
    console.error('Error checking exemption for checkin:', error);
    return false;
  }
}

// ============================================
// WORK DAY HELPERS FOR EXEMPTIONS
// ============================================

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Get the actual return work day for an exemption
 * If endDate falls on a non-work day, returns the next work day
 * @param endDate - End date string (YYYY-MM-DD or ISO string)
 * @param workDays - Comma-separated work days string (e.g., "MON,TUE,WED,THU,FRI")
 */
export function getActualReturnWorkDay(
  endDate: string | null,
  workDays: string = 'MON,TUE,WED,THU,FRI'
): { date: Date; wasAdjusted: boolean; originalDayName: string; adjustedDayName: string } | null {
  if (!endDate) return null;

  const endDateObj = new Date(endDate);
  endDateObj.setHours(0, 0, 0, 0);

  const workDaysList = workDays.split(',').map(d => d.trim().toUpperCase());
  const originalDayName = DAY_NAMES[endDateObj.getDay()];

  // Check if endDate is already a work day
  if (workDaysList.includes(originalDayName)) {
    return {
      date: endDateObj,
      wasAdjusted: false,
      originalDayName,
      adjustedDayName: originalDayName,
    };
  }

  // Find the next work day
  const current = new Date(endDateObj);
  for (let i = 1; i <= 7; i++) {
    current.setDate(current.getDate() + 1);
    const dayName = DAY_NAMES[current.getDay()];
    if (workDaysList.includes(dayName)) {
      return {
        date: current,
        wasAdjusted: true,
        originalDayName,
        adjustedDayName: dayName,
      };
    }
  }

  return {
    date: endDateObj,
    wasAdjusted: false,
    originalDayName,
    adjustedDayName: originalDayName,
  };
}

/**
 * Calculate days remaining until actual return work day
 * Considers that endDate might fall on a non-work day
 */
export function getDaysRemainingToWorkDay(
  endDate: string | null,
  workDays: string = 'MON,TUE,WED,THU,FRI',
  timezone: string
): { days: number; actualReturnDate: Date | null; wasAdjusted: boolean } {
  if (!endDate) return { days: 0, actualReturnDate: null, wasAdjusted: false };

  const nowInTz = getNowInTimezone(timezone);
  const todayStart = createDateWithTimeInTimezone('00:00', nowInTz.date, timezone);

  const actualReturn = getActualReturnWorkDay(endDate, workDays);
  if (!actualReturn) return { days: 0, actualReturnDate: null, wasAdjusted: false };

  const diff = actualReturn.date.getTime() - todayStart.getTime();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  return {
    days,
    actualReturnDate: actualReturn.date,
    wasAdjusted: actualReturn.wasAdjusted,
  };
}

/**
 * Format return date display with adjustment note if applicable
 */
export function formatReturnDateDisplay(
  endDate: string | null,
  workDays: string = 'MON,TUE,WED,THU,FRI'
): string {
  if (!endDate) return 'Not set';

  const actualReturn = getActualReturnWorkDay(endDate, workDays);
  if (!actualReturn) return 'Not set';

  const dateStr = actualReturn.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (actualReturn.wasAdjusted) {
    return dateStr + ' (adjusted from ' + actualReturn.originalDayName + ')';
  }

  return dateStr;
}
