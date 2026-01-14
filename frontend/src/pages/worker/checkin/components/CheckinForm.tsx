/**
 * CheckinForm Component
 *
 * The main check-in form for submitting daily readiness.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smile,
  Frown,
  Meh,
  Brain,
  Moon,
  Heart,
  Send,
  PartyPopper,
} from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Slider } from '../../../../components/ui/Slider';
import { useToast } from '../../../../components/ui/Toast';
import { checkinService, type CreateCheckinData, type CheckinWithAttendance } from '../../../../services/checkin.service';
import { invalidateRelatedQueries } from '../../../../lib/query-utils';
import { CheckinErrorMessage } from './CheckinErrorMessage';
import { LowScoreReasonModal } from './LowScoreReasonModal';
import { formatExceptionType } from '../utils';

interface LeaveStatus {
  isReturning?: boolean;
  lastException?: {
    id: string;
    type: string;
  };
}

interface CheckinFormProps {
  leaveStatus?: LeaveStatus | null;
}

export function CheckinForm({ leaveStatus }: CheckinFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = useState<CreateCheckinData>({
    mood: 7,
    stress: 3,
    sleep: 7,
    physicalHealth: 7,
    notes: '',
  });

  // Low score reason modal state
  const [showLowScoreModal, setShowLowScoreModal] = useState(false);
  const [newCheckinData, setNewCheckinData] = useState<CheckinWithAttendance | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: CreateCheckinData) => checkinService.create(data),
    onSuccess: (data: CheckinWithAttendance) => {
      invalidateRelatedQueries(queryClient, 'checkins');
      const attendanceMsg = data.attendance
        ? ` | Attendance: ${data.attendance.status}${data.attendance.minutesLate > 0 ? ` (${data.attendance.minutesLate} mins late)` : ''}`
        : '';
      toast.success('Check-in Submitted!', `Readiness: ${data.readinessScore}%${attendanceMsg}`);

      // Show low score reason modal for RED or YELLOW status
      if (data.readinessStatus === 'RED' || data.readinessStatus === 'YELLOW') {
        setNewCheckinData(data);
        setShowLowScoreModal(true);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getMoodIcon = (value: number) => {
    if (value <= 3) return <Frown className="h-6 w-6 text-danger-500" />;
    if (value <= 6) return <Meh className="h-6 w-6 text-warning-500" />;
    return <Smile className="h-6 w-6 text-success-500" />;
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Welcome Back Banner */}
      {leaveStatus?.isReturning && leaveStatus.lastException && (
        <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-success-50 rounded-xl border border-primary-200">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <PartyPopper className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Welcome Back!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Great to see you again after your{' '}
                {formatExceptionType(leaveStatus.lastException.type).toLowerCase()}.
                Your streak has been preserved - let's keep it going!
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {leaveStatus?.isReturning ? 'Welcome Back Check-in' : 'Daily Check-in'}
        </h1>
        <p className="text-gray-500 mt-1">
          {leaveStatus?.isReturning
            ? "Let us know how you're feeling after your time away"
            : 'Take a moment to assess your current readiness status'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Mood */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getMoodIcon(formData.mood)}
                <div>
                  <h3 className="font-medium text-gray-900">Mood</h3>
                  <p className="text-sm text-gray-500">How are you feeling today?</p>
                </div>
              </div>
            </div>
            <Slider
              value={formData.mood}
              onChange={(e) =>
                setFormData({ ...formData, mood: parseInt(e.target.value) })
              }
              min={1}
              max={10}
              colorScale
            />
          </div>

          {/* Stress */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary-500" />
              <div>
                <h3 className="font-medium text-gray-900">Stress Level</h3>
                <p className="text-sm text-gray-500">
                  Rate your current stress (1 = Low, 10 = High)
                </p>
              </div>
            </div>
            <Slider
              value={formData.stress}
              onChange={(e) =>
                setFormData({ ...formData, stress: parseInt(e.target.value) })
              }
              min={1}
              max={10}
            />
          </div>

          {/* Sleep */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Moon className="h-6 w-6 text-primary-500" />
              <div>
                <h3 className="font-medium text-gray-900">Sleep Quality</h3>
                <p className="text-sm text-gray-500">How well did you sleep last night?</p>
              </div>
            </div>
            <Slider
              value={formData.sleep}
              onChange={(e) =>
                setFormData({ ...formData, sleep: parseInt(e.target.value) })
              }
              min={1}
              max={10}
              colorScale
            />
          </div>

          {/* Physical Health */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-primary-500" />
              <div>
                <h3 className="font-medium text-gray-900">Physical Health</h3>
                <p className="text-sm text-gray-500">How is your physical condition?</p>
              </div>
            </div>
            <Slider
              value={formData.physicalHealth}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  physicalHealth: parseInt(e.target.value),
                })
              }
              min={1}
              max={10}
              colorScale
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any concerns or comments..."
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={createMutation.isPending}
            leftIcon={<Send className="h-5 w-5" />}
          >
            Submit Check-in
          </Button>

          {createMutation.isError && (
            <CheckinErrorMessage error={createMutation.error} />
          )}
        </form>
      </Card>

      {/* Low Score Reason Modal */}
      {newCheckinData && (
        <LowScoreReasonModal
          checkinId={newCheckinData.id}
          score={newCheckinData.readinessScore}
          isOpen={showLowScoreModal}
          onClose={() => setShowLowScoreModal(false)}
          onSuccess={() => {
            invalidateRelatedQueries(queryClient, 'checkins');
          }}
        />
      )}
    </div>
  );
}
