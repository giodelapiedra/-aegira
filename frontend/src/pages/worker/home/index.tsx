/**
 * HomePage - Main Orchestrator for Worker Home Page
 *
 * Displays the worker's dashboard with:
 * - Welcome header with greeting
 * - Schedule and next check-in cards
 * - Today's status card
 * - Week calendar with attendance overview
 * - Dynamic tips based on check-in data
 *
 * Handles role-based redirects for non-worker roles.
 * Uses consolidated /worker/dashboard endpoint for data fetching.
 */

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../../../hooks/useUser';
import { useWorkerDashboard, useHomeCalculations } from './hooks';
import {
  WelcomeHeader,
  ScheduleCard,
  NextCheckinCard,
  StatusCard,
  WeekCalendar,
  DynamicTipCard,
} from './components';
import { SkeletonDashboard } from '../../../components/ui/Skeleton';
import type { AbsenceRecord, ActiveExemption } from './types';
import type { WorkerDashboardAbsence, WorkerDashboardActiveExemption } from '../../../types/worker';

// Map dashboard absence to home page format
function mapAbsenceHistory(absences: WorkerDashboardAbsence[] | undefined): AbsenceRecord[] {
  if (!absences) return [];
  return absences.map((a) => ({
    id: a.id,
    userId: '', // Not needed for week calendar
    absenceDate: a.absenceDate,
    status: a.status,
    reason: a.explanation || undefined,
    createdAt: a.absenceDate,
  }));
}

// Map dashboard exemption to home page format
function mapActiveExemptions(
  exemptions: WorkerDashboardActiveExemption[] | undefined
): ActiveExemption[] {
  if (!exemptions) return [];
  return exemptions.map((e) => ({
    id: e.id,
    userId: e.userId,
    type: e.type,
    status: e.status,
    startDate: e.startDate,
    endDate: e.endDate,
    reason: e.reason,
  }));
}

export function HomePage() {
  const { user } = useUser();

  // Fetch consolidated dashboard data (replaces 5 separate API calls)
  // Hook must be called unconditionally (before any returns)
  const { data: dashboardData, isLoading } = useWorkerDashboard();

  // Map data to formats expected by useHomeCalculations
  // Hooks must be called unconditionally - handle undefined data inside
  const mappedAbsenceHistory = useMemo(
    () => mapAbsenceHistory(dashboardData?.absenceHistory),
    [dashboardData?.absenceHistory]
  );

  const mappedActiveExemptions = useMemo(
    () => mapActiveExemptions(dashboardData?.activeExemptions),
    [dashboardData?.activeExemptions]
  );

  // Calculations hook - must be called unconditionally
  const {
    timezone,
    returnToWorkDate,
    weekCalendar,
    weeklySummary,
    nextCheckin,
    dynamicTip,
    greetingText,
    formattedWorkDays,
    formattedShiftHours,
    todayDateDisplay,
    returnToWorkDateDisplay,
    returnToWorkShiftTime,
    nextCheckinTimeDisplay,
    nextCheckinFullDisplay,
    isTodayExempted,
  } = useHomeCalculations({
    team: dashboardData?.team
      ? {
          ...dashboardData.team,
          company: { timezone: dashboardData.timezone }, // Company timezone from dashboard
        }
      : undefined,
    todayCheckin: dashboardData?.todayCheckin,
    recentCheckins: dashboardData?.recentCheckins,
    activeExemptions: mappedActiveExemptions,
    absenceHistory: mappedAbsenceHistory,
    userId: user?.id,
  });

  // Role-based redirects (after all hooks)
  if (user?.role === 'EXECUTIVE') {
    return <Navigate to="/executive" replace />;
  }
  if (user?.role === 'SUPERVISOR' || user?.role === 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  if (user?.role === 'TEAM_LEAD') {
    return <Navigate to="/team/overview" replace />;
  }
  if (user?.role === 'WHS_CONTROL') {
    return <Navigate to="/whs" replace />;
  }
  if (user?.role === 'CLINICIAN') {
    return <Navigate to="/rehabilitation" replace />;
  }

  // Show loading state while fetching data
  if (isLoading || !dashboardData) {
    return (
      <div className="min-h-[400px]">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <WelcomeHeader
        firstName={user?.firstName}
        todayDateDisplay={todayDateDisplay}
        greetingText={greetingText}
        hasCheckedIn={!!dashboardData?.todayCheckin}
      />

      {/* Schedule & Next Check-in Cards */}
      {dashboardData?.team && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScheduleCard
            teamName={dashboardData.team.name}
            formattedWorkDays={formattedWorkDays}
            formattedShiftHours={formattedShiftHours}
          />
          <NextCheckinCard
            todayCheckin={!!dashboardData.todayCheckin}
            returnToWorkDate={returnToWorkDate}
            nextCheckin={nextCheckin}
            returnToWorkDateDisplay={returnToWorkDateDisplay}
            returnToWorkShiftTime={returnToWorkShiftTime}
            nextCheckinTimeDisplay={nextCheckinTimeDisplay}
            nextCheckinFullDisplay={nextCheckinFullDisplay}
            isTodayExempted={isTodayExempted}
          />
        </div>
      )}

      {/* Status Card */}
      <StatusCard
        isLoading={isLoading}
        todayCheckin={dashboardData?.todayCheckin}
        timezone={timezone}
      />

      {/* Week Calendar */}
      <WeekCalendar weekCalendar={weekCalendar} weeklySummary={weeklySummary} />

      {/* Dynamic Tips */}
      <DynamicTipCard tip={dynamicTip} />
    </div>
  );
}

// Default export for router
export default HomePage;
