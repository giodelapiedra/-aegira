/**
 * CheckinPage - Main Orchestrator
 *
 * Handles routing between different check-in states:
 * - Loading state
 * - Not required (non-MEMBER/WORKER role)
 * - No team assigned
 * - Welcome state (new team member)
 * - On leave state
 * - Not work day / Too early / Too late
 * - Check-in form
 * - Check-in dashboard (after submission)
 */

import { useEffect } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

// Hooks
import { useCheckinQueries } from './hooks';

// State Components
import {
  NoTeamState,
  NotRequiredState,
  OnLeaveState,
  WelcomeState,
  NotWorkDayState,
} from './states';

// Main Components
import { CheckinForm, CheckinDashboard } from './components';

// Utils
import { checkCheckinAvailability } from './utils';

export function CheckinPage() {
  const setUser = useAuthStore((state) => state.setUser);

  // Get today's check-in data first to pass to queries
  const {
    currentUser,
    team,
    leaveStatus,
    todayCheckin,
    recentCheckins,
    weekStats,
    isLoading,
  } = useCheckinQueries();

  // Update auth store when fresh user data is fetched
  useEffect(() => {
    if (currentUser.data) {
      setUser(currentUser.data);
    }
  }, [currentUser.data, setUser]);

  // Re-fetch exemption queries with today's check-in data
  const {
    exemptionStatus: exemptionStatusWithId,
    pendingExemption: pendingExemptionWithId,
  } = useCheckinQueries({
    todayCheckinId: todayCheckin.data?.id,
    todayCheckinStatus: todayCheckin.data?.readinessStatus,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Non-MEMBER/WORKER role - check-in not required
  if (currentUser.data?.role !== 'MEMBER' && currentUser.data?.role !== 'WORKER') {
    return <NotRequiredState role={currentUser.data?.role} />;
  }

  // No team assigned
  if (!currentUser.data?.teamId) {
    return <NoTeamState />;
  }

  // User is before their effective start date (just added to team today)
  if (leaveStatus.data?.isBeforeStart) {
    return (
      <WelcomeState
        effectiveStartDate={leaveStatus.data.effectiveStartDate}
        teamName={currentUser.data?.team?.name}
      />
    );
  }

  // User is on approved leave
  if (leaveStatus.data?.isOnLeave && leaveStatus.data.currentException) {
    return <OnLeaveState exception={leaveStatus.data.currentException} />;
  }

  // Already checked in today - show dashboard
  if (todayCheckin.data) {
    // Check if low score reason is needed (YELLOW/RED without reason submitted)
    const needsLowScoreReason =
      (todayCheckin.data.readinessStatus === 'RED' ||
        todayCheckin.data.readinessStatus === 'YELLOW') &&
      !todayCheckin.data.lowScoreReason;

    return (
      <CheckinDashboard
        currentUser={currentUser.data}
        team={team.data}
        todayCheckin={todayCheckin.data}
        needsLowScoreReason={needsLowScoreReason}
        onRefetchTodayCheckin={() => todayCheckin.refetch()}
      />
    );
  }

  // Check if check-in is available based on team schedule
  if (team.data) {
    const availability = checkCheckinAvailability(team.data);
    if (!availability.available) {
      return <NotWorkDayState availability={availability} />;
    }
  }

  // Check-in form
  return <CheckinForm leaveStatus={leaveStatus.data} />;
}

// Default export for router
export default CheckinPage;
