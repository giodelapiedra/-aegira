/**
 * Stats Hook
 * Lightweight stats-only fetch for fast initial page load
 */

import { useQuery } from '@tanstack/react-query';
import { getStats, type StatsResponse } from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-stats';
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

interface UseStatsOptions {
  teamId?: string;
  enabled?: boolean;
}

export function useDailyMonitoringStats(options: UseStatsOptions = {}) {
  const { teamId, enabled = true } = options;

  return useQuery<StatsResponse>({
    queryKey: [QUERY_KEY, teamId],
    queryFn: () => getStats(teamId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export { QUERY_KEY as STATS_QUERY_KEY };
