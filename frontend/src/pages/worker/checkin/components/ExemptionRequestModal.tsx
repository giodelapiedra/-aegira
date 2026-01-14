/**
 * ExemptionRequestModal Component
 *
 * Modal for workers to request exemption when they have a critical (RED) check-in score.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldAlert, X, FileText } from 'lucide-react';
import { useToast } from '../../../../components/ui/Toast';
import { Button } from '../../../../components/ui/Button';
import { createExemption, type ExceptionType } from '../../../../services/exemption.service';
import type { AxiosError } from 'axios';

interface ExemptionRequestModalProps {
  checkinId: string;
  score: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const exceptionTypes: { value: ExceptionType; label: string }[] = [
  { value: 'SICK_LEAVE', label: 'Sick Leave' },
  { value: 'PERSONAL_LEAVE', label: 'Personal Leave' },
  { value: 'MEDICAL_APPOINTMENT', label: 'Medical Appointment' },
  { value: 'FAMILY_EMERGENCY', label: 'Family Emergency' },
  { value: 'OTHER', label: 'Other' },
];

export function ExemptionRequestModal({
  checkinId,
  score,
  isOpen,
  onClose,
  onSuccess,
}: ExemptionRequestModalProps) {
  const toast = useToast();
  const [type, setType] = useState<ExceptionType>('SICK_LEAVE');
  const [reason, setReason] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createExemption({
        type,
        reason,
        checkinId,
      }),
    onSuccess: () => {
      toast.success(
        'Exemption Request Submitted',
        'Your team leader will review your request and set a return date.'
      );
      onSuccess();
      onClose();
    },
    onError: (error: AxiosError<{ error: string }>) => {
      const message = error.response?.data?.error || 'Failed to submit exemption request';
      toast.error('Request Failed', message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Reason Required', 'Please provide a reason for your exemption request.');
      return;
    }
    createMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-danger-500 to-danger-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Request Exemption</h3>
                <p className="text-sm text-white/80">Score: {score}% (Critical)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-4 bg-danger-50 rounded-lg border border-danger-100">
            <p className="text-sm text-danger-700">
              Your check-in indicates you may not be fit for duty today. Submit an exemption
              request and your team leader will review it and set a return-to-work date.
            </p>
          </div>

          {/* Type Select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Exemption Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExceptionType)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {exceptionTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Reason <span className="text-danger-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Please describe why you need an exemption..."
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              required
            />
            <p className="text-xs text-gray-500">
              Your team leader will set the return date after reviewing your request.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={createMutation.isPending}
              leftIcon={<FileText className="h-4 w-4" />}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
