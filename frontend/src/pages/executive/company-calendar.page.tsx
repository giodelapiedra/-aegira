import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Trash2, X, Users, Clock } from 'lucide-react';
import { Calendar } from '../../components/calendar';
import { getHolidays, addHoliday, removeHoliday } from '../../services/holiday.service';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../components/ui/Toast';
import type { Holiday } from '../../types/calendar';
import api from '../../services/api';

interface Team {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  memberCount: number;
}

export default function CompanyCalendarPage() {
  const { company } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'remove'>('add');
  const [existingHoliday, setExistingHoliday] = useState<Holiday | null>(null);

  // Fetch holidays for the year
  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => getHolidays(year),
  });

  // Fetch teams for schedule info
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-schedule'],
    queryFn: async () => {
      const response = await api.get<{ data: Team[] }>('/teams');
      return response.data.data || [];
    },
  });

  // Add holiday mutation
  const addMutation = useMutation({
    mutationFn: ({ date, name }: { date: string; name: string }) => addHoliday(date, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setShowModal(false);
      setHolidayName('');
      setSelectedDate(null);
      toast.success('Holiday Added', 'The holiday has been added to the calendar.');
    },
    onError: () => {
      toast.error('Failed', 'Could not add holiday.');
    },
  });

  // Remove holiday mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setShowModal(false);
      setExistingHoliday(null);
      setSelectedDate(null);
      toast.success('Holiday Removed', 'The holiday has been removed.');
    },
    onError: () => {
      toast.error('Failed', 'Could not remove holiday.');
    },
  });

  const handleDateClick = (date: string) => {
    const existing = holidays.find(h => h.date === date);
    setSelectedDate(date);

    if (existing) {
      setModalMode('remove');
      setExistingHoliday(existing);
    } else {
      setModalMode('add');
      setHolidayName('');
      setExistingHoliday(null);
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'add' && selectedDate && holidayName.trim()) {
      addMutation.mutate({ date: selectedDate, name: holidayName.trim() });
    } else if (modalMode === 'remove' && existingHoliday) {
      removeMutation.mutate(existingHoliday.id);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatWorkDays = (workDays: string) => {
    const days = workDays.split(',').map(d => d.trim());
    const dayMap: Record<string, string> = {
      'MONDAY': 'Mon',
      'TUESDAY': 'Tue',
      'WEDNESDAY': 'Wed',
      'THURSDAY': 'Thu',
      'FRIDAY': 'Fri',
      'SATURDAY': 'Sat',
      'SUNDAY': 'Sun',
    };
    return days.map(d => dayMap[d] || d).join(', ');
  };

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CalendarIcon className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Company Calendar</h1>
        </div>
        <p className="text-gray-600">
          Manage company-wide holidays and view team schedules. Click on a date to add or remove a holiday.
        </p>
      </div>

      <div className="relative">
        {/* Calendar - Full Width */}
        <div>
          <Calendar
            year={year}
            month={month}
            onMonthChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
            onDateClick={handleDateClick}
            holidays={holidays}
            workDays="MON,TUE,WED,THU,FRI,SAT,SUN"
            disablePastDates
            selectedDate={selectedDate || undefined}
            timezone={company?.timezone}
          />

          {/* Stats & Legend Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{sortedHolidays.length}</p>
                  <p className="text-xs text-gray-500">Holidays in {year}</p>
                </div>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{teams.length}</p>
                  <p className="text-xs text-gray-500">Teams</p>
                </div>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{teams.reduce((sum, t) => sum + t.memberCount, 0)}</p>
                  <p className="text-xs text-gray-500">Total Members</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 mr-1">Legend:</span>
              <div className="px-2.5 py-1 text-xs font-medium rounded bg-red-500 text-white">Holiday</div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-medium">7</div>
                <span className="text-xs text-gray-600">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-gray-200" />
                <span className="text-xs text-gray-600">Weekend</span>
              </div>
            </div>
          </div>

          {/* Holiday List - Horizontal scrollable */}
          {sortedHolidays.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Holidays</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {sortedHolidays.map(holiday => (
                  <div
                    key={holiday.id}
                    className="flex-shrink-0 flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedDate(holiday.date);
                      setExistingHoliday(holiday);
                      setModalMode('remove');
                      setShowModal(true);
                    }}
                  >
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs text-red-600 font-medium">
                        {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-red-600">
                        {new Date(holiday.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{holiday.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                    </div>
                    <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-500 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Schedules - Horizontal cards */}
          {teams.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Schedules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(team => (
                  <div key={team.id} className="p-4 bg-white rounded-xl border shadow-sm">
                    <p className="font-semibold text-gray-900">{team.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-full">
                        <CalendarIcon className="w-3 h-3" />
                        {formatWorkDays(team.workDays)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-full">
                        <Clock className="w-3 h-3" />
                        {team.shiftStart} - {team.shiftEnd}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                        <Users className="w-3 h-3" />
                        {team.memberCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {modalMode === 'add' ? 'Add Holiday' : 'Remove Holiday'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <p className="text-gray-600 mb-4">
                {selectedDate && formatDateDisplay(selectedDate)}
              </p>

              {modalMode === 'add' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={e => setHolidayName(e.target.value)}
                    placeholder="e.g., New Year's Day"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="mb-4 p-4 bg-red-50 rounded-lg">
                  <p className="text-red-700">
                    Are you sure you want to remove <strong>{existingHoliday?.name}</strong>?
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalMode === 'add' && !holidayName.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
                    modalMode === 'add'
                      ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {modalMode === 'add' ? 'Add Holiday' : 'Remove'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
