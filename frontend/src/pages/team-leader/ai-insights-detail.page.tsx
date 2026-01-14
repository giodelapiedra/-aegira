import { useRef, memo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Printer,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileWarning,
  
  Activity,
  CheckCircle2,
  AlertTriangle,
  
  
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { analyticsService, type AISummaryDetail } from '../../services/analytics.service';
import { useUser } from '../../hooks/useUser';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  formatDateTimeFull,
  formatPeriod,
  STATUS_CONFIG,
  RISK_CONFIG,
  type StatusType,
  type RiskLevel,
} from './ai-insights.utils';

// =============================================================================
// TYPES
// =============================================================================

interface PeriodMetrics {
  periodStart: string;
  periodEnd: string;
  checkinRate: number;
  avgScore: number;
  atRiskCount: number;
  totalCheckins: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

interface PeriodComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  changes: {
    checkinRate: number;
    avgScore: number;
    atRiskCount: number;
    totalCheckins: number;
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Background gradient
const GradientBackground = memo(function GradientBackground() {
  return (
    <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none -z-10">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-400/30 via-purple-400/30 via-pink-400/20 to-orange-400/20 blur-3xl rounded-full" />
    </div>
  );
});

// Loading spinner wrapper
const PageLoadingSpinner = memo(function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
});

// Status badge
interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge = memo(function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };
  const iconSizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium border', config.color, sizeClasses[size])}>
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
});

// Change indicator
interface ChangeIndicatorProps {
  value: number;
  inverted?: boolean;
  suffix?: string;
}

const ChangeIndicator = memo(function ChangeIndicator({ value, inverted = false, suffix = '' }: ChangeIndicatorProps) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  const displayValue = Math.abs(value);

  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-gray-500 text-sm">
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  return (
    <span className={cn('flex items-center gap-1 text-sm font-medium', isPositive && 'text-emerald-600', isNegative && 'text-rose-600')}>
      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      <span>{isPositive ? '+' : '-'}{displayValue}{suffix}</span>
    </span>
  );
});

// Section header
interface SectionHeaderProps {
  icon: typeof CheckCircle2;
  title: string;
  iconColor?: string;
}

const SectionHeader = memo(function SectionHeader({ icon: Icon, title, iconColor = 'text-gray-500' }: SectionHeaderProps) {
  return (
    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <Icon className={cn('h-5 w-5', iconColor)} />
      {title}
    </h2>
  );
});

// Metric card
interface MetricCardProps {
  icon: typeof Activity;
  label: string;
  value: string | number;
  subtext?: string;
  gradient: string;
  iconColor: string;
  progress?: { value: number; color: string };
  children?: React.ReactNode;
}

const MetricCard = memo(function MetricCard({ icon: Icon, label, value, subtext, gradient, iconColor, progress, children }: MetricCardProps) {
  return (
    <div className={cn('rounded-xl p-6 border', gradient)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-gray-900">{value}</span>
        {subtext && <span className="text-xl text-gray-400 mb-1">{subtext}</span>}
      </div>
      {progress && (
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', progress.color)} style={{ width: `${progress.value}%` }} />
        </div>
      )}
      {children}
    </div>
  );
});

// List item
interface ListItemProps {
  text: string;
  index?: number;
  variant: 'highlight' | 'concern' | 'recommendation';
}

const ListItem = memo(function ListItem({ text, index, variant }: ListItemProps) {
  const config = {
    highlight: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-800',
      Icon: CheckCircle2,
    },
    concern: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-800',
      Icon: AlertTriangle,
    },
    recommendation: {
      bg: 'bg-violet-50',
      border: 'border-violet-100',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      textColor: 'text-violet-800',
      Icon: TrendingUp,
    },
  };

  const { bg, border, iconBg, iconColor, textColor, Icon } = config[variant];

  return (
    <div className={cn('flex items-start gap-4 p-4 rounded-xl border', bg, border)}>
      <div className={cn('h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0', iconBg)}>
        {index !== undefined ? (
          <span className={cn('text-sm font-semibold', iconColor)}>{index}</span>
        ) : (
          <Icon className={cn('h-4 w-4', iconColor)} />
        )}
      </div>
      <p className={textColor}>{text}</p>
    </div>
  );
});

// Period comparison card
interface PeriodComparisonCardProps {
  comparison: PeriodComparison;
}

const PeriodComparisonCard = memo(function PeriodComparisonCard({ comparison }: PeriodComparisonCardProps) {
  const formatShort = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 rounded-xl border border-violet-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Activity className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Period Comparison</h3>
          <p className="text-sm text-gray-500">
            {formatShort(comparison.current.periodStart, comparison.current.periodEnd)} vs {formatShort(comparison.previous.periodStart, comparison.previous.periodEnd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Check-in Rate</span>
            <ChangeIndicator value={comparison.changes.checkinRate} suffix="%" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{comparison.current.checkinRate}%</span>
            <span className="text-sm text-gray-400">from {comparison.previous.checkinRate}%</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Avg Readiness</span>
            <ChangeIndicator value={comparison.changes.avgScore} suffix="%" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{comparison.current.avgScore}%</span>
            <span className="text-sm text-gray-400">from {comparison.previous.avgScore}%</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">At-Risk Members</span>
            <ChangeIndicator value={comparison.changes.atRiskCount} inverted />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{comparison.current.atRiskCount}</span>
            <span className="text-sm text-gray-400">from {comparison.previous.atRiskCount}</span>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="mt-4 pt-4 border-t border-violet-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Current Period</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-medium">{comparison.current.greenCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-amber-700 font-medium">{comparison.current.yellowCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-rose-700 font-medium">{comparison.current.redCount}</span>
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Previous Period</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="text-emerald-600">{comparison.previous.greenCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="text-amber-600">{comparison.previous.yellowCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="text-rose-600">{comparison.previous.redCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// PRINT HANDLER
// =============================================================================

function generatePrintHTML(summary: AISummaryDetail, teamName: string, timezone: string): string {
  const statusLabels = { healthy: 'Healthy', attention: 'Needs Attention', critical: 'Critical' };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Insights Report - ${teamName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
        .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
        .header .meta { color: #6b7280; font-size: 14px; }
        .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin: 10px 0; }
        .status.healthy { background: #d1fae5; color: #065f46; }
        .status.attention { background: #fef3c7; color: #92400e; }
        .status.critical { background: #fee2e2; color: #991b1b; }
        .section { margin-bottom: 25px; }
        .section h2 { font-size: 16px; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
        .summary { background: #f9fafb; padding: 16px; border-radius: 8px; line-height: 1.6; }
        .list { list-style: none; }
        .list li { padding: 8px 0; padding-left: 20px; position: relative; border-bottom: 1px solid #f3f4f6; }
        .list li:before { content: "•"; position: absolute; left: 0; color: #9ca3af; }
        .list li.highlight:before { color: #10b981; }
        .list li.concern:before { color: #f59e0b; }
        .list li.recommendation:before { color: #8b5cf6; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
        .members-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .members-table th, .members-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .members-table th { background: #f9fafb; font-weight: 600; color: #374151; }
        .comparison-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
        .comparison-card { background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center; }
        .comparison-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .comparison-card .value { font-size: 20px; font-weight: 700; color: #111827; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AegiraAI Insights Report</h1>
        <div class="meta">
          <strong>${teamName}</strong><br/>
          Period: ${formatPeriod(summary.periodStart, summary.periodEnd, timezone)}<br/>
          Generated: ${formatDateTimeFull(summary.createdAt, timezone)} by ${summary.generatedBy}
        </div>
        <div class="status ${summary.overallStatus}">${statusLabels[summary.overallStatus]}</div>
      </div>

      <div class="section">
        <h2>Executive Summary</h2>
        <div class="summary">${summary.summary}</div>
      </div>

      ${summary.highlights.length > 0 ? `
      <div class="section">
        <h2>Highlights</h2>
        <ul class="list">${summary.highlights.map(h => `<li class="highlight">${h}</li>`).join('')}</ul>
      </div>
      ` : ''}

      ${summary.concerns.length > 0 ? `
      <div class="section">
        <h2>Concerns</h2>
        <ul class="list">${summary.concerns.map(c => `<li class="concern">${c}</li>`).join('')}</ul>
      </div>
      ` : ''}

      ${summary.recommendations.length > 0 ? `
      <div class="section">
        <h2>Recommendations</h2>
        <ul class="list">${summary.recommendations.map(r => `<li class="recommendation">${r}</li>`).join('')}</ul>
      </div>
      ` : ''}

      ${summary.aggregateData?.memberAnalytics ? `
      <div class="section">
        <h2>Member Analytics</h2>
        <table class="members-table">
          <thead>
            <tr><th>Name</th><th>Risk</th><th>Avg Score</th><th>Check-in Rate</th><th>G/Y/R</th></tr>
          </thead>
          <tbody>
            ${summary.aggregateData.memberAnalytics.map(m => `
              <tr>
                <td>${m.name}</td>
                <td>${m.riskLevel === 'high' ? 'At Risk' : m.riskLevel === 'medium' ? 'Caution' : 'Good'}</td>
                <td>${m.avgScore}%</td>
                <td>${m.checkinRate}%</td>
                <td>${m.greenCount}/${m.yellowCount}/${m.redCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="footer">Generated by AegiraAI Insights &bull; ${new Date().toLocaleDateString('en-US', { timeZone: timezone })}</div>
    </body>
    </html>
  `;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AIInsightsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { company } = useUser();
  const timezone = company?.timezone || 'Asia/Manila';

  // Queries
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  const { data: summary, isLoading: summaryLoading, error } = useQuery({
    queryKey: ['ai-summary-detail', team?.id, id],
    queryFn: () => analyticsService.getTeamAISummaryById(team!.id, id!),
    enabled: !!team?.id && !!id,
  });

  // Handlers
  const handlePrint = () => {
    if (!summary || !team) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generatePrintHTML(summary, team.name, timezone));
    printWindow.document.close();
    printWindow.print();
  };

  const handleBack = () => navigate('/team/ai-insights');

  // Loading
  if (teamLoading || summaryLoading) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <GradientBackground />
        <PageLoadingSpinner />
      </div>
    );
  }

  // Error
  if (error || !summary) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <GradientBackground />
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <FileWarning className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Not Found</h2>
          <p className="text-gray-500 mb-6">This report could not be found or you don't have access.</p>
          <Link
            to="/team/ai-insights"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Insights
          </Link>
        </div>
      </div>
    );
  }

  const healthScore = summary.aggregateData?.teamHealthScore || 0;

  return (
    <div className="relative min-h-[calc(100vh-120px)]">
      <GradientBackground />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="h-5 w-5" />}
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-purple-600">Report</span>
              </h1>
              <p className="text-gray-500">{team?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handlePrint}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Print
            </Button>
            <Button
              variant="primary"
              onClick={handlePrint}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div ref={printRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Report Header */}
          <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 px-8 py-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Bot className="h-7 w-7 text-white" />
                </div>
                <div>
                  <StatusBadge status={summary.overallStatus} size="lg" />
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {formatPeriod(summary.periodStart, summary.periodEnd, timezone)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {summary.generatedBy}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDateTimeFull(summary.createdAt, timezone)}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Summary */}
            <div>
              <SectionHeader icon={Sparkles} title="Summary" iconColor="text-violet-500" />
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="text-gray-700 leading-relaxed text-base">{summary.summary}</p>
              </div>
            </div>

            {/* Key Metrics */}
            {summary.aggregateData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Health Score */}
                  <MetricCard
                    icon={Activity}
                    label="Team Health Score"
                    value={healthScore}
                    subtext="/100"
                    gradient="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100"
                    iconColor="text-violet-500"
                    progress={{
                      value: healthScore,
                      color: healthScore >= 75 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                    }}
                  >
                    <p className="text-xs text-gray-500 mt-2">Readiness (40%) + Compliance (30%) + Consistency (30%)</p>
                  </MetricCard>

                  {/* Team Grade */}
                  {summary.aggregateData.teamGrade && (
                    <MetricCard
                      icon={TrendingUp}
                      label="Team Grade"
                      value={summary.aggregateData.teamGrade.letter}
                      gradient="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100"
                      iconColor="text-purple-500"
                    >
                      <p className="font-medium text-gray-700 mt-2">{summary.aggregateData.teamGrade.label}</p>
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-purple-100">
                        <div>
                          <p className="text-xs text-gray-500">Avg Readiness</p>
                          <p className="font-semibold text-gray-900">{summary.aggregateData.teamGrade.avgReadiness}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Compliance</p>
                          <p className="font-semibold text-gray-900">{summary.aggregateData.teamGrade.compliance}%</p>
                        </div>
                      </div>
                    </MetricCard>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <Users className="h-5 w-5 text-gray-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{summary.aggregateData.totalMembers}</p>
                    <p className="text-xs text-gray-500">Members</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{summary.highlights.length}</p>
                    <p className="text-xs text-gray-500">Highlights</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{summary.concerns.length}</p>
                    <p className="text-xs text-gray-500">Concerns</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <TrendingUp className="h-5 w-5 text-violet-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{summary.recommendations.length}</p>
                    <p className="text-xs text-gray-500">Recs</p>
                  </div>
                </div>

                {/* Top Performers */}
                {summary.aggregateData.topPerformers && summary.aggregateData.topPerformers.length > 0 && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Top Performers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {summary.aggregateData.topPerformers.map((p: any, i: number) => (
                        <div key={i} className="bg-white rounded-lg p-4 border border-emerald-100">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white', i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-600')}>
                              {i + 1}
                            </div>
                            <span className="font-medium text-gray-900">{p.name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold text-emerald-600">{p.avgScore}%</p>
                              <p className="text-xs text-gray-500">Score</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-violet-600">{p.checkinRate}%</p>
                              <p className="text-xs text-gray-500">Rate</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-purple-600">{p.currentStreak}</p>
                              <p className="text-xs text-gray-500">Streak</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Root Cause Analysis */}
                {summary.aggregateData.topReasons && summary.aggregateData.topReasons.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Root Cause Analysis</h3>
                    <div className="space-y-3">
                      {summary.aggregateData.topReasons.map((r: any, i: number) => {
                        const total = summary.aggregateData!.topReasons!.reduce((sum: number, x: any) => sum + x.count, 0);
                        const pct = Math.round((r.count / total) * 100);
                        return (
                          <div key={i} className="flex items-center gap-4">
                            <div className="w-28 text-sm font-medium text-gray-700 truncate">{r.label}</div>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full flex items-center justify-end pr-2" style={{ width: `${pct}%` }}>
                                {pct >= 15 && <span className="text-xs font-medium text-white">{r.count}</span>}
                              </div>
                            </div>
                            <div className="w-10 text-sm text-gray-500 text-right">{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Period Comparison */}
            {summary.aggregateData?.periodComparison && (
              <PeriodComparisonCard comparison={summary.aggregateData.periodComparison as PeriodComparison} />
            )}

            {/* Highlights */}
            {summary.highlights.length > 0 && (
              <div>
                <SectionHeader icon={CheckCircle2} title="Highlights" iconColor="text-emerald-500" />
                <div className="space-y-3">
                  {summary.highlights.map((h, i) => <ListItem key={i} text={h} variant="highlight" />)}
                </div>
              </div>
            )}

            {/* Concerns */}
            {summary.concerns.length > 0 && (
              <div>
                <SectionHeader icon={AlertTriangle} title="Concerns" iconColor="text-amber-500" />
                <div className="space-y-3">
                  {summary.concerns.map((c, i) => <ListItem key={i} text={c} variant="concern" />)}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {summary.recommendations.length > 0 && (
              <div>
                <SectionHeader icon={TrendingUp} title="Recommendations" iconColor="text-violet-500" />
                <div className="space-y-3">
                  {summary.recommendations.map((r, i) => <ListItem key={i} text={r} index={i + 1} variant="recommendation" />)}
                </div>
              </div>
            )}

            {/* Member Analytics */}
            {summary.aggregateData?.memberAnalytics && summary.aggregateData.memberAnalytics.length > 0 && (
              <div>
                <SectionHeader icon={Users} title="Member Analytics" />
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Risk</th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Score</th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Rate</th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">G/Y/R</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.aggregateData.memberAnalytics.map((m, i) => {
                        const risk = RISK_CONFIG[m.riskLevel as RiskLevel];
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">{m.name}</td>
                            <td className="px-6 py-4">
                              <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', risk.className)}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-gray-900">{m.avgScore}%</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn('font-semibold', m.checkinRate >= 80 ? 'text-emerald-600' : m.checkinRate >= 50 ? 'text-amber-600' : 'text-rose-600')}>
                                  {m.checkinRate}%
                                </span>
                                {m.expectedWorkDays !== undefined && (
                                  <span className="text-xs text-gray-500 mt-0.5">
                                    ({m.checkinCount || 0}/{m.expectedWorkDays})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-emerald-600 font-medium">{m.greenCount}</span>
                              <span className="text-gray-400 mx-1">/</span>
                              <span className="text-amber-600 font-medium">{m.yellowCount}</span>
                              <span className="text-gray-400 mx-1">/</span>
                              <span className="text-rose-600 font-medium">{m.redCount}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              <Sparkles className="inline h-4 w-4 mr-1" />
              Generated by AegiraAI Insights
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIInsightsDetailPage;
