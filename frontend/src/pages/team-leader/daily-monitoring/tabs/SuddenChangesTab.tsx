/**
 * Sudden Changes Tab Component
 * Displays workers with significant score drops
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Pagination } from '../../../../components/ui/Pagination';
import { SkeletonList } from '../../../../components/ui/Skeleton';
import { SuddenChangeCard } from '../../../../components/monitoring';
import { useSuddenChanges } from '../hooks/useSuddenChanges';

interface SuddenChangesTabProps {
  teamId?: string;
}

export function SuddenChangesTab({ teamId }: SuddenChangesTabProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useSuddenChanges({ teamId, page });

  const changes = data?.data || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  if (isLoading) {
    return <SkeletonList items={4} />;
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
      {/* Header with summary stats and refresh button */}
      <div className="flex items-center justify-between gap-4">
        {/* Summary stats */}
        {summary && (
          <div className="flex flex-wrap gap-2">
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

        {/* Refresh button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex-shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

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
            onViewDetails={(userId) => navigate(`/team/members/${userId}`)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            onPageChange={setPage}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
