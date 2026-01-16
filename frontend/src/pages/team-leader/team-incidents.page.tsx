import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import api from '../../services/api';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { SkeletonTable } from '../../components/ui/Skeleton';
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

export function TeamIncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Get user's team first
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  // Get incidents for team
  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['team-incidents', team?.id, statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('teamId', team.id);
      if (statusFilter) params.append('status', statusFilter);
      if (severityFilter) params.append('severity', severityFilter);
      params.append('limit', '100');
      const response = await api.get(`/incidents?${params.toString()}`);
      return response.data;
    },
    enabled: !!team?.id,
  });

  const allIncidents: Incident[] = incidentsData?.data || [];

  // Filter by search query
  const filteredIncidents = allIncidents.filter((incident) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      incident.title.toLowerCase().includes(query) ||
      incident.caseNumber.toLowerCase().includes(query) ||
      incident.description?.toLowerCase().includes(query) ||
      `${incident.reporter?.firstName} ${incident.reporter?.lastName}`.toLowerCase().includes(query)
    );
  });

  // Pagination
  const { paginatedData: incidents, paginationProps } = usePagination(filteredIncidents, {
    pageSize: 10,
  });

  // Stats
  const stats = {
    total: allIncidents.length,
    open: allIncidents.filter((i) => i.status === 'OPEN').length,
    inProgress: allIncidents.filter((i) => i.status === 'IN_PROGRESS').length,
    resolved: allIncidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
  };

  const hasActiveFilters = statusFilter || severityFilter || searchQuery;

  const clearFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setSearchQuery('');
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <FileWarning className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-danger-200 p-4 bg-danger-50/50 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-danger-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-danger-700">{stats.open}</p>
              <p className="text-sm text-danger-600">Open</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-warning-200 p-4 bg-warning-50/50 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning-700">{stats.inProgress}</p>
              <p className="text-sm text-warning-600">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-success-200 p-4 bg-success-50/50 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success-700">{stats.resolved}</p>
              <p className="text-sm text-success-600">Resolved</p>
            </div>
          </div>
        </div>
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
                onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-w-[130px]"
            >
              <option value="">All Severity</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
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
        ) : filteredIncidents.length === 0 ? (
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

                return (
                  <div
                    key={incident.id}
                    className="group hover:bg-gray-50 transition-colors cursor-pointer"
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
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded font-medium">
                                {incident.caseNumber}
                              </span>
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
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incidents/${incident.id}`);
                          }}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
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
                          <div className="flex items-center gap-2 mb-1">
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
                              <span>{formatDisplayDateTime(incident.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination - only show wrapper if more than 1 page */}
            {paginationProps.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Pagination {...paginationProps} />
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
