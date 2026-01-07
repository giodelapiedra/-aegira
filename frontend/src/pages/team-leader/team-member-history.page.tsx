import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { formatDisplayDate, formatTime } from '../../lib/date-utils';
import {
  History,
  Smile,
  Brain,
  Moon,
  Heart,
  ChevronDown,
  Users,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
  };
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function TeamMemberHistoryPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'GREEN' | 'YELLOW' | 'RED'>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 15;

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  const members: TeamMember[] = team?.members || [];

  // Get team check-ins with pagination
  const { data: checkinsData, isLoading: checkinsLoading } = useQuery({
    queryKey: ['team-checkins-history', team?.id, page, filter, selectedMemberId],
    queryFn: async () => {
      const params: any = {
        page,
        limit,
        teamId: team?.id,
      };
      if (filter !== 'all') {
        params.status = filter;
      }
      if (selectedMemberId !== 'all') {
        params.userId = selectedMemberId;
      }
      const response = await api.get('/checkins', { params });
      return response.data as {
        data: TeamCheckin[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    },
    enabled: !!team?.id,
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'GREEN':
        return {
          variant: 'success' as const,
          label: 'Ready',
          icon: CheckCircle2,
          bg: 'bg-success-50',
          text: 'text-success-700',
          dot: 'bg-success-500',
        };
      case 'YELLOW':
        return {
          variant: 'warning' as const,
          label: 'Limited',
          icon: AlertCircle,
          bg: 'bg-warning-50',
          text: 'text-warning-700',
          dot: 'bg-warning-500',
        };
      case 'RED':
        return {
          variant: 'danger' as const,
          label: 'Not Ready',
          icon: XCircle,
          bg: 'bg-danger-50',
          text: 'text-danger-700',
          dot: 'bg-danger-500',
        };
      default:
        return {
          variant: 'default' as const,
          label: 'Unknown',
          icon: AlertCircle,
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          dot: 'bg-gray-500',
        };
    }
  };

  const getMetricColor = (value: number, inverted = false) => {
    if (inverted) {
      if (value <= 3) return 'text-success-600';
      if (value <= 6) return 'text-warning-600';
      return 'text-danger-600';
    }
    if (value <= 3) return 'text-danger-600';
    if (value <= 6) return 'text-warning-600';
    return 'text-success-600';
  };

  const totalPages = checkinsData?.pagination ? Math.ceil(checkinsData.pagination.total / limit) : 1;
  const isLoading = teamLoading || checkinsLoading;

  const selectedMember = members.find(m => m.id === selectedMemberId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Team Assigned</h2>
        <p className="text-gray-500">You are not currently assigned to a team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <History className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Check-in History</h1>
            <p className="text-slate-300 text-sm mt-0.5">
              {team.name} • {checkinsData?.pagination?.total || 0} total records
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Member Dropdown */}
        <div className="relative">
          <select
            value={selectedMemberId}
            onChange={(e) => {
              setSelectedMemberId(e.target.value);
              setPage(1);
            }}
            className="appearance-none w-full sm:w-56 pl-10 pr-10 py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">All Members ({members.length})</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => {
            const isActive = filter === status;
            return (
              <button
                key={status}
                onClick={() => { setFilter(status); setPage(1); }}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? status === 'all'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : status === 'GREEN'
                        ? 'bg-success-500 text-white shadow-sm'
                        : status === 'YELLOW'
                          ? 'bg-warning-500 text-white shadow-sm'
                          : 'bg-danger-500 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {status === 'all' ? 'All Status' : status === 'GREEN' ? 'Ready' : status === 'YELLOW' ? 'Limited' : 'Not Ready'}
              </button>
            );
          })}
        </div>
      </div>

      {/* History Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {!checkinsData?.data || checkinsData.data.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium">No records found</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedMemberId !== 'all'
                  ? `${selectedMember?.firstName} has no check-in records yet`
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">Member</div>
                <div className="col-span-2">Date & Time</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-4 text-center">Metrics</div>
                <div className="col-span-1 text-center">Score</div>
              </div>

              {/* Table Rows */}
              {checkinsData.data.map((checkin) => {
                const config = getStatusConfig(checkin.readinessStatus);
                const isExpanded = expandedId === checkin.id;
                const StatusIcon = config.icon;

                return (
                  <div key={checkin.id} className="group">
                    {/* Main Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : checkin.id)}
                      className={cn(
                        'grid grid-cols-2 md:grid-cols-12 gap-4 px-4 md:px-6 py-4 cursor-pointer transition-colors',
                        isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'
                      )}
                    >
                      {/* Member */}
                      <div className="col-span-1 md:col-span-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-white">
                            {checkin.user.firstName.charAt(0)}{checkin.user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {checkin.user.firstName} {checkin.user.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate md:hidden">
                            {formatDisplayDate(checkin.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Date & Time - Desktop */}
                      <div className="hidden md:flex md:col-span-2 flex-col justify-center">
                        <p className="text-sm text-gray-900">{formatDisplayDate(checkin.createdAt)}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(checkin.createdAt)}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-end md:justify-center">
                        <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium', config.bg, config.text)}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{config.label}</span>
                        </div>
                      </div>

                      {/* Metrics - Desktop */}
                      <div className="hidden md:flex md:col-span-4 items-center justify-center gap-4">
                        <div className="text-center">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-1">
                            <Smile className="h-4 w-4 text-blue-600" />
                          </div>
                          <p className={cn('text-sm font-bold', getMetricColor(checkin.mood))}>{checkin.mood}</p>
                          <p className="text-[10px] text-gray-400">Mood</p>
                        </div>
                        <div className="text-center">
                          <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-1">
                            <Brain className="h-4 w-4 text-purple-600" />
                          </div>
                          <p className={cn('text-sm font-bold', getMetricColor(checkin.stress, true))}>{checkin.stress}</p>
                          <p className="text-[10px] text-gray-400">Stress</p>
                        </div>
                        <div className="text-center">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-1">
                            <Moon className="h-4 w-4 text-indigo-600" />
                          </div>
                          <p className={cn('text-sm font-bold', getMetricColor(checkin.sleep))}>{checkin.sleep}</p>
                          <p className="text-[10px] text-gray-400">Sleep</p>
                        </div>
                        <div className="text-center">
                          <div className="h-8 w-8 rounded-lg bg-status-red-50 flex items-center justify-center mx-auto mb-1">
                            <Heart className="h-4 w-4 text-status-red-600" />
                          </div>
                          <p className={cn('text-sm font-bold', getMetricColor(checkin.physicalHealth))}>{checkin.physicalHealth}</p>
                          <p className="text-[10px] text-gray-400">Physical</p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="hidden md:flex md:col-span-1 items-center justify-center">
                        <span className={cn(
                          'text-lg font-bold',
                          checkin.readinessScore >= 70 ? 'text-success-600' :
                          checkin.readinessScore >= 40 ? 'text-warning-600' : 'text-danger-600'
                        )}>
                          {checkin.readinessScore}%
                        </span>
                      </div>
                    </div>

                    {/* Expanded Details - Mobile & Notes */}
                    {isExpanded && (
                      <div className="px-4 md:px-6 pb-4 bg-gray-50 border-t border-gray-100">
                        {/* Mobile Metrics */}
                        <div className="md:hidden grid grid-cols-4 gap-3 py-4">
                          <div className="text-center">
                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                              <Smile className="h-5 w-5 text-blue-600" />
                            </div>
                            <p className={cn('text-xl font-bold', getMetricColor(checkin.mood))}>{checkin.mood}</p>
                            <p className="text-xs text-gray-500">Mood</p>
                          </div>
                          <div className="text-center">
                            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-2">
                              <Brain className="h-5 w-5 text-purple-600" />
                            </div>
                            <p className={cn('text-xl font-bold', getMetricColor(checkin.stress, true))}>{checkin.stress}</p>
                            <p className="text-xs text-gray-500">Stress</p>
                          </div>
                          <div className="text-center">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                              <Moon className="h-5 w-5 text-indigo-600" />
                            </div>
                            <p className={cn('text-xl font-bold', getMetricColor(checkin.sleep))}>{checkin.sleep}</p>
                            <p className="text-xs text-gray-500">Sleep</p>
                          </div>
                          <div className="text-center">
                            <div className="h-10 w-10 rounded-lg bg-status-red-50 flex items-center justify-center mx-auto mb-2">
                              <Heart className="h-5 w-5 text-status-red-600" />
                            </div>
                            <p className={cn('text-xl font-bold', getMetricColor(checkin.physicalHealth))}>{checkin.physicalHealth}</p>
                            <p className="text-xs text-gray-500">Physical</p>
                          </div>
                        </div>

                        {/* Mobile Score */}
                        <div className="md:hidden flex items-center justify-between py-3 border-t border-gray-200">
                          <span className="text-sm text-gray-500">Readiness Score</span>
                          <span className={cn(
                            'text-xl font-bold',
                            checkin.readinessScore >= 70 ? 'text-success-600' :
                            checkin.readinessScore >= 40 ? 'text-warning-600' : 'text-danger-600'
                          )}>
                            {checkin.readinessScore}%
                          </span>
                        </div>

                        {/* Notes */}
                        {checkin.notes && (
                          <div className="flex items-start gap-2 pt-3 border-t border-gray-200">
                            <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-600">{checkin.notes}</p>
                          </div>
                        )}

                        {!checkin.notes && (
                          <p className="text-sm text-gray-400 italic pt-3 border-t border-gray-200">No notes provided</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {checkinsData?.data && checkinsData.data.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={checkinsData?.pagination?.total}
                pageSize={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




