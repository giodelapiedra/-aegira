/**
 * Team Summary Page
 *
 * Shows historical team check-in summaries from DailyTeamSummary.
 * Provides weekly/monthly view of team compliance and readiness.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SkeletonDashboard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { WeeklySummaryTable, SummaryAggregateCard } from '../../components/domain/team';
import { useTeamSummary, SUMMARY_PERIODS, type SummaryPeriod } from '../../hooks/useTeamSummary';
import { teamService } from '../../services/team.service';
import { cn } from '../../lib/utils';

export function TeamSummaryPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<SummaryPeriod>('7d');

  // Get user's team first
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: () => teamService.getMyTeam(),
    staleTime: 5 * 60 * 1000,
  });

  // Get team summary
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isFetching,
    error,
    refetch,
  } = useTeamSummary({
    teamId: team?.id,
    days: SUMMARY_PERIODS[selectedPeriod].days,
    enabled: !!team?.id,
  });

  const isLoading = teamLoading || summaryLoading;

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (!team) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Team Assigned"
        description="You are not currently assigned to a team."
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Summary</h2>
        <p className="text-gray-500 mb-4">Failed to load team summary. Please try again.</p>
        <Button onClick={() => refetch()} variant="secondary">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Summary</h1>
          <p className="text-gray-500 mt-1">
            Historical check-in data for {team.name}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          {isFetching && !summaryLoading && (
            <RefreshCw className="h-4 w-4 text-primary-500 animate-spin" />
          )}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="Select time period">
            {(Object.keys(SUMMARY_PERIODS) as SummaryPeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                aria-pressed={selectedPeriod === period}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                  selectedPeriod === period
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {SUMMARY_PERIODS[period].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aggregate Stats */}
      {summaryData?.aggregate && (
        <SummaryAggregateCard
          aggregate={summaryData.aggregate}
          periodLabel={SUMMARY_PERIODS[selectedPeriod].label}
        />
      )}

      {/* Daily Summaries Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Daily Breakdown</h2>
          <span className="text-sm text-gray-500">
            {summaryData?.summaries.length || 0} days
          </span>
        </div>

        {summaryData?.summaries && summaryData.summaries.length > 0 ? (
          <WeeklySummaryTable summaries={summaryData.summaries} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No summary data for this period</p>
          </div>
        )}
      </div>

    </div>
  );
}
