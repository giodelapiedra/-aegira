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
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

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
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export { QUERY_KEY as NOT_CHECKED_IN_QUERY_KEY };
