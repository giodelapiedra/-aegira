/**
 * Not Checked In Hook
 * Paginated members who haven't checked in today
 */

import { useQuery } from '@tanstack/react-query';
import {
  getNotCheckedInPaginated,
  type NotCheckedInPaginatedResponse,
} from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-not-checked-in';
const PAGE_SIZE = 50;
const REFETCH_INTERVAL = 60000; // 1 minute

interface UseNotCheckedInOptions {
  teamId?: string;
  search?: string;
  page?: number;
  enabled?: boolean;
}

export function useNotCheckedIn(options: UseNotCheckedInOptions = {}) {
  const { teamId, search, page = 1, enabled = true } = options;

  return useQuery<NotCheckedInPaginatedResponse>({
    queryKey: [QUERY_KEY, teamId, search, page],
    queryFn: () =>
      getNotCheckedInPaginated({
        teamId,
        search,
        page,
        limit: PAGE_SIZE,
      }),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
    enabled,
  });
}

export { QUERY_KEY as NOT_CHECKED_IN_QUERY_KEY };
