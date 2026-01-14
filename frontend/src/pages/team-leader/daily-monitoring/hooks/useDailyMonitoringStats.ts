/**
 * Stats Hook
 * Lightweight stats-only fetch for fast initial page load
 */

import { useQuery } from '@tanstack/react-query';
import { getStats, type StatsResponse } from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-stats';
const REFETCH_INTERVAL = 60000; // 1 minute

interface UseStatsOptions {
  teamId?: string;
  enabled?: boolean;
}

export function useDailyMonitoringStats(options: UseStatsOptions = {}) {
  const { teamId, enabled = true } = options;

  return useQuery<StatsResponse>({
    queryKey: [QUERY_KEY, teamId],
    queryFn: () => getStats(teamId),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    enabled,
  });
}

export { QUERY_KEY as STATS_QUERY_KEY };
