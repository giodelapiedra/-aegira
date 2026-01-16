/**
 * WelcomeState Component
 *
 * Shown when user is new to the team (before their effective start date).
 */

import { PartyPopper } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { formatDisplayDate } from '../../../../lib/date-utils';

interface WelcomeStateProps {
  effectiveStartDate?: string;
  teamName?: string;
}

export function WelcomeState({ effectiveStartDate, teamName }: WelcomeStateProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <PartyPopper className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to the Team!
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You've just been added to your team. Your daily check-in will start on your next scheduled work day.
              Take today to get familiar with your schedule.
            </p>
            <div className="p-4 bg-primary-50 rounded-lg inline-block text-left">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Check-in starts:</span>{' '}
                  {effectiveStartDate ? formatDisplayDate(effectiveStartDate) : 'Tomorrow'}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Team:</span> {teamName || 'Your Team'}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              We're excited to have you on board!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
