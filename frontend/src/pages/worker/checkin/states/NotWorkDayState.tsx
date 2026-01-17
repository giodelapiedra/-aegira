/**
 * NotWorkDayState Component
 *
 * Shown when check-in is not available due to time restrictions
 * (too early, too late, not a work day, or holiday).
 */

import { Clock, CalendarX, PartyPopper } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import type { CheckinAvailability } from '../types';

interface NotWorkDayStateProps {
  availability: Extract<CheckinAvailability, { available: false }>;
}

export function NotWorkDayState({ availability }: NotWorkDayStateProps) {
  const getIcon = () => {
    switch (availability.reason) {
      case 'TOO_LATE':
        return <Clock className="h-8 w-8 text-danger-600" />;
      case 'TOO_EARLY':
        return <Clock className="h-8 w-8 text-warning-600" />;
      case 'NOT_WORK_DAY':
        return <CalendarX className="h-8 w-8 text-warning-600" />;
      case 'HOLIDAY':
        return <PartyPopper className="h-8 w-8 text-primary-600" />;
      default:
        return <CalendarX className="h-8 w-8 text-warning-600" />;
    }
  };

  const getIconBgColor = () => {
    if (availability.reason === 'TOO_LATE') return 'bg-danger-100';
    if (availability.reason === 'HOLIDAY') return 'bg-primary-100';
    return 'bg-warning-100';
  };

  const getTitle = () => {
    switch (availability.reason) {
      case 'TOO_LATE':
        return 'Check-in Time Ended';
      case 'TOO_EARLY':
        return 'Too Early to Check In';
      case 'NOT_WORK_DAY':
        return 'Not a Work Day';
      case 'HOLIDAY':
        return 'Company Holiday';
      default:
        return 'Check-in Unavailable';
    }
  };

  const getSubtitle = () => {
    switch (availability.reason) {
      case 'TOO_LATE':
        return (
          <>
            Your shift ended at <span className="font-semibold">{availability.shiftEnd}</span>.
            Check-in will be available again on your next work day.
          </>
        );
      case 'TOO_EARLY':
        return (
          <>
            Your shift starts at <span className="font-semibold">{availability.shiftStart}</span>.
            Please come back when your shift begins.
          </>
        );
      case 'NOT_WORK_DAY':
        return 'Enjoy your day off! Check-in will be available on your next scheduled work day.';
      case 'HOLIDAY':
        return (
          <>
            Today is <span className="font-semibold">{availability.holidayName}</span>.
            Enjoy your holiday! Check-in will be available on your next work day.
          </>
        );
      default:
        return 'Check-in is not available at this time.';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Daily Check-in</h1>
        <p className="text-gray-500 mt-1">
          Take a moment to assess your current readiness status
        </p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${getIconBgColor()}`}>
              {getIcon()}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {getTitle()}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {availability.message}
            </p>
            <div className="p-4 bg-gray-50 rounded-lg inline-block">
              <p className="text-sm text-gray-600">
                {getSubtitle()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
