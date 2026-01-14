import { useState, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  User,
  Search,
  Filter,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { analyticsService, type AISummaryHistoryItem } from '../../services/analytics.service';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { useUser } from '../../hooks/useUser';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  formatDateTime,
  formatPeriod,
  getDaysInPeriod,
  STATUS_CONFIG,
  type StatusType,
} from './ai-insights.utils';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Background gradient glow effect (same as AI Chat)
const GradientBackground = memo(function GradientBackground() {
  return (
    <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none -z-10">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-400/30 via-purple-400/30 via-pink-400/20 to-orange-400/20 blur-3xl rounded-full" />
    </div>
  );
});

// Branding header
const Branding = memo(function Branding() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-primary-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
        <BarChart3 className="h-6 w-6 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-purple-600">Insights</span>
        </h1>
        <p className="text-sm text-gray-500">AI-generated reports & analytics</p>
      </div>
    </div>
  );
});

// Status badge
interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

const StatusBadge = memo(function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium border', config.color, sizeClass)}>
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      {config.label}
    </span>
  );
});

// Stats card
interface StatsCardProps {
  icon: typeof BarChart3;
  value: number;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatsCard = memo(function StatsCard({ icon: Icon, value, label, variant = 'default' }: StatsCardProps) {
  const variantStyles = {
    default: {
      bg: 'bg-white',
      border: 'border-gray-200',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      valueColor: 'text-gray-900',
      labelColor: 'text-gray-500',
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
      labelColor: 'text-emerald-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
      labelColor: 'text-amber-600',
    },
    danger: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      valueColor: 'text-rose-700',
      labelColor: 'text-rose-600',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn('rounded-xl border p-4', styles.bg, styles.border)}>
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', styles.iconBg)}>
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
        <div>
          <p className={cn('text-2xl font-bold', styles.valueColor)}>{value}</p>
          <p className={cn('text-sm', styles.labelColor)}>{label}</p>
        </div>
      </div>
    </div>
  );
});

// Report card
interface ReportCardProps {
  summary: AISummaryHistoryItem;
  timezone: string;
  onClick: () => void;
}

const ReportCard = memo(function ReportCard({ summary, timezone, onClick }: ReportCardProps) {
  const status = STATUS_CONFIG[summary.overallStatus];
  const daysInPeriod = getDaysInPeriod(summary.periodStart, summary.periodEnd);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      {/* Card Header */}
      <div className={cn('px-5 py-3 border-b border-gray-100', status.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={summary.overallStatus} size="sm" />
            <span className="text-sm text-gray-500">{daysInPeriod} day report</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {formatDateTime(summary.createdAt, timezone)}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Period & Author */}
            <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{formatPeriod(summary.periodStart, summary.periodEnd, timezone)}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-gray-400" />
                {summary.generatedBy}
              </span>
            </div>

            {/* Summary Preview */}
            <p className="text-gray-700 line-clamp-2 mb-4">{summary.summary}</p>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4">
              {summary.highlights.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-700 font-medium">{summary.highlights.length}</span>
                  <span className="text-gray-500">highlight{summary.highlights.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {summary.concerns.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-700 font-medium">{summary.concerns.length}</span>
                  <span className="text-gray-500">concern{summary.concerns.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {summary.recommendations.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  <span className="text-violet-700 font-medium">{summary.recommendations.length}</span>
                  <span className="text-gray-500">rec{summary.recommendations.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="flex-shrink-0">
            <Button variant="secondary" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
              View Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

// Empty state
interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: typeof Bot;
  };
}

const EmptyState = memo(function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant="primary"
          leftIcon={action.icon && <action.icon className="h-4 w-4" />}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
});


// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AIInsightsHistoryPage() {
  const navigate = useNavigate();
  const { company } = useUser();
  const timezone = company?.timezone || 'Asia/Manila';

  // State
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['ai-summary-history', team?.id],
    queryFn: () => analyticsService.getTeamAISummaryHistory(team!.id),
    enabled: !!team?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes - historical data doesn't change frequently
  });

  const allSummaries: AISummaryHistoryItem[] = historyData?.summaries || [];

  // Filter summaries
  const filteredSummaries = allSummaries.filter((summary) => {
    if (statusFilter && summary.overallStatus !== statusFilter) return false;
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

  // Handlers
  const handleViewReport = (id: string) => {
    navigate(`/team/ai-insights/${id}`);
  };

  const handleGenerateNew = () => {
    navigate('/team/ai-chat');
  };

  // Loading state
  if (teamLoading || historyLoading) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <GradientBackground />
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // No team state
  if (!team) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <GradientBackground />
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Bot className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Team Assigned</h2>
          <p className="text-gray-500">You are not currently assigned to a team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)]">
      <GradientBackground />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Branding />

          <div className="flex items-center gap-3">
            <Link to="/team/ai-chat">
              <Button variant="ghost" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />}>
                Chat
              </Button>
            </Link>
            <Button
              onClick={handleGenerateNew}
              variant="primary"
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Generate New
            </Button>
          </div>
        </div>

        {/* Team Name */}
        <p className="text-gray-500">
          Reports for <span className="font-medium text-gray-700">{team.name}</span>
        </p>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard icon={BarChart3} value={stats.total} label="Total Reports" variant="default" />
          <StatsCard icon={CheckCircle2} value={stats.healthy} label="Healthy" variant="success" />
          <StatsCard icon={AlertTriangle} value={stats.attention} label="Attention" variant="warning" />
          <StatsCard icon={AlertCircle} value={stats.critical} label="Critical" variant="danger" />
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
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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

        {/* Content */}
        {allSummaries.length === 0 ? (
          <EmptyState
            title="No AI Insights Yet"
            description="Generate your first AI insights using AegiraAI Chat."
            action={{
              label: 'Go to Chat',
              onClick: handleGenerateNew,
              icon: Bot,
            }}
          />
        ) : filteredSummaries.length === 0 ? (
          <EmptyState
            title="No matching reports"
            description="Try adjusting your search or filter criteria."
          />
        ) : (
          <div className="space-y-4">
            {summaries?.map((summary: AISummaryHistoryItem) => (
              <ReportCard
                key={summary.id}
                summary={summary}
                timezone={timezone}
                onClick={() => handleViewReport(summary.id)}
              />
            ))}

            {/* Pagination */}
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-4">
              <Pagination {...paginationProps} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-xs text-gray-400">
            <Sparkles className="inline h-3 w-3 mr-1" />
            All reports are generated by AegiraAI and stored securely.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIInsightsHistoryPage;
