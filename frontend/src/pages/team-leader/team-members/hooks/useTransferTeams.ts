/**
 * useTransferTeams Hook
 * Lazy loads teams for transfer modal
 */

import { useQuery } from '@tanstack/react-query';
import { teamService, type TeamWithStats } from '../../../../services/team.service';

interface UseTransferTeamsOptions {
  /** Only fetch when modal is open */
  enabled: boolean;
  /** Exclude current team from list */
  excludeTeamId?: string;
}

interface UseTransferTeamsReturn {
  teams: TeamWithStats[];
  isLoading: boolean;
}

/**
 * Hook to fetch teams for transfer modal
 * Only fetches when enabled (modal is open)
 */
export function useTransferTeams({
  enabled,
  excludeTeamId,
}: UseTransferTeamsOptions): UseTransferTeamsReturn {
  const { data, isLoading } = useQuery({
    queryKey: ['all-teams-for-transfer'],
    queryFn: () => teamService.getAll({ forTransfer: true }),
    enabled,
  });

  const allTeams: TeamWithStats[] = data?.data || [];
  const filteredTeams = excludeTeamId
    ? allTeams.filter((t) => t.id !== excludeTeamId)
    : allTeams;

  return {
    teams: filteredTeams,
    isLoading,
  };
}
