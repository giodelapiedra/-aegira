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
 *
 * Uses consolidated /worker/dashboard endpoint for data fetching.
 */

import { useEffect } from 'react';
import { useAuthStore } from '../../../store/auth.store';
import { SkeletonDashboard } from '../../../components/ui/Skeleton';

// Hooks
import {
  useWorkerDashboard,
  useInvalidateWorkerDashboard,
  useDashboardHelpers,
} from './hooks';

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

  // Fetch consolidated dashboard data (replaces 8 separate API calls)
  const { data: dashboardData, isLoading } = useWorkerDashboard();
  const helpers = useDashboardHelpers(dashboardData);
  const invalidateDashboard = useInvalidateWorkerDashboard();

  // Update auth store when fresh user data is fetched
  // Note: Only updates subset of fields from dashboard - other fields preserved from initial login
  useEffect(() => {
    if (dashboardData?.user) {
      // Partial update - merge with existing user data via type assertion
      // Full user data is set during login, this just refreshes display fields
      setUser({
        id: dashboardData.user.id,
        firstName: dashboardData.user.firstName,
        lastName: dashboardData.user.lastName,
        email: dashboardData.user.email,
        role: dashboardData.user.role as import('../../../types/user').Role,
        avatar: dashboardData.user.avatar ?? undefined,
        teamId: dashboardData.user.teamId ?? undefined,
        team: dashboardData.team
          ? {
              id: dashboardData.team.id,
              name: dashboardData.team.name,
            }
          : undefined,
        // Required fields - use defaults as these are set during login
        companyId: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });
    }
  }, [dashboardData?.user, dashboardData?.team, setUser]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[400px]">
        <SkeletonDashboard />
      </div>
    );
  }

  // Non-MEMBER/WORKER role - check-in not required
  if (dashboardData?.user?.role !== 'MEMBER' && dashboardData?.user?.role !== 'WORKER') {
    return <NotRequiredState role={dashboardData?.user?.role} />;
  }

  // No team assigned
  if (!helpers.hasTeam) {
    return <NoTeamState />;
  }

  // User is before their effective start date (just added to team today)
  if (helpers.isBeforeStart) {
    return (
      <WelcomeState
        effectiveStartDate={dashboardData?.leaveStatus.effectiveStartDate ?? undefined}
        teamName={dashboardData?.team?.name}
      />
    );
  }

  // User is on approved leave
  if (helpers.isOnLeave && dashboardData?.leaveStatus.currentException) {
    const exception = dashboardData.leaveStatus.currentException;
    return (
      <OnLeaveState
        exception={{
          ...exception,
          startDate: exception.startDate || '',
          endDate: exception.endDate || '',
        }}
      />
    );
  }

  // Already checked in today - show dashboard
  if (helpers.hasCheckedInToday && dashboardData?.todayCheckin) {
    // Check if low score reason is needed (RED without reason submitted)
    const needsLowScoreReason =
      dashboardData.todayCheckin.readinessStatus === 'RED' &&
      !dashboardData.todayCheckin.lowScoreReason;

    return (
      <CheckinDashboard
        currentUser={{
          id: dashboardData.user.id,
          firstName: dashboardData.user.firstName,
          lastName: dashboardData.user.lastName,
        }}
        team={dashboardData.team}
        todayCheckin={{
          ...dashboardData.todayCheckin,
          userId: dashboardData.user.id,
          companyId: '',
          notes: dashboardData.todayCheckin.notes ?? undefined,
          lowScoreReason: (dashboardData.todayCheckin.lowScoreReason ?? undefined) as import('../../../types/user').LowScoreReason | undefined,
          lowScoreDetails: dashboardData.todayCheckin.lowScoreDetails ?? undefined,
        }}
        needsLowScoreReason={needsLowScoreReason}
        onRefetchTodayCheckin={invalidateDashboard}
      />
    );
  }

  // Check if today is a holiday
  if (helpers.isHoliday && dashboardData?.holidayName) {
    return (
      <NotWorkDayState
        availability={{
          available: false,
          reason: 'HOLIDAY',
          message: `Today is ${dashboardData.holidayName}. Check-in is not required.`,
          holidayName: dashboardData.holidayName,
        }}
      />
    );
  }

  // Check if check-in is available based on team schedule
  if (dashboardData?.team) {
    const availability = checkCheckinAvailability(dashboardData.team, dashboardData.timezone);
    if (!availability.available) {
      return <NotWorkDayState availability={availability} />;
    }
  }

  // Check-in form
  return <CheckinForm leaveStatus={dashboardData?.leaveStatus} />;
}

// Default export for router
export default CheckinPage;
