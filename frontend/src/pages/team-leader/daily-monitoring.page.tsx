/**
 * Daily Monitoring Page
 * Comprehensive daily monitoring dashboard for Team Leaders
 * Navigation handled via SubMenuPanel (icon rail sidebar pattern)
 */

import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  CalendarX,
  RefreshCw,
  Users,
  TrendingDown,
  Clock,
  Timer,
  ChevronRight,
  X,
  Flame,
  UserMinus,
  Eye,
  MessageSquare,
  Search,
} from 'lucide-react';

// UI Components
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';

// Monitoring Components
import {
  MetricsRow,
  SuddenChangeCard,
  PendingExemptionCard,
  ActiveExemptionCard,
} from '../../components/monitoring';

// Services
import {
  getDailyMonitoring,
  getStatusColor,
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
import { absenceService } from '../../services/absence.service';

// Absence Components
import { AbsenceReviewCard } from '../../components/absences/AbsenceReviewCard';

// Utils
import { cn } from '../../lib/utils';
import { getNowInTimezone } from '../../lib/date-utils';

// ============================================
// TYPES
// ============================================

type MonitoringTab = 'checkins' | 'changes' | 'exemptions' | 'absences';

// ============================================
// CONSTANTS
// ============================================

const QUERY_KEY = 'daily-monitoring';
const REFETCH_INTERVAL = 60000; // 1 minute

// ============================================
// MODAL COMPONENTS
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

  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;

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

  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Approve Exemption</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Avatar firstName={exemption.user.firstName} lastName={exemption.user.lastName} size="md" />
            <div>
              <p className="font-medium text-gray-900">{exemption.user.firstName} {exemption.user.lastName}</p>
              <p className="text-sm text-gray-500">{exemption.reason}</p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Last day of exemption</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={formatDateForInput(tomorrow)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { label: 'Tomorrow', date: tomorrow },
            { label: '3 days', date: in3Days },
            { label: '1 week', date: in7Days },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setEndDate(formatDateForInput(opt.date))}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onConfirm(endDate, notes || undefined)} disabled={!endDate || isLoading}>
            {isLoading ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CreateExemptionModalProps {
  checkin: TodayCheckin;
  onClose: () => void;
  onConfirm: (data: { type: ExceptionType; reason: string; endDate: string; notes?: string }) => void;
  isLoading: boolean;
  timezone: string;
}

function CreateExemptionModal({ checkin, onClose, onConfirm, isLoading, timezone }: CreateExemptionModalProps) {
  const [type, setType] = useState<ExceptionType>('SICK_LEAVE');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const nowInTz = getNowInTimezone(timezone);
  const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayParts = dateFormatter.formatToParts(nowInTz.date);
  const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);

  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Create Exemption</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-danger-50 rounded-lg p-4 mb-6 border border-danger-100">
          <div className="flex items-center gap-3">
            <Avatar firstName={checkin.user.firstName} lastName={checkin.user.lastName} size="md" />
            <div>
              <p className="font-medium text-gray-900">{checkin.user.firstName} {checkin.user.lastName}</p>
              <p className="text-sm text-danger-600">Score: {checkin.readinessScore}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exemption Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExceptionType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {EXCEPTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for exemption..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last day of exemption *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={formatDateForInput(tomorrow)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Tomorrow', date: tomorrow },
              { label: '3 days', date: in3Days },
              { label: '1 week', date: in7Days },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setEndDate(formatDateForInput(opt.date))}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm({ type, reason, endDate, notes: notes || undefined })}
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
// CHECK-IN COMPONENTS (Mobile Card + Desktop Row)
// ============================================

interface CheckinItemProps {
  checkin: TodayCheckin;
  onCreateExemption?: (checkin: TodayCheckin) => void;
}

// Mobile Card Component
const CheckinCard = memo(({ checkin, onCreateExemption }: CheckinItemProps) => {
  const statusColors = getStatusColor(checkin.readinessStatus);
  const hasChange = checkin.changeFromAverage !== null && checkin.changeFromAverage < -10;
  const canCreateExemption = checkin.readinessStatus === 'RED' && !checkin.hasExemptionRequest;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar firstName={checkin.user.firstName} lastName={checkin.user.lastName} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{checkin.user.firstName} {checkin.user.lastName}</span>
                {checkin.user.currentStreak && checkin.user.currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    <Flame className="h-3 w-3" />{checkin.user.currentStreak}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(checkin.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            </div>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', statusColors.bg, statusColors.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.dot)} />
            {checkin.readinessStatus === 'GREEN' ? 'Ready' : checkin.readinessStatus === 'YELLOW' ? 'Limited' : 'Not Ready'}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600">Readiness Score</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">{checkin.readinessScore}%</span>
            {hasChange && (
              <span className="text-xs text-red-600 font-medium">{checkin.changeFromAverage}%</span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-3">
          <MetricsRow mood={checkin.mood} stress={checkin.stress} sleep={checkin.sleep} physicalHealth={checkin.physicalHealth} size="sm" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          {canCreateExemption && onCreateExemption && (
            <button
              onClick={() => onCreateExemption(checkin)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              Put on Leave
            </button>
          )}
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
            <Eye className="w-4 h-4" />
            Details
          </button>
          <button className="p-2.5 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors">
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
CheckinCard.displayName = 'CheckinCard';

// Desktop Table Row Component
const CheckinRow = memo(({ checkin, onCreateExemption }: CheckinItemProps) => {
  const statusColors = getStatusColor(checkin.readinessStatus);
  const hasChange = checkin.changeFromAverage !== null && checkin.changeFromAverage < -10;
  const canCreateExemption = checkin.readinessStatus === 'RED' && !checkin.hasExemptionRequest;

  return (
    <tr className="hover:bg-gray-50/80 transition-all border-l-2 border-l-transparent hover:border-l-primary-500">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar firstName={checkin.user.firstName} lastName={checkin.user.lastName} size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{checkin.user.firstName} {checkin.user.lastName}</span>
              {checkin.user.currentStreak && checkin.user.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <Flame className="h-3 w-3" />{checkin.user.currentStreak}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{checkin.user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <MetricsRow mood={checkin.mood} stress={checkin.stress} sleep={checkin.sleep} physicalHealth={checkin.physicalHealth} size="sm" />
      </td>
      <td className="px-6 py-4">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', statusColors.bg, statusColors.text)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.dot)} />
          {checkin.readinessStatus === 'GREEN' ? 'Ready' : checkin.readinessStatus === 'YELLOW' ? 'Limited' : 'Not Ready'}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700">
          {checkin.readinessScore}%
        </span>
        {hasChange && (
          <span className="ml-2 text-xs text-red-600">{checkin.changeFromAverage}%</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-gray-500">
          {new Date(checkin.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-1">
          {canCreateExemption && onCreateExemption && (
            <button
              onClick={() => onCreateExemption(checkin)}
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              title="Put on Leave"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          )}
          <button className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="View Details">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Message">
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});
CheckinRow.displayName = 'CheckinRow';

// ============================================
// STATS BAR COMPONENT
// ============================================

interface StatsBarProps {
  stats: {
    greenCount: number;
    yellowCount: number;
    redCount: number;
    totalCheckedIn: number;
    teamSize: number;
  };
}

// Desktop Stats Bar
const StatsBar = memo(({ stats }: StatsBarProps) => (
  <div className="hidden md:flex items-center gap-6">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="text-sm text-gray-600">Ready: <strong className="text-gray-900">{stats.greenCount}</strong></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span className="text-sm text-gray-600">Limited: <strong className="text-gray-900">{stats.yellowCount}</strong></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm text-gray-600">At Risk: <strong className="text-gray-900">{stats.redCount}</strong></span>
      </div>
    </div>
    <div className="h-4 w-px bg-gray-300" />
    <span className="text-sm text-gray-500">
      {stats.totalCheckedIn}/{stats.teamSize} checked in
    </span>
  </div>
));
StatsBar.displayName = 'StatsBar';

// Mobile Stats Cards
const MobileStatsCards = memo(({ stats }: StatsBarProps) => (
  <div className="grid grid-cols-4 gap-2 md:hidden">
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.greenCount}</p>
      <p className="text-[10px] text-gray-500">Ready</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.yellowCount}</p>
      <p className="text-[10px] text-gray-500">Limited</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-red-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.redCount}</p>
      <p className="text-[10px] text-gray-500">At Risk</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-primary-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.totalCheckedIn}/{stats.teamSize}</p>
      <p className="text-[10px] text-gray-500">Checked In</p>
    </div>
  </div>
));
MobileStatsCards.displayName = 'MobileStatsCards';

// ============================================
// MAIN COMPONENT
// ============================================

export function DailyMonitoringPage() {
  // URL search params for tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MonitoringTab | null;

  // Tab state - sync with URL
  const [activeTab, setActiveTab] = useState<MonitoringTab>(tabFromUrl || 'checkins');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync tab state with URL
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: MonitoringTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  }, [setSearchParams]);

  // Modal state
  const [selectedExemption, setSelectedExemption] = useState<Exemption | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedCheckinForExemption, setSelectedCheckinForExemption] = useState<TodayCheckin | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  // Data fetching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getDailyMonitoring,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 30000,
  });

  const { data: pendingAbsences } = useQuery({
    queryKey: ['absences', 'team-pending'],
    queryFn: () => absenceService.getTeamPending(),
    refetchInterval: REFETCH_INTERVAL,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, endDate, notes }: { id: string; endDate: string; notes?: string }) =>
      approveExemption(id, { endDate, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      setShowApproveModal(false);
      setSelectedExemption(null);
      toast.success('Exemption approved');
    },
    onError: () => toast.error('Failed to approve exemption'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => rejectExemption(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Exemption rejected');
    },
    onError: () => toast.error('Failed to reject exemption'),
  });

  const endEarlyMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => endExemptionEarly(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Exemption ended');
    },
    onError: () => toast.error('Failed to end exemption'),
  });

  const createExemptionMutation = useMutation({
    mutationFn: (params: { userId: string; type: ExceptionType; reason: string; endDate: string; checkinId?: string; notes?: string }) =>
      createExemptionForWorker(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      setSelectedCheckinForExemption(null);
      toast.success('Exemption created');
    },
    onError: () => toast.error('Failed to create exemption'),
  });

  // Handlers
  const handleApprove = useCallback((exemption: Exemption) => {
    setSelectedExemption(exemption);
    setShowApproveModal(true);
  }, []);

  const handleReject = useCallback((exemption: Exemption) => {
    if (confirm(`Reject exemption request from ${exemption.user.firstName}?`)) {
      rejectMutation.mutate({ id: exemption.id });
    }
  }, [rejectMutation]);

  const handleEndEarly = useCallback((exemption: Exemption) => {
    if (confirm(`End ${exemption.user.firstName}'s exemption early?`)) {
      endEarlyMutation.mutate({ id: exemption.id });
    }
  }, [endEarlyMutation]);

  // Filter data by search
  const filteredCheckins = useMemo(() => {
    if (!data || !searchQuery) return data?.todayCheckins || [];
    const query = searchQuery.toLowerCase();
    return data.todayCheckins.filter(c =>
      c.user.firstName.toLowerCase().includes(query) ||
      c.user.lastName.toLowerCase().includes(query) ||
      c.user.email.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    const errorMessage = (error as any)?.response?.data?.error || 'Failed to load data';
    const isNoTeamError = errorMessage.includes('not assigned to a team');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className={cn('h-16 w-16 rounded-full flex items-center justify-center mb-4', isNoTeamError ? 'bg-warning-100' : 'bg-danger-100')}>
          {isNoTeamError ? <Users className="h-8 w-8 text-warning-600" /> : <AlertTriangle className="h-8 w-8 text-danger-600" />}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{isNoTeamError ? 'No Team Available' : 'Failed to Load Data'}</h2>
        <p className="text-gray-500 mb-4 text-center max-w-md">
          {isNoTeamError ? 'You need to be assigned to a team to view monitoring data.' : 'There was an error loading the data.'}
        </p>
        {!isNoTeamError && <Button onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>}
      </div>
    );
  }

  const { team, stats, todayCheckins, notCheckedInMembers, suddenChanges, pendingExemptions, activeExemptions } = data;

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Daily Monitoring</h1>
              <p className="text-sm text-gray-500 mt-1">{team.name} &bull; {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetch()} className="flex-shrink-0">
              <RefreshCw className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Refresh</span>
            </Button>
          </div>
          <StatsBar stats={stats} />
        </div>

        {/* Mobile Stats Cards */}
        <MobileStatsCards stats={stats} />

        {/* Critical Alert */}
        {stats.criticalChanges > 0 && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-5 w-5 text-danger-600" />
              </div>
              <div>
                <p className="font-semibold text-danger-800 text-sm md:text-base">{stats.criticalChanges} Critical Score Drop{stats.criticalChanges > 1 ? 's' : ''}</p>
                <p className="text-xs md:text-sm text-danger-600">Workers showing significant wellness decline</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => handleTabChange('changes')} className="w-full md:w-auto">
              View <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Search Bar (only for check-ins) */}
        {activeTab === 'checkins' && (
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 md:py-2 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
            />
          </div>
        )}

        {/* Content Panels */}
        <div className="min-h-[300px] md:min-h-[400px]">
          {/* CHECK-INS PANEL */}
          {activeTab === 'checkins' && (
            <div className="space-y-4 md:space-y-6">
              {filteredCheckins.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 py-12">
                  <EmptyState icon={Users} title="No check-ins yet" description="Team members haven't checked in today." />
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filteredCheckins.map((checkin) => (
                      <CheckinCard key={checkin.id} checkin={checkin} onCreateExemption={setSelectedCheckinForExemption} />
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metrics</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                          <th className="w-32 px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredCheckins.map((checkin) => (
                          <CheckinRow key={checkin.id} checkin={checkin} onCreateExemption={setSelectedCheckinForExemption} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Not Checked In */}
              {notCheckedInMembers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-600 text-base">
                      <Clock className="h-5 w-5" />Not Checked In ({notCheckedInMembers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {notCheckedInMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <Avatar firstName={member.firstName} lastName={member.lastName} size="sm" />
                          <p className="text-sm font-medium text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* SUDDEN CHANGES PANEL */}
          {activeTab === 'changes' && (
            <div className="space-y-4">
              {suddenChanges.length === 0 ? (
                <Card><CardContent className="py-12"><EmptyState icon={TrendingDown} title="No sudden changes" description="All workers are within normal range." /></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suddenChanges.map((change) => (
                    <SuddenChangeCard key={change.userId} {...change} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXEMPTIONS PANEL */}
          {activeTab === 'exemptions' && (
            <div className="space-y-6">
              {/* Pending */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning-500" />Pending ({pendingExemptions.length})
                </h3>
                {pendingExemptions.length === 0 ? (
                  <Card><CardContent className="py-8"><EmptyState icon={Clock} title="No pending requests" /></CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingExemptions.map((exemption) => (
                      <PendingExemptionCard key={exemption.id} exemption={exemption} onApprove={handleApprove} onReject={handleReject} isLoading={approveMutation.isPending || rejectMutation.isPending} />
                    ))}
                  </div>
                )}
              </div>

              {/* Active */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success-500" />Active ({activeExemptions.length})
                </h3>
                {activeExemptions.length === 0 ? (
                  <Card><CardContent className="py-8"><EmptyState icon={Timer} title="No active exemptions" /></CardContent></Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeExemptions.map((exemption) => (
                      <ActiveExemptionCard key={exemption.id} exemption={exemption} onEndEarly={handleEndEarly} timezone={team.timezone} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABSENCES PANEL */}
          {activeTab === 'absences' && (
            <div className="space-y-6">
              {!pendingAbsences || pendingAbsences.count === 0 ? (
                <Card><CardContent className="py-12"><EmptyState icon={CalendarX} title="No pending absence reviews" description="All justifications have been reviewed." /></CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingAbsences.data.map((absence) => (
                    <AbsenceReviewCard key={absence.id} absence={absence} />
                  ))}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">How Absence Reviews Work</p>
                    <ul className="text-sm text-blue-600 mt-1 space-y-1">
                      <li><strong>Excused:</strong> No penalty - won't affect attendance grade</li>
                      <li><strong>Unexcused:</strong> 0 points - counts against attendance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showApproveModal && selectedExemption && (
        <ApproveModal
          exemption={selectedExemption}
          onClose={() => { setShowApproveModal(false); setSelectedExemption(null); }}
          onConfirm={(endDate, notes) => approveMutation.mutate({ id: selectedExemption.id, endDate, notes })}
          isLoading={approveMutation.isPending}
          timezone={team.timezone}
        />
      )}

      {selectedCheckinForExemption && (
        <CreateExemptionModal
          checkin={selectedCheckinForExemption}
          onClose={() => setSelectedCheckinForExemption(null)}
          onConfirm={(formData) => createExemptionMutation.mutate({
            userId: selectedCheckinForExemption.userId,
            checkinId: selectedCheckinForExemption.id,
            ...formData,
          })}
          isLoading={createExemptionMutation.isPending}
          timezone={team.timezone}
        />
      )}
    </>
  );
}

export default DailyMonitoringPage;
