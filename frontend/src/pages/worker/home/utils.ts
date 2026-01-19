/**
 * Utility functions for Worker Home Page
 *
 * Contains date calculations, exemption checks, and calendar logic.
 * All date operations use company timezone.
 */

import {
  getNowInTimezone,
  createDateWithTimeInTimezone,
} from '../../../lib/date-utils';
import {
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT,
  DAY_INDEX_TO_CODE,
} from '../../../lib/constants';
import type {
  NextCheckinResult,
  WeekCalendarDay,
  WeeklySummary,
  ActiveExemption,
  AbsenceRecord,
  MinimalCheckin,
} from './types';

/**
 * Check if a date is within an exemption/exception period
 */
export function isDateExempted(
  date: Date,
  activeExemptions: ActiveExemption[] | undefined,
  userId: string | undefined,
  timezone: string
): boolean {
  if (!activeExemptions || activeExemptions.length === 0 || !userId) return false;

  // Filter for current user's approved leave
  const myActiveExemptions = activeExemptions.filter(
    (exemption) => exemption.userId === userId && exemption.status === 'APPROVED'
  );
  if (myActiveExemptions.length === 0) return false;

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Format the input date in company timezone
  const dateParts = dateFormatter.formatToParts(date);
  const dateYear = parseInt(dateParts.find((p) => p.type === 'year')!.value);
  const dateMonth = parseInt(dateParts.find((p) => p.type === 'month')!.value);
  const dateDay = parseInt(dateParts.find((p) => p.type === 'day')!.value);
  const dateStr = `${dateYear}-${String(dateMonth).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;

  return myActiveExemptions.some((exemption) => {
    if (!exemption.startDate || !exemption.endDate) return false;

    // Format start and end dates in company timezone
    const startDateObj = new Date(exemption.startDate);
    const startParts = dateFormatter.formatToParts(startDateObj);
    const startYear = parseInt(startParts.find((p) => p.type === 'year')!.value);
    const startMonth = parseInt(startParts.find((p) => p.type === 'month')!.value);
    const startDay = parseInt(startParts.find((p) => p.type === 'day')!.value);
    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

    const endDateObj = new Date(exemption.endDate);
    const endParts = dateFormatter.formatToParts(endDateObj);
    const endYear = parseInt(endParts.find((p) => p.type === 'year')!.value);
    const endMonth = parseInt(endParts.find((p) => p.type === 'month')!.value);
    const endDay = parseInt(endParts.find((p) => p.type === 'day')!.value);
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    return dateStr >= startDateStr && dateStr <= endDateStr;
  });
}

/**
 * Get day code in timezone
 */
function getDayCodeInTimezone(date: Date, timezone: string): string {
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayStr = dayFormatter.format(date);
  const dayMap: Record<string, string> = {
    Sun: 'SUN',
    Mon: 'MON',
    Tue: 'TUE',
    Wed: 'WED',
    Thu: 'THU',
    Fri: 'FRI',
    Sat: 'SAT',
  };
  return dayMap[dayStr] || 'SUN';
}

/**
 * Get return to work date from active exemption
 */
export function getReturnToWorkDate(
  activeExemptions: ActiveExemption[] | undefined,
  workDays: string | undefined,
  userId: string | undefined,
  timezone: string
): Date | null {
  if (!activeExemptions || activeExemptions.length === 0 || !workDays || !userId) {
    return null;
  }

  // Filter exemptions for current user only
  const myActiveExemptions = activeExemptions.filter(
    (exemption) => exemption.userId === userId
  );

  if (myActiveExemptions.length === 0) {
    return null;
  }

  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;

  // Get today's date string in company timezone
  const todayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = todayFormatter.formatToParts(today);
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

  // Find exemption where TODAY is within the date range
  const activeExemption = myActiveExemptions
    .filter((exemption) => {
      if (!exemption.startDate || !exemption.endDate) return false;

      // Parse start date
      const startDateObj = new Date(exemption.startDate);
      const startParts = todayFormatter.formatToParts(startDateObj);
      const startYear = parseInt(startParts.find((p) => p.type === 'year')!.value);
      const startMonth = parseInt(startParts.find((p) => p.type === 'month')!.value) - 1;
      const startDay = parseInt(startParts.find((p) => p.type === 'day')!.value);
      const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

      // Parse end date
      const endDateObj = new Date(exemption.endDate);
      const endParts = todayFormatter.formatToParts(endDateObj);
      const endYear = parseInt(endParts.find((p) => p.type === 'year')!.value);
      const endMonth = parseInt(endParts.find((p) => p.type === 'month')!.value) - 1;
      const endDay = parseInt(endParts.find((p) => p.type === 'day')!.value);
      const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      // Check if today is within the exemption period
      return todayStr >= startDateStr && todayStr <= endDateStr;
    })
    .sort((a, b) => {
      // Sort by endDate ascending (earliest return date first)
      const aDate = new Date(a.endDate!).getTime();
      const bDate = new Date(b.endDate!).getTime();
      return aDate - bDate;
    })[0];

  if (!activeExemption || !activeExemption.endDate) return null;

  // Parse return date in company timezone
  const returnDateObj = new Date(activeExemption.endDate);
  const returnParts = todayFormatter.formatToParts(returnDateObj);
  const returnYear = parseInt(returnParts.find((p) => p.type === 'year')!.value);
  const returnMonth = parseInt(returnParts.find((p) => p.type === 'month')!.value) - 1;
  const returnDay = parseInt(returnParts.find((p) => p.type === 'day')!.value);

  const workDaysArray = workDays.split(',').map((d: string) => d.trim().toUpperCase());

  // Return date is the day AFTER endDate
  let finalDate = new Date(Date.UTC(returnYear, returnMonth, returnDay + 1, 12, 0, 0));

  // Get the date parts for the day after endDate
  const nextDayParts = todayFormatter.formatToParts(finalDate);
  let finalYear = parseInt(nextDayParts.find((p) => p.type === 'year')!.value);
  let finalMonth = parseInt(nextDayParts.find((p) => p.type === 'month')!.value) - 1;
  let finalDay = parseInt(nextDayParts.find((p) => p.type === 'day')!.value);

  // Check if return date is a work day, if not find next work day
  let returnDayCode = getDayCodeInTimezone(finalDate, timezone);

  if (!workDaysArray.includes(returnDayCode)) {
    // Search for next work day (max 7 days)
    for (let i = 1; i <= 7; i++) {
      const candidateDate = new Date(
        Date.UTC(returnYear, returnMonth, returnDay + 1 + i, 12, 0, 0)
      );
      const candidateDayCode = getDayCodeInTimezone(candidateDate, timezone);

      if (workDaysArray.includes(candidateDayCode)) {
        const candidateParts = todayFormatter.formatToParts(candidateDate);
        finalYear = parseInt(candidateParts.find((p) => p.type === 'year')!.value);
        finalMonth = parseInt(candidateParts.find((p) => p.type === 'month')!.value) - 1;
        finalDay = parseInt(candidateParts.find((p) => p.type === 'day')!.value);
        finalDate = candidateDate;
        break;
      }
    }
  }

  // Compare dates in company timezone
  const finalDateStr = `${finalYear}-${String(finalMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;

  if (finalDateStr < todayStr) {
    return null; // Exemption has ended
  }

  return finalDate;
}

/**
 * Calculate next check-in date/time
 */
export function getNextCheckin(
  team: {
    shiftStart: string;
    shiftEnd?: string;
    workDays: string;
    company?: { timezone?: string };
  } | null | undefined,
  todayCheckin: MinimalCheckin | null | undefined,
  activeExemptions: ActiveExemption[] | undefined,
  userId: string | undefined,
  returnToWorkDate: Date | null
): NextCheckinResult | null {
  if (!team?.shiftStart || !team?.workDays) return null;

  // Use company timezone - comes from company settings via dashboard
  // Fallback to UTC if not available (edge case)
  const timezone = team.company?.timezone || 'UTC';
  const nowInTz = getNowInTimezone(timezone);
  const now = nowInTz.date;

  const [shiftHours, shiftMinutes] = team.shiftStart.split(':').map(Number);

  // Check if today is a work day
  const todayCode = DAY_INDEX_TO_CODE[nowInTz.dayOfWeek];
  const workDays = team.workDays.split(',').map((d: string) => d.trim().toUpperCase());

  // Get today's date components in company timezone
  const todayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = todayFormatter.formatToParts(now);
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);

  // Create date for grace period calculation
  const todayInTzForDate = new Date(Date.UTC(todayYear, todayMonth, todayDay, 12, 0, 0));
  const todayShiftEnd = createDateWithTimeInTimezone(
    team.shiftEnd || '17:00',
    todayInTzForDate,
    timezone
  );

  // Grace period: 30 minutes before shift start
  const graceMinutes = shiftMinutes - 30;
  const graceHours = graceMinutes < 0 ? shiftHours - 1 : shiftHours;
  const finalGraceMinutes = graceMinutes < 0 ? graceMinutes + 60 : graceMinutes;
  const graceTimeString = `${String(graceHours).padStart(2, '0')}:${String(finalGraceMinutes).padStart(2, '0')}`;
  const graceStart = createDateWithTimeInTimezone(graceTimeString, todayInTzForDate, timezone);

  // Check if user is on exemption
  const isOnExemption =
    isDateExempted(now, activeExemptions, userId, timezone) || returnToWorkDate !== null;

  if (isOnExemption) {
    return null;
  }

  // Not on exemption, proceed with normal check-in logic
  if (workDays.includes(todayCode)) {
    // If today is a work day and we're before shift end
    if (!todayCheckin && now < todayShiftEnd) {
      // If we're within check-in window
      if (now >= graceStart) {
        return {
          date: now,
          isNow: true,
          timeUntil: 'Now',
        };
      } else {
        // Before grace period starts
        const diffMs = graceStart.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return {
          date: graceStart,
          isNow: false,
          timeUntil: diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`,
        };
      }
    }
  }

  // Find next work day
  for (let i = 1; i <= 14; i++) {
    const candidateDate = new Date(Date.UTC(todayYear, todayMonth, todayDay + i, 12, 0, 0));

    // Get day of week in company timezone
    const dateInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(candidateDate);

    const dayStr = dateInTz.find((p) => p.type === 'weekday')!.value;
    const dayMap: Record<string, string> = {
      Sun: 'SUN',
      Mon: 'MON',
      Tue: 'TUE',
      Wed: 'WED',
      Thu: 'THU',
      Fri: 'FRI',
      Sat: 'SAT',
    };
    const nextDayCode = (dayMap[dayStr] || 'SUN') as keyof typeof DAY_CODE_TO_NAME;

    // Get candidate date components
    const candidateYear = parseInt(dateInTz.find((p) => p.type === 'year')!.value);
    const candidateMonth = parseInt(dateInTz.find((p) => p.type === 'month')!.value) - 1;
    const candidateDay = parseInt(dateInTz.find((p) => p.type === 'day')!.value);

    // Skip if this is today
    if (candidateYear === todayYear && candidateMonth === todayMonth && candidateDay === todayDay) {
      continue;
    }

    // Check if this date is exempted
    if (isDateExempted(candidateDate, activeExemptions, userId, timezone)) {
      continue;
    }

    if (workDays.includes(nextDayCode)) {
      const year = parseInt(dateInTz.find((p) => p.type === 'year')!.value);
      const month = parseInt(dateInTz.find((p) => p.type === 'month')!.value) - 1;
      const day = parseInt(dateInTz.find((p) => p.type === 'day')!.value);

      const dateForGrace = new Date(Date.UTC(year, month, day, 12, 0, 0));
      const graceTime = createDateWithTimeInTimezone(graceTimeString, dateForGrace, timezone);

      const diffMs = graceTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        continue;
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        date: graceTime,
        isNow: false,
        timeUntil:
          diffDays > 0
            ? `${diffDays}d ${diffHours}h`
            : diffHours > 0
              ? `${diffHours}h ${diffMins}m`
              : `${diffMins}m`,
        dayName: DAY_CODE_TO_NAME[nextDayCode],
      };
    }
  }

  return null;
}

/**
 * Get current week calendar (Mon-Sun)
 */
export function getWeekCalendar(
  workDaysStr: string | undefined,
  timezone: string,
  recentCheckins: MinimalCheckin[] | undefined,
  activeExemptions: ActiveExemption[] | undefined,
  userId: string | undefined,
  absenceHistory: AbsenceRecord[] | undefined
): WeekCalendarDay[] {
  const days: WeekCalendarDay[] = [];

  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;
  const dayOfWeek = nowInTz.dayOfWeek; // 0 = Sunday

  // Get today's date components in company timezone
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = dateFormatter.formatToParts(today);
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

  // Calculate Monday of current week
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayDay = todayDay - daysFromMonday;

  const orderedDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
  const workDays = workDaysStr?.split(',').map((d: string) => d.trim().toUpperCase()) || [];

  for (let i = 0; i < 7; i++) {
    // Create date for this day of the week using UTC
    const date = new Date(Date.UTC(todayYear, todayMonth, mondayDay + i, 12, 0, 0));

    // Get date components in company timezone
    const dateParts = dateFormatter.formatToParts(date);
    const dateYear = parseInt(dateParts.find((p) => p.type === 'year')!.value);
    const dateMonth = parseInt(dateParts.find((p) => p.type === 'month')!.value) - 1;
    const dateDay = parseInt(dateParts.find((p) => p.type === 'day')!.value);
    const dateStr = `${dateYear}-${String(dateMonth + 1).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;

    const dayCode = orderedDays[i];
    const isWorkDayFlag = workDays.includes(dayCode);

    const checkin = recentCheckins?.find((c) => {
      const checkinDateObj = new Date(c.createdAt);
      const checkinParts = dateFormatter.formatToParts(checkinDateObj);
      const checkinYear = parseInt(checkinParts.find((p) => p.type === 'year')!.value);
      const checkinMonth = parseInt(checkinParts.find((p) => p.type === 'month')!.value) - 1;
      const checkinDay = parseInt(checkinParts.find((p) => p.type === 'day')!.value);
      const checkinDateStr = `${checkinYear}-${String(checkinMonth + 1).padStart(2, '0')}-${String(checkinDay).padStart(2, '0')}`;
      return checkinDateStr === dateStr;
    });

    // Find absence record for this date
    const absence = absenceHistory?.find((a) => {
      const absenceDateObj = new Date(a.absenceDate);
      const absenceParts = dateFormatter.formatToParts(absenceDateObj);
      const absenceYear = parseInt(absenceParts.find((p) => p.type === 'year')!.value);
      const absenceMonth = parseInt(absenceParts.find((p) => p.type === 'month')!.value) - 1;
      const absenceDay = parseInt(absenceParts.find((p) => p.type === 'day')!.value);
      const absenceDateStr = `${absenceYear}-${String(absenceMonth + 1).padStart(2, '0')}-${String(absenceDay).padStart(2, '0')}`;
      return absenceDateStr === dateStr;
    });

    // Check if this date is in the future
    const isFuture = dateStr > todayStr;

    // Check if this date is exempted (only if it's a work day)
    const isExempted =
      isWorkDayFlag && isDateExempted(date, activeExemptions, userId, timezone);

    days.push({
      dayName: DAY_CODE_TO_SHORT[dayCode],
      dayNum: dateDay,
      dateStr,
      isToday: dateStr === todayStr,
      isWorkDay: isWorkDayFlag,
      isFuture,
      checkin: checkin || null,
      isExempted,
      absence: absence || null,
    });
  }

  return days;
}

/**
 * Calculate weekly summary from calendar data
 */
export function calculateWeeklySummary(weekCalendar: WeekCalendarDay[]): WeeklySummary {
  const checkinsThisWeek = weekCalendar.filter((day) => day.checkin).length;
  const workDaysThisWeek = weekCalendar.filter((day) => day.isWorkDay).length;
  const workDaysPassed = weekCalendar.filter((day) => day.isWorkDay && !day.isFuture).length;
  const excusedAbsences = weekCalendar.filter((day) => day.absence?.status === 'EXCUSED').length;
  const unexcusedAbsences = weekCalendar.filter(
    (day) => day.absence?.status === 'UNEXCUSED'
  ).length;
  const pendingAbsences = weekCalendar.filter(
    (day) => day.absence?.status === 'PENDING_JUSTIFICATION'
  ).length;

  return {
    checkinsThisWeek,
    workDaysThisWeek,
    workDaysPassed,
    excusedAbsences,
    unexcusedAbsences,
    pendingAbsences,
  };
}
