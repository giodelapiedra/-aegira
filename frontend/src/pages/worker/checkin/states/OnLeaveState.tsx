/**
 * OnLeaveState Component
 *
 * Shown when user is on approved leave.
 */

import { Palmtree } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { formatDisplayDate } from '../../../../lib/date-utils';
import { formatExceptionType } from '../utils';

interface CurrentException {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface OnLeaveStateProps {
  exception: CurrentException;
}

export function OnLeaveState({ exception }: OnLeaveStateProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <Palmtree className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              You're On Approved Leave
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Check-in is not required during your leave period. Take care and rest well!
            </p>
            <div className="p-4 bg-primary-50 rounded-lg inline-block text-left">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">{formatExceptionType(exception.type)}</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Period:</span>{' '}
                  {formatDisplayDate(exception.startDate)} - {formatDisplayDate(exception.endDate)}
                </p>
                {exception.reason && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Reason:</span> {exception.reason}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Your streak will continue when you return. No worries!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
