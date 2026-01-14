/**
 * NotRequiredState Component
 *
 * Shown when a non-MEMBER/WORKER role (e.g., Team Lead, Supervisor) accesses the check-in page.
 */

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';

interface NotRequiredStateProps {
  role?: string;
}

export function NotRequiredState({ role }: NotRequiredStateProps) {
  const roleDisplay = role === 'TEAM_LEAD' ? 'Team Lead' : role?.toLowerCase() || 'your role';

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Check-in Not Required
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Daily check-in is only required for team members.
              As a {roleDisplay}, you can view your team's check-in status from the dashboard.
            </p>
            <div className="p-4 bg-gray-50 rounded-lg inline-block">
              <p className="text-sm text-gray-600">
                You can monitor your team members' daily readiness and check-in status
                from the Team Dashboard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
