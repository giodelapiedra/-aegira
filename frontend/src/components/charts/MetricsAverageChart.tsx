/**
 * Metrics Average Chart
 * Shows average metrics (Mood, Stress, Sleep, Physical Health) as horizontal bars
 */

import { Smile, Brain, Moon, Heart } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MetricsData {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
}

interface MetricsAverageChartProps {
  data: MetricsData;
  showLabels?: boolean;
}

export function MetricsAverageChart({ data, showLabels: _showLabels = true }: MetricsAverageChartProps) {
  const getColor = (value: number, inverted = false) => {
    if (inverted) {
      // For stress: lower is better
      if (value <= 3) return { bar: 'bg-success-500', text: 'text-success-600' };
      if (value <= 6) return { bar: 'bg-warning-500', text: 'text-warning-600' };
      return { bar: 'bg-danger-500', text: 'text-danger-600' };
    }
    // For mood, sleep, physical: higher is better
    if (value >= 7) return { bar: 'bg-success-500', text: 'text-success-600' };
    if (value >= 4) return { bar: 'bg-warning-500', text: 'text-warning-600' };
    return { bar: 'bg-danger-500', text: 'text-danger-600' };
  };

  const metrics = [
    {
      key: 'mood',
      label: 'Mood',
      value: data.mood,
      icon: Smile,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      inverted: false,
    },
    {
      key: 'stress',
      label: 'Stress',
      value: data.stress,
      icon: Brain,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      inverted: true,
      note: 'Lower is better',
    },
    {
      key: 'sleep',
      label: 'Sleep',
      value: data.sleep,
      icon: Moon,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      inverted: false,
    },
    {
      key: 'physicalHealth',
      label: 'Physical',
      value: data.physicalHealth,
      icon: Heart,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      inverted: false,
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-4">Average Metrics</h3>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const colors = getColor(metric.value, metric.inverted);
          const percentage = (metric.value / 10) * 100;

          return (
            <div key={metric.key} className="space-y-1.5">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', metric.iconBg)}>
                    <Icon className={cn('h-4 w-4', metric.iconColor)} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                    {metric.note && (
                      <span className="text-xs text-gray-400 ml-1">({metric.note})</span>
                    )}
                  </div>
                </div>
                <span className={cn('text-lg font-bold', colors.text)}>
                  {metric.value.toFixed(1)}
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

      {/* Scale reference */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
        <span>1 (Low)</span>
        <span>10 (High)</span>
      </div>
    </div>
  );
}
