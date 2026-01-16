/**
 * Check-in Card Component
 * Mobile card view for a single check-in
 */

import { memo } from 'react';
import { Flame, UserMinus } from 'lucide-react';
import { Avatar } from '../../../../components/ui/Avatar';
import { MetricsRow } from '../../../../components/monitoring';
import { getStatusColor } from '../../../../services/daily-monitoring.service';
import { cn } from '../../../../lib/utils';
import type { CheckinItemProps } from '../types';

export const CheckinCard = memo(({ checkin, onCreateExemption }: CheckinItemProps) => {
  const statusColors = getStatusColor(checkin.readinessStatus);
  const hasChange = checkin.changeFromAverage !== null && checkin.changeFromAverage < -10;
  const canCreateExemption = checkin.readinessStatus === 'RED' && !checkin.hasExemptionRequest;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar
              firstName={checkin.user.firstName}
              lastName={checkin.user.lastName}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {checkin.user.firstName} {checkin.user.lastName}
                </span>
                {checkin.user.currentStreak && checkin.user.currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    <Flame className="h-3 w-3" />
                    {checkin.user.currentStreak}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(checkin.createdAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </p>
            </div>
          </div>
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
              ? 'Caution'
              : 'Not Ready'}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600">Readiness Score</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">{checkin.readinessScore}%</span>
            {hasChange && (
              <span className="text-xs text-red-600 font-medium">
                {checkin.changeFromAverage}%
              </span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-3">
          <MetricsRow
            mood={checkin.mood}
            stress={checkin.stress}
            sleep={checkin.sleep}
            physicalHealth={checkin.physicalHealth}
            size="sm"
          />
        </div>

        {/* Actions */}
        {canCreateExemption && onCreateExemption && (
          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={() => onCreateExemption(checkin)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              Put on Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
CheckinCard.displayName = 'CheckinCard';
