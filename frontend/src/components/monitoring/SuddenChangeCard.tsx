/**
 * SuddenChangeCard Component
 * Displays a sudden score change alert with severity indicator
 */

import { cn } from '../../lib/utils';
import {
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Eye,
  Calendar,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { SeverityLevel, ReadinessStatus } from '../../services/daily-monitoring.service';
import { getSeverityColor, getSeverityLabel, formatTimeAgo } from '../../services/daily-monitoring.service';

// ============================================
// TYPES
// ============================================

interface SuddenChangeCardProps {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  todayScore: number;
  todayStatus: ReadinessStatus;
  averageScore: number;
  change: number;
  severity: SeverityLevel;
  checkinTime: string;
  onViewDetails?: (userId: string) => void;
  onScheduleOneOnOne?: (userId: string) => void;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSeverityIcon(severity: SeverityLevel) {
  switch (severity) {
    case 'CRITICAL':
      return AlertTriangle;
    case 'SIGNIFICANT':
      return AlertCircle;
    default:
      return TrendingDown;
  }
}

function getStatusColor(status: ReadinessStatus): string {
  const colors: Record<ReadinessStatus, string> = {
    GREEN: 'bg-success-500',
    YELLOW: 'bg-warning-500',
    RED: 'bg-danger-500',
  };
  return colors[status];
}

// ============================================
// COMPONENT
// ============================================

export function SuddenChangeCard({
  userId,
  firstName,
  lastName,
  todayScore,
  todayStatus,
  averageScore,
  change,
  severity,
  checkinTime,
  onViewDetails,
  onScheduleOneOnOne,
  className,
}: SuddenChangeCardProps) {
  const severityColors = getSeverityColor(severity);
  const SeverityIcon = getSeverityIcon(severity);

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        severityColors.bg,
        severityColors.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-medium text-gray-700">
              {firstName.charAt(0)}
              {lastName.charAt(0)}
            </span>
          </div>
          <div>
            <h4 className={cn('font-semibold', severityColors.text)}>
              {firstName} {lastName}
            </h4>
            <p className="text-sm text-gray-500">{formatTimeAgo(checkinTime)}</p>
          </div>
        </div>

        {/* Severity Badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            severity === 'CRITICAL' && 'bg-danger-100 text-danger-700',
            severity === 'SIGNIFICANT' && 'bg-orange-100 text-orange-700',
            severity === 'NOTABLE' && 'bg-warning-100 text-warning-700',
            severity === 'MINOR' && 'bg-blue-100 text-blue-700'
          )}
        >
          <SeverityIcon className="h-3.5 w-3.5" />
          {getSeverityLabel(severity)}
        </div>
      </div>

      {/* Score Comparison */}
      <div className="bg-white/60 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">7-Day Avg</p>
            <p className="text-lg font-bold text-gray-700">{averageScore}%</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className={cn('h-5 w-5', severityColors.text)} />
            <span className={cn('text-lg font-bold', severityColors.text)}>
              {change}%
            </span>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Today</p>
            <div className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', getStatusColor(todayStatus))} />
              <p className="text-lg font-bold text-gray-700">{todayScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onViewDetails && (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onViewDetails(userId)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View Details
          </Button>
        )}
        {onScheduleOneOnOne && (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onScheduleOneOnOne(userId)}
          >
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Schedule 1-on-1
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPACT VERSION
// ============================================

interface SuddenChangeRowProps {
  firstName: string;
  lastName: string;
  todayScore: number;
  todayStatus: ReadinessStatus;
  averageScore: number;
  change: number;
  severity: SeverityLevel;
  onClick?: () => void;
  className?: string;
}

export function SuddenChangeRow({
  firstName,
  lastName,
  todayScore,
  todayStatus,
  averageScore,
  change,
  severity,
  onClick,
  className,
}: SuddenChangeRowProps) {
  const severityColors = getSeverityColor(severity);
  const SeverityIcon = getSeverityIcon(severity);

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow',
        severityColors.bg,
        severityColors.border,
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <SeverityIcon className={cn('h-4 w-4', severityColors.text)} />
        <span className="font-medium text-gray-900">
          {firstName} {lastName}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {averageScore}% → {todayScore}%
        </span>
        <span className={cn('font-semibold', severityColors.text)}>{change}%</span>
      </div>
    </div>
  );
}
