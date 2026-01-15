/**
 * CheckinDashboard Component
 *
 * Dashboard view shown after check-in is completed.
 * Shows wellness insights and low score reporting modal.
 */

import { formatDisplayDate } from '../../../../lib/date-utils';
import { LowScoreReasonModal } from './LowScoreReasonModal';
import { WellnessInsightCard } from './WellnessInsightCard';
import type { CheckinWithAttendance } from '../../../../services/checkin.service';

interface User {
  id: string;
  firstName: string;
  lastName?: string;
}

interface Team {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
}

interface CheckinDashboardProps {
  currentUser: User;
  team?: Team | null;
  todayCheckin: CheckinWithAttendance;
  needsLowScoreReason?: boolean;
  onRefetchTodayCheckin: () => void;
}

export function CheckinDashboard({
  currentUser,
  team,
  todayCheckin,
  needsLowScoreReason,
  onRefetchTodayCheckin,
}: CheckinDashboardProps) {

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getGreeting()}, {currentUser.firstName}!
          </h1>
          <p className="text-gray-500 mt-1">
            {team?.shiftStart} - {team?.shiftEnd} shift
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          {formatDisplayDate(new Date().toISOString())}
        </div>
      </div>

      {/* Wellness Insight Card */}
      <WellnessInsightCard
        mood={todayCheckin.mood}
        stress={todayCheckin.stress}
        sleep={todayCheckin.sleep}
        physicalHealth={todayCheckin.physicalHealth}
        readinessStatus={todayCheckin.readinessStatus}
      />

      {/* Low Score Reason Modal */}
      {needsLowScoreReason && (
        <LowScoreReasonModal
          checkinId={todayCheckin.id}
          score={todayCheckin.readinessScore}
          isOpen={true}
          onClose={() => {}}
          onSuccess={onRefetchTodayCheckin}
        />
      )}
    </div>
  );
}
