/**
 * useMemberMutations Hook
 * Handles transfer, deactivate, and reactivate mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../../../services/user.service';
import { invalidateRelatedQueries } from '../../../../lib/query-utils';

interface UseMemberMutationsOptions {
  /** Called after successful transfer */
  onTransferSuccess?: () => void;
  /** Called on transfer error */
  onTransferError?: (error: Error) => void;
  /** Called after successful deactivate */
  onDeactivateSuccess?: () => void;
  /** Called on deactivate error */
  onDeactivateError?: (error: Error) => void;
  /** Called after successful reactivate */
  onReactivateSuccess?: () => void;
  /** Called on reactivate error */
  onReactivateError?: (error: Error) => void;
}

/**
 * Hook for member mutations (transfer, deactivate, reactivate)
 * Handles query invalidation automatically
 */
export function useMemberMutations(options?: UseMemberMutationsOptions) {
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      userService.update(userId, { teamId }),
    onSuccess: () => {
      // Invalidate all team-related queries
      invalidateRelatedQueries(queryClient, 'teams');
      queryClient.invalidateQueries({ queryKey: ['all-teams-for-transfer'] });
      options?.onTransferSuccess?.();
    },
    onError: (error) => options?.onTransferError?.(error as Error),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => userService.deactivate(userId),
    onSuccess: (_data, userId) => {
      invalidateRelatedQueries(queryClient, 'teams');
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
      options?.onDeactivateSuccess?.();
    },
    onError: (error) => options?.onDeactivateError?.(error as Error),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => userService.reactivate(userId),
    onSuccess: (_data, userId) => {
      invalidateRelatedQueries(queryClient, 'teams');
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
      options?.onReactivateSuccess?.();
    },
    onError: (error) => options?.onReactivateError?.(error as Error),
  });

  return {
    transferMutation,
    deactivateMutation,
    reactivateMutation,
    isLoading:
      transferMutation.isPending ||
      deactivateMutation.isPending ||
      reactivateMutation.isPending,
  };
}
