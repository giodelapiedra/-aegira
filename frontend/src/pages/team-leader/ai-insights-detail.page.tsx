import { useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileWarning,
  Loader2,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { analyticsService, type AISummaryDetail } from '../../services/analytics.service';
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
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatPeriod(startDate: string, endDate: string, timezone: string = 'Asia/Manila'): string {
  return `${formatDate(startDate, timezone)} - ${formatDate(endDate, timezone)}`;
}

// Period Comparison types
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

// Change indicator component
function ChangeIndicator({ value, inverted = false, suffix = '' }: { value: number; inverted?: boolean; suffix?: string }) {
  // For inverted metrics (like atRiskCount), negative is good
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
    <span className={cn(
      'flex items-center gap-1 text-sm font-medium',
      isPositive && 'text-success-600',
      isNegative && 'text-danger-600'
    )}>
      {isPositive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      <span>
        {isPositive ? '+' : '-'}{displayValue}{suffix}
      </span>
    </span>
  );
}

// Period Comparison Card component
function PeriodComparisonCard({ comparison }: { comparison: PeriodComparison }) {
  const formatShortPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Activity className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Period Comparison</h3>
          <p className="text-sm text-gray-500">
            {formatShortPeriod(comparison.current.periodStart, comparison.current.periodEnd)} vs {formatShortPeriod(comparison.previous.periodStart, comparison.previous.periodEnd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Check-in Rate */}
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

        {/* Avg Score */}
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

        {/* At-Risk Members */}
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

      {/* Status Distribution Comparison */}
      <div className="mt-4 pt-4 border-t border-blue-100">
        <div className="grid grid-cols-2 gap-4">
          {/* Current Period */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Current Period</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-success-500"></span>
                <span className="text-success-700 font-medium">{comparison.current.greenCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-warning-500"></span>
                <span className="text-warning-700 font-medium">{comparison.current.yellowCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-danger-500"></span>
                <span className="text-danger-700 font-medium">{comparison.current.redCount}</span>
              </span>
              <span className="text-xs text-gray-400">({comparison.current.totalCheckins} total)</span>
            </div>
          </div>

          {/* Previous Period */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Previous Period</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-success-300"></span>
                <span className="text-success-600">{comparison.previous.greenCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-warning-300"></span>
                <span className="text-warning-600">{comparison.previous.yellowCount}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-danger-300"></span>
                <span className="text-danger-600">{comparison.previous.redCount}</span>
              </span>
              <span className="text-xs text-gray-400">({comparison.previous.totalCheckins} total)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status, size = 'md' }: { status: 'healthy' | 'attention' | 'critical'; size?: 'sm' | 'md' | 'lg' }) {
  const config = {
    healthy: {
      icon: CheckCircle2,
      label: 'Healthy',
      className: 'bg-success-100 text-success-700 border-success-200',
    },
    attention: {
      icon: AlertTriangle,
      label: 'Needs Attention',
      className: 'bg-warning-100 text-warning-700 border-warning-200',
    },
    critical: {
      icon: AlertCircle,
      label: 'Critical',
      className: 'bg-danger-100 text-danger-700 border-danger-200',
    },
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium border', className, sizeClasses[size])}>
      <Icon className={cn(size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      {label}
    </span>
  );
}

export function AIInsightsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { company } = useUser();
  const timezone = company?.timezone || 'Asia/Manila';

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
  });

  // Get summary detail
  const { data: summary, isLoading: summaryLoading, error } = useQuery({
    queryKey: ['ai-summary-detail', team?.id, id],
    queryFn: async () => {
      const result = await analyticsService.getTeamAISummaryById(team!.id, id!);
      return result;
    },
    enabled: !!team?.id && !!id,
  });

  const handlePrint = () => {
    if (!summary || !team) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Insights Report - ${team.name}</title>
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
          .list li.recommendation:before { color: #3b82f6; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
          .members-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          .members-table th, .members-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .members-table th { background: #f9fafb; font-weight: 600; color: #374151; }
          .risk-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
          .risk-high { background: #fee2e2; color: #991b1b; }
          .risk-medium { background: #fef3c7; color: #92400e; }
          .risk-low { background: #d1fae5; color: #065f46; }
          .comparison-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
          .comparison-card { background: #f9fafb; padding: 12px; border-radius: 8px; text-align: center; }
          .comparison-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
          .comparison-card .value { font-size: 20px; font-weight: 700; color: #111827; }
          .comparison-card .change { font-size: 12px; margin-top: 4px; }
          .comparison-card .change.positive { color: #059669; }
          .comparison-card .change.negative { color: #dc2626; }
          .comparison-card .change.neutral { color: #6b7280; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AEGIRA AI Insights Report</h1>
          <div class="meta">
            <strong>${team.name}</strong><br/>
            Period: ${formatPeriod(summary.periodStart, summary.periodEnd, timezone)}<br/>
            Generated: ${formatDateTime(summary.createdAt, timezone)} by ${summary.generatedBy}
          </div>
          <div class="status ${summary.overallStatus}">${summary.overallStatus === 'healthy' ? 'Healthy' : summary.overallStatus === 'attention' ? 'Needs Attention' : 'Critical'}</div>
        </div>

        ${summary.aggregateData ? `
        <div class="section">
          <h2>Key Metrics</h2>
          <div class="comparison-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="comparison-card">
              <div class="label">Team Health Score</div>
              <div class="value">${summary.aggregateData.teamHealthScore || 0}/100</div>
            </div>
            ${summary.aggregateData.teamGrade ? `
            <div class="comparison-card">
              <div class="label">Team Grade</div>
              <div class="value">${summary.aggregateData.teamGrade.letter}</div>
              <div style="font-size: 11px; color: #6b7280;">${summary.aggregateData.teamGrade.label}</div>
            </div>
            <div class="comparison-card">
              <div class="label">Avg Readiness</div>
              <div class="value">${summary.aggregateData.teamGrade.avgReadiness}%</div>
            </div>
            <div class="comparison-card">
              <div class="label">Compliance</div>
              <div class="value">${summary.aggregateData.teamGrade.compliance}%</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <div class="section">
          <h2>Executive Summary</h2>
          <div class="summary">${summary.summary}</div>
        </div>

        ${summary.aggregateData?.topPerformers && summary.aggregateData.topPerformers.length > 0 ? `
        <div class="section">
          <h2>Top Performers (Recognition Recommended)</h2>
          <table class="members-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Avg Score</th>
                <th>Check-in Rate</th>
                <th>Current Streak</th>
              </tr>
            </thead>
            <tbody>
              ${summary.aggregateData.topPerformers.map((p: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.name}</td>
                  <td>${p.avgScore}%</td>
                  <td>${p.checkinRate}%</td>
                  <td>${p.currentStreak} days</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${summary.aggregateData?.topReasons && summary.aggregateData.topReasons.length > 0 ? `
        <div class="section">
          <h2>Root Cause Analysis (Low Score Reasons)</h2>
          <table class="members-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const total = summary.aggregateData!.topReasons!.reduce((sum: number, r: any) => sum + r.count, 0);
                return summary.aggregateData!.topReasons!.map((r: any) => `
                  <tr>
                    <td>${r.label}</td>
                    <td>${r.count}</td>
                    <td>${Math.round((r.count / total) * 100)}%</td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${summary.aggregateData?.periodComparison ? `
        <div class="section">
          <h2>Period Comparison</h2>
          <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
            Current: ${formatDate(summary.aggregateData.periodComparison.current.periodStart, timezone)} - ${formatDate(summary.aggregateData.periodComparison.current.periodEnd, timezone)} vs
            Previous: ${formatDate(summary.aggregateData.periodComparison.previous.periodStart, timezone)} - ${formatDate(summary.aggregateData.periodComparison.previous.periodEnd, timezone)}
          </p>
          <div class="comparison-grid">
            <div class="comparison-card">
              <div class="label">Check-in Rate</div>
              <div class="value">${summary.aggregateData.periodComparison.current.checkinRate}%</div>
              <div class="change ${summary.aggregateData.periodComparison.changes.checkinRate > 0 ? 'positive' : summary.aggregateData.periodComparison.changes.checkinRate < 0 ? 'negative' : 'neutral'}">
                ${summary.aggregateData.periodComparison.changes.checkinRate > 0 ? '↑' : summary.aggregateData.periodComparison.changes.checkinRate < 0 ? '↓' : '→'}
                ${summary.aggregateData.periodComparison.changes.checkinRate > 0 ? '+' : ''}${summary.aggregateData.periodComparison.changes.checkinRate}% from ${summary.aggregateData.periodComparison.previous.checkinRate}%
              </div>
            </div>
            <div class="comparison-card">
              <div class="label">Avg Readiness</div>
              <div class="value">${summary.aggregateData.periodComparison.current.avgScore}%</div>
              <div class="change ${summary.aggregateData.periodComparison.changes.avgScore > 0 ? 'positive' : summary.aggregateData.periodComparison.changes.avgScore < 0 ? 'negative' : 'neutral'}">
                ${summary.aggregateData.periodComparison.changes.avgScore > 0 ? '↑' : summary.aggregateData.periodComparison.changes.avgScore < 0 ? '↓' : '→'}
                ${summary.aggregateData.periodComparison.changes.avgScore > 0 ? '+' : ''}${summary.aggregateData.periodComparison.changes.avgScore}% from ${summary.aggregateData.periodComparison.previous.avgScore}%
              </div>
            </div>
            <div class="comparison-card">
              <div class="label">At-Risk Members</div>
              <div class="value">${summary.aggregateData.periodComparison.current.atRiskCount}</div>
              <div class="change ${summary.aggregateData.periodComparison.changes.atRiskCount < 0 ? 'positive' : summary.aggregateData.periodComparison.changes.atRiskCount > 0 ? 'negative' : 'neutral'}">
                ${summary.aggregateData.periodComparison.changes.atRiskCount < 0 ? '↓' : summary.aggregateData.periodComparison.changes.atRiskCount > 0 ? '↑' : '→'}
                ${summary.aggregateData.periodComparison.changes.atRiskCount !== 0 ? Math.abs(summary.aggregateData.periodComparison.changes.atRiskCount) : 'No change'} from ${summary.aggregateData.periodComparison.previous.atRiskCount}
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        ${summary.highlights.length > 0 ? `
        <div class="section">
          <h2>Highlights</h2>
          <ul class="list">
            ${summary.highlights.map(h => `<li class="highlight">${h}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${summary.concerns.length > 0 ? `
        <div class="section">
          <h2>Concerns</h2>
          <ul class="list">
            ${summary.concerns.map(c => `<li class="concern">${c}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${summary.recommendations.length > 0 ? `
        <div class="section">
          <h2>Recommendations</h2>
          <ul class="list">
            ${summary.recommendations.map(r => `<li class="recommendation">${r}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${summary.aggregateData?.memberAnalytics ? `
        <div class="section">
          <h2>Member Analytics</h2>
          <table class="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Risk Level</th>
                <th>Avg Score</th>
                <th>Check-in Rate</th>
                <th>Status Distribution</th>
              </tr>
            </thead>
            <tbody>
              ${summary.aggregateData.memberAnalytics.map(m => `
                <tr>
                  <td>${m.name}</td>
                  <td><span class="risk-badge risk-${m.riskLevel}">${m.riskLevel === 'high' ? 'At Risk' : m.riskLevel === 'medium' ? 'Caution' : 'Good'}</span></td>
                  <td>${m.avgScore}%</td>
                  <td>${m.checkinRate}%</td>
                  <td>${m.greenCount}G / ${m.yellowCount}Y / ${m.redCount}R</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          Generated by AEGIRA AI Insights &bull; ${new Date().toLocaleDateString('en-US', { timeZone: timezone })}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (teamLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <FileWarning className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Not Found</h2>
        <p className="text-gray-500 mb-6">This AI Insights report could not be found or you don't have access to it.</p>
        <Link
          to="/team/ai-insights"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Insights
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/team/ai-insights')}
            className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Insights Report</h1>
            <p className="text-gray-500">{team?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div ref={printRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-primary-50 via-purple-50 to-primary-50 px-8 py-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center">
                <Brain className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <StatusBadge status={summary.overallStatus} size="lg" />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
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
                {formatDateTime(summary.createdAt, timezone)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed text-base">{summary.summary}</p>
            </div>
          </div>

          {/* Key Metrics */}
          {summary.aggregateData && (
            <div className="space-y-4">
              {/* Team Health Score & Grade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team Health Score */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Team Health Score</h3>
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {summary.aggregateData.teamHealthScore || 0}
                    </span>
                    <span className="text-xl text-gray-400 mb-1">/100</span>
                  </div>
                  <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (summary.aggregateData.teamHealthScore || 0) >= 75 ? 'bg-success-500' :
                        (summary.aggregateData.teamHealthScore || 0) >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                      )}
                      style={{ width: `${summary.aggregateData.teamHealthScore || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Readiness (40%) + Compliance (30%) + Consistency (30%)
                  </p>
                </div>

                {/* Team Grade */}
                {summary.aggregateData.teamGrade && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Team Grade</h3>
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'text-5xl font-bold',
                        summary.aggregateData.teamGrade.score >= 80 ? 'text-success-600' :
                        summary.aggregateData.teamGrade.score >= 60 ? 'text-warning-600' : 'text-danger-600'
                      )}>
                        {summary.aggregateData.teamGrade.letter}
                      </span>
                      <div>
                        <p className="font-medium text-gray-700">{summary.aggregateData.teamGrade.label}</p>
                        <p className="text-sm text-gray-500">{summary.aggregateData.teamGrade.score}/100 points</p>
                      </div>
                    </div>
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
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <Users className="h-5 w-5 text-gray-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{summary.aggregateData.totalMembers}</p>
                  <p className="text-xs text-gray-500">Team Members</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <CheckCircle2 className="h-5 w-5 text-success-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{summary.highlights.length}</p>
                  <p className="text-xs text-gray-500">Highlights</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <AlertTriangle className="h-5 w-5 text-warning-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{summary.concerns.length}</p>
                  <p className="text-xs text-gray-500">Concerns</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <TrendingUp className="h-5 w-5 text-primary-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{summary.recommendations.length}</p>
                  <p className="text-xs text-gray-500">Recommendations</p>
                </div>
              </div>

              {/* Top Performers */}
              {summary.aggregateData.topPerformers && summary.aggregateData.topPerformers.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Performers (Recognition Recommended)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {summary.aggregateData.topPerformers.map((performer: any, i: number) => (
                      <div key={i} className="bg-white rounded-lg p-4 border border-green-100">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white',
                            i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-600'
                          )}>
                            {i + 1}
                          </div>
                          <span className="font-medium text-gray-900">{performer.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-success-600">{performer.avgScore}%</p>
                            <p className="text-xs text-gray-500">Score</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-primary-600">{performer.checkinRate}%</p>
                            <p className="text-xs text-gray-500">Rate</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-purple-600">{performer.currentStreak}</p>
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
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
                  <h3 className="font-semibold text-gray-900 mb-4">Root Cause Analysis (Low Score Reasons)</h3>
                  <div className="space-y-3">
                    {summary.aggregateData.topReasons.map((reason: any, i: number) => {
                      const total = summary.aggregateData.topReasons.reduce((sum: number, r: any) => sum + r.count, 0);
                      const percentage = Math.round((reason.count / total) * 100);
                      return (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-32 text-sm font-medium text-gray-700">{reason.label}</div>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-400 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage >= 15 && (
                                <span className="text-xs font-medium text-white">{reason.count}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-12 text-sm text-gray-500 text-right">{percentage}%</div>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
                Highlights
              </h2>
              <div className="space-y-3">
                {summary.highlights.map((highlight, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-success-50 rounded-xl border border-success-100">
                    <div className="h-6 w-6 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-success-600" />
                    </div>
                    <p className="text-success-800">{highlight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {summary.concerns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning-500" />
                Concerns
              </h2>
              <div className="space-y-3">
                {summary.concerns.map((concern, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-warning-50 rounded-xl border border-warning-100">
                    <div className="h-6 w-6 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-warning-600" />
                    </div>
                    <p className="text-warning-800">{concern}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary-500" />
                Recommendations
              </h2>
              <div className="space-y-3">
                {summary.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-primary-50 rounded-xl border border-primary-100">
                    <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary-600">
                      {i + 1}
                    </div>
                    <p className="text-primary-800">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Analytics Table */}
          {summary.aggregateData?.memberAnalytics && summary.aggregateData.memberAnalytics.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-500" />
                Member Analytics at Time of Report
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Risk Level</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Avg Score</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Check-in Rate</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">G / Y / R</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.aggregateData.memberAnalytics.map((member, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{member.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                              member.riskLevel === 'high' && 'bg-danger-100 text-danger-700',
                              member.riskLevel === 'medium' && 'bg-warning-100 text-warning-700',
                              member.riskLevel === 'low' && 'bg-success-100 text-success-700'
                            )}
                          >
                            {member.riskLevel === 'high' ? 'At Risk' : member.riskLevel === 'medium' ? 'Caution' : 'Good'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-semibold text-gray-900">{member.avgScore}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            'font-semibold',
                            member.checkinRate >= 80 ? 'text-success-600' : member.checkinRate >= 50 ? 'text-warning-600' : 'text-danger-600'
                          )}>
                            {member.checkinRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-success-600 font-medium">{member.greenCount}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-warning-600 font-medium">{member.yellowCount}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-danger-600 font-medium">{member.redCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Generated by AEGIRA AI Insights
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIInsightsDetailPage;
