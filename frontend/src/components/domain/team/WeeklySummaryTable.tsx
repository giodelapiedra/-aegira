/**
 * WeeklySummaryTable Component
 *
 * Displays a table of daily summaries for a week/period.
 */

import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Minus, Shield, CheckCheck, Ban } from 'lucide-react';
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

  // Memoize sorted summaries to avoid re-sorting on every render
  const sortedSummaries = useMemo(() => {
    return [...summaries].sort(
      (a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime()
    );
  }, [summaries]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Checked In</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-blue-500" />
                On Leave
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1" title="TL-approved absences (not penalized)">
                <CheckCheck className="h-3.5 w-3.5 text-primary-500" />
                Excused
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1" title="Penalized absences (0 points)">
                <Ban className="h-3.5 w-3.5 text-red-500" />
                Absent
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              </span>
            </th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Compliance</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Avg Score</th>
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
                  {summary.isHoliday ? (
                    <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Holiday
                    </span>
                  ) : !summary.isWorkDay ? (
                    <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                      Rest Day
                    </span>
                  ) : (
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
                  )}
                </td>

                {/* Checked In */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span>
                      {summary.checkedInCount}/{summary.expectedToCheckIn}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* On Leave */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-sm font-medium',
                      summary.onLeaveCount > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'
                    )}>
                      {summary.onLeaveCount}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Excused */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-sm font-medium',
                      summary.excusedCount > 0 ? 'bg-primary-100 text-primary-700' : 'text-gray-400'
                    )}>
                      {summary.excusedCount}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Absent */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-sm font-medium',
                      summary.absentCount > 0 ? 'bg-red-100 text-red-700' : 'text-gray-400'
                    )}>
                      {summary.absentCount}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Green */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className="text-green-600 font-medium">{summary.greenCount}</span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Yellow */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className="text-yellow-600 font-medium">{summary.yellowCount}</span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Red */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className="text-red-600 font-medium">{summary.redCount}</span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Compliance */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday ? (
                    <span className={cn('font-medium', colors.text)}>
                      {summary.complianceRate !== null
                        ? `${Math.round(summary.complianceRate)}%`
                        : '—'}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
                </td>

                {/* Avg Score */}
                <td className="px-4 py-3 text-center">
                  {summary.isWorkDay && !summary.isHoliday && summary.avgReadinessScore !== null ? (
                    <span className="text-gray-700">{Math.round(summary.avgReadinessScore)}</span>
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                  )}
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
