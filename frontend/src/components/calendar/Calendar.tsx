import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Holiday } from '../../types/calendar';

// Day status type for background coloring
export type DayStatus = 'green' | 'yellow' | 'red' | 'absent' | 'exempted' | 'holiday' | 'pending' | 'off' | 'before-start' | null;

interface CalendarProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onDateClick?: (date: string) => void;
  renderDay?: (date: string, isWorkDay: boolean, isHoliday: boolean, holidayName?: string) => React.ReactNode;
  // New: get day status for background coloring
  getDayStatus?: (date: string) => DayStatus;
  holidays: Holiday[];
  workDays?: string;
  selectedDate?: string;
  startDate?: string; // Date when check-ins started (user joined / team created)
  disablePastDates?: boolean; // Disable clicking on past dates (for adding holidays)
  timezone?: string; // Company timezone (e.g., 'Asia/Manila')
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MAP: Record<number, string> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
};

function formatDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

// Get today's date in a specific timezone
function getTodayInTimezone(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(now); // Returns YYYY-MM-DD format
    } catch {
      // Fallback to local time if timezone is invalid
    }
  }
  // Default: use local time
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

// Background colors for each status - soft pastel colors like reference
const STATUS_BG_COLORS: Record<DayStatus | 'default', string> = {
  'green': 'bg-emerald-50 hover:bg-emerald-100/80',
  'yellow': 'bg-amber-50 hover:bg-amber-100/80',
  'red': 'bg-orange-50 hover:bg-orange-100/80',
  'absent': 'bg-slate-100 hover:bg-slate-200/80',
  'exempted': 'bg-violet-50 hover:bg-violet-100/80',
  'holiday': 'bg-rose-50 hover:bg-rose-100/80',
  'pending': 'bg-sky-50 hover:bg-sky-100/80',
  'off': 'bg-gray-50/50',
  'before-start': 'bg-gray-50/30',
  'default': 'bg-white hover:bg-gray-50',
  null: 'bg-white hover:bg-gray-50',
};

// Border accent colors for selected state
const STATUS_BORDER_COLORS: Record<DayStatus | 'default', string> = {
  'green': 'ring-2 ring-emerald-400',
  'yellow': 'ring-2 ring-amber-400',
  'red': 'ring-2 ring-orange-400',
  'absent': 'ring-2 ring-slate-400',
  'exempted': 'ring-2 ring-violet-400',
  'holiday': 'ring-2 ring-rose-400',
  'pending': 'ring-2 ring-sky-400',
  'off': 'ring-2 ring-gray-300',
  'before-start': 'ring-2 ring-gray-200',
  'default': 'ring-2 ring-indigo-400',
  null: 'ring-2 ring-indigo-400',
};

export function Calendar({
  year,
  month,
  onMonthChange,
  onDateClick,
  renderDay,
  getDayStatus,
  holidays,
  workDays = 'MON,TUE,WED,THU,FRI',
  selectedDate,
  startDate,
  disablePastDates = false,
  timezone,
  className,
}: CalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const workDaysList = workDays.split(',').map(d => d.trim().toUpperCase());

  // Build holiday map
  const holidayMap = new Map<string, string>();
  holidays.forEach(h => holidayMap.set(h.date, h.name));

  // Get today's date based on company timezone
  const todayStr = getTodayInTimezone(timezone);

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  // Generate calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Calculate number of weeks
  const totalCells = days.length;
  const weeksNeeded = Math.ceil(totalCells / 7);
  while (days.length < weeksNeeded * 7) {
    days.push(null);
  }

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border overflow-hidden', className)}>
      {/* Header - Clean minimal style */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 ml-2">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
        </div>
        <button
          onClick={() => {
            const now = new Date();
            onMonthChange(now.getFullYear(), now.getMonth() + 1);
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <CalendarIcon className="w-4 h-4" />
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES.map((day, i) => (
          <div
            key={day}
            className={cn(
              'py-3 text-center text-sm font-medium',
              i === 0 || i === 6 ? 'text-gray-400' : 'text-gray-600'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200/60">
        {days.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[110px] p-2 bg-gray-50/50"
              />
            );
          }

          const dateStr = formatDate(year, month, day);
          const dayOfWeek = new Date(year, month - 1, day).getDay();
          const isWorkDay = workDaysList.includes(DAY_MAP[dayOfWeek]);
          const holidayName = holidayMap.get(dateStr);
          const isHoliday = !!holidayName;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isPast = dateStr < todayStr;
          const isOffDay = !isWorkDay && !isHoliday;
          const isBeforeStart = startDate ? dateStr < startDate : false;
          const isStartDate = startDate === dateStr;
          const isPastDisabled = disablePastDates && isPast;

          // Get status from prop or determine default
          let dayStatus: DayStatus = null;
          if (isBeforeStart) {
            dayStatus = 'before-start';
          } else if (isHoliday) {
            dayStatus = 'holiday';
          } else if (isOffDay) {
            dayStatus = 'off';
          } else if (getDayStatus) {
            dayStatus = getDayStatus(dateStr);
          }

          // Clickable: not before start, not off day (unless disablePastDates mode), not past (if disablePastDates)
          const isClickable = !isBeforeStart && !isPastDisabled && (disablePastDates || !isOffDay) && onDateClick;

          // Get background color based on status
          const bgColor = STATUS_BG_COLORS[dayStatus ?? 'default'];
          const selectedBorder = isSelected ? STATUS_BORDER_COLORS[dayStatus ?? 'default'] : '';

          return (
            <div
              key={dateStr}
              onClick={() => isClickable && onDateClick?.(dateStr)}
              className={cn(
                'min-h-[110px] p-2.5 transition-all duration-200 relative',
                bgColor,
                isClickable && 'cursor-pointer',
                isSelected && !isBeforeStart && selectedBorder,
                // Add subtle left border accent for status
                dayStatus === 'green' && 'border-l-[3px] border-l-emerald-400',
                dayStatus === 'yellow' && 'border-l-[3px] border-l-amber-400',
                dayStatus === 'red' && 'border-l-[3px] border-l-orange-400',
                dayStatus === 'absent' && 'border-l-[3px] border-l-slate-400',
                dayStatus === 'exempted' && 'border-l-[3px] border-l-violet-400',
                dayStatus === 'holiday' && 'border-l-[3px] border-l-rose-400',
                dayStatus === 'pending' && 'border-l-[3px] border-l-sky-400',
              )}
            >
              {/* Date number - larger and more prominent */}
              <div className="flex items-start justify-between mb-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center transition-colors',
                    (isBeforeStart || isPastDisabled) && 'text-gray-300 text-sm',
                    !isBeforeStart && !isPastDisabled && isToday && 'w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-base shadow-sm',
                    !isBeforeStart && !isPastDisabled && !isToday && isOffDay && !disablePastDates && 'text-gray-300 text-sm',
                    !isBeforeStart && !isPastDisabled && !isToday && !isOffDay && isPast && 'text-gray-500 text-lg font-semibold',
                    !isBeforeStart && !isPastDisabled && !isToday && !isOffDay && !isPast && 'text-gray-800 text-lg font-bold',
                    // For disablePastDates mode (executive calendar) - future dates are all normal
                    disablePastDates && !isPast && !isToday && 'text-gray-800 text-lg font-bold'
                  )}
                >
                  {day}
                </span>
                {/* Start date indicator */}
                {isStartDate && (
                  <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                    START
                  </span>
                )}
              </div>

              {/* Events/Status area */}
              <div className="space-y-1.5">
                {/* Holiday card */}
                {isHoliday && !isBeforeStart && (
                  <div className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white truncate shadow-sm">
                    {holidayName}
                  </div>
                )}

                {/* Custom render - for status indicators (only on active work days) */}
                {!isBeforeStart && !isOffDay && renderDay && renderDay(dateStr, isWorkDay, isHoliday, holidayName)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;
