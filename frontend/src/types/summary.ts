/**
 * DailyTeamSummary Types
 *
 * Pre-computed daily statistics per team for fast analytics queries.
 */

// Single day summary for a team
export interface DailyTeamSummary {
  id: string;
  teamId: string;
  companyId: string;
  date: string;

  // Flags
  isWorkDay: boolean;
  isHoliday: boolean;

  // Member counts
  totalMembers: number;
  onLeaveCount: number;
  expectedToCheckIn: number;

  // Check-in stats
  checkedInCount: number;
  notCheckedInCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;

  // Scores
  avgReadinessScore: number | null;
  complianceRate: number | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Team stats for today (from /teams/:id/stats)
export interface TeamDailyStats {
  totalMembers: number;
  checkedIn: number;
  notCheckedIn: number;
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExceptions: number;
  openIncidents: number;
  checkinRate: number;
  avgReadinessScore: number | null;
  onLeaveCount: number;
}

// Weekly summary request params
export interface WeeklySummaryParams {
  teamId: string;
  startDate?: string;
  endDate?: string;
  days?: number;
}

// Weekly summary response
export interface WeeklySummaryResponse {
  teamId: string;
  teamName: string;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summaries: DailyTeamSummary[];
  aggregate: {
    totalWorkDays: number;
    totalExpected: number;
    totalCheckedIn: number;
    avgComplianceRate: number | null;
    avgReadinessScore: number | null;
    totalGreen: number;
    totalYellow: number;
    totalRed: number;
  };
}

// Day status for calendar view
export type DayStatus = 'perfect' | 'good' | 'warning' | 'poor' | 'holiday' | 'weekend' | 'no-data';

// Helper to get day status from compliance rate
export function getDayStatus(summary: DailyTeamSummary | null): DayStatus {
  if (!summary) return 'no-data';
  if (summary.isHoliday) return 'holiday';
  if (!summary.isWorkDay) return 'weekend';
  if (summary.complianceRate === null) return 'no-data';
  if (summary.complianceRate >= 100) return 'perfect';
  if (summary.complianceRate >= 80) return 'good';
  if (summary.complianceRate >= 60) return 'warning';
  return 'poor';
}

// Status colors for UI
export const dayStatusColors: Record<DayStatus, { bg: string; text: string; border: string }> = {
  perfect: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  good: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  poor: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  holiday: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  weekend: { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' },
  'no-data': { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' },
};
