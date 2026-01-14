/**
 * RecentCheckinsCard Component
 *
 * Displays recent check-in history.
 */

import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { formatDisplayDate, formatDisplayDateTime } from '../../../../lib/date-utils';
import { STATUS_CONFIG } from '../../../../components/worker/StatusConfig';

interface Checkin {
  id: string;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  createdAt: string;
}

interface RecentCheckinsCardProps {
  checkins?: Checkin[];
  /** Skip first N checkins (e.g., skip today's) */
  skipFirst?: number;
  /** Max checkins to display */
  maxDisplay?: number;
}

export function RecentCheckinsCard({
  checkins,
  skipFirst = 1,
  maxDisplay = 4,
}: RecentCheckinsCardProps) {
  if (!checkins || checkins.length <= skipFirst) {
    return null;
  }

  const displayCheckins = checkins.slice(skipFirst, skipFirst + maxDisplay);

  const getStatusColor = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return config ? `${config.textColor} ${config.bgColor}` : 'text-gray-400 bg-gray-100';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          Recent Check-ins
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayCheckins.map((checkin) => (
            <div
              key={checkin.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatDisplayDate(checkin.createdAt)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDisplayDateTime(checkin.createdAt).split(',')[1]?.trim()}
                </p>
              </div>
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${getStatusColor(checkin.readinessStatus)}`}
              >
                {checkin.readinessScore}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
