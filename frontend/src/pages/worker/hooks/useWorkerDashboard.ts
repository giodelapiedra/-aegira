/**
 * useWorkerDashboard Hook
 *
 * Consolidated React Query hook for worker dashboard data.
 * Replaces multiple separate queries with a single optimized request.
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useWorkerDashboard();
 *
 * // Access data
 * const user = data?.user;
 * const team = data?.team;
 * const todayCheckin = data?.todayCheckin;
 * ```
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workerService } from '../../../services/worker.service';
import type { WorkerDashboardResponse } from '../../../types/worker';

// Query key for cache management
export const WORKER_DASHBOARD_KEY = ['worker', 'dashboard'] as const;

/**
 * Main hook for fetching consolidated worker dashboard data
 */
export function useWorkerDashboard() {
  return useQuery({
    queryKey: WORKER_DASHBOARD_KEY,
    queryFn: () => workerService.getDashboard(),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to invalidate worker dashboard cache
 * Use this after actions that modify dashboard data (e.g., check-in submission)
 */
export function useInvalidateWorkerDashboard() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: WORKER_DASHBOARD_KEY });

    // Also invalidate related queries for backwards compatibility
    queryClient.invalidateQueries({ queryKey: ['checkin', 'today'] });
    queryClient.invalidateQueries({ queryKey: ['checkins', 'week-stats'] });
    queryClient.invalidateQueries({ queryKey: ['checkins', 'recent'] });
    queryClient.invalidateQueries({ queryKey: ['leave-status'] });
  };
}

/**
 * Helper to extract commonly used values from dashboard data
 */
export function useDashboardHelpers(data: WorkerDashboardResponse | undefined) {
  if (!data) {
    return {
      hasTeam: false,
      hasCheckedInToday: false,
      canCheckIn: false,
      isOnLeave: false,
      isReturning: false,
      isBeforeStart: false,
      isHoliday: false,
      isWorkDay: false,
      isRedStatus: false,
    };
  }

  const hasTeam = !!data.team;
  const hasCheckedInToday = !!data.todayCheckin;
  const isOnLeave = data.leaveStatus.isOnLeave;
  const isReturning = data.leaveStatus.isReturning;
  const isBeforeStart = data.leaveStatus.isBeforeStart;
  const isHoliday = data.isHoliday;
  const isWorkDay = data.isWorkDay;
  const isRedStatus = data.todayCheckin?.readinessStatus === 'RED';

  // Can check in if:
  // - Has team
  // - Not already checked in
  // - Not on leave
  // - Not before start date
  // - Not holiday
  // - Is a work day
  const canCheckIn =
    hasTeam && !hasCheckedInToday && !isOnLeave && !isBeforeStart && !isHoliday && isWorkDay;

  return {
    hasTeam,
    hasCheckedInToday,
    canCheckIn,
    isOnLeave,
    isReturning,
    isBeforeStart,
    isHoliday,
    isWorkDay,
    isRedStatus,
  };
}
