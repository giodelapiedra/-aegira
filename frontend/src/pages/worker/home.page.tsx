import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checkinService } from '../../services/checkin.service';
import { teamService } from '../../services/team.service';
import { getActiveExemptions } from '../../services/exemption.service';
import { useUser } from '../../hooks/useUser';
import { quickActions } from '../../config/navigation';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  formatDisplayDateTime,
  getNowInTimezone,
  createDateWithTimeInTimezone,
} from '../../lib/date-utils';
import {
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT,
  DAY_INDEX_TO_CODE,
} from '../../lib/constants';
import { formatWorkDays } from '../../lib/schedule-utils';
import {
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Smile,
  Brain,
  Moon,
  Heart,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Calendar,
  Timer,
  Shield,
} from 'lucide-react';

// ============================================================================
// CONSTANTS & HELPERS (outside component to avoid recreation)
// ============================================================================

const DAY_MAP: Record<string, string> = {
  'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED',
  'Thu': 'THU', 'Fri': 'FRI', 'Sat': 'SAT'
};

const ORDERED_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const STATUS_CONFIG = {
  GREEN: {
    label: 'Ready for Duty',
    emoji: '😊',
    color: 'bg-success-500',
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
  },
  YELLOW: {
    label: 'Limited Readiness',
    emoji: '😐',
    color: 'bg-warning-500',
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
  },
  RED: {
    label: 'Not Ready',
    emoji: '😰',
    color: 'bg-danger-500',
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
  },
  DEFAULT: {
    label: 'Unknown',
    emoji: '😐',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
  },
} as const;

const GRADE_CONFIG = {
  A: { color: 'text-success-600', bgColor: 'bg-success-100', ringColor: 'ring-success-500', emoji: '🎉' },
  B: { color: 'text-primary-600', bgColor: 'bg-primary-100', ringColor: 'ring-primary-500', emoji: '👍' },
  C: { color: 'text-warning-600', bgColor: 'bg-warning-100', ringColor: 'ring-warning-500', emoji: '😐' },
  DEFAULT: { color: 'text-danger-600', bgColor: 'bg-danger-100', ringColor: 'ring-danger-500', emoji: '😰' },
} as const;

const getStatusConfig = (status: string) => STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DEFAULT;
const getGradeConfig = (grade: string) => GRADE_CONFIG[grade as keyof typeof GRADE_CONFIG] || GRADE_CONFIG.DEFAULT;

/** Create date formatter - memoize at call site */
const createDateFormatter = (timezone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Parse date parts to string YYYY-MM-DD */
const partsToDateStr = (parts: Intl.DateTimeFormatPart[]) => {
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
};

/** Get weekday code from formatter parts */
const getWeekdayFromDate = (date: Date, timezone: string): string => {
  const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
  return DAY_MAP[dayStr] || 'SUN';
};

export function HomePage() {
  const { user } = useUser();

  // Redirect non-MEMBER/WORKER roles to their respective dashboards
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

  const { data: todayCheckin, isLoading } = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
  });

  const { data: recentCheckins } = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 7 }),
  });

  const { data: myTeam } = useQuery({
    queryKey: ['team', 'my'],
    queryFn: () => teamService.getMyTeam(),
  });

  const { data: attendancePerformance } = useQuery({
    queryKey: ['attendance', 'performance'],
    queryFn: () => checkinService.getAttendancePerformance('all'),
    enabled: !!user?.teamId,
  });

  const { data: activeExemptions } = useQuery({
    queryKey: ['exemptions', 'active'],
    queryFn: () => getActiveExemptions(),
  });


  // Calculate next check-in date/time
  const getNextCheckin = () => {
    if (!myTeam?.shiftStart || !myTeam?.workDays) return null;

    // Use company timezone if available, otherwise use browser timezone
    const timezone = myTeam.company?.timezone || 'Asia/Manila';
    const nowInTz = getNowInTimezone(timezone);
    const now = nowInTz.date;
    
    const [shiftHours, shiftMinutes] = myTeam.shiftStart.split(':').map(Number);

    // Check if today is a work day and within shift hours
    const todayCode = DAY_INDEX_TO_CODE[nowInTz.dayOfWeek];
    const workDays = myTeam.workDays.split(',').map((d: string) => d.trim().toUpperCase());

    // Get today's date components in company timezone (for reuse in next work day calculation)
    const todayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayParts = todayFormatter.formatToParts(now);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
    
    // Create a date object representing today at noon in company timezone (for date calculations)
    const todayInTzForDate = new Date(Date.UTC(todayYear, todayMonth, todayDay, 12, 0, 0));
    
    // Create today's shift start and end times in company timezone
    const todayShiftEnd = createDateWithTimeInTimezone(myTeam.shiftEnd || '17:00', todayInTzForDate, timezone);

    // Grace period: 30 minutes before shift start
    const graceMinutes = shiftMinutes - 30;
    const graceHours = graceMinutes < 0 ? shiftHours - 1 : shiftHours;
    const finalGraceMinutes = graceMinutes < 0 ? graceMinutes + 60 : graceMinutes;
    const graceTimeString = `${String(graceHours).padStart(2, '0')}:${String(finalGraceMinutes).padStart(2, '0')}`;
    const graceStart = createDateWithTimeInTimezone(graceTimeString, todayInTzForDate, timezone);

    // Get exemption return date (if any) - this is the earliest date we can check in
    const exemptionReturnDate = getReturnToWorkDate();
    let minCheckinDate: Date | null = null;
    let minCheckinDateStr: string | null = null;
    if (exemptionReturnDate) {
      // Parse return date in company timezone
      const returnParts = todayFormatter.formatToParts(exemptionReturnDate);
      const returnYear = parseInt(returnParts.find(p => p.type === 'year')!.value);
      const returnMonth = parseInt(returnParts.find(p => p.type === 'month')!.value) - 1;
      const returnDay = parseInt(returnParts.find(p => p.type === 'day')!.value);
      minCheckinDateStr = `${returnYear}-${String(returnMonth + 1).padStart(2, '0')}-${String(returnDay).padStart(2, '0')}`;
      
      // If return date is in the future, use it as minimum check-in date
      if (minCheckinDateStr > todayStr) {
        minCheckinDate = exemptionReturnDate;
      }
    }

    // CRITICAL: Check if user is on exemption FIRST - if so, don't allow check-in today
    // Check if today is exempted (user is on leave) OR if there's a return date in the future
    // Also check if exemptionReturnDate exists (meaning user has an active exemption)
    const isOnExemption = isDateExempted(now) || 
                         (minCheckinDate && minCheckinDateStr && todayStr < minCheckinDateStr) ||
                         (exemptionReturnDate !== null);
    
    if (isOnExemption) {
      // User is on exemption today, don't return any check-in time
      // The UI will show the exemption return date instead
      return null;
    }

    // Not on exemption, proceed with normal check-in logic
    if (workDays.includes(todayCode)) {
      // If today is a work day and we're before shift end
      // If we haven't checked in today and shift hasn't ended
      if (!todayCheckin && now < todayShiftEnd) {
        // Not on exemption, can check in
        // If we're within check-in window (grace period to shift end)
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

    // If there's an exemption return date in the future, check if it's a work day
    // If so, return it as the next check-in date
    if (minCheckinDate && minCheckinDateStr && minCheckinDateStr > todayStr) {
      const returnDateParts = todayFormatter.formatToParts(minCheckinDate);
      const returnDayStr = returnDateParts.find(p => p.type === 'weekday')!.value;
      const returnDayMap: Record<string, string> = {
        'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED',
        'Thu': 'THU', 'Fri': 'FRI', 'Sat': 'SAT'
      };
      const returnDayCode = (returnDayMap[returnDayStr] || 'SUN') as keyof typeof DAY_CODE_TO_NAME;
      
      // If return date is a work day, use it as the next check-in date
      if (workDays.includes(returnDayCode)) {
        const returnDateForGrace = new Date(minCheckinDate);
        returnDateForGrace.setHours(0, 0, 0, 0);
        const graceTime = createDateWithTimeInTimezone(graceTimeString, returnDateForGrace, timezone);
        
        const diffMs = graceTime.getTime() - now.getTime();
        
        // Only return if the grace time is in the future
        if (diffMs > 0) {
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60));
          
          return {
            date: graceTime,
            isNow: false,
            timeUntil: diffDays > 0
              ? `${diffDays}d ${diffHours}h`
              : diffHours > 0
                ? `${diffHours}h ${diffMins}m`
                : `${diffMins}m`,
            dayName: DAY_CODE_TO_NAME[returnDayCode],
          };
        }
      }
    }

    // Find next work day (in company timezone)
    // IMPORTANT: If user already checked in today or is on exemption, we MUST skip today and find the next work day
    // Start from tomorrow (i=1) and ensure we skip today
    // Calculate dates directly from today's components to avoid timezone conversion issues
    // Increased to 14 days to handle longer exemptions
    for (let i = 1; i <= 14; i++) {
      // Calculate the candidate date by adding days directly to today's date components
      // This ensures we're working with the correct date in the company timezone
      const candidateDate = new Date(Date.UTC(todayYear, todayMonth, todayDay + i, 12, 0, 0));
      
      // Get day of week in company timezone
      const dateInTz = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(candidateDate);
      
      const dayStr = dateInTz.find(p => p.type === 'weekday')!.value;
      const dayMap: Record<string, string> = {
        'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED', 
        'Thu': 'THU', 'Fri': 'FRI', 'Sat': 'SAT'
      };
      const nextDayCode = (dayMap[dayStr] || 'SUN') as keyof typeof DAY_CODE_TO_NAME;
      
      // Get candidate date components in company timezone
      const candidateYear = parseInt(dateInTz.find(p => p.type === 'year')!.value);
      const candidateMonth = parseInt(dateInTz.find(p => p.type === 'month')!.value) - 1;
      const candidateDay = parseInt(dateInTz.find(p => p.type === 'day')!.value);
      const candidateDateStr = `${candidateYear}-${String(candidateMonth + 1).padStart(2, '0')}-${String(candidateDay).padStart(2, '0')}`;
      
      // CRITICAL: Skip if this is today (must skip today if already checked in)
      // Compare dates in company timezone to ensure accuracy
      if (candidateYear === todayYear && candidateMonth === todayMonth && candidateDay === todayDay) {
        continue; // Skip today - user already checked in or it's still today
      }
      
      // Additional safety check: if day code matches today AND it's a work day, verify it's not the same date
      if (nextDayCode === todayCode && workDays.includes(todayCode)) {
        const candidateDateOnly = new Date(Date.UTC(candidateYear, candidateMonth, candidateDay, 12, 0, 0));
        const todayDateOnly = new Date(Date.UTC(todayYear, todayMonth, todayDay, 12, 0, 0));
        if (candidateDateOnly.getTime() === todayDateOnly.getTime()) {
          continue; // Skip today - dates match exactly
        }
      }
      
      // Check if this date is before the exemption return date
      if (minCheckinDate && minCheckinDateStr && candidateDateStr < minCheckinDateStr) {
        continue; // Skip dates before exemption return date
      }
      
      // Check if this date is exempted (within exemption period)
      if (isDateExempted(candidateDate)) {
        continue; // Skip exempted dates
      }
      
      if (workDays.includes(nextDayCode)) {
        // Get the actual date components in company timezone for creating the grace time
        const year = parseInt(dateInTz.find(p => p.type === 'year')!.value);
        const month = parseInt(dateInTz.find(p => p.type === 'month')!.value) - 1;
        const day = parseInt(dateInTz.find(p => p.type === 'day')!.value);
        
        // Create a date object that represents this date in the company timezone
        // Use UTC to avoid browser timezone issues, then createDateWithTimeInTimezone will handle the conversion
        const dateForGrace = new Date(Date.UTC(year, month, day, 12, 0, 0));
        
        // Create grace time in company timezone
        const graceTime = createDateWithTimeInTimezone(graceTimeString, dateForGrace, timezone);

        const diffMs = graceTime.getTime() - now.getTime();
        
        // Only return if the grace time is in the future
        if (diffMs <= 0) {
          continue; // Skip if this time is in the past (shouldn't happen, but safety check)
        }
        
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return {
          date: graceTime,
          isNow: false,
          timeUntil: diffDays > 0
            ? `${diffDays}d ${diffHours}h`
            : diffHours > 0
              ? `${diffHours}h ${diffMins}m`
              : `${diffMins}m`,
          dayName: DAY_CODE_TO_NAME[nextDayCode],
        };
      }
    }

    return null;
  };

  // Check if a date is within an exemption/exception period
  const isDateExempted = (date: Date): boolean => {
    if (!activeExemptions || activeExemptions.length === 0 || !user?.id) return false;

    // Filter for current user's approved leave (both exemptions and exceptions)
    // Backend /active endpoint returns ALL approved exceptions that haven't ended yet
    const myActiveExemptions = activeExemptions.filter(
      exemption => exemption.userId === user.id && exemption.status === 'APPROVED'
    );
    if (myActiveExemptions.length === 0) return false;

    // Use company timezone for date comparison
    const timezone = myTeam?.company?.timezone || 'Asia/Manila';
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // Format the input date in company timezone
    const dateParts = dateFormatter.formatToParts(date);
    const dateYear = parseInt(dateParts.find(p => p.type === 'year')!.value);
    const dateMonth = parseInt(dateParts.find(p => p.type === 'month')!.value);
    const dateDay = parseInt(dateParts.find(p => p.type === 'day')!.value);
    const dateStr = `${dateYear}-${String(dateMonth).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;

    return myActiveExemptions.some(exemption => {
      if (!exemption.startDate || !exemption.endDate) return false;

      // Format start and end dates in company timezone
      const startDateObj = new Date(exemption.startDate);
      const startParts = dateFormatter.formatToParts(startDateObj);
      const startYear = parseInt(startParts.find(p => p.type === 'year')!.value);
      const startMonth = parseInt(startParts.find(p => p.type === 'month')!.value);
      const startDay = parseInt(startParts.find(p => p.type === 'day')!.value);
      const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

      const endDateObj = new Date(exemption.endDate);
      const endParts = dateFormatter.formatToParts(endDateObj);
      const endYear = parseInt(endParts.find(p => p.type === 'year')!.value);
      const endMonth = parseInt(endParts.find(p => p.type === 'month')!.value);
      const endDay = parseInt(endParts.find(p => p.type === 'day')!.value);
      const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      return dateStr >= startDateStr && dateStr <= endDateStr;
    });
  };

  // Get the return to work date from active exemption
  // Only returns if user is CURRENTLY on exemption (today is within start-end range)
  // If return date is not a work day, find the next work day
  const getReturnToWorkDate = () => {
    if (!activeExemptions || activeExemptions.length === 0 || !myTeam?.workDays || !user?.id) {
      return null;
    }

    // Filter exemptions for current user only
    const myActiveExemptions = activeExemptions.filter(
      exemption => exemption.userId === user.id
    );

    if (myActiveExemptions.length === 0) {
      return null;
    }

    // Use company timezone (centralized)
    const timezone = myTeam?.company?.timezone || 'Asia/Manila';
    const nowInTz = getNowInTimezone(timezone);
    const today = nowInTz.date;

    // Get today's date string in company timezone for comparison
    const todayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayParts = todayFormatter.formatToParts(today);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    // Find exemption where TODAY is within the date range (startDate <= today <= endDate)
    // This excludes future scheduled exemptions that haven't started yet
    const activeExemption = myActiveExemptions
      .filter(exemption => {
      if (!exemption.startDate || !exemption.endDate) return false;

        // Parse start date
        const startDateObj = new Date(exemption.startDate);
        const startParts = todayFormatter.formatToParts(startDateObj);
        const startYear = parseInt(startParts.find(p => p.type === 'year')!.value);
        const startMonth = parseInt(startParts.find(p => p.type === 'month')!.value) - 1;
        const startDay = parseInt(startParts.find(p => p.type === 'day')!.value);
        const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

        // Parse end date
      const endDateObj = new Date(exemption.endDate);
      const endParts = todayFormatter.formatToParts(endDateObj);
      const endYear = parseInt(endParts.find(p => p.type === 'year')!.value);
      const endMonth = parseInt(endParts.find(p => p.type === 'month')!.value) - 1;
      const endDay = parseInt(endParts.find(p => p.type === 'day')!.value);
      const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        // Check if today is within the exemption period
        return todayStr >= startDateStr && todayStr <= endDateStr;
      })
      .sort((a, b) => {
        // Sort by endDate ascending (earliest return date first)
        const aDate = new Date(a.endDate!).getTime();
        const bDate = new Date(b.endDate!).getTime();
        return aDate - bDate;
      })[0]; // Get the first one (earliest return date)

    if (!activeExemption || !activeExemption.endDate) return null;

    // Parse return date in company timezone
    const returnDateObj = new Date(activeExemption.endDate);
    const returnParts = todayFormatter.formatToParts(returnDateObj);
    const returnYear = parseInt(returnParts.find(p => p.type === 'year')!.value);
    const returnMonth = parseInt(returnParts.find(p => p.type === 'month')!.value) - 1;
    const returnDay = parseInt(returnParts.find(p => p.type === 'day')!.value);

    const workDays = myTeam.workDays.split(',').map((d: string) => d.trim().toUpperCase());

    // Get day of week in company timezone using Intl
    const getDayCodeInTimezone = (date: Date): string => {
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });
      const dayStr = dayFormatter.format(date);
      const dayMap: Record<string, string> = {
        'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED',
        'Thu': 'THU', 'Fri': 'FRI', 'Sat': 'SAT'
      };
      return dayMap[dayStr] || 'SUN';
    };

    // Find the final return date (must be a work day)
    let finalYear = returnYear;
    let finalMonth = returnMonth;
    let finalDay = returnDay;
    let finalDate = new Date(Date.UTC(returnYear, returnMonth, returnDay, 12, 0, 0));

    // Check if return date is a work day, if not find next work day
    let returnDayCode = getDayCodeInTimezone(finalDate);

    if (!workDays.includes(returnDayCode)) {
      // Search for next work day (max 7 days)
      for (let i = 1; i <= 7; i++) {
        const candidateDate = new Date(Date.UTC(returnYear, returnMonth, returnDay + i, 12, 0, 0));
        const candidateDayCode = getDayCodeInTimezone(candidateDate);

        if (workDays.includes(candidateDayCode)) {
          // Get the actual date components in company timezone
          const candidateParts = todayFormatter.formatToParts(candidateDate);
          finalYear = parseInt(candidateParts.find(p => p.type === 'year')!.value);
          finalMonth = parseInt(candidateParts.find(p => p.type === 'month')!.value) - 1;
          finalDay = parseInt(candidateParts.find(p => p.type === 'day')!.value);
          finalDate = candidateDate;
          break;
        }
      }
    }

    // Compare dates in company timezone
    // Return the return date if it's today or in the future
    // If exemption ends today, worker should check in today (return date)
    const finalDateStr = `${finalYear}-${String(finalMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;

    // Only return null if the return date is in the past
    // If it's today or future, return it (even if it's today, show it as return date)
    // IMPORTANT: We want to show the return date even if it's today, so use <= instead of <
    if (finalDateStr < todayStr) {
      return null; // Exemption has ended (return date is in the past)
    }

    // Return the final date (adjusted to work day if needed)
    return finalDate;
  };

  // Get current week calendar (Mon-Sun) showing work days
  const getWeekCalendar = () => {
    const days = [];
    // Use company timezone (centralized)
    const timezone = myTeam?.company?.timezone || 'Asia/Manila';
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
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    // Calculate Monday of current week (in company timezone)
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayDay = todayDay - daysFromMonday;

    const orderedDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
    const workDays = myTeam?.workDays?.split(',').map((d: string) => d.trim().toUpperCase()) || [];

    for (let i = 0; i < 7; i++) {
      // Create date for this day of the week using UTC
      const date = new Date(Date.UTC(todayYear, todayMonth, mondayDay + i, 12, 0, 0));

      // Get date components in company timezone
      const dateParts = dateFormatter.formatToParts(date);
      const dateYear = parseInt(dateParts.find(p => p.type === 'year')!.value);
      const dateMonth = parseInt(dateParts.find(p => p.type === 'month')!.value) - 1;
      const dateDay = parseInt(dateParts.find(p => p.type === 'day')!.value);
      const dateStr = `${dateYear}-${String(dateMonth + 1).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;

      const dayCode = orderedDays[i];
      const isWorkDayFlag = workDays.includes(dayCode);

      const checkin = recentCheckins?.data?.find(c => {
        // Format checkin date in company timezone
        const checkinDateObj = new Date(c.createdAt);
        const checkinParts = dateFormatter.formatToParts(checkinDateObj);
        const checkinYear = parseInt(checkinParts.find(p => p.type === 'year')!.value);
        const checkinMonth = parseInt(checkinParts.find(p => p.type === 'month')!.value) - 1;
        const checkinDay = parseInt(checkinParts.find(p => p.type === 'day')!.value);
        const checkinDateStr = `${checkinYear}-${String(checkinMonth + 1).padStart(2, '0')}-${String(checkinDay).padStart(2, '0')}`;
        return checkinDateStr === dateStr;
      });

      // Check if this date is in the future (in company timezone)
      const isFuture = dateStr > todayStr;

      // Check if this date is exempted (only if it's a work day)
      const isExempted = isWorkDayFlag && isDateExempted(date);

      days.push({
        dayName: DAY_CODE_TO_SHORT[dayCode],
        dayNum: dateDay,
        isToday: dateStr === todayStr,
        isWorkDay: isWorkDayFlag,
        isFuture,
        checkin,
        isExempted,
      });
    }
    return days;
  };

  // Get dynamic tip based on today's metrics
  const getDynamicTip = () => {
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
        title: 'You\'re at Peak Performance!',
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
      text: 'Regular check-ins help maintain accurate readiness tracking. You\'re doing well!',
    };
  };

  // ============================================================================
  // MEMOIZED COMPUTATIONS - prevents recalculation on every render
  // ============================================================================

  // Centralized timezone - used by all calculations
  const timezone = useMemo(
    () => myTeam?.company?.timezone || 'Asia/Manila',
    [myTeam?.company?.timezone]
  );

  // Memoize weekly summary
  const weeklySummary = useMemo(() => {
    if (!recentCheckins?.data || recentCheckins.data.length === 0) return null;
    const data = recentCheckins.data;
    const avgScore = Math.round(data.reduce((sum, c) => sum + c.readinessScore, 0) / data.length);
    const greenDays = data.filter(c => c.readinessStatus === 'GREEN').length;
    const trend = data.length >= 2 ? data[0].readinessScore - data[1].readinessScore : 0;
    return { avgScore, greenDays, totalDays: data.length, trend };
  }, [recentCheckins?.data]);

  // Memoize return to work date - heavy calculation
  const returnToWorkDate = useMemo(
    () => getReturnToWorkDate(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExemptions, myTeam?.workDays, timezone, user?.id]
  );

  // Memoize next check-in - heavy calculation
  const nextCheckin = useMemo(() => {
    if (returnToWorkDate) return null;
    return getNextCheckin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnToWorkDate, myTeam?.shiftStart, myTeam?.shiftEnd, myTeam?.workDays, todayCheckin, activeExemptions, timezone]);

  // Memoize week calendar - heavy calculation with date formatting
  const weekCalendar = useMemo(
    () => getWeekCalendar(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myTeam?.workDays, timezone, recentCheckins?.data, activeExemptions, user?.id]
  );

  // Memoize dynamic tip
  const dynamicTip = useMemo(
    () => getDynamicTip(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayCheckin?.sleep, todayCheckin?.stress, todayCheckin?.readinessScore, todayCheckin?.mood]
  );

  // Memoize greeting text
  const greetingText = useMemo(() => {
    const nowInTz = getNowInTimezone(timezone);
    const hour = nowInTz.hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [timezone]);

  // Memoize formatted work days
  const formattedWorkDays = useMemo(
    () => myTeam?.workDays ? formatWorkDays(myTeam.workDays) : 'Not set',
    [myTeam?.workDays]
  );

  // Memoize shift hours display
  const formattedShiftHours = useMemo(() => {
    if (!myTeam?.shiftStart) return '';
    const shiftStart = myTeam.shiftStart || '08:00';
    const shiftEnd = myTeam.shiftEnd || '17:00';
    const todayInTz = getNowInTimezone(timezone);
    const todayDate = new Date(todayInTz.date);
    todayDate.setHours(0, 0, 0, 0);
    const startTime = createDateWithTimeInTimezone(shiftStart, todayDate, timezone);
    const endTime = createDateWithTimeInTimezone(shiftEnd, todayDate, timezone);
    const startFormatted = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
    const endFormatted = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
    return `${startFormatted} - ${endFormatted}`;
  }, [myTeam?.shiftStart, myTeam?.shiftEnd, timezone]);

  // Memoize today's date display
  const todayDateDisplay = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone }),
    [timezone]
  );

  // Memoize return to work date display
  const returnToWorkDateDisplay = useMemo(() => {
    if (!returnToWorkDate) return '';
    return returnToWorkDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
  }, [returnToWorkDate, timezone]);

  // Memoize return to work shift time
  const returnToWorkShiftTime = useMemo(() => {
    if (!returnToWorkDate || !myTeam?.shiftStart) return '';
    const todayDate = new Date(returnToWorkDate);
    todayDate.setHours(0, 0, 0, 0);
    const shiftTime = createDateWithTimeInTimezone(myTeam.shiftStart, todayDate, timezone);
    return shiftTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  }, [returnToWorkDate, myTeam?.shiftStart, timezone]);

  // Memoize next check-in time display
  const nextCheckinTimeDisplay = useMemo(() => {
    if (!nextCheckin?.date) return '';
    return nextCheckin.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  }, [nextCheckin?.date, timezone]);

  // Memoize next check-in full display (date + time)
  const nextCheckinFullDisplay = useMemo(() => {
    if (!nextCheckin?.date) return '';
    const dateStr = nextCheckin.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });
    const timeStr = nextCheckin.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
    return `${dateStr}, ${timeStr}`;
  }, [nextCheckin?.date, timezone]);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary-200" />
            <span className="text-sm text-primary-200">{todayDateDisplay}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {greetingText}, {user?.firstName}!
          </h1>
          <p className="text-primary-100 max-w-xl">
            {todayCheckin
              ? "You've completed your check-in today. Keep up the great work!"
              : "Start your day right by completing your daily check-in."
            }
          </p>
        </div>
      </div>

      {/* Schedule & Next Check-in Card */}
      {myTeam && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* My Schedule */}
          <Card className="border border-gray-200">
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Schedule</h3>
                  <p className="text-sm text-gray-600">{myTeam.name}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Work Days</span>
                  <span className="text-sm font-medium text-gray-900">{formattedWorkDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Shift Hours</span>
                  <span className="text-sm font-medium text-gray-900">{formattedShiftHours}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Check-in */}
          <Card className={`border ${nextCheckin?.isNow ? 'border-primary-300 bg-primary-50' : 'border-gray-200'} min-h-[140px]`}>
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${nextCheckin?.isNow ? 'bg-primary-100' : 'bg-gray-50'}`}>
                  <Timer className={`h-5 w-5 ${nextCheckin?.isNow ? 'text-primary-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Next Check-in</h3>
                  {returnToWorkDate ? (
                    <p className="text-sm text-blue-600 font-medium">On exemption</p>
                  ) : todayCheckin ? (
                    <p className="text-sm text-success-600">Completed for today</p>
                  ) : nextCheckin?.isNow && !isDateExempted(new Date()) ? (
                    <p className="text-sm text-primary-600 font-medium">Available now!</p>
                  ) : (
                    <p className="text-sm text-gray-600">Upcoming</p>
                  )}
                </div>
              </div>
              {todayCheckin ? (
                <div className="flex items-center justify-between">
                  {returnToWorkDate ? (
                    <>
                      <span className="text-sm text-gray-500">Return to work</span>
                      <span className="text-sm font-medium text-blue-700">
                        {returnToWorkDateDisplay}, {returnToWorkShiftTime}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-500">Next available</span>
                      <span className="text-sm font-medium text-gray-900">
                        {nextCheckin ? (
                          nextCheckin.dayName
                            ? `${nextCheckin.dayName}, ${nextCheckinTimeDisplay}`
                            : nextCheckinFullDisplay
                        ) : 'Tomorrow'}
                      </span>
                    </>
                  )}
                </div>
              ) : returnToWorkDate ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Currently exempted</span>
                    <span className="text-sm font-medium text-blue-700">On exemption</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Return to work</span>
                    <span className="text-lg font-bold text-blue-700">{returnToWorkDateDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Time</span>
                    <span className="text-sm font-medium text-gray-900">{returnToWorkShiftTime}</span>
                  </div>
                </div>
              ) : nextCheckin ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Time until check-in</span>
                    <span className={`text-lg font-bold ${nextCheckin.isNow ? 'text-primary-600' : 'text-gray-900'}`}>
                      {nextCheckin.timeUntil}
                    </span>
                  </div>
                  {nextCheckin.dayName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Day</span>
                      <span className="text-sm font-medium text-gray-900">{nextCheckin.dayName}</span>
                    </div>
                  )}
                  {nextCheckin.isNow && !isDateExempted(new Date()) && (
                    <Link
                      to="/checkin"
                      className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors text-sm"
                    >
                      Check-in Now
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No upcoming schedule</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Card */}
      {isLoading ? (
        <Card className="border-2 border-gray-200 bg-gray-50 min-h-[140px]">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gray-200 animate-pulse" />
                <div>
                  <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
                </div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-24 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ) : todayCheckin ? (
        <Card className={`border-2 ${getStatusConfig(todayCheckin.readinessStatus).borderColor} ${getStatusConfig(todayCheckin.readinessStatus).bgColor} transition-all duration-300 hover:shadow-lg`}>
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl ${getStatusConfig(todayCheckin.readinessStatus).color} flex items-center justify-center shadow-lg relative overflow-hidden`}>
                  <span className="text-3xl animate-bounce-slow relative z-10">{getStatusConfig(todayCheckin.readinessStatus).emoji}</span>
                  <div className={`absolute inset-0 ${getStatusConfig(todayCheckin.readinessStatus).color} opacity-20 animate-pulse`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={todayCheckin.readinessStatus === 'GREEN' ? 'success' : todayCheckin.readinessStatus === 'YELLOW' ? 'warning' : 'danger'}>
                      {getStatusConfig(todayCheckin.readinessStatus).label}
                    </Badge>
                    <span className="text-2xl font-bold text-gray-900 animate-fade-in">{todayCheckin.readinessScore}%</span>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1 animate-fade-in">
                    <Clock className="h-4 w-4" />
                    Last check-in: {formatDisplayDateTime(todayCheckin.createdAt, myTeam?.company?.timezone)}
                  </p>
                </div>
              </div>
              <Link
                to="/my-history"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-warning-200 bg-warning-50">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-warning-500 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Check-in Required</h3>
                  <p className="text-sm text-gray-600">
                    Complete your daily check-in to update your readiness status
                  </p>
                </div>
              </div>
              <Link
                to="/checkin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Check-in Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Performance Card */}
      {attendancePerformance ? (
        <Card className="border border-gray-200 overflow-hidden min-h-[180px]">
          <CardContent className="py-5">
            {attendancePerformance.countedDays > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  {/* Grade Circle with Emoji */}
                  <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg relative overflow-hidden ${getGradeConfig(attendancePerformance.grade).bgColor} ${getGradeConfig(attendancePerformance.grade).ringColor} ring-4`}>
                    <span className="text-4xl animate-bounce-slow relative z-10">
                      {getGradeConfig(attendancePerformance.grade).emoji}
                    </span>
                    <div className={`absolute inset-0 ${getGradeConfig(attendancePerformance.grade).bgColor} opacity-20 animate-pulse`} />
                  </div>
                  {/* Score & Label */}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">{attendancePerformance.score}%</span>
                      <span className={`text-sm font-medium ${getGradeConfig(attendancePerformance.grade).color}`}>
                        {attendancePerformance.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-500">Attendance Score</p>
                      <span className={`text-lg font-black ${getGradeConfig(attendancePerformance.grade).color}`}>
                        {attendancePerformance.grade}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Breakdown Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-success-50 rounded-lg">
                    <p className="text-lg font-bold text-success-600">{attendancePerformance.breakdown.green}</p>
                    <p className="text-xs text-gray-500">On-time</p>
                  </div>
                  <div className="p-2 bg-warning-50 rounded-lg">
                    <p className="text-lg font-bold text-warning-600">{attendancePerformance.breakdown.yellow}</p>
                    <p className="text-xs text-gray-500">Late</p>
                  </div>
                  <div className="p-2 bg-danger-50 rounded-lg">
                    <p className="text-lg font-bold text-danger-600">{attendancePerformance.breakdown.absent}</p>
                    <p className="text-xs text-gray-500">Absent</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-600">{attendancePerformance.breakdown.excused}</p>
                    <p className="text-xs text-gray-500">Excused</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Based on {attendancePerformance.countedDays} work day{attendancePerformance.countedDays !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              /* No Data State */
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-100 ring-4 ring-gray-200">
                  <span className="text-2xl font-bold text-gray-400">—</span>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-500">No record yet</p>
                  <p className="text-sm text-gray-400 mt-0.5">Attendance score will appear after your first work day</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-200 overflow-hidden min-h-[180px]">
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-100 ring-4 ring-gray-200">
                <span className="text-2xl font-bold text-gray-400">—</span>
              </div>
              <div className="flex-1">
                <p className="text-lg font-medium text-gray-500">Loading attendance...</p>
                <p className="text-sm text-gray-400 mt-0.5">Calculating your performance score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Metrics + Week Calendar Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {todayCheckin ? (
          <>
          {/* Today's Metrics */}
          <Card>
            <CardContent className="py-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Today's Metrics</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <Smile className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{todayCheckin.mood}</p>
                  <p className="text-xs text-gray-500">Mood</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{todayCheckin.stress}</p>
                  <p className="text-xs text-gray-500">Stress</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                    <Moon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{todayCheckin.sleep}</p>
                  <p className="text-xs text-gray-500">Sleep</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 rounded-lg bg-status-red-50 flex items-center justify-center mx-auto mb-2">
                    <Heart className="h-5 w-5 text-status-red-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{todayCheckin.physicalHealth}</p>
                  <p className="text-xs text-gray-500">Physical</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week at a Glance */}
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">This Week</h3>
                {weeklySummary && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{weeklySummary.avgScore}% avg</span>
                    {weeklySummary.trend !== 0 && (
                      <span className={`flex items-center text-xs ${weeklySummary.trend > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {weeklySummary.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weekCalendar.map((day, index) => (
                  <div
                    key={index}
                    className={`text-center p-2 rounded-lg relative ${
                      day.isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''
                    } ${
                      day.checkin
                        ? day.checkin.readinessStatus === 'GREEN'
                          ? 'bg-success-100'
                          : day.checkin.readinessStatus === 'YELLOW'
                          ? 'bg-warning-100'
                          : 'bg-danger-100'
                        : day.isExempted
                        ? 'bg-blue-50 border border-blue-300'
                        : day.isFuture && day.isWorkDay
                        ? 'bg-primary-50 border border-primary-200 border-dashed'
                        : day.isWorkDay && !day.isFuture
                        ? 'bg-gray-100'
                        : 'bg-gray-50'
                    }`}
                  >
                    <p className={`text-xs font-medium ${day.isWorkDay ? 'text-gray-600' : 'text-gray-400'}`}>{day.dayName}</p>
                    <p className={`text-sm font-bold ${day.isToday ? 'text-primary-600' : 'text-gray-900'}`}>
                      {day.dayNum}
                    </p>
                    {day.checkin ? (
                      <div className={`text-xs font-medium ${
                        day.checkin.readinessStatus === 'GREEN' ? 'text-success-700' :
                        day.checkin.readinessStatus === 'YELLOW' ? 'text-warning-700' : 'text-danger-700'
                      }`}>
                        {day.checkin.readinessScore}%
                      </div>
                    ) : day.isExempted ? (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Shield className="h-3 w-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Exempt</span>
                      </div>
                    ) : day.isFuture && day.isWorkDay ? (
                      <div className="text-xs text-primary-500">○</div>
                    ) : !day.isWorkDay ? (
                      <div className="text-xs text-gray-300">off</div>
                    ) : (
                      <div className="text-xs text-gray-400">-</div>
                    )}
                  </div>
                ))}
              </div>
              {weeklySummary && weeklySummary.totalDays > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-4 text-xs">
                  <span className="text-success-600 font-medium">{weeklySummary.greenDays} green</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{weeklySummary.totalDays} check-ins</span>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        ) : (
          <>
            {/* Today's Metrics - Placeholder */}
            <Card className="min-h-[200px]">
              <CardContent className="py-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Today's Metrics</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="text-center">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 animate-pulse mx-auto mb-2" />
                      <div className="h-6 bg-gray-100 rounded w-8 mx-auto mb-1 animate-pulse" />
                      <div className="h-3 bg-gray-100 rounded w-12 mx-auto animate-pulse" />
        </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Week Calendar - Placeholder */}
            <Card className="min-h-[200px]">
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">This Week</h3>
                  <div className="h-4 bg-gray-100 rounded w-16 animate-pulse" />
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="text-center p-2 rounded-lg bg-gray-100 animate-pulse">
                      <div className="h-3 bg-gray-200 rounded mb-1" />
                      <div className="h-4 bg-gray-200 rounded mb-1" />
                      <div className="h-3 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.id} to={action.href}>
                <Card className="h-full hover:shadow-md hover:border-primary-200 transition-all group cursor-pointer">
                  <CardContent className="py-6 text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center mx-auto mb-3 transition-colors">
                      <Icon className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{action.label}</h3>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Dynamic Tips Section */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <dynamicTip.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{dynamicTip.title}</h3>
                  <p className="text-sm text-gray-600">{dynamicTip.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
    </div>
  );
}
