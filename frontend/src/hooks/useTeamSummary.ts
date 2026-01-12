/**
 * Custom hook for fetching team summary data from DailyTeamSummary
 *
 * Provides pre-computed daily statistics for fast analytics queries.
 */

import { useQuery } from '@tanstack/react-query';
import { teamService } from '../services/team.service';
import type { WeeklySummaryResponse, TeamDailyStats } from '../types/summary';

interface UseTeamSummaryOptions {
  teamId: string | undefined;
  days?: number;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

/**
 * Fetch team summary for a date range
 * Default: last 7 days
 */
export function useTeamSummary({
  teamId,
  days = 7,
  startDate,
  endDate,
  enabled = true,
}: UseTeamSummaryOptions) {
  return useQuery<WeeklySummaryResponse>({
    queryKey: ['team-summary', teamId, { days, startDate, endDate }],
    queryFn: () => teamService.getTeamSummary(teamId!, { days, startDate, endDate }),
    enabled: enabled && !!teamId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch today's stats for a team
 */
export function useTeamDailyStats(teamId: string | undefined, enabled = true) {
  return useQuery<TeamDailyStats>({
    queryKey: ['team-daily-stats', teamId],
    queryFn: () => teamService.getTeamDailyStats(teamId!),
    enabled: enabled && !!teamId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Preset periods for quick selection
 */
export const SUMMARY_PERIODS = {
  '7d': { days: 7, label: 'Last 7 Days' },
  '14d': { days: 14, label: 'Last 14 Days' },
  '30d': { days: 30, label: 'Last 30 Days' },
} as const;

export type SummaryPeriod = keyof typeof SUMMARY_PERIODS;
