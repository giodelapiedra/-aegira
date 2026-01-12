/**
 * DailySummaryCard Component
 *
 * Displays a single day's team summary statistics.
 */

import { CheckCircle2, AlertTriangle, XCircle, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { DailyTeamSummary } from '../../../types/summary';
import { getDayStatus, dayStatusColors } from '../../../types/summary';

interface DailySummaryCardProps {
  summary: DailyTeamSummary;
  isToday?: boolean;
  onClick?: () => void;
}

export function DailySummaryCard({ summary, isToday, onClick }: DailySummaryCardProps) {
  const status = getDayStatus(summary);
  const colors = dayStatusColors[status];

  // Parse date safely - handle both ISO string and date-only string
  const dateStr = summary.date.split('T')[0]; // Get YYYY-MM-DD part
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // Create date in local timezone

  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

  // Keyboard handler for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'rounded-lg border p-4 transition-all',
        colors.bg,
        colors.border,
        onClick && 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500',
        isToday && 'ring-2 ring-primary-500 ring-offset-2'
      )}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className={cn('h-4 w-4', colors.text)} />
          <span className={cn('font-medium', colors.text)}>
            {dayName}, {monthName} {dayNum}
          </span>
        </div>
        {isToday && (
          <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
            Today
          </span>
        )}
      </div>

      {/* Content based on status */}
      {summary.isHoliday ? (
        <div className="text-center py-2">
          <span className="text-purple-600 font-medium">Holiday</span>
        </div>
      ) : !summary.isWorkDay ? (
        <div className="text-center py-2">
          <span className="text-gray-500">Rest Day</span>
        </div>
      ) : (
        <>
          {/* Compliance */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Compliance</span>
            <span className={cn('font-bold', colors.text)}>
              {summary.complianceRate !== null ? `${Math.round(summary.complianceRate)}%` : '—'}
            </span>
          </div>

          {/* Check-in Stats */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Checked In</span>
            <span className="font-medium">
              {summary.checkedInCount}/{summary.expectedToCheckIn}
            </span>
          </div>

          {/* Status Distribution */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{summary.greenCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">{summary.yellowCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">{summary.redCount}</span>
            </div>
          </div>

          {/* Avg Score */}
          {summary.avgReadinessScore !== null && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              Avg Score: {Math.round(summary.avgReadinessScore)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
