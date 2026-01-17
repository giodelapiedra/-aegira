import { CheckCircle2, AlertTriangle, AlertCircle, type LucideIcon } from 'lucide-react';

// =============================================================================
// DATE FORMATTING
// =============================================================================

export function formatDate(dateStr: string, timezone: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

export function formatDateTime(dateStr: string, timezone: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function formatDateTimeFull(dateStr: string, timezone: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export function formatPeriod(startDate: string, endDate: string, timezone: string): string {
  return `${formatDate(startDate, timezone)} - ${formatDate(endDate, timezone)}`;
}

export function formatShortPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function getDaysInPeriod(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// =============================================================================
// STATUS CONFIG
// =============================================================================

export type StatusType = 'healthy' | 'attention' | 'critical';

export interface StatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  healthy: {
    icon: CheckCircle2,
    label: 'Healthy',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
  },
  attention: {
    icon: AlertTriangle,
    label: 'Needs Attention',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
  },
};

// =============================================================================
// RISK LEVEL CONFIG
// =============================================================================

export type RiskLevel = 'high' | 'medium' | 'low';

export const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  high: { label: 'At Risk', className: 'bg-rose-100 text-rose-700' },
  medium: { label: 'Caution', className: 'bg-amber-100 text-amber-700' },
  low: { label: 'Good', className: 'bg-emerald-100 text-emerald-700' },
};
