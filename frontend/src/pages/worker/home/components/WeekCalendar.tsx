/**
 * WeekCalendar Component
 *
 * Shows attendance overview for the current week (Mon-Sun).
 */

import { Calendar, Shield } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import type { WeekCalendarDay, WeeklySummary } from '../types';

interface WeekCalendarProps {
  weekCalendar: WeekCalendarDay[];
  weeklySummary: WeeklySummary;
}

export function WeekCalendar({ weekCalendar, weeklySummary }: WeekCalendarProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">This Week</h3>
              <p className="text-xs text-gray-500">Your attendance overview</p>
            </div>
          </div>
          {weeklySummary && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600">
                  {weeklySummary.checkinsThisWeek}/{weeklySummary.workDaysPassed}
                </p>
                <p className="text-xs text-gray-500">check-ins</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-success-500" />
            <span className="text-gray-600">Green</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-warning-500" />
            <span className="text-gray-600">Yellow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-danger-500" />
            <span className="text-gray-600">Red</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">Exempt</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekCalendar.map((day, index) => {
            const isCheckedIn = !!day.checkin;
            const isGreen = day.checkin?.readinessStatus === 'GREEN';
            const isYellow = day.checkin?.readinessStatus === 'YELLOW';

            // Determine background based on priority
            const getBackgroundClass = () => {
              if (isCheckedIn) {
                if (isGreen)
                  return 'bg-gradient-to-br from-success-50 to-success-100 border border-success-200';
                if (isYellow)
                  return 'bg-gradient-to-br from-warning-50 to-warning-100 border border-warning-200';
                return 'bg-gradient-to-br from-danger-50 to-danger-100 border border-danger-200';
              }
              if (day.isExempted)
                return 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200';
              if (day.isFuture && day.isWorkDay)
                return 'bg-white border-2 border-dashed border-gray-200';
              if (day.isWorkDay && !day.isFuture) return 'bg-gray-50 border border-gray-200';
              return 'bg-gray-50/50 border border-gray-100';
            };

            return (
              <div
                key={index}
                className={`relative rounded-xl p-2 transition-all ${
                  day.isToday ? 'ring-2 ring-primary-500 ring-offset-2 shadow-md' : ''
                } ${getBackgroundClass()}`}
              >
                {/* Day name */}
                <p
                  className={`text-[10px] font-semibold text-center uppercase tracking-wider mb-0.5 ${
                    day.isWorkDay ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {day.dayName}
                </p>

                {/* Day number */}
                <p
                  className={`text-center font-bold mb-1 ${
                    day.isToday ? 'text-lg text-primary-600' : 'text-base text-gray-900'
                  }`}
                >
                  {day.dayNum}
                </p>

                {/* Status indicator */}
                <div className="flex justify-center">
                  {isCheckedIn ? (
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center ${
                        isGreen ? 'bg-success-500' : isYellow ? 'bg-warning-500' : 'bg-danger-500'
                      }`}
                    >
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : day.isExempted ? (
                    <div
                      className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center"
                      title="Exempted"
                    >
                      <Shield className="h-3 w-3 text-white" />
                    </div>
                  ) : day.isFuture && day.isWorkDay ? (
                    <div className="h-5 w-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-[8px] text-gray-400">—</span>
                    </div>
                  ) : !day.isWorkDay ? (
                    <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-[8px] text-gray-500 font-medium">off</span>
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-400">—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly progress bar */}
        {weeklySummary && weeklySummary.workDaysPassed > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">Weekly Progress</span>
              <span className="font-medium text-gray-700">
                {Math.round((weeklySummary.checkinsThisWeek / weeklySummary.workDaysPassed) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  weeklySummary.checkinsThisWeek === weeklySummary.workDaysPassed
                    ? 'bg-success-500'
                    : weeklySummary.checkinsThisWeek >= weeklySummary.workDaysPassed * 0.8
                      ? 'bg-primary-500'
                      : 'bg-warning-500'
                }`}
                style={{
                  width: `${Math.min(100, (weeklySummary.checkinsThisWeek / weeklySummary.workDaysPassed) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
