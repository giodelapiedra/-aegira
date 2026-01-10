import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Users, CheckCircle, XCircle, Gift, CalendarOff, X, Clock } from 'lucide-react';
import { Calendar, type DayStatus } from '../../components/calendar';
import { getTeamCalendar } from '../../services/calendar.service';
import { useAuthStore } from '../../store/auth.store';
import type { TeamDayInfo, MemberStatus } from '../../types/calendar';

export default function TeamCalendarPage() {
  const { company } = useAuthStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<TeamDayInfo | null>(null);

  // Fetch calendar data
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['team-calendar', year, month],
    queryFn: () => getTeamCalendar(year, month),
  });

  // Build day info map
  const dayInfoMap = new Map<string, TeamDayInfo>();
  calendarData?.days.forEach(day => dayInfoMap.set(day.date, day));

  const handleDateClick = (date: string) => {
    const dayInfo = dayInfoMap.get(date);
    if (dayInfo) {
      setSelectedDay(dayInfo);
    }
  };

  // Get day status for background coloring
  const getDayStatus = (date: string): DayStatus => {
    const day = dayInfoMap.get(date);
    if (!day) return null;
    if (day.isBeforeTeamStart) return 'before-start';
    if (day.isHoliday) return 'holiday';
    if (!day.isWorkDay) return 'off';

    const required = day.requiredCount ?? calendarData?.team.memberCount ?? 0;
    const checkedIn = day.checkedInCount;
    const exempted = day.exemptedCount;
    const expectedToCheckIn = required - exempted;

    if (expectedToCheckIn <= 0) return 'off';

    const completionRate = checkedIn / expectedToCheckIn;
    if (completionRate >= 1) return 'green';
    if (completionRate >= 0.5) return 'yellow';
    if (checkedIn > 0) return 'red';

    // Check if today or future
    const today = new Date();
    const dayDate = new Date(date);
    if (dayDate > today) return 'pending';

    return 'absent';
  };

  const renderDay = (date: string) => {
    const day = dayInfoMap.get(date);
    if (!day || !day.isWorkDay || day.isHoliday || day.isBeforeTeamStart) return null;

    // Use requiredCount which excludes members who weren't in the team yet
    const required = day.requiredCount ?? calendarData?.team.memberCount ?? 0;
    const checkedIn = day.checkedInCount;
    const exempted = day.exemptedCount;
    const expectedToCheckIn = required - exempted;

    if (required === 0 || expectedToCheckIn <= 0) return null;

    // Show completion status as enhanced card
    const isComplete = checkedIn >= expectedToCheckIn;
    const completionRate = checkedIn / expectedToCheckIn;

    if (isComplete) {
      return (
        <div className="bg-emerald-100 rounded-lg px-2.5 py-2 shadow-sm border border-emerald-200/50">
          <div className="flex items-center gap-1.5 mb-0.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Complete</span>
          </div>
          <p className="text-[10px] text-emerald-600">
            {checkedIn}/{expectedToCheckIn} checked in
          </p>
        </div>
      );
    }

    if (completionRate >= 0.5) {
      return (
        <div className="bg-amber-100 rounded-lg px-2.5 py-2 shadow-sm border border-amber-200/50">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Partial</span>
          </div>
          <p className="text-[10px] text-amber-600">
            {checkedIn}/{expectedToCheckIn} checked in
          </p>
        </div>
      );
    }

    return (
      <div className="bg-slate-100 rounded-lg px-2.5 py-2 shadow-sm border border-slate-200/50">
        <div className="flex items-center gap-1.5 mb-0.5">
          <XCircle className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Incomplete</span>
        </div>
        <p className="text-[10px] text-slate-500">
          {checkedIn}/{expectedToCheckIn} checked in
        </p>
      </div>
    );
  };

  const getStatusColor = (status: MemberStatus['status']) => {
    switch (status) {
      case 'checked_in': return 'bg-emerald-100 text-emerald-700';
      case 'exempted': return 'bg-violet-100 text-violet-700';
      case 'absent': return 'bg-rose-100 text-rose-700';
      case 'pending': return 'bg-slate-100 text-slate-600';
      case 'not_required': return 'bg-gray-50 text-gray-400';
    }
  };

  const getStatusLabel = (status: MemberStatus['status']) => {
    switch (status) {
      case 'checked_in': return 'Checked In';
      case 'exempted': return 'Exempted';
      case 'absent': return 'Absent';
      case 'pending': return 'Pending';
      case 'not_required': return 'Not Required';
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CalendarIcon className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Team Calendar</h1>
        </div>
        <p className="text-gray-600">
          View team schedule, holidays, and member check-ins
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="relative">
          {/* Calendar - Full Width */}
          <div>
            <Calendar
              year={year}
              month={month}
              onMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
                setSelectedDay(null);
              }}
              onDateClick={handleDateClick}
              holidays={calendarData?.holidays.map(h => ({ ...h, id: h.date })) || []}
              workDays={calendarData?.team?.workDays}
              startDate={calendarData?.startDate}
              renderDay={renderDay}
              getDayStatus={getDayStatus}
              selectedDate={selectedDay?.date}
              timezone={company?.timezone}
            />

            {/* Stats & Legend Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5 bg-white rounded-2xl border shadow-sm">
              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{calendarData?.team.memberCount || 0}</p>
                    <p className="text-xs text-gray-500 font-medium">Members</p>
                  </div>
                </div>
                <div className="w-px h-12 bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{calendarData?.summary.workDays || 0}</p>
                    <p className="text-xs text-gray-500 font-medium">Work Days</p>
                  </div>
                </div>
                <div className="w-px h-12 bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{calendarData?.summary.holidays || 0}</p>
                    <p className="text-xs text-gray-500 font-medium">Holidays</p>
                  </div>
                </div>
                <div className="w-px h-12 bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                    <CalendarOff className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{calendarData?.exemptions.length || 0}</p>
                    <p className="text-xs text-gray-500 font-medium">On Leave</p>
                  </div>
                </div>
              </div>

              {/* Legend - Enhanced with color blocks */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400 font-medium">Legend:</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-medium text-rose-700">Holiday</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700">Complete</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Partial</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-medium text-slate-600">Incomplete</span>
                </div>
              </div>
            </div>
          </div>

      {/* Slide-in Panel when date is selected */}
      {selectedDay && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setSelectedDay(null)}
          />
          {/* Panel - Clean professional sidebar */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
            {/* Header - Clean and minimal */}
            <div className="sticky top-0 bg-white px-6 py-6 flex items-start justify-between z-10 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                  {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                  })}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })}
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
              {selectedDay.isHoliday ? (
                <div className="py-12">
                  <div className="w-16 h-16 mx-auto mb-5 bg-rose-50 rounded-2xl flex items-center justify-center">
                    <Gift className="w-8 h-8 text-rose-500" />
                  </div>
                  <p className="text-center text-xl font-semibold text-gray-900">{selectedDay.holidayName}</p>
                  <p className="text-center text-gray-400 mt-1 text-sm">Company Holiday</p>
                </div>
              ) : selectedDay.isBeforeTeamStart ? (
                <div className="py-16">
                  <CalendarOff className="w-12 h-12 mx-auto text-gray-300" />
                  <p className="text-center text-gray-400 mt-4 font-medium">Before team was created</p>
                </div>
              ) : !selectedDay.isWorkDay ? (
                <div className="py-16">
                  <p className="text-center text-gray-400 font-medium">Day Off</p>
                  <p className="text-center text-gray-300 mt-1 text-sm">No check-in required</p>
                </div>
              ) : (
                <>
                  {/* Summary Stats - Card Style */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                      <p className="text-3xl font-bold text-emerald-600">{selectedDay.checkedInCount}</p>
                      <p className="text-xs text-emerald-700 mt-1 font-medium">Checked In</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                      <p className="text-3xl font-bold text-slate-600">
                        {(selectedDay.requiredCount ?? calendarData?.team.memberCount ?? 0) - selectedDay.checkedInCount - selectedDay.exemptedCount}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 font-medium">Missing</p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-4 text-center border border-violet-100">
                      <p className="text-3xl font-bold text-violet-600">{selectedDay.exemptedCount}</p>
                      <p className="text-xs text-violet-700 mt-1 font-medium">Exempted</p>
                    </div>
                  </div>

                  {/* Member List */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Team Members</h4>
                    <div className="space-y-2">
                      {selectedDay.memberStatuses
                        .filter(m => m.status !== 'not_required')
                        .map(member => (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                              {member.checkinTime && (
                                <p className="text-xs text-gray-400">
                                  {formatTime(member.checkinTime)}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getStatusColor(member.status)}`}>
                            {getStatusLabel(member.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
        </div>
      )}
    </div>
  );
}
