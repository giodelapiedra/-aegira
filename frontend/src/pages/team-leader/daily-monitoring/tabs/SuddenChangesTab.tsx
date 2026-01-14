/**
 * Sudden Changes Tab Component
 * Displays workers with significant score drops
 */

import { TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { SuddenChangeCard } from '../../../../components/monitoring';
import { useSuddenChanges } from '../hooks/useSuddenChanges';

interface SuddenChangesTabProps {
  teamId?: string;
}

export function SuddenChangesTab({ teamId }: SuddenChangesTabProps) {
  const { data, isLoading } = useSuddenChanges({ teamId });

  const changes = data?.data || [];
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={TrendingDown}
            title="No sudden changes"
            description="All workers are within normal range."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {summary && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summary.criticalCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
              {summary.criticalCount} Critical
            </span>
          )}
          {summary.significantCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              {summary.significantCount} Significant
            </span>
          )}
          {summary.notableCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
              {summary.notableCount} Notable
            </span>
          )}
          {summary.minorCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {summary.minorCount} Minor
            </span>
          )}
        </div>
      )}

      {/* Changes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {changes.map((change) => (
          <SuddenChangeCard
            key={change.userId}
            userId={change.userId}
            firstName={change.user.firstName}
            lastName={change.user.lastName}
            email={change.user.email}
            todayScore={change.todayScore}
            todayStatus={change.todayStatus as 'GREEN' | 'YELLOW' | 'RED'}
            averageScore={change.averageScore}
            change={change.change}
            severity={change.severity}
            checkinTime={change.checkinTime.toString()}
          />
        ))}
      </div>
    </div>
  );
}
