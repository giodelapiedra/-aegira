/**
 * NoTeamState Component
 *
 * Shown when user has no team assigned and cannot check in.
 */

import { Users } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';

export function NoTeamState() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-warning-100 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-warning-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Team Assigned
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You need to be assigned to a team before you can check in.
              Please contact your supervisor or team leader to be added to a team.
            </p>
            <div className="p-4 bg-gray-50 rounded-lg inline-block">
              <p className="text-sm text-gray-600">
                Once you're assigned to a team, you'll be able to complete your daily check-in
                during your team's scheduled work hours.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
