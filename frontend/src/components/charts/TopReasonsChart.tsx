/**
 * Top Reasons Chart
 * Horizontal bar chart showing top reasons for low readiness scores
 */

import { cn } from '../../lib/utils';
import {
  AlertTriangle,
  Thermometer,
  Moon,
  Brain,
  Heart,
  Home,
  Briefcase,
  HelpCircle,
} from 'lucide-react';

interface ReasonData {
  reason: string;
  label: string;
  count: number;
}

interface TopReasonsChartProps {
  data: ReasonData[];
  maxItems?: number;
}

const REASON_ICONS: Record<string, typeof AlertTriangle> = {
  PHYSICAL_INJURY: AlertTriangle,
  ILLNESS_SICKNESS: Thermometer,
  POOR_SLEEP: Moon,
  HIGH_STRESS: Brain,
  PERSONAL_ISSUES: Heart,
  FAMILY_EMERGENCY: Home,
  WORK_RELATED: Briefcase,
  OTHER: HelpCircle,
};

const REASON_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  PHYSICAL_INJURY: { bg: 'bg-red-50', bar: 'bg-red-500', text: 'text-red-600' },
  ILLNESS_SICKNESS: { bg: 'bg-orange-50', bar: 'bg-orange-500', text: 'text-orange-600' },
  POOR_SLEEP: { bg: 'bg-indigo-50', bar: 'bg-indigo-500', text: 'text-indigo-600' },
  HIGH_STRESS: { bg: 'bg-purple-50', bar: 'bg-purple-500', text: 'text-purple-600' },
  PERSONAL_ISSUES: { bg: 'bg-pink-50', bar: 'bg-pink-500', text: 'text-pink-600' },
  FAMILY_EMERGENCY: { bg: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-600' },
  WORK_RELATED: { bg: 'bg-blue-50', bar: 'bg-blue-500', text: 'text-blue-600' },
  OTHER: { bg: 'bg-gray-50', bar: 'bg-gray-500', text: 'text-gray-600' },
};

export function TopReasonsChart({ data, maxItems = 5 }: TopReasonsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <HelpCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No low score reasons recorded</p>
      </div>
    );
  }

  const displayData = data.slice(0, maxItems);
  const maxCount = Math.max(...displayData.map((d) => d.count));

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-4">Top Reasons for Low Scores</h3>

      <div className="space-y-3">
        {displayData.map((item, index) => {
          const Icon = REASON_ICONS[item.reason] || HelpCircle;
          const colors = REASON_COLORS[item.reason] || REASON_COLORS.OTHER;
          const percentage = (item.count / maxCount) * 100;

          return (
            <div key={item.reason} className="space-y-1.5">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', colors.bg)}>
                    <Icon className={cn('h-4 w-4', colors.text)} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <span className={cn('text-sm font-bold', colors.text)}>
                  {item.count}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.length > maxItems && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          +{data.length - maxItems} more reasons
        </p>
      )}
    </div>
  );
}
