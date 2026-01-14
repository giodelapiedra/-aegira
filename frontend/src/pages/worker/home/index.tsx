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
 */

import { Navigate } from 'react-router-dom';
import { useUser } from '../../../hooks/useUser';
import { useHomeQueries } from './hooks';
import { useHomeCalculations } from './hooks';
import {
  WelcomeHeader,
  ScheduleCard,
  NextCheckinCard,
  StatusCard,
  WeekCalendar,
  DynamicTipCard,
} from './components';

export function HomePage() {
  const { user } = useUser();

  // Role-based redirects
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

  // Fetch data
  const { todayCheckin, recentCheckins, myTeam, activeExemptions, absenceHistory, isLoading } =
    useHomeQueries();

  // Calculations
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
    team: myTeam.data,
    todayCheckin: todayCheckin.data,
    recentCheckins: recentCheckins.data?.data,
    activeExemptions: activeExemptions.data,
    absenceHistory: absenceHistory.data?.data,
    userId: user?.id,
  });

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <WelcomeHeader
        firstName={user?.firstName}
        todayDateDisplay={todayDateDisplay}
        greetingText={greetingText}
        hasCheckedIn={!!todayCheckin.data}
      />

      {/* Schedule & Next Check-in Cards */}
      {myTeam.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScheduleCard
            teamName={myTeam.data.name}
            formattedWorkDays={formattedWorkDays}
            formattedShiftHours={formattedShiftHours}
          />
          <NextCheckinCard
            todayCheckin={!!todayCheckin.data}
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
        todayCheckin={todayCheckin.data}
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
