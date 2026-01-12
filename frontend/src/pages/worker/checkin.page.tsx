import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { authService } from '../../services/auth.service';
import {
  checkinService,
  LOW_SCORE_REASONS,
  type LowScoreReason,
  type WeekStats,
} from '../../services/checkin.service';
import {
  createExemption,
  getMyPendingExemption,
  hasExemptionForCheckin,
  getExceptionTypeLabel,
  type ExceptionType,
} from '../../services/exemption.service';
import api from '../../services/api';
import type { CreateCheckinData, LeaveStatus, CheckinWithAttendance } from '../../services/checkin.service';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Slider } from '../../components/ui/Slider';
import { Badge } from '../../components/ui/Badge';
import { formatDisplayDateTime, formatDisplayDate, getNowInTimezone } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import {
  Smile,
  Frown,
  Meh,
  Brain,
  Moon,
  Heart,
  Send,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Users,
  CalendarX,
  Palmtree,
  PartyPopper,
  ShieldAlert,
  FileText,
  X,
  Flame,
  Calendar,
  Target,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

import type { AxiosError } from 'axios';

interface Team {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  workDays: string;
  company?: {
    id: string;
    name: string;
    timezone: string;
  };
}

type CheckinAvailability =
  | { available: true }
  | { available: false; reason: 'NOT_WORK_DAY'; message: string }
  | { available: false; reason: 'TOO_EARLY'; message: string; shiftStart: string }
  | { available: false; reason: 'TOO_LATE'; message: string; shiftEnd: string };

function checkCheckinAvailability(team: Team): CheckinAvailability {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Use company timezone for all calculations (centralized)
  const timezone = team.company?.timezone || 'Asia/Manila';
  const nowInTz = getNowInTimezone(timezone);
  const currentDay = dayNames[nowInTz.dayOfWeek];
  const workDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

  // Check if today is a work day (in company timezone)
  if (!workDays.includes(currentDay)) {
    return {
      available: false,
      reason: 'NOT_WORK_DAY',
      message: `Today (${currentDay}) is not a scheduled work day. Work days: ${workDays.join(', ')}`,
    };
  }

  // Check time (in company timezone)
  const currentTimeMinutes = nowInTz.hour * 60 + nowInTz.minute;

  const [shiftStartHour, shiftStartMin] = team.shiftStart.split(':').map(Number);
  const [shiftEndHour, shiftEndMin] = team.shiftEnd.split(':').map(Number);
  const shiftStartMinutes = shiftStartHour * 60 + shiftStartMin;
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;

  // Allow 30 minutes early check-in
  const gracePeriod = 30;
  const allowedStartMinutes = shiftStartMinutes - gracePeriod;

  if (currentTimeMinutes < allowedStartMinutes) {
    return {
      available: false,
      reason: 'TOO_EARLY',
      message: `Check-in is not yet available. You can check in starting ${gracePeriod} minutes before your shift.`,
      shiftStart: team.shiftStart,
    };
  }

  if (currentTimeMinutes > shiftEndMinutes) {
    return {
      available: false,
      reason: 'TOO_LATE',
      message: `Check-in time has ended. Your shift ended at ${team.shiftEnd}.`,
      shiftEnd: team.shiftEnd,
    };
  }

  return { available: true };
}

interface CheckinError {
  error: string;
  code?: 'NO_TEAM' | 'NOT_WORK_DAY' | 'TOO_EARLY' | 'TOO_LATE' | 'ALREADY_CHECKED_IN' | 'NOT_MEMBER_ROLE' | 'ON_LEAVE';
}

function formatExceptionType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// EXEMPTION REQUEST MODAL
// ============================================

interface ExemptionRequestModalProps {
  checkinId: string;
  score: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ExemptionRequestModal({
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

  const exceptionTypes: { value: ExceptionType; label: string }[] = [
    { value: 'SICK_LEAVE', label: 'Sick Leave' },
    { value: 'PERSONAL_LEAVE', label: 'Personal Leave' },
    { value: 'MEDICAL_APPOINTMENT', label: 'Medical Appointment' },
    { value: 'FAMILY_EMERGENCY', label: 'Family Emergency' },
    { value: 'OTHER', label: 'Other' },
  ];

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

// ============================================
// LOW SCORE REASON MODAL
// ============================================

interface LowScoreReasonModalProps {
  checkinId: string;
  score: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function LowScoreReasonModal({
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

// ============================================
// CHECK-IN ERROR MESSAGE
// ============================================

function CheckinErrorMessage({ error }: { error: unknown }) {
  // Extract error data from axios error response
  let errorData: CheckinError | null = null;

  // Type-safe extraction of axios error response
  const axiosError = error as AxiosError<CheckinError>;
  if (axiosError?.response?.data) {
    errorData = axiosError.response.data;
  }

  const code = errorData?.code;
  const message = errorData?.error || 'Failed to submit check-in. Please try again.';

  const getIcon = () => {
    switch (code) {
      case 'NO_TEAM':
        return <Users className="h-5 w-5 text-danger-500" />;
      case 'NOT_MEMBER_ROLE':
        return <CheckCircle2 className="h-5 w-5 text-primary-500" />;
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return <CalendarX className="h-5 w-5 text-warning-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-danger-500" />;
    }
  };

  const getBgColor = () => {
    switch (code) {
      case 'NO_TEAM':
        return 'bg-danger-50 border-danger-200';
      case 'NOT_MEMBER_ROLE':
        return 'bg-primary-50 border-primary-200';
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return 'bg-warning-50 border-warning-200';
      default:
        return 'bg-danger-50 border-danger-200';
    }
  };

  const getTextColor = () => {
    switch (code) {
      case 'NOT_MEMBER_ROLE':
        return 'text-primary-700';
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return 'text-warning-700';
      default:
        return 'text-danger-600';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div>
          <p className={`text-sm font-medium ${getTextColor()}`}>
            {code === 'NO_TEAM' && 'No Team Assigned'}
            {code === 'NOT_MEMBER_ROLE' && 'Check-in Not Required'}
            {code === 'NOT_WORK_DAY' && 'Not a Work Day'}
            {code === 'TOO_EARLY' && 'Too Early to Check In'}
            {code === 'TOO_LATE' && 'Check-in Time Ended'}
            {!code && 'Check-in Failed'}
          </p>
          <p className={`text-sm mt-1 ${getTextColor()}`}>{message}</p>
        </div>
      </div>
    </div>
  );
}

export function CheckinPage() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const toast = useToast();
  const [formData, setFormData] = useState<CreateCheckinData>({
    mood: 7,
    stress: 3,
    sleep: 7,
    physicalHealth: 7,
    notes: '',
  });

  // Exemption modal state
  const [showExemptionModal, setShowExemptionModal] = useState(false);

  // Low score reason modal state
  const [showLowScoreModal, setShowLowScoreModal] = useState(false);
  const [newCheckinData, setNewCheckinData] = useState<CheckinWithAttendance | null>(null);

  // Fetch fresh user data to get current team assignment
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => authService.getMe(),
    staleTime: 30 * 1000, // 30 seconds - user data doesn't change frequently
  });

  // Update auth store when fresh user data is fetched
  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser, setUser]);

  // Fetch team info for shift times
  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get<Team>('/teams/my');
      return response.data;
    },
    enabled: !!currentUser?.teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes - team schedule rarely changes
  });

  // Fetch leave status
  const { data: leaveStatus, isLoading: isLoadingLeave } = useQuery({
    queryKey: ['leave-status'],
    queryFn: () => checkinService.getLeaveStatus(),
    enabled: !!currentUser?.teamId && (currentUser?.role === 'MEMBER' || currentUser?.role === 'WORKER'),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: todayCheckin, isLoading: isLoadingToday, refetch: refetchTodayCheckin } = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
    enabled: !!currentUser?.teamId, // Only fetch if user has a team
    staleTime: 30 * 1000, // 30 seconds
  });

  // Check if RED/YELLOW check-in needs a reason (no lowScoreReason yet)
  const needsLowScoreReason = (todayCheckin?.readinessStatus === 'RED' || todayCheckin?.readinessStatus === 'YELLOW') && !todayCheckin?.lowScoreReason;

  // Check if check-in is available based on team schedule
  const checkinAvailability = team ? checkCheckinAvailability(team) : null;

  const { data: recentCheckins } = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 5 }),
    enabled: !!currentUser?.teamId, // Only fetch if user has a team
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch weekly stats for dashboard
  const { data: weekStats } = useQuery({
    queryKey: ['checkins', 'week-stats'],
    queryFn: () => checkinService.getWeekStats(),
    enabled: !!currentUser?.teamId && !!todayCheckin, // Only fetch if checked in today
    staleTime: 60 * 1000, // 1 minute
  });

  // Check if exemption already exists for today's check-in
  const { data: exemptionStatus, refetch: refetchExemptionStatus } = useQuery({
    queryKey: ['exemption-status', todayCheckin?.id],
    queryFn: () => hasExemptionForCheckin(todayCheckin!.id),
    enabled: !!todayCheckin && todayCheckin.readinessStatus === 'RED',
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get user's pending exemption
  const { data: pendingExemption, refetch: refetchPendingExemption } = useQuery({
    queryKey: ['my-pending-exemption'],
    queryFn: () => getMyPendingExemption(),
    enabled: !!todayCheckin && todayCheckin.readinessStatus === 'RED',
    staleTime: 30 * 1000, // 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCheckinData) => checkinService.create(data),
    onSuccess: (data: CheckinWithAttendance) => {
      invalidateRelatedQueries(queryClient, 'checkins');
      const attendanceMsg = data.attendance
        ? ` | Attendance: ${data.attendance.status}${data.attendance.minutesLate > 0 ? ` (${data.attendance.minutesLate} mins late)` : ''}`
        : '';
      toast.success('Check-in Submitted!', `Readiness: ${data.readinessScore}%${attendanceMsg}`);

      // Show low score reason modal for RED or YELLOW status (low scores)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GREEN':
        return <Badge variant="success">Ready for Duty</Badge>;
      case 'YELLOW':
        return <Badge variant="warning">Limited Readiness</Badge>;
      case 'RED':
        return <Badge variant="danger">Not Ready</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  // Loading state
  if (isLoadingUser || isLoadingTeam || isLoadingLeave || (isLoadingToday && currentUser?.teamId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Non-MEMBER/WORKER role - check-in not required (e.g., Team Leads, Supervisors, etc.)
  if (currentUser?.role !== 'MEMBER' && currentUser?.role !== 'WORKER') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Check-in Not Required
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Daily check-in is only required for team members.
                As a {currentUser?.role === 'TEAM_LEAD' ? 'Team Lead' : currentUser?.role?.toLowerCase()},
                you can view your team's check-in status from the dashboard.
              </p>
              <div className="p-4 bg-gray-50 rounded-lg inline-block">
                <p className="text-sm text-gray-600">
                  You can monitor your team members' daily readiness and check-in status
                  from the Team Dashboard.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No team assigned - block access to check-in
  if (!currentUser?.teamId) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning-100 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-warning-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Team Assigned
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You need to be assigned to a team before you can check in.
                Please contact your supervisor or team leader to be added to a team.
              </p>
              <div className="p-4 bg-gray-50 rounded-lg inline-block">
                <p className="text-sm text-gray-600">
                  Once you're assigned to a team, you'll be able to complete your daily check-in
                  during your team's scheduled work hours.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is before their effective start date (just added to team today)
  if (leaveStatus?.isBeforeStart) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                <PartyPopper className="h-8 w-8 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to the Team!
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You've just been added to your team. Your daily check-in will start tomorrow.
                Take today to get familiar with your schedule.
              </p>
              <div className="p-4 bg-primary-50 rounded-lg inline-block text-left">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Check-in starts:</span>{' '}
                    {leaveStatus.effectiveStartDate ? formatDisplayDate(leaveStatus.effectiveStartDate) : 'Tomorrow'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Team:</span> {currentUser?.team?.name || 'Your Team'}
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm text-gray-500">
                We're excited to have you on board!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is on approved leave
  if (leaveStatus?.isOnLeave && leaveStatus.currentException) {
    const exception = leaveStatus.currentException;
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                <Palmtree className="h-8 w-8 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                You're On Approved Leave
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Check-in is not required during your leave period. Take care and rest well!
              </p>
              <div className="p-4 bg-primary-50 rounded-lg inline-block text-left">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{formatExceptionType(exception.type)}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Period:</span>{' '}
                    {formatDisplayDate(exception.startDate)} - {formatDisplayDate(exception.endDate)}
                  </p>
                  {exception.reason && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Reason:</span> {exception.reason}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-6 text-sm text-gray-500">
                Your streak will continue when you return. No worries!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already checked in today - Enhanced Dashboard View
  if (todayCheckin) {
    // Helper to get status color classes
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'GREEN': return 'text-success-600 bg-success-100';
        case 'YELLOW': return 'text-warning-600 bg-warning-100';
        case 'RED': return 'text-danger-600 bg-danger-100';
        default: return 'text-gray-400 bg-gray-100';
      }
    };

    const getStatusBgGradient = (status: string) => {
      switch (status) {
        case 'GREEN': return 'from-success-500 to-success-600';
        case 'YELLOW': return 'from-warning-500 to-warning-600';
        case 'RED': return 'from-danger-500 to-danger-600';
        default: return 'from-gray-500 to-gray-600';
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'GREEN': return 'Ready for Duty';
        case 'YELLOW': return 'Limited Readiness';
        case 'RED': return 'Not Ready';
        default: return 'Unknown';
      }
    };

    // Week days for display (ordered Mon-Sun)
    const weekDaysOrder = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const dayLabels: Record<string, string> = {
      MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S'
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {currentUser?.firstName}!
            </h1>
            <p className="text-gray-500 mt-1">
              {team?.shiftStart} - {team?.shiftEnd} shift
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            {formatDisplayDate(new Date().toISOString())}
          </div>
        </div>

        {/* Main Grid - Today's Status + Week Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Status - Hero Card (2 columns) */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              {/* Gradient Header based on status */}
              <div className={`bg-gradient-to-r ${getStatusBgGradient(todayCheckin.readinessStatus)} px-6 py-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">{todayCheckin.readinessScore}%</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {getStatusLabel(todayCheckin.readinessStatus)}
                      </h2>
                      <p className="text-white/80 text-sm">Today's Status</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Checked in at {formatDisplayDateTime(todayCheckin.createdAt).split(',')[1]?.trim() || formatDisplayDateTime(todayCheckin.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <Smile className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{todayCheckin.mood}</p>
                    <p className="text-xs text-gray-500 font-medium">Mood</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <Brain className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{todayCheckin.stress}</p>
                    <p className="text-xs text-gray-500 font-medium">Stress</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <Moon className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{todayCheckin.sleep}</p>
                    <p className="text-xs text-gray-500 font-medium">Sleep</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <Heart className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{todayCheckin.physicalHealth}</p>
                    <p className="text-xs text-gray-500 font-medium">Physical</p>
                  </div>
                </div>

                {todayCheckin.notes && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600">{todayCheckin.notes}</p>
                  </div>
                )}

                {/* Exemption Request Option for RED status */}
                {todayCheckin.readinessStatus === 'RED' && (
                  <div className="mt-4 p-4 bg-danger-50 rounded-xl border border-danger-100">
                    {exemptionStatus ? (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Exemption Request Pending</p>
                          <p className="text-sm text-gray-600">Your team leader will review your request.</p>
                        </div>
                      </div>
                    ) : pendingExemption ? (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Pending Exemption Request</p>
                          <p className="text-sm text-gray-600">Your team leader will review it soon.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                            <ShieldAlert className="h-5 w-5 text-danger-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Not Fit for Duty?</p>
                            <p className="text-sm text-gray-600">Request an exemption from your team leader.</p>
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowExemptionModal(true)}
                          leftIcon={<FileText className="h-4 w-4" />}
                        >
                          Request
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Week Stats - Sidebar Card */}
          <div className="space-y-4">
            {/* This Week Card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-primary-500" />
                  <h3 className="font-semibold text-gray-900">This Week</h3>
                </div>

                {weekStats ? (
                  <>
                    {/* Week Average */}
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-gray-900">
                        {weekStats.avgScore > 0 ? `${weekStats.avgScore}%` : '--'}
                      </div>
                      <p className="text-sm text-gray-500">
                        {weekStats.totalCheckins}/{weekStats.scheduledDaysSoFar} days
                      </p>
                    </div>

                    {/* Week Progress Bar */}
                    <div className="mb-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            weekStats.avgScore >= 70 ? 'bg-success-500' :
                            weekStats.avgScore >= 50 ? 'bg-warning-500' :
                            weekStats.avgScore > 0 ? 'bg-danger-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${weekStats.avgScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Daily Status Dots */}
                    <div className="flex justify-between">
                      {weekDaysOrder.map((day) => {
                        const dayStatus = weekStats.dailyStatus[day];
                        const isWorkDay = weekStats.workDays.includes(day);
                        const isFutureDay = !dayStatus && isWorkDay;

                        return (
                          <div key={day} className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-400 font-medium">{dayLabels[day]}</span>
                            {dayStatus ? (
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${getStatusColor(dayStatus.status)}`}
                                title={`${day}: ${dayStatus.score}%`}
                              >
                                {dayStatus.score}
                              </div>
                            ) : isWorkDay ? (
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-gray-300" />
                              </div>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center">
                                <span className="text-xs text-gray-300">-</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Loading...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Streak Card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      (weekStats?.currentStreak || 0) >= 7 ? 'bg-orange-100' :
                      (weekStats?.currentStreak || 0) >= 3 ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <Flame className={`h-6 w-6 ${
                        (weekStats?.currentStreak || 0) >= 7 ? 'text-orange-500' :
                        (weekStats?.currentStreak || 0) >= 3 ? 'text-amber-500' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {weekStats?.currentStreak || 0}
                      </p>
                      <p className="text-sm text-gray-500">Day streak</p>
                    </div>
                  </div>
                  {(weekStats?.longestStreak || 0) > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {weekStats?.longestStreak}
                      </p>
                      <p className="text-xs text-gray-400">Best</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Check-ins */}
        {recentCheckins?.data && recentCheckins.data.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-gray-400" />
                Recent Check-ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {recentCheckins.data.slice(1, 5).map((checkin) => (
                  <div
                    key={checkin.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDisplayDate(checkin.createdAt)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDisplayDateTime(checkin.createdAt).split(',')[1]?.trim()}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${getStatusColor(checkin.readinessStatus)}`}>
                      {checkin.readinessScore}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exemption Request Modal */}
        {todayCheckin.readinessStatus === 'RED' && (
          <ExemptionRequestModal
            checkinId={todayCheckin.id}
            score={todayCheckin.readinessScore}
            isOpen={showExemptionModal}
            onClose={() => setShowExemptionModal(false)}
            onSuccess={() => {
              refetchExemptionStatus();
              refetchPendingExemption();
            }}
          />
        )}

        {/* Low Score Reason Modal - persistent until submitted */}
        {needsLowScoreReason && (
          <LowScoreReasonModal
            checkinId={todayCheckin.id}
            score={todayCheckin.readinessScore}
            isOpen={true}
            onClose={() => {}} // Cannot close without submitting
            onSuccess={() => {
              refetchTodayCheckin();
            }}
          />
        )}
      </div>
    );
  }

  // Check-in not available (time restrictions)
  if (checkinAvailability && !checkinAvailability.available) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Daily Check-in</h1>
          <p className="text-gray-500 mt-1">
            Take a moment to assess your current readiness status
          </p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
                checkinAvailability.reason === 'TOO_LATE'
                  ? 'bg-danger-100'
                  : 'bg-warning-100'
              }`}>
                {checkinAvailability.reason === 'TOO_LATE' ? (
                  <Clock className="h-8 w-8 text-danger-600" />
                ) : checkinAvailability.reason === 'TOO_EARLY' ? (
                  <Clock className="h-8 w-8 text-warning-600" />
                ) : (
                  <CalendarX className="h-8 w-8 text-warning-600" />
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {checkinAvailability.reason === 'TOO_LATE' && 'Check-in Time Ended'}
                {checkinAvailability.reason === 'TOO_EARLY' && 'Too Early to Check In'}
                {checkinAvailability.reason === 'NOT_WORK_DAY' && 'Not a Work Day'}
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {checkinAvailability.message}
              </p>
              <div className="p-4 bg-gray-50 rounded-lg inline-block">
                <p className="text-sm text-gray-600">
                  {checkinAvailability.reason === 'TOO_LATE' && (
                    <>Your shift ended at <span className="font-semibold">{checkinAvailability.shiftEnd}</span>. Check-in will be available again on your next work day.</>
                  )}
                  {checkinAvailability.reason === 'TOO_EARLY' && (
                    <>Your shift starts at <span className="font-semibold">{checkinAvailability.shiftStart}</span>. Please come back when your shift begins.</>
                  )}
                  {checkinAvailability.reason === 'NOT_WORK_DAY' && (
                    <>Enjoy your day off! Check-in will be available on your next scheduled work day.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check-in form
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
                Great to see you again after your {formatExceptionType(leaveStatus.lastException.type).toLowerCase()}.
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
