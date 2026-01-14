/**
 * Team Member History Page
 * Enhanced table view with date filters, mobile cards, and trend indicators
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Pagination } from '../../components/ui/Pagination';
import { Avatar } from '../../components/ui/Avatar';
import { MetricsRow } from '../../components/monitoring/MetricsBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDisplayDate, formatTime } from '../../lib/date-utils';
import {
  History,
  Users,
  ChevronDown,
  Filter,
  
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ===========================================
// TYPES
// ===========================================

interface TeamCheckin {
  id: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

type StatusFilter = 'all' | 'GREEN' | 'YELLOW' | 'RED';
type DatePreset = 'all' | '7days' | '30days' | 'thisMonth' | 'custom';
type TrendType = 'up' | 'down' | 'same' | null;

// ===========================================
// CONSTANTS
// ===========================================

const STATUS_CONFIG = {
  GREEN: { label: 'Ready', bg: 'bg-success-100', text: 'text-success-700' },
  YELLOW: { label: 'Limited', bg: 'bg-warning-100', text: 'text-warning-700' },
  RED: { label: 'Not Ready', bg: 'bg-danger-100', text: 'text-danger-700' },
} as const;

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
] as const;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getDateRange(preset: DatePreset, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case '7days': {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    }
    case '30days': {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    }
    case 'thisMonth': {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    }
    case 'custom':
      if (customStart && customEnd) {
        return {
          startDate: new Date(customStart).toISOString(),
          endDate: new Date(customEnd + 'T23:59:59').toISOString()
        };
      }
      return null;
    default:
      return null;
  }
}

function getScoreColor(score: number) {
  if (score >= 70) return { bg: 'bg-success-50', text: 'text-success-600' };
  if (score >= 40) return { bg: 'bg-warning-50', text: 'text-warning-600' };
  return { bg: 'bg-danger-50', text: 'text-danger-600' };
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

function StatusBadge({ status }: { status: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', config.bg, config.text)}>
      {config.label}
    </span>
  );
}

function TrendIndicator({ trend, size = 'sm' }: { trend: TrendType; size?: 'sm' | 'md' }) {
  if (!trend) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const colorClass = trend === 'up' ? 'text-success-500' : trend === 'down' ? 'text-danger-500' : 'text-gray-400';

  return (
    <span className={cn('flex-shrink-0', colorClass)}>
      {trend === 'up' && <TrendingUp className={iconSize} />}
      {trend === 'down' && <TrendingDown className={iconSize} />}
      {trend === 'same' && <Minus className={iconSize} />}
    </span>
  );
}

function ScoreBadge({ score, trend, variant = 'badge' }: { score: number; trend: TrendType; variant?: 'badge' | 'text' }) {
  const colors = getScoreColor(score);

  if (variant === 'text') {
    return (
      <div className="flex items-center gap-2">
        <span className={cn('text-lg font-bold', colors.text)}>{score}%</span>
        <TrendIndicator trend={trend} size="md" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded-md text-sm font-bold', colors.bg, colors.text)}>
        {score}%
      </span>
      <TrendIndicator trend={trend} size="sm" />
    </div>
  );
}

function NotesTooltip({ notes }: { notes?: string }) {
  if (!notes) return <span className="text-xs text-gray-300">-</span>;

  return (
    <div className="group relative">
      <FileText className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
      <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
        {notes}
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function TeamMemberHistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const limit = 20;

  // Get team data
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  const members: TeamMember[] = team?.members || [];

  // Calculate date range
  const dateRange = useMemo(
    () => getDateRange(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate]
  );

  // Get check-ins with filters
  const { data: checkinsData, isLoading: checkinsLoading } = useQuery({
    queryKey: ['team-checkins-history', team?.id, page, statusFilter, selectedMemberId, dateRange],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit, teamId: team?.id };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (selectedMemberId !== 'all') params.userId = selectedMemberId;
      if (dateRange) {
        params.startDate = dateRange.startDate;
        params.endDate = dateRange.endDate;
      }
      const response = await api.get('/checkins', { params });
      return response.data as {
        data: TeamCheckin[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    },
    enabled: !!team?.id,
  });

  // Get trend for a specific checkin by comparing with previous
  const getTrend = (checkin: TeamCheckin, index: number): TrendType => {
    const allCheckins = checkinsData?.data || [];
    for (let i = index + 1; i < allCheckins.length; i++) {
      if (allCheckins[i].user.id === checkin.user.id) {
        const diff = checkin.readinessScore - allCheckins[i].readinessScore;
        if (diff > 5) return 'up';
        if (diff < -5) return 'down';
        return 'same';
      }
    }
    return null;
  };

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    setPage(1);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
    if (preset !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // Loading state
  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // No team state
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">No Team Assigned</p>
        <p className="text-sm text-gray-500">You are not currently assigned to a team.</p>
      </div>
    );
  }

  const checkins = checkinsData?.data || [];
  const totalRecords = checkinsData?.pagination?.total || 0;
  const totalPages = checkinsData?.pagination?.totalPages || 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <History className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Check-in History</h1>
          <p className="text-sm text-gray-500">{team.name} • {totalRecords} records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Member Select */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedMemberId}
              onChange={(e) => handleMemberChange(e.target.value)}
              className="appearance-none w-full lg:w-48 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Members ({members.length})</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleDatePresetChange(preset.value as DatePreset)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  datePreset === preset.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500 mr-1">Status:</span>
          {(['all', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-full transition-colors',
                statusFilter === status
                  ? status === 'all'
                    ? 'bg-gray-900 text-white'
                    : status === 'GREEN'
                      ? 'bg-success-500 text-white'
                      : status === 'YELLOW'
                        ? 'bg-warning-500 text-white'
                        : 'bg-danger-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {checkinsLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : checkins.length === 0 ? (
          <div className="text-center py-16">
            <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-2">Member</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-5">Metrics</div>
                <div className="col-span-1 text-center">Score</div>
                <div className="col-span-1">Notes</div>
              </div>

              <div className="divide-y divide-gray-100">
                {checkins.map((checkin, index) => (
                  <div key={checkin.id} className="grid grid-cols-12 gap-3 px-4 py-3 hover:bg-gray-50 transition-colors items-center">
                    <div className="col-span-2 flex items-center gap-2">
                      <Avatar src={checkin.user.avatar} firstName={checkin.user.firstName} lastName={checkin.user.lastName} size="sm" />
                      <p className="text-sm font-medium text-gray-900 truncate">{checkin.user.firstName} {checkin.user.lastName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-900">{formatDisplayDate(checkin.createdAt)}</p>
                      <p className="text-xs text-gray-500">{formatTime(checkin.createdAt)}</p>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <StatusBadge status={checkin.readinessStatus} />
                    </div>
                    <div className="col-span-5">
                      <MetricsRow mood={checkin.mood} stress={checkin.stress} sleep={checkin.sleep} physicalHealth={checkin.physicalHealth} size="sm" showLabels />
                    </div>
                    <div className="col-span-1">
                      <ScoreBadge score={checkin.readinessScore} trend={getTrend(checkin, index)} />
                    </div>
                    <div className="col-span-1">
                      <NotesTooltip notes={checkin.notes} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {checkins.map((checkin, index) => (
                <div key={checkin.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar src={checkin.user.avatar} firstName={checkin.user.firstName} lastName={checkin.user.lastName} size="md" />
                      <div>
                        <p className="font-medium text-gray-900">{checkin.user.firstName} {checkin.user.lastName}</p>
                        <p className="text-xs text-gray-500">{formatDisplayDate(checkin.createdAt)} • {formatTime(checkin.createdAt)}</p>
                      </div>
                    </div>
                    <StatusBadge status={checkin.readinessStatus} />
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-600">Readiness Score</span>
                    <ScoreBadge score={checkin.readinessScore} trend={getTrend(checkin, index)} variant="text" />
                  </div>

                  <MetricsRow mood={checkin.mood} stress={checkin.stress} sleep={checkin.sleep} physicalHealth={checkin.physicalHealth} size="sm" showLabels />

                  {checkin.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                      <span className="text-xs text-gray-400 block mb-1">Notes:</span>
                      {checkin.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <Pagination currentPage={page} totalPages={totalPages} totalItems={totalRecords} pageSize={limit} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}











