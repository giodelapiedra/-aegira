/**
 * StreakCard Component
 *
 * Displays current check-in streak and best streak.
 */

import { Flame } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';

interface StreakCardProps {
  currentStreak?: number;
  longestStreak?: number;
}

export function StreakCard({ currentStreak = 0, longestStreak = 0 }: StreakCardProps) {
  const getStreakColor = () => {
    if (currentStreak >= 7) return { bg: 'bg-orange-100', icon: 'text-orange-500' };
    if (currentStreak >= 3) return { bg: 'bg-amber-100', icon: 'text-amber-500' };
    return { bg: 'bg-gray-100', icon: 'text-gray-400' };
  };

  const colors = getStreakColor();

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
              <Flame className={`h-6 w-6 ${colors.icon}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{currentStreak}</p>
              <p className="text-sm text-gray-500">Day streak</p>
            </div>
          </div>
          {longestStreak > 0 && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{longestStreak}</p>
              <p className="text-xs text-gray-400">Best</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
