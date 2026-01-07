/**
 * Daily Monitoring Page
 * Comprehensive daily monitoring dashboard for Team Leaders
 *
 * Features:
 * - Today's check-ins with metrics
 * - Sudden change detection
 * - Pending exemption requests
 * - Active exemptions
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  TrendingDown,
  UserX,
  Calendar,
  RefreshCw,
  ChevronRight,
  X,
  Timer,
  Flame,
  ChevronDown,
  MessageCircle,
  UserMinus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getNowInTimezone, formatLocalDate } from '../../lib/date-utils';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { StatsCard, StatsCardGrid } from '../../components/ui/StatsCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import {
  MetricsRow,
  SuddenChangeCard,
  PendingExemptionCard,
  ActiveExemptionCard,
} from '../../components/monitoring';
import {
  getDailyMonitoring,
  getStatusColor,
  getLowScoreReasonLabel,
  type DailyMonitoringData,
  type TodayCheckin,
} from '../../services/daily-monitoring.service';
import {
  approveExemption,
  rejectExemption,
  endExemptionEarly,
  createExemptionForWorker,
  EXCEPTION_TYPE_OPTIONS,
  type Exemption,
  type ExceptionType,
} from '../../services/exemption.service';

// ============================================
// TYPES
// ============================================

type TabType = 'checkins' | 'changes' | 'exemptions';

// ============================================
// APPROVE MODAL COMPONENT
// ============================================

interface ApproveModalProps {
  exemption: Exemption;
  onClose: () => void;
  onConfirm: (endDate: string, notes?: string) => void;
  isLoading: boolean;
  timezone: string;
}

function ApproveModal({ exemption, onClose, onConfirm, isLoading, timezone }: ApproveModalProps) {
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Default date suggestions using company timezone
  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;

  // Get today's date components in company timezone
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = dateFormatter.formatToParts(today);
  const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);

  // Create date objects using UTC to avoid browser timezone issues
  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  // Format date for input in company timezone (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Approve Exemption</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Worker Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {exemption.user.firstName.charAt(0)}
                {exemption.user.lastName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {exemption.user.firstName} {exemption.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{exemption.reason}</p>
            </div>
          </div>
        </div>

        {/* End Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last day of exemption
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={formatDateForInput(tomorrow)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Quick Date Options */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(tomorrow))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(in3Days))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            In 3 days
          </button>
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(in7Days))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            In 1 week
          </button>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for the worker..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm(endDate, notes || undefined)}
            disabled={!endDate || isLoading}
          >
            {isLoading ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CREATE EXEMPTION MODAL COMPONENT
// ============================================

interface CreateExemptionModalProps {
  checkin: TodayCheckin;
  onClose: () => void;
  onConfirm: (data: {
    type: ExceptionType;
    reason: string;
    endDate: string;
    notes?: string;
  }) => void;
  isLoading: boolean;
  timezone: string;
}

function CreateExemptionModal({ checkin, onClose, onConfirm, isLoading, timezone }: CreateExemptionModalProps) {
  const [type, setType] = useState<ExceptionType>('SICK_LEAVE');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Default date suggestions using company timezone
  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;

  // Get today's date components in company timezone
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = dateFormatter.formatToParts(today);
  const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);

  // Create date objects using UTC to avoid browser timezone issues
  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  // Format date for input in company timezone (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = () => {
    if (!reason.trim()) return;
    if (!endDate) return;
    onConfirm({ type, reason, endDate, notes: notes || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Create Exemption</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Worker Info */}
        <div className="bg-danger-50 rounded-lg p-4 mb-6 border border-danger-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-danger-500 to-danger-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {checkin.user.firstName.charAt(0)}
                {checkin.user.lastName.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {checkin.user.firstName} {checkin.user.lastName}
              </p>
              <p className="text-sm text-danger-600">
                Score: {checkin.readinessScore}%
                {checkin.lowScoreReason && ` - ${getLowScoreReasonLabel(checkin.lowScoreReason)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Exception Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exemption Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ExceptionType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {EXCEPTION_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for creating this exemption..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* End Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last day of exemption <span className="text-danger-500">*</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={formatDateForInput(tomorrow)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Quick Date Options */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(tomorrow))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(in3Days))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            3 days
          </button>
          <button
            type="button"
            onClick={() => setEndDate(formatDateForInput(in7Days))}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            1 week
          </button>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!reason.trim() || !endDate || isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Exemption'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DailyMonitoringPage() {
  const [activeTab, setActiveTab] = useState<TabType>('checkins');
  const [selectedExemption, setSelectedExemption] = useState<Exemption | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedCheckinForExemption, setSelectedCheckinForExemption] = useState<TodayCheckin | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch daily monitoring data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-monitoring'],
    queryFn: () => getDailyMonitoring(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, endDate, notes }: { id: string; endDate: string; notes?: string }) =>
      approveExemption(id, { endDate, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-monitoring'] });
      setShowApproveModal(false);
      setSelectedExemption(null);
      toast.success('Exemption Approved', 'The worker has been notified.');
    },
    onError: () => {
      toast.error('Error', 'Failed to approve exemption. Please try again.');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      rejectExemption(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-monitoring'] });
      toast.success('Exemption Rejected', 'The worker has been notified.');
    },
    onError: () => {
      toast.error('Error', 'Failed to reject exemption. Please try again.');
    },
  });

  // End early mutation
  const endEarlyMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      endExemptionEarly(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-monitoring'] });
      toast.success('Exemption Ended', 'The worker will need to check in on their next work day.');
    },
    onError: () => {
      toast.error('Error', 'Failed to end exemption. Please try again.');
    },
  });

  const createExemptionMutation = useMutation({
    mutationFn: (data: {
      userId: string;
      type: ExceptionType;
      reason: string;
      endDate: string;
      checkinId?: string;
      notes?: string;
    }) => createExemptionForWorker(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-monitoring'] });
      setSelectedCheckinForExemption(null);
      toast.success('Exemption Created', 'The worker has been put on leave and notified.');
    },
    onError: () => {
      toast.error('Error', 'Failed to create exemption. Please try again.');
    },
  });

  // Handlers
  const handleApprove = (exemption: Exemption) => {
    setSelectedExemption(exemption);
    setShowApproveModal(true);
  };

  const handleConfirmApprove = (endDate: string, notes?: string) => {
    if (selectedExemption) {
      approveMutation.mutate({ id: selectedExemption.id, endDate, notes });
    }
  };

  const handleReject = (exemption: Exemption) => {
    if (confirm(`Are you sure you want to reject the exemption request from ${exemption.user.firstName}?`)) {
      rejectMutation.mutate({ id: exemption.id });
    }
  };

  const handleEndEarly = (exemption: Exemption) => {
    if (confirm(`Are you sure you want to end ${exemption.user.firstName}'s exemption early?`)) {
      endEarlyMutation.mutate({ id: exemption.id });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    // Check for specific error messages
    const errorMessage = (error as any)?.response?.data?.error || 'Failed to load data';
    const isNoTeamError = errorMessage.includes('not assigned to a team') || errorMessage.includes('No teams found');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className={cn(
          'h-16 w-16 rounded-full flex items-center justify-center mb-4',
          isNoTeamError ? 'bg-warning-100' : 'bg-danger-100'
        )}>
          {isNoTeamError ? (
            <Users className="h-8 w-8 text-warning-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-danger-600" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isNoTeamError ? 'No Team Available' : 'Failed to Load Data'}
        </h2>
        <p className="text-gray-500 mb-4 text-center max-w-md">
          {isNoTeamError
            ? 'You need to be assigned to a team or have teams in your company to view monitoring data.'
            : 'There was an error loading the monitoring data. Please try again.'}
        </p>
        {!isNoTeamError && (
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  const { team, stats, todayCheckins, notCheckedInMembers, suddenChanges, pendingExemptions, activeExemptions } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Monitoring</h1>
          <p className="text-gray-500 mt-1">
            {team.name} &bull; {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: team.timezone })}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <StatsCardGrid columns={4}>
        <StatsCard
          label="Checked In"
          value={`${stats.checkedIn}/${stats.activeMembers}`}
          icon={Users}
          variant="primary"
          description={stats.onLeave > 0 ? `${stats.onLeave} on leave` : undefined}
        />
        <StatsCard
          label="Ready (Green)"
          value={stats.greenCount}
          icon={CheckCircle2}
          variant="success"
        />
        <StatsCard
          label="At Risk (Red)"
          value={stats.redCount}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatsCard
          label="Sudden Changes"
          value={stats.suddenChanges}
          icon={TrendingDown}
          variant={stats.criticalChanges > 0 ? 'danger' : 'warning'}
          description={stats.criticalChanges > 0 ? `${stats.criticalChanges} critical` : undefined}
        />
      </StatsCardGrid>

      {/* Alert Banners */}
      {pendingExemptions.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="font-semibold text-warning-800">
                {pendingExemptions.length} Pending Exemption Request{pendingExemptions.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-warning-600">Waiting for your approval</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveTab('exemptions')}
          >
            Review Now
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {stats.criticalChanges > 0 && (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-danger-100 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="font-semibold text-danger-800">
                {stats.criticalChanges} Critical Score Drop{stats.criticalChanges > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-danger-600">Workers showing significant wellness decline</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveTab('changes')}
          >
            View Details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { key: 'checkins', label: "Today's Check-ins", count: todayCheckins.length },
            { key: 'changes', label: 'Sudden Changes', count: suddenChanges.length, alert: stats.criticalChanges > 0 },
            { key: 'exemptions', label: 'Exemptions', count: pendingExemptions.length + activeExemptions.length, alert: pendingExemptions.length > 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    tab.alert
                      ? 'bg-danger-100 text-danger-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'checkins' && (
        <div className="space-y-6">
          {/* Readiness Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-success-50 rounded-xl p-4 text-center border border-success-200">
              <div className="h-12 w-12 rounded-full bg-success-500 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <p className="text-2xl font-bold text-success-700">{stats.greenCount}</p>
              <p className="text-sm text-success-600">Ready (Green)</p>
            </div>
            <div className="bg-warning-50 rounded-xl p-4 text-center border border-warning-200">
              <div className="h-12 w-12 rounded-full bg-warning-500 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <p className="text-2xl font-bold text-warning-700">{stats.yellowCount}</p>
              <p className="text-sm text-warning-600">Caution (Yellow)</p>
            </div>
            <div className="bg-danger-50 rounded-xl p-4 text-center border border-danger-200">
              <div className="h-12 w-12 rounded-full bg-danger-500 flex items-center justify-center mx-auto mb-2">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <p className="text-2xl font-bold text-danger-700">{stats.redCount}</p>
              <p className="text-sm text-danger-600">At Risk (Red)</p>
            </div>
          </div>

          {/* Check-ins List */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              {todayCheckins.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No check-ins yet"
                  description="Team members haven't checked in today."
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {todayCheckins.map((checkin) => (
                    <CheckinRow
                      key={checkin.id}
                      checkin={checkin}
                      onCreateExemption={setSelectedCheckinForExemption}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Not Checked In */}
          {notCheckedInMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-gray-400" />
                  Not Checked In ({notCheckedInMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {notCheckedInMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-600">
                          {member.firstName.charAt(0)}
                          {member.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          {member.firstName} {member.lastName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="space-y-6">
          {suddenChanges.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={TrendingDown}
                  title="No sudden changes detected"
                  description="All workers are within their normal wellness range."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suddenChanges.map((change) => (
                <SuddenChangeCard
                  key={change.userId}
                  {...change}
                  onViewDetails={(id) => console.log('View details:', id)}
                  onScheduleOneOnOne={(id) => console.log('Schedule 1-on-1:', id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'exemptions' && (
        <div className="space-y-6">
          {/* Pending Exemptions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning-500" />
              Pending Requests ({pendingExemptions.length})
            </h3>
            {pendingExemptions.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <EmptyState
                    icon={Clock}
                    title="No pending requests"
                    description="All exemption requests have been reviewed."
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingExemptions.map((exemption) => (
                  <PendingExemptionCard
                    key={exemption.id}
                    exemption={exemption}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isLoading={approveMutation.isPending || rejectMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Active Exemptions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-500" />
              Active Exemptions ({activeExemptions.length})
            </h3>
            {activeExemptions.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <EmptyState
                    icon={Timer}
                    title="No active exemptions"
                    description="No workers are currently on approved exemptions."
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeExemptions.map((exemption) => (
                  <ActiveExemptionCard
                    key={exemption.id}
                    exemption={exemption}
                    onEndEarly={handleEndEarly}
                    timezone={team.timezone}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedExemption && (
        <ApproveModal
          exemption={selectedExemption}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedExemption(null);
          }}
          onConfirm={handleConfirmApprove}
          isLoading={approveMutation.isPending}
          timezone={team.timezone}
        />
      )}

      {/* Create Exemption Modal */}
      {selectedCheckinForExemption && (
        <CreateExemptionModal
          checkin={selectedCheckinForExemption}
          onClose={() => setSelectedCheckinForExemption(null)}
          onConfirm={(data) => {
            createExemptionMutation.mutate({
              userId: selectedCheckinForExemption.userId,
              type: data.type,
              reason: data.reason,
              endDate: data.endDate,
              checkinId: selectedCheckinForExemption.id,
              notes: data.notes,
            });
          }}
          isLoading={createExemptionMutation.isPending}
          timezone={team.timezone}
        />
      )}
    </div>
  );
}

// ============================================
// CHECK-IN ROW COMPONENT
// ============================================

interface CheckinRowProps {
  checkin: TodayCheckin;
  onCreateExemption?: (checkin: TodayCheckin) => void;
}

function CheckinRow({ checkin, onCreateExemption }: CheckinRowProps) {
  const statusColors = getStatusColor(checkin.readinessStatus);
  const hasChange = checkin.changeFromAverage !== null && checkin.changeFromAverage < -10;
  const canCreateExemption = checkin.readinessStatus === 'RED' && !checkin.hasExemptionRequest;

  return (
    <div className="py-4 hover:bg-gray-50 -mx-4 px-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-white">
              {checkin.user.firstName.charAt(0)}
              {checkin.user.lastName.charAt(0)}
            </span>
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">
                {checkin.user.firstName} {checkin.user.lastName}
              </span>
              {checkin.user.currentStreak && checkin.user.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <Flame className="h-3 w-3" />
                  {checkin.user.currentStreak}
                </span>
              )}
              {hasChange && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                  <TrendingDown className="h-3 w-3" />
                  {checkin.changeFromAverage}%
                </span>
              )}
            </div>
            <MetricsRow
              mood={checkin.mood}
              stress={checkin.stress}
              sleep={checkin.sleep}
              physicalHealth={checkin.physicalHealth}
              size="sm"
            />
          </div>
        </div>

        {/* Score and Actions */}
        <div className="flex items-center gap-3">
          {/* Create Exemption Button for RED status */}
          {canCreateExemption && onCreateExemption && (
            <button
              onClick={() => onCreateExemption(checkin)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-lg transition-colors border border-danger-200"
              title="Create exemption for this worker"
            >
              <UserMinus className="h-3.5 w-3.5" />
              Put on Leave
            </button>
          )}
          {checkin.hasExemptionRequest && (
            <span className="text-xs text-warning-600 bg-warning-50 px-2 py-1 rounded">
              {checkin.exemptionStatus === 'PENDING' ? 'Pending' : checkin.exemptionStatus}
            </span>
          )}
          <div
            className={cn(
              'px-3 py-1.5 rounded-full flex items-center gap-2',
              statusColors.bg
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', statusColors.dot)} />
            <span className={cn('font-semibold', statusColors.text)}>
              {checkin.readinessScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Low Score Reason - for RED status */}
      {checkin.readinessStatus === 'RED' && checkin.lowScoreReason && (
        <div className="mt-2 ml-14 flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-danger-500 flex-shrink-0" />
          <span className="text-xs text-danger-600">
            Reason: {getLowScoreReasonLabel(checkin.lowScoreReason)}
            {checkin.lowScoreDetails && ` - ${checkin.lowScoreDetails}`}
          </span>
        </div>
      )}
    </div>
  );
}

export default DailyMonitoringPage;
