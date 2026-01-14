/**
 * useTeamMembers Hook
 * Fetches team data with members
 * Supports both server-side and client-side pagination
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamService, type TeamDetails, type TeamMemberWithStats } from '../../../../services/team.service';

interface UseTeamMembersOptions {
  /** If provided, fetch specific team; else fetch my-team */
  teamId?: string;
  /** Control when to fetch */
  enabled?: boolean;
  /** Current page (1-indexed) for client-side pagination */
  page?: number;
  /** Items per page for client-side pagination */
  limit?: number;
}

interface UseTeamMembersReturn {
  team: TeamDetails | undefined;
  /** All members (unfiltered) */
  allMembers: TeamMemberWithStats[];
  /** Paginated members (if pagination enabled) */
  members: TeamMemberWithStats[];
  /** Total member count */
  totalMembers: number;
  /** Total pages (for pagination) */
  totalPages: number;
  /** Current page */
  currentPage: number;
  /** Items per page */
  pageSize: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch team members with optional client-side pagination
 * - If teamId is provided, fetches that specific team
 * - If no teamId, fetches the current user's team (my-team)
 * - Supports client-side pagination via page/limit params
 */
export function useTeamMembers(options?: UseTeamMembersOptions): UseTeamMembersReturn {
  const { teamId, enabled = true, page = 1, limit = 0 } = options || {};

  const {
    data: team,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: teamId ? ['team', teamId] : ['my-team'],
    queryFn: () => teamId
      ? teamService.getById(teamId)
      : teamService.getMyTeam(),
    enabled,
  });

  // Memoized pagination calculation
  const paginationResult = useMemo(() => {
    const allMembers = team?.members || [];
    const totalMembers = allMembers.length;

    // If limit is 0 or not set, return all members (no pagination)
    if (limit <= 0) {
      return {
        allMembers,
        members: allMembers,
        totalMembers,
        totalPages: 1,
        currentPage: 1,
        pageSize: totalMembers,
      };
    }

    // Client-side pagination
    const totalPages = Math.ceil(totalMembers / limit);
    const safePage = Math.max(1, Math.min(page, totalPages || 1));
    const startIndex = (safePage - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMembers = allMembers.slice(startIndex, endIndex);

    return {
      allMembers,
      members: paginatedMembers,
      totalMembers,
      totalPages,
      currentPage: safePage,
      pageSize: limit,
    };
  }, [team?.members, page, limit]);

  return {
    team,
    ...paginationResult,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
