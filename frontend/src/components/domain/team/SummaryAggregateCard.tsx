/**
 * SummaryAggregateCard Component
 *
 * Displays aggregated statistics for a period.
 * Clean, minimal design with single accent color.
 */

import { cn } from '../../../lib/utils';

interface AggregateData {
  totalWorkDays: number;
  totalExpected: number;
  totalCheckedIn: number;
  avgComplianceRate: number | null;
  avgReadinessScore: number | null;
  totalGreen: number;
  totalYellow: number;
  totalRed: number;
  totalExcused: number;
}

interface SummaryAggregateCardProps {
  aggregate: AggregateData;
  periodLabel: string;
}

export function SummaryAggregateCard({ aggregate, periodLabel }: SummaryAggregateCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Period Summary</h3>
        <span className="text-sm text-gray-500">{periodLabel}</span>
      </div>

      {/* Stats Grid - Check-in metrics only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-y sm:divide-y-0 divide-gray-200">
        {/* Work Days */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500 mb-1">Work Days</p>
          <p className="text-2xl font-semibold text-gray-900">{aggregate.totalWorkDays}</p>
        </div>

        {/* Check-ins */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500 mb-1">Checked In</p>
          <p className="text-2xl font-semibold text-gray-900">
            {aggregate.totalCheckedIn}
            <span className="text-base font-normal text-gray-400">/{aggregate.totalExpected}</span>
          </p>
        </div>

        {/* On Leave */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500 mb-1">On Leave</p>
          <p className="text-2xl font-semibold text-gray-900">{aggregate.totalExcused}</p>
        </div>
      </div>

      {/* Status Distribution - Simple bar */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">Status Distribution</span>
          <div className="flex items-center gap-4 text-gray-600">
            <span>Ready: <strong className="text-gray-900">{aggregate.totalGreen}</strong></span>
            <span>Caution: <strong className="text-gray-900">{aggregate.totalYellow}</strong></span>
            <span>At Risk: <strong className="text-gray-900">{aggregate.totalRed}</strong></span>
          </div>
        </div>
        {/* Progress bar */}
        {(aggregate.totalGreen + aggregate.totalYellow + aggregate.totalRed) > 0 && (
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {aggregate.totalGreen > 0 && (
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(aggregate.totalGreen / (aggregate.totalGreen + aggregate.totalYellow + aggregate.totalRed)) * 100}%` }}
              />
            )}
            {aggregate.totalYellow > 0 && (
              <div
                className="bg-yellow-400 h-full"
                style={{ width: `${(aggregate.totalYellow / (aggregate.totalGreen + aggregate.totalYellow + aggregate.totalRed)) * 100}%` }}
              />
            )}
            {aggregate.totalRed > 0 && (
              <div
                className="bg-red-500 h-full"
                style={{ width: `${(aggregate.totalRed / (aggregate.totalGreen + aggregate.totalYellow + aggregate.totalRed)) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
