/**
 * Not Checked In Section Component
 * Displays members who haven't checked in today
 */

import { memo } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Avatar } from '../../../../components/ui/Avatar';
import type { NotCheckedInMember } from '../../../../services/daily-monitoring.service';

interface NotCheckedInSectionProps {
  members: NotCheckedInMember[];
}

export const NotCheckedInSection = memo(({ members }: NotCheckedInSectionProps) => {
  if (members.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-600 text-base">
          <Clock className="h-5 w-5" />
          Not Checked In ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Avatar firstName={member.firstName} lastName={member.lastName} size="sm" />
              <p className="text-sm font-medium text-gray-900 truncate">
                {member.firstName} {member.lastName}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
NotCheckedInSection.displayName = 'NotCheckedInSection';
