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
  Smile,
  Brain,
  Moon,
  Lightbulb,
  Heart,
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
  type StatusType,
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

// =============================================================================
// WELLNESS COMPONENTS
// =============================================================================

interface WellnessMetricsCardProps {
  avgMood: number;
  avgStress: number;
  avgSleep: number;
  avgPhysicalHealth: number;
}

// Metric configuration for DRY approach
const METRIC_CONFIG = {
  mood: {
    label: 'Mood',
    icon: Smile,
    getStatus: (v: number) => v >= 7 ? 'good' : v >= 5 ? 'warning' : 'danger',
    getLabel: (v: number) => v >= 7 ? 'Good' : v >= 5 ? 'Moderate' : 'Low',
  },
  stress: {
    label: 'Stress',
    icon: Brain,
    getStatus: (v: number) => v <= 4 ? 'good' : v <= 6 ? 'warning' : 'danger',
    getLabel: (v: number) => v <= 4 ? 'Low' : v <= 6 ? 'Moderate' : 'High',
  },
  sleep: {
    label: 'Sleep',
    icon: Moon,
    getStatus: (v: number) => v >= 7 ? 'good' : v >= 5 ? 'warning' : 'danger',
    getLabel: (v: number) => v >= 7 ? 'Good' : v >= 5 ? 'Fair' : 'Poor',
  },
  physical: {
    label: 'Physical',
    icon: Heart,
    getStatus: (v: number) => v >= 7 ? 'good' : v >= 5 ? 'warning' : 'danger',
    getLabel: (v: number) => v >= 7 ? 'Good' : v >= 5 ? 'Fair' : 'Poor',
  },
} as const;

const STATUS_STYLES = {
  good: { text: 'text-emerald-600', bg: 'bg-emerald-100' },
  warning: { text: 'text-amber-600', bg: 'bg-amber-100' },
  danger: { text: 'text-rose-600', bg: 'bg-rose-100' },
} as const;

// Wellness Status Card - Extracted as proper component
interface WellnessStatusCardProps {
  mood: number;
  stress: number;
  sleep: number;
  physical: number;
}

const WellnessStatusCard = memo(function WellnessStatusCard({ mood, stress, sleep, physical }: WellnessStatusCardProps) {
  const moodOk = mood >= 6;
  const stressOk = stress <= 5;
  const sleepOk = sleep >= 6;
  const physicalOk = physical >= 6;
  const goodCount = [moodOk, stressOk, sleepOk, physicalOk].filter(Boolean).length;

  const statusConfig = goodCount >= 3
    ? { status: 'Healthy', color: 'text-emerald-600', bg: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200', dot: 'bg-emerald-500', desc: 'Team wellness metrics are within healthy ranges.' }
    : goodCount >= 2
    ? { status: 'Needs Attention', color: 'text-amber-600', bg: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200', dot: 'bg-amber-500', desc: 'Some wellness metrics need monitoring.' }
    : { status: 'Critical', color: 'text-rose-600', bg: 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200', dot: 'bg-rose-500', desc: 'Multiple wellness metrics require immediate attention.' };

  return (
    <div className={cn('rounded-xl p-6 border', statusConfig.bg)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Team Wellness Status</h3>
        <Heart className={cn('h-5 w-5', statusConfig.color)} />
      </div>
      <div className="flex items-center gap-3">
        <div className={cn('h-3 w-3 rounded-full', statusConfig.dot)} />
        <span className={cn('text-2xl font-bold', statusConfig.color)}>{statusConfig.status}</span>
      </div>
      <p className="text-sm text-gray-600 mt-3">{statusConfig.desc}</p>
    </div>
  );
});

// Single metric card component
interface MetricItemProps {
  type: keyof typeof METRIC_CONFIG;
  value: number;
}

const MetricItem = memo(function MetricItem({ type, value }: MetricItemProps) {
  const config = METRIC_CONFIG[type];
  const status = config.getStatus(value);
  const styles = STATUS_STYLES[status];
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', styles.bg)}>
          <Icon className={cn('h-5 w-5', styles.text)} />
        </div>
        <span className="text-sm font-medium text-gray-700">{config.label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-3xl font-bold', styles.text)}>{value}</span>
        <span className="text-gray-400 text-sm">/10</span>
      </div>
      <p className={cn('text-xs font-medium mt-1', styles.text)}>{config.getLabel(value)}</p>
    </div>
  );
});

// AI Predictions generator
function getWellnessPredictions(mood: number, stress: number, sleep: number, physical: number) {
  const predictions: { type: 'success' | 'warning' | 'danger'; message: string }[] = [];

  // Individual metric predictions
  const addPrediction = (
    value: number,
    thresholds: { good: number; warning: number },
    messages: { good: string; warning: string; danger: string },
    inverted = false
  ) => {
    const isGood = inverted ? value <= thresholds.good : value >= thresholds.good;
    const isWarning = inverted ? value <= thresholds.warning : value >= thresholds.warning;

    if (isGood) predictions.push({ type: 'success', message: messages.good });
    else if (isWarning) predictions.push({ type: 'warning', message: messages.warning });
    else predictions.push({ type: 'danger', message: messages.danger });
  };

  addPrediction(mood, { good: 7, warning: 5 }, {
    good: 'Team morale is high. Maintain current engagement activities.',
    warning: 'Team mood is moderate. Consider team-building activities to boost morale.',
    danger: 'Low team mood detected. Immediate intervention recommended.',
  });

  addPrediction(stress, { good: 4, warning: 6 }, {
    good: 'Stress levels are well-managed. Current workload appears sustainable.',
    warning: 'Moderate stress detected. Monitor workload distribution.',
    danger: 'High stress levels across the team. Risk of burnout is elevated.',
  }, true);

  addPrediction(sleep, { good: 7, warning: 5 }, {
    good: 'Team is well-rested. Good sleep quality supports optimal performance.',
    warning: 'Sleep quality is below optimal. Encourage better work-life balance.',
    danger: 'Poor sleep quality detected. This may impact productivity and safety.',
  });

  addPrediction(physical, { good: 7, warning: 5 }, {
    good: 'Team physical health is excellent. Continue promoting healthy practices.',
    warning: 'Physical health is moderate. Consider wellness programs.',
    danger: 'Low physical health reported. Review workplace safety measures.',
  });

  // Combined risk analysis
  if (stress > 6 && sleep < 5) {
    predictions.push({ type: 'danger', message: 'Critical: High stress with poor sleep. Immediate action needed to prevent burnout.' });
  } else if (mood >= 7 && stress <= 4 && sleep >= 7 && physical >= 7) {
    predictions.push({ type: 'success', message: 'Excellent overall wellness! Team is in optimal condition.' });
  }

  return predictions;
}

// Prediction item component
const PREDICTION_STYLES = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-200', iconColor: 'text-emerald-700', text: 'text-emerald-800' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-200', iconColor: 'text-amber-700', text: 'text-amber-800' },
  danger: { bg: 'bg-rose-50', border: 'border-rose-200', iconBg: 'bg-rose-200', iconColor: 'text-rose-700', text: 'text-rose-800' },
} as const;

const PredictionItem = memo(function PredictionItem({ type, message }: { type: 'success' | 'warning' | 'danger'; message: string }) {
  const styles = PREDICTION_STYLES[type];
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border', styles.bg, styles.border)}>
      <div className={cn('h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', styles.iconBg)}>
        <Icon className={cn('h-3 w-3', styles.iconColor)} />
      </div>
      <p className={cn('text-sm leading-relaxed', styles.text)}>{message}</p>
    </div>
  );
});

// Main Wellness Metrics Card
const WellnessMetricsCard = memo(function WellnessMetricsCard({ avgMood, avgStress, avgSleep, avgPhysicalHealth }: WellnessMetricsCardProps) {
  const predictions = getWellnessPredictions(avgMood, avgStress, avgSleep, avgPhysicalHealth);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Team Wellness Metrics</h3>
          <p className="text-sm text-gray-500">Average metrics with AI predictions</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricItem type="mood" value={avgMood} />
        <MetricItem type="stress" value={avgStress} />
        <MetricItem type="sleep" value={avgSleep} />
        <MetricItem type="physical" value={avgPhysicalHealth} />
      </div>

      {/* AI Predictions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-gray-700">AI Predictions & Suggestions</span>
        </div>
        <div className="space-y-2">
          {predictions.map((prediction, i) => (
            <PredictionItem key={i} type={prediction.type} message={prediction.message} />
          ))}
        </div>
      </div>
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
                const avgScore = summary.aggregateData?.memberAnalytics?.length > 0
                  ? Math.round(summary.aggregateData.memberAnalytics.reduce((sum: number, m: any) => sum + m.avgScore, 0) / summary.aggregateData.memberAnalytics.length)
                  : 0;
                const totalCheckins = summary.aggregateData?.memberAnalytics?.reduce((sum: number, m: any) => sum + m.checkinCount, 0) || 0;
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
