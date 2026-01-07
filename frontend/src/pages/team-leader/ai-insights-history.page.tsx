import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  User,
  TrendingUp,
  MessageSquare,
  Search,
  Filter,
  BarChart3,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { analyticsService, type AISummaryHistoryItem } from '../../services/analytics.service';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { useUser } from '../../hooks/useUser';

// Helper to format date with timezone
function formatDate(dateStr: string, timezone: string = 'Asia/Manila'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

function formatDateTime(dateStr: string, timezone: string = 'Asia/Manila'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatPeriod(startDate: string, endDate: string, timezone: string = 'Asia/Manila'): string {
  return `${formatDate(startDate, timezone)} - ${formatDate(endDate, timezone)}`;
}

// Calculate days in period
function getDaysInPeriod(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Status config
const statusConfig = {
  healthy: {
    icon: CheckCircle2,
    label: 'Healthy',
    color: 'bg-success-100 text-success-700 border-success-200',
    bgColor: 'bg-success-50',
  },
  attention: {
    icon: AlertTriangle,
    label: 'Needs Attention',
    color: 'bg-warning-100 text-warning-700 border-warning-200',
    bgColor: 'bg-warning-50',
  },
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    color: 'bg-danger-100 text-danger-700 border-danger-200',
    bgColor: 'bg-danger-50',
  },
};

// Main Page Component
export function AIInsightsHistoryPage() {
  const navigate = useNavigate();
  const { company } = useUser();
  const timezone = company?.timezone || 'Asia/Manila';
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  // Get AI summary history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['ai-summary-history', team?.id],
    queryFn: async () => {
      const result = await analyticsService.getTeamAISummaryHistory(team!.id);
      return result;
    },
    enabled: !!team?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const allSummaries: AISummaryHistoryItem[] = historyData?.summaries || [];

  // Filter summaries
  const filteredSummaries = allSummaries.filter((summary) => {
    // Status filter
    if (statusFilter && summary.overallStatus !== statusFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        summary.summary.toLowerCase().includes(query) ||
        summary.generatedBy.toLowerCase().includes(query) ||
        summary.concerns.some((c) => c.toLowerCase().includes(query)) ||
        summary.recommendations.some((r) => r.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Pagination
  const { paginatedData: summaries, paginationProps } = usePagination(filteredSummaries, {
    pageSize: 5,
  });

  // Stats
  const stats = {
    total: allSummaries.length,
    healthy: allSummaries.filter((s) => s.overallStatus === 'healthy').length,
    attention: allSummaries.filter((s) => s.overallStatus === 'attention').length,
    critical: allSummaries.filter((s) => s.overallStatus === 'critical').length,
  };

  if (teamLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Brain className="h-16 w-16 text-gray-300 mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-gray-500 mt-1">AI-generated reports for {team.name}</p>
        </div>

        <button
          onClick={() => navigate('/team/ai-chat')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm"
        >
          <MessageSquare className="h-4 w-4" />
          Generate New Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Reports</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-success-200 p-4 bg-success-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success-700">{stats.healthy}</p>
              <p className="text-sm text-success-600">Healthy</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-warning-200 p-4 bg-warning-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning-700">{stats.attention}</p>
              <p className="text-sm text-warning-600">Attention</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-danger-200 p-4 bg-danger-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-danger-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-danger-700">{stats.critical}</p>
              <p className="text-sm text-danger-600">Critical</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {allSummaries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports by content, concerns, or recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="">All Status</option>
                <option value="healthy">Healthy</option>
                <option value="attention">Needs Attention</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary List */}
      {allSummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No AI Insights Yet</h3>
          <p className="text-gray-500 mb-6">Generate your first AI insights using the Chat Bot.</p>
          <button
            onClick={() => navigate('/team/ai-chat')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Brain className="h-4 w-4" />
            Go to Chat Bot
          </button>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching reports</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reports List */}
          {summaries?.map((summary: AISummaryHistoryItem) => {
            const status = statusConfig[summary.overallStatus];
            const StatusIcon = status.icon;
            const daysInPeriod = getDaysInPeriod(summary.periodStart, summary.periodEnd);

            return (
              <div
                key={summary.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/team/ai-insights/${summary.id}`)}
              >
                {/* Card Header with Status */}
                <div className={cn('px-6 py-3 border-b', status.bgColor, 'border-gray-100')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border', status.color)}>
                        <StatusIcon className="h-4 w-4" />
                        {status.label}
                      </span>
                      <span className="text-sm text-gray-500">
                        {daysInPeriod} day report
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {formatDateTime(summary.createdAt, timezone)}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Period */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{formatPeriod(summary.periodStart, summary.periodEnd, timezone)}</span>
                        <span className="text-gray-400">•</span>
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{summary.generatedBy}</span>
                      </div>

                      {/* Summary Preview */}
                      <p className="text-gray-700 line-clamp-2 mb-4">{summary.summary}</p>

                      {/* Quick Stats */}
                      <div className="flex flex-wrap gap-4">
                        {summary.highlights.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-success-500" />
                            <span className="text-success-700 font-medium">{summary.highlights.length}</span>
                            <span className="text-gray-500">highlight{summary.highlights.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {summary.concerns.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <AlertTriangle className="h-4 w-4 text-warning-500" />
                            <span className="text-warning-700 font-medium">{summary.concerns.length}</span>
                            <span className="text-gray-500">concern{summary.concerns.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {summary.recommendations.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <TrendingUp className="h-4 w-4 text-primary-500" />
                            <span className="text-primary-700 font-medium">{summary.recommendations.length}</span>
                            <span className="text-gray-500">recommendation{summary.recommendations.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">
                        View Details
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-4">
            <Pagination {...paginationProps} />
          </div>
        </div>
      )}
    </div>
  );
}
