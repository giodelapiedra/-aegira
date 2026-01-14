/**
 * Check-in Row Component
 * Desktop table row for a single check-in
 */

import { memo } from 'react';
import { Flame, UserMinus } from 'lucide-react';
import { Avatar } from '../../../../components/ui/Avatar';
import { MetricsRow } from '../../../../components/monitoring';
import { getStatusColor } from '../../../../services/daily-monitoring.service';
import { cn } from '../../../../lib/utils';
import type { CheckinItemProps } from '../types';

export const CheckinRow = memo(({ checkin, onCreateExemption }: CheckinItemProps) => {
  const statusColors = getStatusColor(checkin.readinessStatus);
  const hasChange = checkin.changeFromAverage !== null && checkin.changeFromAverage < -10;
  const canCreateExemption = checkin.readinessStatus === 'RED' && !checkin.hasExemptionRequest;

  return (
    <tr className="hover:bg-gray-50/80 transition-all border-l-2 border-l-transparent hover:border-l-primary-500">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar
            firstName={checkin.user.firstName}
            lastName={checkin.user.lastName}
            size="sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {checkin.user.firstName} {checkin.user.lastName}
              </span>
              {checkin.user.currentStreak && checkin.user.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <Flame className="h-3 w-3" />
                  {checkin.user.currentStreak}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{checkin.user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <MetricsRow
          mood={checkin.mood}
          stress={checkin.stress}
          sleep={checkin.sleep}
          physicalHealth={checkin.physicalHealth}
          size="sm"
        />
      </td>
      <td className="px-6 py-4">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            statusColors.bg,
            statusColors.text
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.dot)} />
          {checkin.readinessStatus === 'GREEN'
            ? 'Ready'
            : checkin.readinessStatus === 'YELLOW'
            ? 'Limited'
            : 'Not Ready'}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700">
          {checkin.readinessScore}%
        </span>
        {hasChange && (
          <span className="ml-2 text-xs text-red-600">{checkin.changeFromAverage}%</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-gray-500">
          {new Date(checkin.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end">
          {canCreateExemption && onCreateExemption && (
            <button
              onClick={() => onCreateExemption(checkin)}
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              title="Put on Leave"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
CheckinRow.displayName = 'CheckinRow';
