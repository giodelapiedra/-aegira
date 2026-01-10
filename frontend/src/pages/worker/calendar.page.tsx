import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Gift,
  CalendarOff,
  X,
  ArrowRight,
  Circle
} from 'lucide-react';
import { Calendar, type DayStatus } from '../../components/calendar';
import { getMyCalendar } from '../../services/calendar.service';
import { useAuthStore } from '../../store/auth.store';
import type { DayInfo } from '../../types/calendar';

// Constants
const DAY_MAP: Record<string, string> = {
  'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed', 'THU': 'Thu',
  'FRI': 'Fri', 'SAT': 'Sat', 'SUN': 'Sun',
  'MONDAY': 'Mon', 'TUESDAY': 'Tue', 'WEDNESDAY': 'Wed', 'THURSDAY': 'Thu',
  'FRIDAY': 'Fri', 'SATURDAY': 'Sat', 'SUNDAY': 'Sun',
};

// Utility functions (outside component)
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatWorkDays = (workDays?: string): string[] => {
  if (!workDays) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return workDays.split(',').map(d => DAY_MAP[d.trim().toUpperCase()] || d.trim());
};

const formatDateDisplay = (dateStr: string, options: Intl.DateTimeFormatOptions): string => {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
};

const getTodayString = (): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
};

const getTomorrowString = (): string => {
  return new Date(Date.now() + 86400000).toISOString().split('T')[0];
};

export default function WorkerCalendarPage() {
  const { company } = useAuthStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  // Fetch calendar data with caching
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['my-calendar', year, month],
    queryFn: () => getMyCalendar(year, month),
    staleTime: 60000, // Cache for 1 minute
    placeholderData: (prev) => prev,
  });

  // Memoized day info map
  const dayInfoMap = useMemo(() => {
    const map = new Map<string, DayInfo>();
    calendarData?.days.forEach(day => map.set(day.date, day));
    return map;
  }, [calendarData?.days]);

  // Memoized next check-in calculation
  const nextCheckin = useMemo(() => {
    if (!calendarData?.days) return null;
    const todayStr = getTodayString();
    return calendarData.days.find(day =>
      day.date >= todayStr &&
      day.isWorkDay &&
      !day.isHoliday &&
      !day.isExempted &&
      !day.checkinStatus
    ) || null;
  }, [calendarData?.days]);

  // Memoized current exemptions
  const currentExemptions = useMemo(() => {
    const todayStr = getTodayString();
    return calendarData?.exemptions?.filter(e => {
      const start = e.startDate || '';
      const end = e.endDate || '9999-12-31';
      return todayStr >= start && todayStr <= end;
    }) || [];
  }, [calendarData?.exemptions]);

  // Memoized summary stats (Trust-First: no breakdown by on-time/late)
  const stats = useMemo(() => ({
    checkedIn: calendarData?.summary.checkedIn || 0,
    workDays: calendarData?.summary.workDays || 0,
    holidays: calendarData?.summary.holidays || 0,
    exempted: calendarData?.summary.exempted || 0,
  }), [calendarData?.summary]);

  const handleDateClick = (date: string) => {
    const dayInfo = dayInfoMap.get(date);
    if (dayInfo) setSelectedDay(dayInfo);
  };

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setSelectedDay(null);
  };

  // Trust-First: Simplified day status (no GREEN/YELLOW/RED judgment)
  const getDayStatus = (date: string): DayStatus => {
    const day = dayInfoMap.get(date);
    if (!day) return null;
    if (day.isBeforeStart) return 'before-start';
    if (day.isHoliday) return 'holiday';
    if (day.isExempted) return 'exempted';
    if (!day.isWorkDay) return 'off';
    // Trust-First: All check-ins treated equally (no green/yellow/red)
    if (day.checkinStatus) return 'green'; // Use green styling but means "checked in"
    if (day.isPast) return 'absent';
    return 'pending';
  };

  // Trust-First: Render day content without judgment
  const renderDay = (date: string) => {
    const day = dayInfoMap.get(date);
    if (!day || day.isBeforeStart) return null;

    // Exempted day
    if (day.isExempted) {
      return (
        <div className="bg-violet-50 rounded-lg px-2 py-1.5 border border-violet-100">
          <div className="flex items-center gap-1">
            <CalendarOff className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] font-medium text-violet-600">Leave</span>
          </div>
        </div>
      );
    }

    if (!day.isWorkDay || day.isHoliday) return null;

    // Trust-First: Checked in (no on-time/late distinction)
    if (day.checkinStatus) {
      return (
        <div className="bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-200">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] font-medium text-slate-700">Checked in</span>
          </div>
          {day.checkinTime && (
            <p className="text-[9px] text-slate-500 mt-0.5">{formatTime(day.checkinTime)}</p>
          )}
        </div>
      );
    }

    // Past day without check-in (neutral, non-judgmental)
    if (day.isPast) {
      return (
        <div className="bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
          <div className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">No check-in</span>
          </div>
        </div>
      );
    }

    // Future work day (pending)
    return (
      <div className="bg-sky-50 rounded-lg px-2 py-1.5 border border-sky-100">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-sky-500" />
          <span className="text-[10px] font-medium text-sky-600">Pending</span>
        </div>
      </div>
    );
  };

  // Render detail panel content (Trust-First)
  const renderDetailContent = () => {
    if (!selectedDay) return null;

    if (selectedDay.isBeforeStart) {
      return (
        <div className="py-16 text-center">
          <CalendarOff className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-400 mt-4 font-medium">Before your start date</p>
        </div>
      );
    }

    if (selectedDay.isHoliday) {
      return (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-rose-50 rounded-2xl flex items-center justify-center">
            <Gift className="w-8 h-8 text-rose-500" />
          </div>
          <p className="text-xl font-semibold text-gray-900">{selectedDay.holidayName}</p>
          <p className="text-gray-400 mt-1 text-sm">Company Holiday</p>
        </div>
      );
    }

    if (selectedDay.isExempted) {
      return (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-violet-50 rounded-2xl flex items-center justify-center">
            <CalendarOff className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-xl font-semibold text-gray-900">
            {selectedDay.exemptionType?.replace('_', ' ')}
          </p>
          <p className="text-gray-400 mt-1 text-sm">Exempted from check-in</p>
        </div>
      );
    }

    if (!selectedDay.isWorkDay) {
      return (
        <div className="py-16 text-center">
          <p className="text-gray-400 font-medium">Day Off</p>
          <p className="text-gray-300 mt-1 text-sm">No check-in required</p>
        </div>
      );
    }

    // Trust-First: Checked in (no score, no on-time/late judgment)
    if (selectedDay.checkinStatus) {
      return (
        <div className="py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-slate-100 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-xl font-semibold text-gray-900">Checked In</p>
          <p className="text-gray-500 mt-1">
            {formatTime(selectedDay.checkinTime)}
          </p>
        </div>
      );
    }

    // Past without check-in (neutral language)
    if (selectedDay.isPast) {
      return (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Circle className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-xl font-semibold text-gray-900">No Check-in</p>
          <p className="text-gray-400 mt-1 text-sm">No record for this day</p>
        </div>
      );
    }

    // Future pending
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-5 bg-sky-50 rounded-2xl flex items-center justify-center">
          <Clock className="w-8 h-8 text-sky-500" />
        </div>
        <p className="text-xl font-semibold text-gray-900">Pending</p>
        <p className="text-gray-400 mt-1 text-sm">Waiting for check-in</p>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CalendarIcon className="w-8 h-8 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">My Calendar</h1>
        </div>
        <p className="text-gray-500">View your schedule, holidays, and exemptions</p>
      </div>

      {isLoading && !calendarData ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600" />
        </div>
      ) : (
        <div className="relative">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Team Schedule */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Team Schedule</p>
                  <p className="text-xs text-gray-500">{calendarData?.team?.name || 'Your Team'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formatWorkDays(calendarData?.team?.workDays).map(day => (
                  <span key={day} className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {day}
                  </span>
                ))}
              </div>
              {calendarData?.team?.shiftStart && calendarData?.team?.shiftEnd && (
                <p className="text-xs text-gray-500 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {calendarData.team.shiftStart} - {calendarData.team.shiftEnd}
                </p>
              )}
            </div>

            {/* Next Check-in */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Next Check-in</p>
                  <p className="text-xs text-gray-500">Upcoming schedule</p>
                </div>
              </div>
              {nextCheckin ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDateDisplay(nextCheckin.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nextCheckin.isToday ? 'Today' : nextCheckin.date === getTomorrowString() ? 'Tomorrow' : ''}
                    </p>
                  </div>
                  {nextCheckin.isToday && (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      Today
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No pending check-ins</p>
              )}
            </div>

            {/* Current Exemption */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <CalendarOff className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Current Exemption</p>
                  <p className="text-xs text-gray-500">Active leave status</p>
                </div>
              </div>
              {currentExemptions.length > 0 ? (
                <div className="space-y-2">
                  {currentExemptions.slice(0, 2).map(exemption => (
                    <div key={exemption.id} className="flex items-center justify-between">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                        {exemption.type.replace('_', ' ')}
                      </span>
                      {exemption.endDate && (
                        <span className="text-xs text-gray-500">
                          until {formatDateDisplay(exemption.endDate, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No active exemptions</p>
              )}
            </div>
          </div>

          {/* Calendar */}
          <Calendar
            year={year}
            month={month}
            onMonthChange={handleMonthChange}
            onDateClick={handleDateClick}
            holidays={calendarData?.holidays.map(h => ({ ...h, id: h.date })) || []}
            workDays={calendarData?.team?.workDays}
            startDate={calendarData?.startDate}
            renderDay={renderDay}
            getDayStatus={getDayStatus}
            selectedDate={selectedDay?.date}
            timezone={company?.timezone}
          />

          {/* Stats Bar - Trust-First: Simple counts only */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5 bg-white rounded-2xl border shadow-sm">
            <div className="flex items-center gap-6">
              {/* Checked In */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.checkedIn}</p>
                  <p className="text-xs text-gray-500 font-medium">Checked In</p>
                </div>
              </div>

              <div className="w-px h-12 bg-gray-200" />

              {/* Work Days */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.workDays}</p>
                  <p className="text-xs text-gray-500 font-medium">Work Days</p>
                </div>
              </div>

              <div className="w-px h-12 bg-gray-200" />

              {/* Holidays */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.holidays}</p>
                  <p className="text-xs text-gray-500 font-medium">Holidays</p>
                </div>
              </div>

              <div className="w-px h-12 bg-gray-200" />

              {/* Exempted */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                  <CalendarOff className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.exempted}</p>
                  <p className="text-xs text-gray-500 font-medium">Exempted</p>
                </div>
              </div>
            </div>

            {/* Legend - Simplified, neutral */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Legend:</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-xs text-slate-600">Checked in</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-100">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-xs text-rose-600">Holiday</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-xs text-violet-600">Exempted</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-xs text-gray-500">No check-in</span>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedDay && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={() => setSelectedDay(null)}
              />
              {/* Panel */}
              <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white px-6 py-6 flex items-start justify-between z-10 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                      {formatDateDisplay(selectedDay.date, { weekday: 'long' })}
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatDateDisplay(selectedDay.date, { month: 'long', day: 'numeric' })}
                    </h3>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {new Date(selectedDay.date + 'T00:00:00').getFullYear()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-2 hover:bg-gray-50 rounded-full transition-colors -mr-2 -mt-1"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="p-6">
                  {renderDetailContent()}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
