/**
 * NextCheckinCard Component
 *
 * Shows next check-in time or exemption status.
 */

import { Link } from 'react-router-dom';
import { Timer, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import type { NextCheckinResult } from '../types';

interface NextCheckinCardProps {
  todayCheckin: boolean;
  returnToWorkDate: Date | null;
  nextCheckin: NextCheckinResult | null;
  returnToWorkDateDisplay: string;
  returnToWorkShiftTime: string;
  nextCheckinTimeDisplay: string;
  nextCheckinFullDisplay: string;
  isTodayExempted: boolean;
}

export function NextCheckinCard({
  todayCheckin,
  returnToWorkDate,
  nextCheckin,
  returnToWorkDateDisplay,
  returnToWorkShiftTime,
  nextCheckinTimeDisplay,
  nextCheckinFullDisplay,
  isTodayExempted,
}: NextCheckinCardProps) {
  return (
    <Card
      className={`border ${nextCheckin?.isNow ? 'border-primary-300 bg-primary-50' : 'border-gray-200'} min-h-[140px]`}
    >
      <CardContent className="py-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${nextCheckin?.isNow ? 'bg-primary-100' : 'bg-gray-50'}`}
          >
            <Timer
              className={`h-5 w-5 ${nextCheckin?.isNow ? 'text-primary-600' : 'text-gray-600'}`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Next Check-in
            </h3>
            {returnToWorkDate ? (
              <p className="text-sm text-blue-600 font-medium">On exemption</p>
            ) : todayCheckin ? (
              <p className="text-sm text-success-600">Completed for today</p>
            ) : nextCheckin?.isNow && !isTodayExempted ? (
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
                  {nextCheckin
                    ? nextCheckin.dayName
                      ? `${nextCheckin.dayName}, ${nextCheckinTimeDisplay}`
                      : nextCheckinFullDisplay
                    : 'Tomorrow'}
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
              <span
                className={`text-lg font-bold ${nextCheckin.isNow ? 'text-primary-600' : 'text-gray-900'}`}
              >
                {nextCheckin.timeUntil}
              </span>
            </div>
            {nextCheckin.dayName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Day</span>
                <span className="text-sm font-medium text-gray-900">{nextCheckin.dayName}</span>
              </div>
            )}
            {nextCheckin.isNow && !isTodayExempted && (
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
  );
}
