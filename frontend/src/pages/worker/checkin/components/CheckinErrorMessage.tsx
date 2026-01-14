/**
 * CheckinErrorMessage Component
 *
 * Displays error messages for check-in failures with appropriate styling based on error type.
 */

import { Users, CheckCircle2, CalendarX, AlertTriangle } from 'lucide-react';
import type { AxiosError } from 'axios';
import type { CheckinErrorCode, CheckinErrorResponse } from '../utils';

interface CheckinErrorMessageProps {
  error: unknown;
}

export function CheckinErrorMessage({ error }: CheckinErrorMessageProps) {
  // Extract error data from axios error response
  let errorData: CheckinErrorResponse | null = null;

  // Type-safe extraction of axios error response
  const axiosError = error as AxiosError<CheckinErrorResponse>;
  if (axiosError?.response?.data) {
    errorData = axiosError.response.data;
  }

  const code = errorData?.code;
  const message = errorData?.error || 'Failed to submit check-in. Please try again.';

  const getIcon = () => {
    switch (code) {
      case 'NO_TEAM':
        return <Users className="h-5 w-5 text-danger-500" />;
      case 'NOT_MEMBER_ROLE':
        return <CheckCircle2 className="h-5 w-5 text-primary-500" />;
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return <CalendarX className="h-5 w-5 text-warning-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-danger-500" />;
    }
  };

  const getBgColor = () => {
    switch (code) {
      case 'NO_TEAM':
        return 'bg-danger-50 border-danger-200';
      case 'NOT_MEMBER_ROLE':
        return 'bg-primary-50 border-primary-200';
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return 'bg-warning-50 border-warning-200';
      default:
        return 'bg-danger-50 border-danger-200';
    }
  };

  const getTextColor = () => {
    switch (code) {
      case 'NOT_MEMBER_ROLE':
        return 'text-primary-700';
      case 'NOT_WORK_DAY':
      case 'TOO_EARLY':
      case 'TOO_LATE':
        return 'text-warning-700';
      default:
        return 'text-danger-600';
    }
  };

  const getTitle = (errorCode?: CheckinErrorCode) => {
    switch (errorCode) {
      case 'NO_TEAM':
        return 'No Team Assigned';
      case 'NOT_MEMBER_ROLE':
        return 'Check-in Not Required';
      case 'NOT_WORK_DAY':
        return 'Not a Work Day';
      case 'TOO_EARLY':
        return 'Too Early to Check In';
      case 'TOO_LATE':
        return 'Check-in Time Ended';
      default:
        return 'Check-in Failed';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div>
          <p className={`text-sm font-medium ${getTextColor()}`}>
            {getTitle(code)}
          </p>
          <p className={`text-sm mt-1 ${getTextColor()}`}>{message}</p>
        </div>
      </div>
    </div>
  );
}
