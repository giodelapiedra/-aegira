/**
 * useHomeQueries Hook
 *
 * Centralized React Query hooks for home page data fetching.
 * Uses standardized query keys for cache consistency.
 */

import { useQuery } from '@tanstack/react-query';
import { checkinService } from '../../../../services/checkin.service';
import { teamService } from '../../../../services/team.service';
import { getActiveExemptions } from '../../../../services/exemption.service';
import { absenceService } from '../../../../services/absence.service';

export function useHomeQueries() {
  // Today's check-in
  const todayCheckin = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Recent check-ins (for week calendar)
  const recentCheckins = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 7 }),
    staleTime: 60 * 1000, // 1 minute
  });

  // Team info
  const myTeam = useQuery({
    queryKey: ['team', 'my'],
    queryFn: () => teamService.getMyTeam(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Active exemptions
  const activeExemptions = useQuery({
    queryKey: ['exemptions', 'active'],
    queryFn: () => getActiveExemptions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Absence history (for week calendar)
  const absenceHistory = useQuery({
    queryKey: ['absences', 'my-history'],
    queryFn: () => absenceService.getMyHistory(14), // Last 14 days
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    todayCheckin,
    recentCheckins,
    myTeam,
    activeExemptions,
    absenceHistory,
    isLoading: todayCheckin.isLoading,
  };
}
