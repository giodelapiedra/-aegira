/**
 * LowScoreReasonModal Component
 *
 * Modal for workers to provide a reason for their low (YELLOW/RED) check-in score.
 * This is a blocking modal - must submit to continue.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../../components/ui/Toast';
import { Button } from '../../../../components/ui/Button';
import {
  checkinService,
  LOW_SCORE_REASONS,
  type LowScoreReason,
} from '../../../../services/checkin.service';

interface LowScoreReasonModalProps {
  checkinId: string;
  score: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LowScoreReasonModal({
  checkinId,
  score,
  isOpen,
  onClose,
  onSuccess,
}: LowScoreReasonModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState<LowScoreReason>('POOR_SLEEP');
  const [details, setDetails] = useState('');

  const updateMutation = useMutation({
    mutationFn: () =>
      checkinService.updateLowScoreReason(checkinId, {
        reason,
        details: reason === 'OTHER' ? details : undefined,
      }),
    onSuccess: () => {
      toast.success('Thank You', 'Your response has been recorded.');
      onSuccess();
      onClose();
    },
    onError: () => {
      toast.error('Error', 'Failed to save your response. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason === 'OTHER' && !details.trim()) {
      toast.error('Details Required', 'Please provide details for "Other" reason.');
      return;
    }
    updateMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - no click to close, must submit */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-warning-500 to-warning-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Low Check-in Score</h3>
              <p className="text-sm text-white/80">Score: {score}%</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-4 bg-warning-50 rounded-lg border border-warning-100">
            <p className="text-sm text-warning-700">
              Your check-in score is below the healthy threshold. Please let us know the main
              reason so we can better support you.
            </p>
          </div>

          {/* Reason Select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              What's the main reason? <span className="text-danger-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as LowScoreReason)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {LOW_SCORE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Details for Other */}
          {reason === 'OTHER' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Please specify <span className="text-danger-500">*</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder="Please describe the reason..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                required
              />
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={updateMutation.isPending}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
