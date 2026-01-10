import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Calendar, Check, FileText, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { absenceService } from '../../services/absence.service';
import type { Absence, AbsenceReason, JustificationInput } from '../../types/absence';
import { ABSENCE_REASON_LABELS } from '../../types/absence';

interface AbsenceJustificationModalProps {
  absences: Absence[];
  onComplete: () => void;
}

interface JustificationFormData {
  reasonCategory: AbsenceReason | '';
  explanation: string;
}

const REASON_ICONS: Record<AbsenceReason, string> = {
  SICK: '🤒',
  EMERGENCY: '🚨',
  PERSONAL: '👤',
  FORGOT_CHECKIN: '🤔',
  TECHNICAL_ISSUE: '💻',
  OTHER: '📝',
};

export function AbsenceJustificationModal({ absences, onComplete }: AbsenceJustificationModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [useSameReason, setUseSameReason] = useState(absences.length > 1);
  const [sharedForm, setSharedForm] = useState<JustificationFormData>({
    reasonCategory: '',
    explanation: '',
  });
  const [individualForms, setIndividualForms] = useState<Record<string, JustificationFormData>>(
    absences.reduce((acc, absence) => {
      acc[absence.id] = { reasonCategory: '', explanation: '' };
      return acc;
    }, {} as Record<string, JustificationFormData>)
  );

  const justifyMutation = useMutation({
    mutationFn: absenceService.justify,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success(
        'Justification Submitted',
        `Your ${data.count > 1 ? `${data.count} absence justifications have` : 'absence justification has'} been submitted for review.`
      );
      onComplete();
    },
    onError: () => {
      toast.error('Submission Failed', 'Failed to submit justification. Please try again.');
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

  const handleSharedFormChange = (field: keyof JustificationFormData, value: string) => {
    setSharedForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleIndividualFormChange = (
    absenceId: string,
    field: keyof JustificationFormData,
    value: string
  ) => {
    setIndividualForms((prev) => ({
      ...prev,
      [absenceId]: { ...prev[absenceId], [field]: value },
    }));
  };

  // Calculate completion progress
  const completionProgress = useMemo(() => {
    if (useSameReason) {
      const reasonFilled = sharedForm.reasonCategory ? 1 : 0;
      const explanationFilled = sharedForm.explanation.trim().length > 0 ? 1 : 0;
      return Math.round(((reasonFilled + explanationFilled) / 2) * 100);
    }
    let totalFields = absences.length * 2;
    let filledFields = 0;
    absences.forEach((absence) => {
      const form = individualForms[absence.id];
      if (form?.reasonCategory) filledFields++;
      if (form?.explanation.trim().length > 0) filledFields++;
    });
    return Math.round((filledFields / totalFields) * 100);
  }, [useSameReason, sharedForm, individualForms, absences]);

  const isFormValid = () => {
    if (useSameReason) {
      return sharedForm.reasonCategory && sharedForm.explanation.trim().length >= 10;
    }
    return absences.every((absence) => {
      const form = individualForms[absence.id];
      return form?.reasonCategory && form?.explanation.trim().length >= 10;
    });
  };

  const handleSubmit = () => {
    const justifications: JustificationInput[] = absences.map((absence) => {
      if (useSameReason) {
        return {
          absenceId: absence.id,
          reasonCategory: sharedForm.reasonCategory as AbsenceReason,
          explanation: sharedForm.explanation,
        };
      }
      const form = individualForms[absence.id];
      return {
        absenceId: absence.id,
        reasonCategory: form.reasonCategory as AbsenceReason,
        explanation: form.explanation,
      };
    });

    justifyMutation.mutate({ justifications });
  };

  const getExplanationLength = (absenceId?: string) => {
    if (useSameReason) {
      return sharedForm.explanation.length;
    }
    return individualForms[absenceId!]?.explanation.length || 0;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header - no close button, blocking modal */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-warning-400 to-warning-600 flex items-center justify-center shadow-lg shadow-warning-200 flex-shrink-0">
              <AlertTriangle className="h-7 w-7 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">Action Required</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning-100 text-warning-800">
                  {absences.length} {absences.length === 1 ? 'absence' : 'absences'}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                You have unexcused absences that need explanation before you can continue using the app.
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">Completion</span>
              <span className={`font-medium ${completionProgress === 100 ? 'text-success-600' : 'text-gray-600'}`}>
                {completionProgress}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  completionProgress === 100 ? 'bg-success-500' : 'bg-primary-500'
                }`}
                style={{ width: `${completionProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Same reason toggle */}
        {absences.length > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useSameReason}
                  onChange={(e) => setUseSameReason(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                Use same reason for all {absences.length} absences
              </span>
            </label>
          </div>
        )}

        {/* Forms - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {useSameReason ? (
            // Shared form for all absences
            <div className="space-y-4">
              {/* Date chips */}
              <div className="flex flex-wrap gap-2">
                {absences.map((absence) => (
                  <div
                    key={absence.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                  >
                    <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    <span className="font-medium text-gray-700">{formatDate(absence.absenceDate)}</span>
                  </div>
                ))}
              </div>

              {/* Reason select */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Reason for absence
                </label>
                <div className="relative">
                  <select
                    value={sharedForm.reasonCategory}
                    onChange={(e) => handleSharedFormChange('reasonCategory', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer text-gray-900 transition-shadow hover:shadow-sm"
                  >
                    <option value="">Select a reason...</option>
                    {Object.entries(ABSENCE_REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {REASON_ICONS[value as AbsenceReason]} {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Explanation textarea */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  Explanation
                </label>
                <textarea
                  value={sharedForm.explanation}
                  onChange={(e) => handleSharedFormChange('explanation', e.target.value)}
                  placeholder="Please provide a detailed explanation for your absence..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-shadow hover:shadow-sm"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className={`text-xs ${getExplanationLength() < 10 ? 'text-warning-600' : 'text-gray-400'}`}>
                    {getExplanationLength() < 10 ? `${10 - getExplanationLength()} more characters needed` : 'Looks good!'}
                  </p>
                  <p className="text-xs text-gray-400">{getExplanationLength()} / 500</p>
                </div>
              </div>
            </div>
          ) : (
            // Individual forms for each absence
            absences.map((absence, index) => (
              <div
                key={absence.id}
                className="bg-gray-50 rounded-xl p-4 border border-gray-100 transition-all hover:border-gray-200"
              >
                {/* Date header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                  <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-gray-700">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{formatFullDate(absence.absenceDate)}</p>
                    <p className="text-xs text-gray-500">Absence #{index + 1} of {absences.length}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Reason select */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      Reason
                    </label>
                    <div className="relative">
                      <select
                        value={individualForms[absence.id]?.reasonCategory || ''}
                        onChange={(e) =>
                          handleIndividualFormChange(absence.id, 'reasonCategory', e.target.value)
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer text-gray-900 text-sm transition-shadow hover:shadow-sm"
                      >
                        <option value="">Select a reason...</option>
                        {Object.entries(ABSENCE_REASON_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {REASON_ICONS[value as AbsenceReason]} {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Explanation textarea */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <MessageSquare className="h-4 w-4 text-gray-400" />
                      Explanation
                    </label>
                    <textarea
                      value={individualForms[absence.id]?.explanation || ''}
                      onChange={(e) =>
                        handleIndividualFormChange(absence.id, 'explanation', e.target.value)
                      }
                      placeholder="Please explain your absence..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm transition-shadow hover:shadow-sm"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${getExplanationLength(absence.id) < 10 ? 'text-warning-600' : 'text-gray-400'}`}>
                        {getExplanationLength(absence.id) < 10 ? `${10 - getExplanationLength(absence.id)} more characters` : ''}
                      </p>
                      <p className="text-xs text-gray-400">{getExplanationLength(absence.id)} / 500</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          {/* Error message */}
          {justifyMutation.isError && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Failed to submit justification. Please try again.
            </div>
          )}

          {/* Submit button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 transition-all"
            onClick={handleSubmit}
            disabled={!isFormValid()}
            isLoading={justifyMutation.isPending}
          >
            <Check className="h-5 w-5 mr-2" />
            Submit {absences.length > 1 ? `${absences.length} Justifications` : 'Justification'}
          </Button>

          <p className="text-xs text-gray-500 text-center mt-3">
            Your justification will be reviewed by your team leader
          </p>
        </div>
      </div>
    </div>
  );
}
