/**
 * SummaryAggregateCard Component
 *
 * Displays aggregated statistics for a period.
 */

import { TrendingUp, Users, CheckCircle2, AlertTriangle, XCircle, Calendar } from 'lucide-react';
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
}

interface SummaryAggregateCardProps {
  aggregate: AggregateData;
  periodLabel: string;
}

export function SummaryAggregateCard({ aggregate, periodLabel }: SummaryAggregateCardProps) {
  const complianceColor =
    aggregate.avgComplianceRate === null
      ? 'text-gray-500'
      : aggregate.avgComplianceRate >= 90
      ? 'text-green-600'
      : aggregate.avgComplianceRate >= 70
      ? 'text-yellow-600'
      : 'text-red-600';

  const scoreColor =
    aggregate.avgReadinessScore === null
      ? 'text-gray-500'
      : aggregate.avgReadinessScore >= 70
      ? 'text-green-600'
      : aggregate.avgReadinessScore >= 50
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Period Summary</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {periodLabel}
        </span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Work Days */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Work Days</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{aggregate.totalWorkDays}</p>
        </div>

        {/* Total Check-ins */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Total Check-ins</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {aggregate.totalCheckedIn}
            <span className="text-sm font-normal text-gray-500">/{aggregate.totalExpected}</span>
          </p>
        </div>

        {/* Avg Compliance */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Avg Compliance</span>
          </div>
          <p className={cn('text-2xl font-bold', complianceColor)}>
            {aggregate.avgComplianceRate !== null ? `${aggregate.avgComplianceRate}%` : '—'}
          </p>
        </div>

        {/* Avg Score */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Avg Score</span>
          </div>
          <p className={cn('text-2xl font-bold', scoreColor)}>
            {aggregate.avgReadinessScore !== null ? aggregate.avgReadinessScore : '—'}
          </p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Status Distribution</h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{aggregate.totalGreen}</p>
              <p className="text-xs text-gray-500">Ready</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-600">{aggregate.totalYellow}</p>
              <p className="text-xs text-gray-500">Caution</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{aggregate.totalRed}</p>
              <p className="text-xs text-gray-500">At Risk</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
