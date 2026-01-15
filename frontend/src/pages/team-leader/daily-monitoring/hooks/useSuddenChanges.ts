/**
 * Sudden Changes Hook
 * Paginated sudden changes (score drops) with summary
 */

import { useQuery } from '@tanstack/react-query';
import {
  getSuddenChangesPaginated,
  type SeverityLevel,
  type SuddenChangesPaginatedResponse,
} from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-sudden-changes';
const PAGE_SIZE = 20;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes - data considered fresh

interface UseSuddenChangesOptions {
  teamId?: string;
  minDrop?: number;
  severity?: SeverityLevel;
  page?: number;
  enabled?: boolean;
}

export function useSuddenChanges(options: UseSuddenChangesOptions = {}) {
  const { teamId, minDrop, severity, page = 1, enabled = true } = options;

  return useQuery<SuddenChangesPaginatedResponse>({
    queryKey: [QUERY_KEY, teamId, minDrop, severity, page],
    queryFn: () =>
      getSuddenChangesPaginated({
        teamId,
        minDrop,
        severity,
        page,
        limit: PAGE_SIZE,
      }),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    enabled,
  });
}

export { QUERY_KEY as SUDDEN_CHANGES_QUERY_KEY };
