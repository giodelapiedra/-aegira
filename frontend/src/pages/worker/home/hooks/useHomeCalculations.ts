/**
 * useHomeCalculations Hook
 *
 * Memoized calculations for home page.
 * Handles timezone-aware date calculations for check-in scheduling.
 */

import { useMemo } from 'react';
import {
  getNowInTimezone,
  createDateWithTimeInTimezone,
} from '../../../../lib/date-utils';
import { formatWorkDays } from '../../../../lib/schedule-utils';
import {
  Lightbulb,
  Moon,
  Brain,
  TrendingUp,
  Smile,
  Sparkles,
} from 'lucide-react';
import {
  getWeekCalendar,
  calculateWeeklySummary,
  getReturnToWorkDate,
  getNextCheckin,
  isDateExempted,
} from '../utils';
import type { DynamicTip, ActiveExemption, AbsenceRecord } from '../types';
import type { Checkin } from '../../../../types/user';

interface UseHomeCalculationsParams {
  team: {
    shiftStart: string;
    shiftEnd?: string;
    workDays: string;
    name: string;
    company?: { timezone?: string };
  } | null | undefined;
  todayCheckin: Checkin | null | undefined;
  recentCheckins: Checkin[] | undefined;
  activeExemptions: ActiveExemption[] | undefined;
  absenceHistory: AbsenceRecord[] | undefined;
  userId: string | undefined;
}

export function useHomeCalculations({
  team,
  todayCheckin,
  recentCheckins,
  activeExemptions,
  absenceHistory,
  userId,
}: UseHomeCalculationsParams) {
  // Centralized timezone - comes from company settings via dashboard
  // Fallback to UTC if not available (edge case - should always come from company settings)
  const timezone = useMemo(
    () => team?.company?.timezone || 'UTC',
    [team?.company?.timezone]
  );

  // Return to work date (heavy calculation)
  const returnToWorkDate = useMemo(
    () => getReturnToWorkDate(activeExemptions, team?.workDays, userId, timezone),
    [activeExemptions, team?.workDays, userId, timezone]
  );

  // Week calendar (heavy calculation with date formatting)
  const weekCalendar = useMemo(
    () =>
      getWeekCalendar(
        team?.workDays,
        timezone,
        recentCheckins,
        activeExemptions,
        userId,
        absenceHistory
      ),
    [team?.workDays, timezone, recentCheckins, activeExemptions, userId, absenceHistory]
  );

  // Weekly summary
  const weeklySummary = useMemo(
    () => calculateWeeklySummary(weekCalendar),
    [weekCalendar]
  );

  // Next check-in (heavy calculation)
  const nextCheckin = useMemo(() => {
    if (returnToWorkDate) return null;
    return getNextCheckin(team, todayCheckin, activeExemptions, userId, returnToWorkDate);
  }, [returnToWorkDate, team, todayCheckin, activeExemptions, userId]);

  // Dynamic tip based on check-in data
  const dynamicTip = useMemo((): DynamicTip => {
    if (!todayCheckin) {
      return {
        icon: Lightbulb,
        title: 'Start Your Day Right',
        text: 'Complete your daily check-in to track your wellness and get personalized insights.',
      };
    }

    if (todayCheckin.sleep <= 4) {
      return {
        icon: Moon,
        title: 'Sleep Matters',
        text: 'Your sleep quality is low today. Try to get 7-8 hours of rest tonight for better performance.',
      };
    }
    if (todayCheckin.stress >= 7) {
      return {
        icon: Brain,
        title: 'Manage Your Stress',
        text: 'High stress detected. Consider taking short breaks or trying deep breathing exercises throughout the day.',
      };
    }
    if (todayCheckin.readinessScore >= 80) {
      return {
        icon: TrendingUp,
        title: "You're at Peak Performance!",
        text: 'Great readiness score today! Keep maintaining your healthy habits for consistent performance.',
      };
    }
    if (todayCheckin.mood <= 4) {
      return {
        icon: Smile,
        title: 'Boost Your Mood',
        text: 'Try connecting with a colleague or taking a short walk to lift your spirits today.',
      };
    }

    return {
      icon: Sparkles,
      title: 'Keep It Up!',
      text: "Regular check-ins help maintain accurate readiness tracking. You're doing well!",
    };
  }, [todayCheckin?.sleep, todayCheckin?.stress, todayCheckin?.readinessScore, todayCheckin?.mood]);

  // Greeting text
  const greetingText = useMemo(() => {
    const nowInTz = getNowInTimezone(timezone);
    const hour = nowInTz.hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [timezone]);

  // Formatted work days
  const formattedWorkDays = useMemo(
    () => (team?.workDays ? formatWorkDays(team.workDays) : 'Not set'),
    [team?.workDays]
  );

  // Formatted shift hours
  const formattedShiftHours = useMemo(() => {
    if (!team?.shiftStart) return '';
    const shiftStart = team.shiftStart || '08:00';
    const shiftEnd = team.shiftEnd || '17:00';
    const todayInTz = getNowInTimezone(timezone);
    const todayDate = new Date(todayInTz.date);
    todayDate.setHours(0, 0, 0, 0);
    const startTime = createDateWithTimeInTimezone(shiftStart, todayDate, timezone);
    const endTime = createDateWithTimeInTimezone(shiftEnd, todayDate, timezone);
    const startFormatted = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
    const endFormatted = endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
    return `${startFormatted} - ${endFormatted}`;
  }, [team?.shiftStart, team?.shiftEnd, timezone]);

  // Today's date display
  const todayDateDisplay = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: timezone,
      }),
    [timezone]
  );

  // Return to work date display
  const returnToWorkDateDisplay = useMemo(() => {
    if (!returnToWorkDate) return '';
    return returnToWorkDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
  }, [returnToWorkDate, timezone]);

  // Return to work shift time
  const returnToWorkShiftTime = useMemo(() => {
    if (!returnToWorkDate || !team?.shiftStart) return '';
    const todayDate = new Date(returnToWorkDate);
    todayDate.setHours(0, 0, 0, 0);
    const shiftTime = createDateWithTimeInTimezone(team.shiftStart, todayDate, timezone);
    return shiftTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
  }, [returnToWorkDate, team?.shiftStart, timezone]);

  // Next check-in time display
  const nextCheckinTimeDisplay = useMemo(() => {
    if (!nextCheckin?.date) return '';
    return nextCheckin.date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
  }, [nextCheckin?.date, timezone]);

  // Next check-in full display (date + time)
  const nextCheckinFullDisplay = useMemo(() => {
    if (!nextCheckin?.date) return '';
    const dateStr = nextCheckin.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
    const timeStr = nextCheckin.date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
    return `${dateStr}, ${timeStr}`;
  }, [nextCheckin?.date, timezone]);

  // Check if today is exempted
  const isTodayExempted = useMemo(
    () => isDateExempted(new Date(), activeExemptions, userId, timezone),
    [activeExemptions, userId, timezone]
  );

  return {
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
  };
}
