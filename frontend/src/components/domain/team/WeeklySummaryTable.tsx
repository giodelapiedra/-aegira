/**
 * WeeklySummaryTable Component
 *
 * Displays a table of daily summaries for a week/period.
 * Clean, minimal design - no colored icons in headers.
 */

import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import type { DailyTeamSummary } from '../../../types/summary';
import { getDayStatus, dayStatusColors } from '../../../types/summary';

interface WeeklySummaryTableProps {
  summaries: DailyTeamSummary[];
  onRowClick?: (summary: DailyTeamSummary) => void;
}

// Helper to get today's date string in YYYY-MM-DD format
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Helper to parse date string safely
function parseDateString(dateStr: string): Date {
  const cleanDate = dateStr.split('T')[0];
  const [year, month, day] = cleanDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function WeeklySummaryTable({ summaries, onRowClick }: WeeklySummaryTableProps) {
  const today = getTodayDateString();

  // Memoize sorted summaries - only show actual work days (no rest days/holidays)
  const sortedSummaries = useMemo(() => {
    return [...summaries]
      .filter((s) => s.isWorkDay && !s.isHoliday)
      .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime());
  }, [summaries]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Checked In</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">On Leave</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Ready</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Caution</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">At Risk</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Compliance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedSummaries.map((summary) => {
            const dateStr = summary.date.split('T')[0];
            const dateObj = parseDateString(summary.date);
            const isToday = dateStr === today;
            const status = getDayStatus(summary);
            const colors = dayStatusColors[status];

            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dateDisplay = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            // Keyboard handler for accessibility
            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(summary);
              }
            };

            return (
              <tr
                key={summary.id}
                onClick={() => onRowClick?.(summary)}
                onKeyDown={handleKeyDown}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50 focus:outline-none focus:bg-primary-50',
                  isToday && 'bg-primary-50'
                )}
              >
                {/* Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{dayName}</span>
                    <span className="text-gray-500">{dateDisplay}</span>
                    {isToday && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>
                </td>

                {/* Status Badge */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={cn(
                      'inline-flex px-2 py-1 rounded text-xs font-medium',
                      colors.bg,
                      colors.text
                    )}
                  >
                    {status === 'perfect' && 'Perfect'}
                    {status === 'good' && 'Good'}
                    {status === 'warning' && 'Warning'}
                    {status === 'poor' && 'Poor'}
                    {status === 'no-data' && 'No Data'}
                  </span>
                </td>

                {/* Checked In */}
                <td className="px-4 py-3 text-center">
                  <span>{summary.checkedInCount}/{summary.expectedToCheckIn}</span>
                </td>

                {/* On Leave */}
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-sm font-medium',
                    summary.onLeaveCount > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'
                  )}>
                    {summary.onLeaveCount}
                  </span>
                </td>

                {/* Green/Ready */}
                <td className="px-4 py-3 text-center">
                  <span className="text-green-600 font-medium">{summary.greenCount}</span>
                </td>

                {/* Yellow/Caution */}
                <td className="px-4 py-3 text-center">
                  <span className="text-yellow-600 font-medium">{summary.yellowCount}</span>
                </td>

                {/* Red/At Risk */}
                <td className="px-4 py-3 text-center">
                  <span className="text-red-600 font-medium">{summary.redCount}</span>
                </td>

                {/* Compliance */}
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'font-medium',
                    summary.complianceRate === null ? 'text-gray-400' :
                    summary.complianceRate >= 90 ? 'text-green-600' :
                    summary.complianceRate >= 70 ? 'text-gray-900' :
                    'text-red-600'
                  )}>
                    {summary.complianceRate !== null
                      ? `${Math.min(100, Math.round(summary.complianceRate))}%`
                      : '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {summaries.length === 0 && (
        <div className="text-center py-8 text-gray-500">No summary data available</div>
      )}
    </div>
  );
}
