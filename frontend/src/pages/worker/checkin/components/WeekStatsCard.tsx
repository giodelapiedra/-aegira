/**
 * WeekStatsCard Component
 *
 * Displays this week's check-in stats with daily status dots.
 */

import { Calendar } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { STATUS_CONFIG } from '../../../../components/worker/StatusConfig';
import type { WeekStats } from '../../../../services/checkin.service';

interface WeekStatsCardProps {
  weekStats?: WeekStats | null;
}

// Week days for display (ordered Mon-Sun)
const WEEK_DAYS_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<string, string> = {
  MON: 'M',
  TUE: 'T',
  WED: 'W',
  THU: 'T',
  FRI: 'F',
  SAT: 'S',
  SUN: 'S',
};

export function WeekStatsCard({ weekStats }: WeekStatsCardProps) {
  const getStatusColor = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return config ? `${config.textColor} ${config.bgColor}` : 'text-gray-400 bg-gray-100';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 70) return 'bg-success-500';
    if (score >= 50) return 'bg-warning-500';
    if (score > 0) return 'bg-danger-500';
    return 'bg-gray-300';
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary-500" />
          <h3 className="font-semibold text-gray-900">This Week</h3>
        </div>

        {weekStats ? (
          <>
            {/* Week Average */}
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-gray-900">
                {weekStats.avgScore > 0 ? `${weekStats.avgScore}%` : '--'}
              </div>
              <p className="text-sm text-gray-500">
                {weekStats.totalCheckins}/{weekStats.scheduledDaysSoFar} days
              </p>
            </div>

            {/* Week Progress Bar */}
            <div className="mb-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getProgressBarColor(weekStats.avgScore)}`}
                  style={{ width: `${weekStats.avgScore}%` }}
                />
              </div>
            </div>

            {/* Daily Status Dots */}
            <div className="flex justify-between">
              {WEEK_DAYS_ORDER.map((day) => {
                const dayStatus = weekStats.dailyStatus[day];
                const isWorkDay = weekStats.workDays.includes(day);

                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">
                      {DAY_LABELS[day]}
                    </span>
                    {dayStatus ? (
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${getStatusColor(dayStatus.status)}`}
                        title={`${day}: ${dayStatus.score}%`}
                      >
                        {dayStatus.score}
                      </div>
                    ) : isWorkDay ? (
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-gray-300" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center">
                        <span className="text-xs text-gray-300">-</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
        )}
      </CardContent>
    </Card>
  );
}
