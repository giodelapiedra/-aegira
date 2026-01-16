/**
 * Stats Bar Components
 * Desktop stats bar and mobile stats cards
 */

import { memo } from 'react';
import type { StatsBarProps } from '../types';

/**
 * Desktop Stats Bar - Horizontal display
 */
export const StatsBar = memo(({ stats }: StatsBarProps) => (
  <div className="hidden md:flex items-center gap-6">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="text-sm text-gray-600">
          Ready: <strong className="text-gray-900">{stats.greenCount}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span className="text-sm text-gray-600">
          Caution: <strong className="text-gray-900">{stats.yellowCount}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm text-gray-600">
          At Risk: <strong className="text-gray-900">{stats.redCount}</strong>
        </span>
      </div>
    </div>
    <div className="h-4 w-px bg-gray-300" />
    <span className="text-sm text-gray-500">
      {stats.totalCheckedIn}/{stats.teamSize} checked in
    </span>
  </div>
));
StatsBar.displayName = 'StatsBar';

/**
 * Mobile Stats Cards - Grid display for mobile
 */
export const MobileStatsCards = memo(({ stats }: StatsBarProps) => (
  <div className="grid grid-cols-4 gap-2 md:hidden">
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.greenCount}</p>
      <p className="text-[10px] text-gray-500">Ready</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.yellowCount}</p>
      <p className="text-[10px] text-gray-500">Caution</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-red-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">{stats.redCount}</p>
      <p className="text-[10px] text-gray-500">At Risk</p>
    </div>
    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
      <div className="w-3 h-3 rounded-full bg-primary-500 mx-auto mb-1" />
      <p className="text-lg font-bold text-gray-900">
        {stats.totalCheckedIn}/{stats.teamSize}
      </p>
      <p className="text-[10px] text-gray-500">Checked In</p>
    </div>
  </div>
));
MobileStatsCards.displayName = 'MobileStatsCards';
