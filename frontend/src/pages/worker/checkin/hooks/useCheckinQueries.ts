/**
 * useCheckinQueries Hook
 *
 * Centralized React Query hooks for check-in page data fetching.
 * Uses standardized query keys for cache consistency.
 */

import { useQuery } from '@tanstack/react-query';
import { authService } from '../../../../services/auth.service';
import { checkinService } from '../../../../services/checkin.service';
import { teamService } from '../../../../services/team.service';
import {
  hasExemptionForCheckin,
  getMyPendingExemption,
} from '../../../../services/exemption.service';

export function useCheckinQueries(options?: {
  todayCheckinId?: string;
  todayCheckinStatus?: string;
}) {
  const { todayCheckinId, todayCheckinStatus } = options || {};

  // Fetch fresh user data
  const currentUser = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => authService.getMe(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  // Fetch team info for shift times (standardized query key)
  const team = useQuery({
    queryKey: ['team', 'my'],
    queryFn: () => teamService.getMyTeam(),
    enabled: !!currentUser.data?.teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch leave status
  const leaveStatus = useQuery({
    queryKey: ['leave-status'],
    queryFn: () => checkinService.getLeaveStatus(),
    enabled:
      !!currentUser.data?.teamId &&
      (currentUser.data?.role === 'MEMBER' || currentUser.data?.role === 'WORKER'),
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch today's check-in
  const todayCheckin = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
    enabled: !!currentUser.data?.teamId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch recent check-ins
  const recentCheckins = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 5 }),
    enabled: !!currentUser.data?.teamId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch week stats (only after today's check-in)
  const weekStats = useQuery({
    queryKey: ['checkins', 'week-stats'],
    queryFn: () => checkinService.getWeekStats(),
    enabled: !!currentUser.data?.teamId && !!todayCheckin.data,
    staleTime: 60 * 1000, // 1 minute
  });

  // Check for existing exemption (RED status only)
  const exemptionStatus = useQuery({
    queryKey: ['exemption-status', todayCheckinId],
    queryFn: () => hasExemptionForCheckin(todayCheckinId!),
    enabled: !!todayCheckinId && todayCheckinStatus === 'RED',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check for pending exemption (RED status only)
  const pendingExemption = useQuery({
    queryKey: ['my-pending-exemption'],
    queryFn: () => getMyPendingExemption(),
    enabled: !!todayCheckinId && todayCheckinStatus === 'RED',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    currentUser,
    team,
    leaveStatus,
    todayCheckin,
    recentCheckins,
    weekStats,
    exemptionStatus,
    pendingExemption,
    isLoading:
      currentUser.isLoading ||
      team.isLoading ||
      leaveStatus.isLoading ||
      todayCheckin.isLoading,
  };
}
