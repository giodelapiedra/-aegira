/**
 * Exemptions Hook
 * Paginated exemptions (pending + active)
 *
 * IMPORTANT: Only APPROVED exemptions affect "on leave" calculations.
 * PENDING exemptions are just requests awaiting review.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getExemptionsPaginated,
  type ExemptionsPaginatedResponse,
} from '../../../../services/daily-monitoring.service';

const QUERY_KEY = 'daily-monitoring-exemptions';
const PAGE_SIZE = 20;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

type ExemptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'active';

interface UseExemptionsOptions {
  teamId?: string;
  status?: ExemptionStatus;
  search?: string;
  page?: number;
  enabled?: boolean;
}

export function useExemptions(options: UseExemptionsOptions = {}) {
  const { teamId, status, search, page = 1, enabled = true } = options;

  return useQuery<ExemptionsPaginatedResponse>({
    queryKey: [QUERY_KEY, teamId, status, search, page],
    queryFn: () =>
      getExemptionsPaginated({
        teamId,
        status,
        search,
        page,
        limit: PAGE_SIZE,
      }),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export { QUERY_KEY as EXEMPTIONS_QUERY_KEY };
