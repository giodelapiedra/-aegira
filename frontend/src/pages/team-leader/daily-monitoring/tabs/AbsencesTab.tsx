/**
 * Absences Tab Component
 * Displays pending absence justifications for review
 */

import { CalendarX, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { SkeletonList } from '../../../../components/ui/Skeleton';
import { AbsenceReviewCard } from '../../../../components/absences/AbsenceReviewCard';
import { absenceService } from '../../../../services/absence.service';

const REFETCH_INTERVAL = 60000; // 1 minute

export function AbsencesTab() {
  const { data: pendingAbsences, isLoading } = useQuery({
    queryKey: ['absences', 'team-pending'],
    queryFn: () => absenceService.getTeamPending(),
    staleTime: 60 * 1000, // 1 minute - allow some caching between refetches
    refetchInterval: REFETCH_INTERVAL, // Keep for real-time monitoring
  });

  if (isLoading) {
    return <SkeletonList items={4} />;
  }

  return (
    <div className="space-y-6">
      {!pendingAbsences || pendingAbsences.count === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={CalendarX}
              title="No pending absence reviews"
              description="All justifications have been reviewed."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingAbsences.data.map((absence) => (
            <AbsenceReviewCard key={absence.id} absence={absence} />
          ))}
        </div>
      )}

      {/* Info box about absence review logic */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">How Absence Reviews Work</p>
            <ul className="text-sm text-blue-600 mt-1 space-y-1">
              <li>
                <strong>Excused:</strong> No penalty - won't affect attendance grade
              </li>
              <li>
                <strong>Unexcused:</strong> 0 points - counts against attendance
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
