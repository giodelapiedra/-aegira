/**
 * Exemption Mutations Hook
 * Handles approve, reject, end early, and create exemption operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveExemption,
  rejectExemption,
  endExemptionEarly,
  createExemptionForWorker,
  type ExceptionType,
} from '../../../../services/exemption.service';
import { STATS_QUERY_KEY } from './useDailyMonitoringStats';
import { CHECKINS_QUERY_KEY } from './useCheckins';
import { EXEMPTIONS_QUERY_KEY } from './useExemptions';
import { NOT_CHECKED_IN_QUERY_KEY } from './useNotCheckedIn';

// Also invalidate the legacy query key for backward compatibility
const LEGACY_QUERY_KEY = 'daily-monitoring';

interface UseExemptionMutationsOptions {
  onApproveSuccess?: () => void;
  onApproveError?: (error: Error) => void;
  onRejectSuccess?: () => void;
  onRejectError?: (error: Error) => void;
  onEndEarlySuccess?: () => void;
  onEndEarlyError?: (error: Error) => void;
  onCreateSuccess?: () => void;
  onCreateError?: (error: Error) => void;
}

export function useExemptionMutations(options: UseExemptionMutationsOptions = {}) {
  const queryClient = useQueryClient();

  // Helper to invalidate all related queries
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [STATS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [CHECKINS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [EXEMPTIONS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [NOT_CHECKED_IN_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [LEGACY_QUERY_KEY] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, endDate, notes }: { id: string; endDate: string; notes?: string }) =>
      approveExemption(id, { endDate, notes }),
    onSuccess: () => {
      invalidateAll();
      options.onApproveSuccess?.();
    },
    onError: (error: Error) => {
      options.onApproveError?.(error);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      rejectExemption(id, { notes }),
    onSuccess: () => {
      invalidateAll();
      options.onRejectSuccess?.();
    },
    onError: (error: Error) => {
      options.onRejectError?.(error);
    },
  });

  const endEarlyMutation = useMutation({
    mutationFn: ({ id, returnDate, notes }: { id: string; returnDate: string; notes?: string }) =>
      endExemptionEarly(id, { returnDate, notes }),
    onSuccess: () => {
      invalidateAll();
      options.onEndEarlySuccess?.();
    },
    onError: (error: Error) => {
      options.onEndEarlyError?.(error);
    },
  });

  const createExemptionMutation = useMutation({
    mutationFn: (params: {
      userId: string;
      type: ExceptionType;
      reason: string;
      endDate: string;
      checkinId?: string;
      notes?: string;
    }) => createExemptionForWorker(params),
    onSuccess: () => {
      invalidateAll();
      options.onCreateSuccess?.();
    },
    onError: (error: Error) => {
      options.onCreateError?.(error);
    },
  });

  return {
    approveMutation,
    rejectMutation,
    endEarlyMutation,
    createExemptionMutation,
    isLoading:
      approveMutation.isPending ||
      rejectMutation.isPending ||
      endEarlyMutation.isPending ||
      createExemptionMutation.isPending,
  };
}
