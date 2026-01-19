import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  FileWarning,
  ChevronRight,
  User,
  Calendar,
  X,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime, getNowInTimezone } from '../../lib/date-utils';
import api from '../../services/api';
import { incidentService } from '../../services/incident.service';
import { Pagination } from '../../components/ui/Pagination';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { useToast } from '../../components/ui/Toast';
import { useUser } from '../../hooks/useUser';
import {
  approveExemption,
  rejectExemption,
  getExceptionTypeLabel,
} from '../../services/exemption.service';
import type { Incident } from '../../types/user';

// Status configuration with colors and icons
const statusConfig: Record<string, {
  color: string;
  bgColor: string;
  icon: typeof AlertTriangle;
  label: string;
}> = {
  OPEN: {
    color: 'text-danger-700 border-danger-200',
    bgColor: 'bg-danger-50',
    icon: AlertTriangle,
    label: 'Open'
  },
  IN_PROGRESS: {
    color: 'text-warning-700 border-warning-200',
    bgColor: 'bg-warning-50',
    icon: Clock,
    label: 'In Progress'
  },
  RESOLVED: {
    color: 'text-success-700 border-success-200',
    bgColor: 'bg-success-50',
    icon: CheckCircle2,
    label: 'Resolved'
  },
  CLOSED: {
    color: 'text-gray-700 border-gray-200',
    bgColor: 'bg-gray-50',
    icon: XCircle,
    label: 'Closed'
  },
};

const severityConfig: Record<string, { color: string; dotColor: string; label: string }> = {
  LOW: { color: 'text-gray-600', dotColor: 'bg-gray-400', label: 'Low' },
  MEDIUM: { color: 'text-blue-600', dotColor: 'bg-blue-500', label: 'Medium' },
  HIGH: { color: 'text-orange-600', dotColor: 'bg-orange-500', label: 'High' },
  CRITICAL: { color: 'text-danger-600', dotColor: 'bg-danger-500', label: 'Critical' },
};

// Simplified Approve Modal for incident-linked exceptions
function ApproveModal({
  incident,
  onClose,
  onConfirm,
  isLoading,
  timezone,
}: {
  incident: Incident;
  onClose: () => void;
  onConfirm: (endDate: string, notes?: string) => void;
  isLoading: boolean;
  timezone: string;
}) {
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
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);

  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    return `${parts.find((p) => p.type === 'year')!.value}-${
      parts.find((p) => p.type === 'month')!.value
    }-${parts.find((p) => p.type === 'day')!.value}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Approve Leave Request</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {incident.caseNumber}: {incident.title}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Reported by: {incident.reporter?.firstName} {incident.reporter?.lastName}
          </p>
          {incident.exception && (
            <Badge variant="warning" className="text-xs">
              {getExceptionTypeLabel(incident.exception.type as any)}
            </Badge>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last day of leave
          </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="success"
            className="flex-1"
            onClick={() => onConfirm(endDate, notes || undefined)}
            disabled={!endDate || isLoading}
            isLoading={isLoading}
          >
            Approve Leave
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simplified Reject Modal
function RejectModal({
  incident,
  onClose,
  onConfirm,
  isLoading,
}: {
  incident: Incident;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Reject Leave Request</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-danger-50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {incident.caseNumber}: {incident.title}
          </p>
          <p className="text-sm text-gray-600">
            Reported by: {incident.reporter?.firstName} {incident.reporter?.lastName}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for rejection (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Provide a reason for rejection..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => onConfirm(notes || undefined)}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Reject Leave
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TeamIncidentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { company } = useUser();
  const timezone = company?.timezone || 'UTC';

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [approveModalIncident, setApproveModalIncident] = useState<Incident | null>(null);
  const [rejectModalIncident, setRejectModalIncident] = useState<Incident | null>(null);
  const navigate = useNavigate();
  const limit = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get user's team first
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  // Fetch stats (separate endpoint for accurate counts)
  const { data: stats } = useQuery({
    queryKey: ['team-incidents-stats', team?.id],
    queryFn: () => incidentService.getStats(team?.id),
    enabled: !!team?.id,
    refetchInterval: 30000,
  });

  // Get incidents for team with server-side filtering
  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['team-incidents', team?.id, statusFilter, severityFilter, leaveStatusFilter, debouncedSearch, page, limit],
    queryFn: () => incidentService.getAll({
      teamId: team.id,
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      exceptionStatus: leaveStatusFilter || undefined,
      search: debouncedSearch || undefined,
      page,
      limit,
    }),
    enabled: !!team?.id,
  });

  const incidents: Incident[] = incidentsData?.data || [];
  const pagination = incidentsData?.pagination;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ exceptionId, endDate, notes }: { exceptionId: string; endDate: string; notes?: string }) =>
      approveExemption(exceptionId, { endDate, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['team-incidents-stats'] });
      queryClient.invalidateQueries({ queryKey: ['exemptions'] });
      setApproveModalIncident(null);
      toast.success('Leave Approved', 'The leave request has been approved.');
    },
    onError: () => {
      toast.error('Approval Failed', 'Failed to approve leave request.');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ exceptionId, notes }: { exceptionId: string; notes?: string }) =>
      rejectExemption(exceptionId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['team-incidents-stats'] });
      queryClient.invalidateQueries({ queryKey: ['exemptions'] });
      setRejectModalIncident(null);
      toast.success('Leave Rejected', 'The leave request has been rejected.');
    },
    onError: () => {
      toast.error('Rejection Failed', 'Failed to reject leave request.');
    },
  });

  const hasActiveFilters = statusFilter || severityFilter || leaveStatusFilter || searchQuery;

  const clearFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setLeaveStatusFilter('');
    setSearchQuery('');
    setPage(1);
  };

  if (teamLoading) {
    return <SkeletonTable rows={5} columns={5} />;
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <FileWarning className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Team Assigned</h2>
        <p className="text-gray-500">You are not currently assigned to a team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-danger-100 flex items-center justify-center">
              <FileWarning className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Incidents</h1>
              <p className="text-gray-500 text-sm">Manage and track incidents for {team.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Using Centralized StatCard */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={FileWarning}
          value={stats?.total ?? 0}
          label="Total"
          color="primary"
        />
        <StatCard
          icon={AlertTriangle}
          value={stats?.open ?? 0}
          label="Open"
          color="danger"
        />
        <StatCard
          icon={Clock}
          value={stats?.inProgress ?? 0}
          label="In Progress"
          color="warning"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats?.resolved ?? 0}
          label="Resolved"
          color="success"
        />
        {/* Pending Leave Requests */}
        {(stats?.pendingLeave ?? 0) > 0 && (
          <StatCard
            icon={ShieldCheck}
            value={stats?.pendingLeave ?? 0}
            label="Pending Leave"
            color="primary"
          />
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, case number, or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[130px]"
              >
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[130px]"
            >
              <option value="">All Severity</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>

            <select
              value={leaveStatusFilter}
              onChange={(e) => { setLeaveStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[150px]"
            >
              <option value="">All Leave Status</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} columns={5} />
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileWarning className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No incidents found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'No incidents have been reported by your team yet.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header - Desktop */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="col-span-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Incident
              </div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reporter
              </div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Severity
              </div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </div>
              <div className="col-span-1 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                Action
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {incidents?.map((incident) => {
                const status = statusConfig[incident.status] || statusConfig.OPEN;
                const severity = severityConfig[incident.severity] || severityConfig.MEDIUM;
                const StatusIcon = status.icon;
                const hasPendingException = incident.exception?.status === 'PENDING';
                const isApproved = incident.exception?.status === 'APPROVED';
                const isRejected = incident.exception?.status === 'REJECTED';

                return (
                  <div
                    key={incident.id}
                    className={cn(
                      'group hover:bg-gray-50 transition-colors cursor-pointer',
                      hasPendingException && 'bg-purple-50/30',
                      isApproved && 'bg-success-50/30',
                      isRejected && 'bg-danger-50/30'
                    )}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    {/* Desktop Layout */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-4 items-center">
                      {/* Incident Info */}
                      <div className="col-span-5">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center',
                            status.bgColor
                          )}>
                            <StatusIcon className={cn('h-5 w-5', status.color.split(' ')[0])} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded font-medium">
                                {incident.caseNumber}
                              </span>
                              {hasPendingException && (
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                                  Leave Pending
                                </Badge>
                              )}
                              {isApproved && (
                                <Badge variant="success" className="text-xs">
                                  Leave Approved
                                </Badge>
                              )}
                              {isRejected && (
                                <Badge variant="danger" className="text-xs">
                                  Leave Rejected
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-gray-900 truncate">{incident.title}</h3>
                            {incident.description && (
                              <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{incident.description}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reporter */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <span className="text-sm text-gray-700 truncate">
                            {incident.reporter?.firstName} {incident.reporter?.lastName}
                          </span>
                        </div>
                      </div>

                      {/* Severity */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', severity.dotColor)} />
                          <span className={cn('text-sm font-medium', severity.color)}>
                            {severity.label}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          status.color,
                          status.bgColor
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>

                      {/* Action */}
                      <div className="col-span-1 flex justify-end gap-1">
                        {hasPendingException ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setApproveModalIncident(incident);
                              }}
                              className="p-2 text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                              title="Approve Leave"
                            >
                              <ShieldCheck className="h-5 w-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectModalIncident(incident);
                              }}
                              className="p-2 text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                              title="Reject Leave"
                            >
                              <ShieldX className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/incidents/${incident.id}`);
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="lg:hidden px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center',
                          status.bgColor
                        )}>
                          <StatusIcon className={cn('h-5 w-5', status.color.split(' ')[0])} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded font-medium">
                              {incident.caseNumber}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                              status.color,
                              status.bgColor
                            )}>
                              {status.label}
                            </span>
                            {hasPendingException && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                                Leave Pending
                              </Badge>
                            )}
                            {isApproved && (
                              <Badge variant="success" className="text-xs">
                                Leave Approved
                              </Badge>
                            )}
                            {isRejected && (
                              <Badge variant="danger" className="text-xs">
                                Leave Rejected
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium text-gray-900">{incident.title}</h3>

                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              <span>{incident.reporter?.firstName} {incident.reporter?.lastName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn('h-2 w-2 rounded-full', severity.dotColor)} />
                              <span className={severity.color}>{severity.label}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDisplayDateTime(incident.createdAt, timezone)}</span>
                            </div>
                          </div>

                          {/* Mobile Approve/Reject Buttons */}
                          {hasPendingException && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setApproveModalIncident(incident);
                                }}
                                leftIcon={<ShieldCheck className="h-4 w-4" />}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectModalIncident(incident);
                                }}
                                leftIcon={<ShieldX className="h-4 w-4" />}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                        {!hasPendingException && (
                          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination - only show wrapper if more than 1 page */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve Modal */}
      {approveModalIncident && approveModalIncident.exception && (
        <ApproveModal
          incident={approveModalIncident}
          onClose={() => setApproveModalIncident(null)}
          onConfirm={(endDate, notes) => {
            approveMutation.mutate({
              exceptionId: approveModalIncident.exception!.id,
              endDate,
              notes,
            });
          }}
          isLoading={approveMutation.isPending}
          timezone={timezone}
        />
      )}

      {/* Reject Modal */}
      {rejectModalIncident && rejectModalIncident.exception && (
        <RejectModal
          incident={rejectModalIncident}
          onClose={() => setRejectModalIncident(null)}
          onConfirm={(notes) => {
            rejectMutation.mutate({
              exceptionId: rejectModalIncident.exception!.id,
              notes,
            });
          }}
          isLoading={rejectMutation.isPending}
        />
      )}
    </div>
  );
}
