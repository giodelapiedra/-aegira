/**
 * Centralized date utility functions
 * Consolidates all date formatting and manipulation logic
 */

import { DAY_INDEX_TO_CODE, type DayCode } from './constants';

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date to local date string (YYYY-MM-DD)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to display format (e.g., "Dec 30, 2024")
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date to display format with time (e.g., "Dec 30, 2024, 2:30 PM")
 * @param date - Date to format
 * @param timezone - Optional timezone (defaults to browser timezone)
 */
export function formatDisplayDateTime(date: Date | string, timezone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  
  if (timezone) {
    options.timeZone = timezone;
  }
  
  // Use toLocaleString instead of toLocaleDateString for proper date+time formatting
  return d.toLocaleString('en-US', options);
}

/**
 * Format time only (e.g., "2:30 PM")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format time only (e.g., "2:30 PM")
 * Alias for formatTime for consistency with other display formatters
 */
export const formatDisplayTime = formatTime;

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 * @param date - Date to format
 * @param options - Optional settings
 * @param options.timezone - Timezone for fallback date display
 * @param options.short - Use short format (e.g., "2h ago" instead of "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string,
  options?: { timezone?: string; short?: boolean }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const short = options?.short ?? false;

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return short ? `${diffInMinutes}m ago` : `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return short ? `${diffInHours}h ago` : `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return short ? `${diffInDays}d ago` : `${diffInDays} days ago`;
  } else {
    // Use timezone if provided for fallback date display
    if (options?.timezone) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        timeZone: options.timezone,
      });
    }
    return formatDisplayDate(d);
  }
}

/**
 * Format shift time (e.g., "08:00" to "8:00 AM")
 */
export function formatShiftTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// ============================================
// DATE CALCULATIONS
// ============================================

/**
 * Get start of day (midnight)
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59.999)
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of week (Sunday)
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of week (Saturday)
 */
export function getEndOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the day code for a date
 */
export function getDayCode(date: Date): DayCode {
  return DAY_INDEX_TO_CODE[date.getDay()];
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < new Date().getTime();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > new Date().getTime();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Get the difference in days between two dates
 */
export function getDaysDifference(date1: Date, date2: Date): number {
  const d1 = getStartOfDay(date1);
  const d2 = getStartOfDay(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================
// WEEK CALENDAR HELPERS
// ============================================

export interface WeekDay {
  date: Date;
  dayCode: DayCode;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

/**
 * Get week calendar starting from a specific day offset
 * @param startOffset - Days to go back from today (default: 6 for full week)
 */
export function getWeekCalendar(startOffset: number = 6): WeekDay[] {
  const today = new Date();
  const days: WeekDay[] = [];

  for (let i = startOffset; i >= 0; i--) {
    const date = subtractDays(today, i);
    days.push({
      date,
      dayCode: getDayCode(date),
      dayNumber: date.getDate(),
      isToday: i === 0,
      isPast: i > 0,
      isFuture: false,
    });
  }

  return days;
}

/**
 * Get current date/time in a specific timezone
 * Returns date components (year, month, day, hour, minute) in the target timezone
 */
export function getNowInTimezone(timezone: string): { date: Date; hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  // Format current time in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value);
  
  // Create a UTC-based date that represents this time in the target timezone
  // We need to find the UTC timestamp that, when displayed in the target timezone, shows this time
  // IMPORTANT: Use Date.UTC() to avoid browser timezone issues - the year/month/day are already
  // extracted from the target timezone, so we create a UTC date at noon to pass to createDateWithTimeInTimezone
  const date = createDateWithTimeInTimezone(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, new Date(Date.UTC(year, month, day, 12, 0, 0)), timezone);
  
  return {
    date,
    hour,
    minute,
    dayOfWeek: (() => {
      // Get day of week in target timezone
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });
      const dayStr = dayFormatter.format(now);
      const dayMap: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };
      return dayMap[dayStr] || 0;
    })(),
  };
}

/**
 * Create a Date object representing a specific time in a specific timezone
 * This is used for schedule calculations where times are specified in company timezone
 * @param timeString - Time in "HH:mm" format (e.g., "08:00")
 * @param date - Date to set the time on (in target timezone)
 * @param timezone - IANA timezone string
 */
export function createDateWithTimeInTimezone(timeString: string, date: Date, timezone: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Get the date components in the target timezone
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const dateParts = dateFormatter.formatToParts(date);
  const year = parseInt(dateParts.find(p => p.type === 'year')!.value);
  const month = parseInt(dateParts.find(p => p.type === 'month')!.value) - 1;
  const day = parseInt(dateParts.find(p => p.type === 'day')!.value);
  
  // Strategy: Find the UTC timestamp that, when displayed in target timezone, shows our desired time
  // We'll use an iterative approach to find the correct UTC time
  
  // Start with a UTC guess
  let guess = Date.UTC(year, month, day, hours, minutes, 0);
  
  // Try to find the exact UTC time by testing different offsets
  // Timezone offsets can range from -12 to +14 hours
  for (let hourOffset = -14; hourOffset <= 14; hourOffset++) {
    const testTime = guess + (hourOffset * 60 * 60 * 1000);
    const testDate = new Date(testTime);
    
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(testDate);
    
    const tzYear = parseInt(tzParts.find(p => p.type === 'year')!.value);
    const tzMonth = parseInt(tzParts.find(p => p.type === 'month')!.value) - 1;
    const tzDay = parseInt(tzParts.find(p => p.type === 'day')!.value);
    const tzHour = parseInt(tzParts.find(p => p.type === 'hour')!.value);
    const tzMinute = parseInt(tzParts.find(p => p.type === 'minute')!.value);
    
    // Check for exact match
    if (tzYear === year && tzMonth === month && tzDay === day && tzHour === hours && tzMinute === minutes) {
      return testDate;
    }
  }
  
  // If no exact match found, refine search with minute-level precision
  // Search ±2 hours around the initial guess
  for (let minOffset = -120; minOffset <= 120; minOffset++) {
    const testTime = guess + (minOffset * 60 * 1000);
    const testDate = new Date(testTime);
    
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(testDate);
    
    const tzYear = parseInt(tzParts.find(p => p.type === 'year')!.value);
    const tzMonth = parseInt(tzParts.find(p => p.type === 'month')!.value) - 1;
    const tzDay = parseInt(tzParts.find(p => p.type === 'day')!.value);
    const tzHour = parseInt(tzParts.find(p => p.type === 'hour')!.value);
    const tzMinute = parseInt(tzParts.find(p => p.type === 'minute')!.value);
    
    if (tzYear === year && tzMonth === month && tzDay === day && tzHour === hours && tzMinute === minutes) {
      return testDate;
    }
  }
  
  // Fallback: return the initial UTC guess
  // This should rarely happen, but using UTC is more predictable than browser timezone
  return new Date(guess);
}

/**
 * Get week calendar centered on today
 */
export function getWeekCalendarCentered(): WeekDay[] {
  const today = new Date();
  const startOfWeek = getStartOfWeek(today);
  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(startOfWeek, i);
    days.push({
      date,
      dayCode: getDayCode(date),
      dayNumber: date.getDate(),
      isToday: isToday(date),
      isPast: isPast(getEndOfDay(date)) && !isToday(date),
      isFuture: isFuture(getStartOfDay(date)) && !isToday(date),
    });
  }

  return days;
}
