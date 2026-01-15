/**
 * Check-ins Hook
 * Paginated check-ins with search and filter support
 */

import { useQuery } from '@tanstack/react-query';
import {
  getCheckinsPaginated,
  type ReadinessStatus,
  type CheckinsPaginatedResponse,
} from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-checkins';
const PAGE_SIZE = 50;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

interface UseCheckinsOptions {
  teamId?: string;
  search?: string;
  status?: ReadinessStatus;
  page?: number;
  enabled?: boolean;
}

export function useCheckinsPaginated(options: UseCheckinsOptions = {}) {
  const { teamId, search, status, page = 1, enabled = true } = options;

  return useQuery<CheckinsPaginatedResponse>({
    queryKey: [QUERY_KEY, teamId, search, status, page],
    queryFn: () =>
      getCheckinsPaginated({
        teamId,
        search,
        status,
        page,
        limit: PAGE_SIZE,
      }),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export { QUERY_KEY as CHECKINS_QUERY_KEY };
