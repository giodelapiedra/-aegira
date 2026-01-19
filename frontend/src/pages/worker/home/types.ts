/**
 * Types for Worker Home Page
 */

import type { TeamDetails } from '../../../services/team.service';
import type { Exemption } from '../../../services/exemption.service';

// Re-export commonly used types
export type { TeamDetails, Exemption };

// Minimal checkin type for home page (subset of full Checkin)
export interface MinimalCheckin {
  id: string;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  createdAt: string;
  mood?: number;
  stress?: number;
  sleep?: number;
  physicalHealth?: number;
}

/**
 * Next check-in calculation result
 */
export interface NextCheckinResult {
  date: Date;
  isNow: boolean;
  timeUntil: string;
  dayName?: string;
}

/**
 * Week calendar day
 */
export interface WeekCalendarDay {
  dayName: string;
  dayNum: number;
  dateStr: string;
  isToday: boolean;
  isWorkDay: boolean;
  isFuture: boolean;
  checkin?: MinimalCheckin | null;
  isExempted: boolean;
  absence?: AbsenceRecord | null;
}

/**
 * Absence record from API
 */
export interface AbsenceRecord {
  id: string;
  userId: string;
  absenceDate: string;
  status: 'PENDING_JUSTIFICATION' | 'EXCUSED' | 'UNEXCUSED';
  reason?: string;
  createdAt: string;
}

/**
 * Weekly summary stats
 */
export interface WeeklySummary {
  checkinsThisWeek: number;
  workDaysThisWeek: number;
  workDaysPassed: number;
  excusedAbsences: number;
  unexcusedAbsences: number;
  pendingAbsences: number;
}

/**
 * Dynamic tip based on check-in data
 */
export interface DynamicTip {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

/**
 * Active exemption from API
 * Using string | null to match the Exemption type from exemption.service.ts
 */
export interface ActiveExemption {
  id: string;
  userId: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  reason?: string;
}

/**
 * Recent checkins response from API
 */
export interface RecentCheckinsResponse {
  data: MinimalCheckin[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Absence history response from API
 */
export interface AbsenceHistoryResponse {
  data: AbsenceRecord[];
}
