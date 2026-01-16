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
  Users,
  FileWarning,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { analyticsService, type AISummaryDetail } from '../../services/analytics.service';
import { useUser } from '../../hooks/useUser';
import { Button } from '../../components/ui/Button';
import { SkeletonProfile } from '../../components/ui/Skeleton';
import {
  formatDateTimeFull,
  formatPeriod,
  STATUS_CONFIG,
  type StatusType,
} from './ai-insights.utils';

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

// Loading skeleton wrapper
const PageLoadingSkeleton = memo(function PageLoadingSkeleton() {
  return <SkeletonProfile />;
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


// =============================================================================
// PRINT HANDLER
// =============================================================================

function generatePrintHTML(summary: AISummaryDetail, teamName: string, timezone: string): string {
  const statusLabels: Record<string, string> = { healthy: 'Healthy', attention: 'Needs Attention', critical: 'Critical', HEALTHY: 'Healthy', ATTENTION: 'Needs Attention', CRITICAL: 'Critical' };

  // Calculate avg score and total checkins from memberAnalytics
  const memberAnalytics = summary.aggregateData?.memberAnalytics || [];
  const avgScore = memberAnalytics.length > 0
    ? Math.round(memberAnalytics.reduce((sum: number, m: any) => sum + m.avgScore, 0) / memberAnalytics.length)
    : 0;
  const totalCheckins = memberAnalytics.reduce((sum: number, m: any) => sum + m.checkinCount, 0);

  // Risk level helper
  const getRiskLabel = (score: number) => score >= 70 ? 'Low' : score >= 40 ? 'Medium' : 'High';
  const getRiskClass = (score: number) => score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Insights Report - ${teamName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
        .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
        .header .meta { color: #6b7280; font-size: 14px; line-height: 1.8; }
        .status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin: 10px 0; }
        .status.healthy, .status.HEALTHY { background: #d1fae5; color: #065f46; }
        .status.attention, .status.ATTENTION { background: #fef3c7; color: #92400e; }
        .status.critical, .status.CRITICAL { background: #fee2e2; color: #991b1b; }
        .section { margin-bottom: 25px; page-break-inside: avoid; }
        .section h2 { font-size: 16px; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
        .summary { background: #f9fafb; padding: 16px; border-radius: 8px; line-height: 1.7; white-space: pre-wrap; }
        .health-card { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; display: inline-block; }
        .health-card .label { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
        .health-card .value { font-size: 24px; font-weight: 700; }
        .health-card .stats { font-size: 12px; color: #6b7280; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f9fafb; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
        td { padding: 10px 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .risk-badge.low { background: #d1fae5; color: #065f46; }
        .risk-badge.medium { background: #fef3c7; color: #92400e; }
        .risk-badge.high { background: #fee2e2; color: #991b1b; }
        .score { font-weight: 700; }
        .score.green { color: #059669; }
        .score.yellow { color: #d97706; }
        .score.red { color: #dc2626; }
        .metric { font-weight: 500; }
        .metric.good { color: #059669; }
        .metric.warning { color: #d97706; }
        .metric.bad { color: #dc2626; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
        @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
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
        <div class="status ${summary.overallStatus}">${statusLabels[summary.overallStatus] || summary.overallStatus}</div>
      </div>

      <div class="section">
        <h2>Team Health Status</h2>
        <div class="health-card">
          <div class="label">Overall Status</div>
          <div class="value">${statusLabels[summary.overallStatus] || summary.overallStatus}</div>
          <div class="stats">Avg Score: ${avgScore}% • Total Check-ins: ${totalCheckins}</div>
        </div>
      </div>

      ${memberAnalytics.length > 0 ? `
      <div class="section">
        <h2>Member Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Status</th>
              <th>Score</th>
              <th>Mood</th>
              <th>Stress</th>
              <th>Sleep</th>
              <th>Physical</th>
            </tr>
          </thead>
          <tbody>
            ${memberAnalytics.map((m: any) => {
              const scoreClass = m.avgScore >= 70 ? 'green' : m.avgScore >= 40 ? 'yellow' : 'red';
              const moodClass = m.avgMood >= 7 ? 'good' : m.avgMood >= 5 ? 'warning' : 'bad';
              const stressClass = m.avgStress <= 4 ? 'good' : m.avgStress <= 6 ? 'warning' : 'bad';
              const sleepClass = m.avgSleep >= 7 ? 'good' : m.avgSleep >= 5 ? 'warning' : 'bad';
              const physical = m.avgPhysical ?? m.avgPhysicalHealth;
              const physicalClass = physical >= 7 ? 'good' : physical >= 5 ? 'warning' : 'bad';
              return `
                <tr>
                  <td><strong>${m.name}</strong><br/><span style="color:#9ca3af;font-size:11px;">${m.checkinCount} check-ins</span></td>
                  <td><span class="risk-badge ${getRiskClass(m.avgScore)}">${getRiskLabel(m.avgScore)}</span></td>
                  <td><span class="score ${scoreClass}">${m.avgScore}%</span></td>
                  <td><span class="metric ${moodClass}">${m.avgMood}/10</span></td>
                  <td><span class="metric ${stressClass}">${m.avgStress}/10</span></td>
                  <td><span class="metric ${sleepClass}">${m.avgSleep}/10</span></td>
                  <td><span class="metric ${physical != null ? physicalClass : ''}">${physical != null ? physical + '/10' : '-'}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="section">
        <h2>Expert Data Interpretation</h2>
        <div class="summary">${summary.summary}</div>
      </div>

      <div class="footer">Generated by AegiraAI Insights • ${new Date().toLocaleDateString('en-US', { timeZone: timezone })}</div>
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
        <PageLoadingSkeleton />
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
            {/* Team Health Status - Simple healthy/attention/critical based on member performance */}
            <div className="max-w-md">
              {(() => {
                const status = summary.overallStatus;
                const statusConfig = {
                  healthy: { label: 'Healthy', icon: '✅', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', desc: 'Team wellness is within healthy ranges' },
                  attention: { label: 'Needs Attention', icon: '⚠️', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', desc: 'Some members may need support' },
                  critical: { label: 'Critical', icon: '🔴', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', desc: 'Immediate attention required' },
                };
                const config = statusConfig[status] || statusConfig.healthy;
                const memberData = summary.aggregateData?.memberAnalytics || [];
                const avgScore = memberData.length > 0
                  ? Math.round(memberData.reduce((sum: number, m: any) => sum + m.avgScore, 0) / memberData.length)
                  : 0;
                const totalCheckins = memberData.reduce((sum: number, m: any) => sum + m.checkinCount, 0);
                return (
                  <div className={cn('rounded-xl border p-6', config.bg, config.border)}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <p className={cn('text-lg font-semibold', config.text)}>{config.label}</p>
                        <p className="text-sm text-gray-600">{config.desc}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Avg Score</p>
                        <p className="font-semibold text-gray-900">{avgScore}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Check-ins</p>
                        <p className="font-semibold text-gray-900">{totalCheckins}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Member Performance Table */}
            {summary.aggregateData?.memberAnalytics && summary.aggregateData.memberAnalytics.length > 0 && (
              <div>
                <SectionHeader icon={Users} title="Member Performance" iconColor="text-blue-500" />
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-xs font-medium text-gray-500 uppercase">
                          <th className="px-4 py-3 text-left">Member</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center">Score</th>
                          <th className="px-4 py-3 text-center">Mood</th>
                          <th className="px-4 py-3 text-center">Stress</th>
                          <th className="px-4 py-3 text-center">Sleep</th>
                          <th className="px-4 py-3 text-center">Physical</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.aggregateData.memberAnalytics.map((member: any, idx: number) => {
                          const scoreColor = member.avgScore >= 70 ? 'text-emerald-600 bg-emerald-50' : member.avgScore >= 40 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
                          const riskColor = member.riskLevel === 'high' ? 'bg-rose-100 text-rose-700' : member.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                          const riskLabel = member.riskLevel === 'high' ? 'High Risk' : member.riskLevel === 'medium' ? 'Medium' : 'Low';
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                <p className="text-xs text-gray-500">{member.checkinCount} check-ins</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', riskColor)}>
                                  {riskLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('px-2 py-0.5 text-sm font-bold rounded-md', scoreColor)}>
                                  {member.avgScore}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('text-sm font-medium', member.avgMood >= 7 ? 'text-emerald-600' : member.avgMood >= 5 ? 'text-amber-600' : 'text-rose-600')}>
                                  {member.avgMood}/10
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('text-sm font-medium', member.avgStress <= 4 ? 'text-emerald-600' : member.avgStress <= 6 ? 'text-amber-600' : 'text-rose-600')}>
                                  {member.avgStress}/10
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn('text-sm font-medium', member.avgSleep >= 7 ? 'text-emerald-600' : member.avgSleep >= 5 ? 'text-amber-600' : 'text-rose-600')}>
                                  {member.avgSleep}/10
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(member.avgPhysical ?? member.avgPhysicalHealth) != null ? (
                                  <span className={cn('text-sm font-medium', (member.avgPhysical ?? member.avgPhysicalHealth) >= 7 ? 'text-emerald-600' : (member.avgPhysical ?? member.avgPhysicalHealth) >= 5 ? 'text-amber-600' : 'text-rose-600')}>
                                    {member.avgPhysical ?? member.avgPhysicalHealth}/10
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {summary.aggregateData.memberAnalytics.map((member: any, idx: number) => {
                      const scoreColor = member.avgScore >= 70 ? 'text-emerald-600 bg-emerald-50' : member.avgScore >= 40 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
                      const riskColor = member.riskLevel === 'high' ? 'bg-rose-100 text-rose-700' : member.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                      const riskLabel = member.riskLevel === 'high' ? 'High Risk' : member.riskLevel === 'medium' ? 'Medium' : 'Low';
                      return (
                        <div key={idx} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.checkinCount} check-ins</p>
                            </div>
                            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', riskColor)}>
                              {riskLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-600">Avg Score</span>
                            <span className={cn('px-2 py-0.5 text-sm font-bold rounded-md', scoreColor)}>{member.avgScore}%</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className={cn('text-lg font-bold', member.avgMood >= 7 ? 'text-emerald-600' : member.avgMood >= 5 ? 'text-amber-600' : 'text-rose-600')}>{member.avgMood}</p>
                              <p className="text-xs text-gray-500">Mood</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className={cn('text-lg font-bold', member.avgStress <= 4 ? 'text-emerald-600' : member.avgStress <= 6 ? 'text-amber-600' : 'text-rose-600')}>{member.avgStress}</p>
                              <p className="text-xs text-gray-500">Stress</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className={cn('text-lg font-bold', member.avgSleep >= 7 ? 'text-emerald-600' : member.avgSleep >= 5 ? 'text-amber-600' : 'text-rose-600')}>{member.avgSleep}</p>
                              <p className="text-xs text-gray-500">Sleep</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className={cn('text-lg font-bold', (member.avgPhysical ?? member.avgPhysicalHealth) != null ? ((member.avgPhysical ?? member.avgPhysicalHealth) >= 7 ? 'text-emerald-600' : (member.avgPhysical ?? member.avgPhysicalHealth) >= 5 ? 'text-amber-600' : 'text-rose-600') : 'text-gray-400')}>
                                {(member.avgPhysical ?? member.avgPhysicalHealth) != null ? (member.avgPhysical ?? member.avgPhysicalHealth) : '-'}
                              </p>
                              <p className="text-xs text-gray-500">Physical</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Expert Data Interpretation Narrative */}
            <div>
              <SectionHeader icon={Sparkles} title="Expert Data Interpretation" iconColor="text-violet-500" />
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
                  {summary.summary}
                </div>
              </div>
            </div>

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
