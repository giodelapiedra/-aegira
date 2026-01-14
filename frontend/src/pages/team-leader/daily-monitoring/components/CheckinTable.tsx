/**
 * Check-in Table Component
 * Desktop table wrapper for check-ins list
 */

import { memo } from 'react';
import { CheckinRow } from './CheckinRow';
import type { TodayCheckin } from '../../../../services/daily-monitoring.service';

interface CheckinTableProps {
  checkins: TodayCheckin[];
  onCreateExemption?: (checkin: TodayCheckin) => void;
}

export const CheckinTable = memo(({ checkins, onCreateExemption }: CheckinTableProps) => {
  return (
    <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50/80 border-b border-gray-200">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Member
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Metrics
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </th>
            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Score
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Time
            </th>
            <th className="w-32 px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {checkins.map((checkin) => (
            <CheckinRow
              key={checkin.id}
              checkin={checkin}
              onCreateExemption={onCreateExemption}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});
CheckinTable.displayName = 'CheckinTable';
