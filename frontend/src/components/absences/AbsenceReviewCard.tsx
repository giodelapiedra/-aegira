import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { absenceService } from '../../services/absence.service';
import type { AbsenceWithUser, AbsenceReason } from '../../types/absence';
import { ABSENCE_REASON_LABELS } from '../../types/absence';

interface AbsenceReviewCardProps {
  absence: AbsenceWithUser;
}

const REASON_ICONS: Record<AbsenceReason, string> = {
  SICK: '🤒',
  EMERGENCY: '🚨',
  PERSONAL: '👤',
  FORGOT_CHECKIN: '🤔',
  TECHNICAL_ISSUE: '💻',
  OTHER: '📝',
};

const REASON_COLORS: Record<AbsenceReason, { bg: string; text: string; border: string }> = {
  SICK: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  EMERGENCY: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  PERSONAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  FORGOT_CHECKIN: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  TECHNICAL_ISSUE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  OTHER: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function AbsenceReviewCard({ absence }: AbsenceReviewCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState('');

  const reviewMutation = useMutation({
    mutationFn: (action: 'EXCUSED' | 'UNEXCUSED') =>
      absenceService.review(absence.id, { action, notes: notes.trim() || undefined }),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['absences', 'team-pending'] });
      queryClient.invalidateQueries({ queryKey: ['absences', 'stats'] });
      if (action === 'EXCUSED') {
        toast.success(
          'Absence Excused',
          `${absence.user.firstName}'s absence has been excused. No penalty applied.`
        );
      } else {
        toast.success(
          'Absence Marked Unexcused',
          `${absence.user.firstName}'s absence has been marked as unexcused.`
        );
      }
    },
    onError: () => {
      toast.error('Review Failed', 'Failed to submit review. Please try again.');
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatJustifiedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleExcuse = () => {
    reviewMutation.mutate('EXCUSED');
  };

  const handleUnexcused = () => {
    if (!showNotesInput) {
      setShowNotesInput(true);
      return;
    }
    reviewMutation.mutate('UNEXCUSED');
  };

  const handleCancelNotes = () => {
    setShowNotesInput(false);
    setNotes('');
  };

  const reasonCategory = absence.reasonCategory as AbsenceReason | null;
  const reasonLabel = reasonCategory
    ? ABSENCE_REASON_LABELS[reasonCategory]
    : 'Not specified';
  const reasonIcon = reasonCategory ? REASON_ICONS[reasonCategory] : '❓';
  const reasonColors = reasonCategory
    ? REASON_COLORS[reasonCategory]
    : { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

  const fullName = `${absence.user.firstName} ${absence.user.lastName}`;
  const initials = getInitials(absence.user.firstName, absence.user.lastName);
  const avatarColor = getAvatarColor(fullName);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {absence.user.avatar ? (
            <img
              src={absence.user.avatar}
              alt={fullName}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
            />
          ) : (
            <div
              className={`h-12 w-12 rounded-full ${avatarColor} flex items-center justify-center ring-2 ring-white shadow`}
            >
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{fullName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600">{formatFullDate(absence.absenceDate)}</span>
            </div>
          </div>

          {/* Submitted time badge */}
          {absence.justifiedAt && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">
                {formatJustifiedAt(absence.justifiedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Reason badge */}
        <div className="mb-3">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${reasonColors.bg} ${reasonColors.border} border`}
          >
            <span className="text-base">{reasonIcon}</span>
            <span className={`text-sm font-medium ${reasonColors.text}`}>{reasonLabel}</span>
          </div>
        </div>

        {/* Explanation */}
        {absence.explanation && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">"{absence.explanation}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes input for unexcused */}
      {showNotesInput && (
        <div className="px-4 pb-4">
          <div className="bg-danger-50 rounded-lg p-3 border border-danger-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-danger-800 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Add a note (optional)
              </label>
              <button
                onClick={handleCancelNotes}
                className="p-1 rounded-full hover:bg-danger-100 transition-colors"
                title="Cancel"
              >
                <X className="h-4 w-4 text-danger-600" />
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this absence is unexcused..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-danger-200 rounded-lg bg-white focus:ring-2 focus:ring-danger-500 focus:border-danger-500 resize-none"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {reviewMutation.isError && (
        <div className="px-4 pb-4">
          <div className="p-2.5 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            Failed to submit review. Please try again.
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <Button
            variant="success"
            size="sm"
            className="flex-1 shadow-sm hover:shadow transition-shadow"
            onClick={handleExcuse}
            isLoading={reviewMutation.isPending && reviewMutation.variables === 'EXCUSED'}
            disabled={reviewMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Excuse
          </Button>
          <Button
            variant={showNotesInput ? 'danger' : 'ghost'}
            size="sm"
            className={`flex-1 ${
              showNotesInput
                ? 'shadow-sm hover:shadow'
                : 'border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            } transition-all`}
            onClick={handleUnexcused}
            isLoading={reviewMutation.isPending && reviewMutation.variables === 'UNEXCUSED'}
            disabled={reviewMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            {showNotesInput ? 'Confirm Unexcused' : 'Unexcused'}
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-500 text-center mt-2">
          {showNotesInput
            ? 'Worker will receive 0 points for this day'
            : 'Excused = No penalty • Unexcused = 0 points'}
        </p>
      </div>
    </div>
  );
}
