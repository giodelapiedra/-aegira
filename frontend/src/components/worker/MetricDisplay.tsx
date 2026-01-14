/**
 * MetricDisplay Component
 *
 * Reusable component for displaying check-in metrics (mood, stress, sleep, physical health)
 * Used in checkin dashboard and member profile pages.
 */

import { Smile, Brain, Moon, Heart, type LucideIcon } from 'lucide-react';

export interface MetricConfig {
  icon: LucideIcon;
  label: string;
  inverted?: boolean; // For stress - lower is better
  color: string;
  bgColor: string;
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  mood: {
    icon: Smile,
    label: 'Mood',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  stress: {
    icon: Brain,
    label: 'Stress',
    inverted: true, // Lower is better
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  sleep: {
    icon: Moon,
    label: 'Sleep',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  physicalHealth: {
    icon: Heart,
    label: 'Physical',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

interface MetricDisplayProps {
  type: 'mood' | 'stress' | 'sleep' | 'physicalHealth';
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showValue?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'p-2',
    icon: 'h-4 w-4',
    value: 'text-lg',
    label: 'text-xs',
  },
  md: {
    container: 'p-3',
    icon: 'h-5 w-5',
    value: 'text-xl',
    label: 'text-sm',
  },
  lg: {
    container: 'p-4',
    icon: 'h-6 w-6',
    value: 'text-2xl',
    label: 'text-base',
  },
};

export function MetricDisplay({
  type,
  value,
  size = 'md',
  showLabel = true,
  showValue = true,
  className = '',
}: MetricDisplayProps) {
  const config = METRIC_CONFIGS[type];
  const sizes = sizeClasses[size];
  const Icon = config.icon;

  // For inverted metrics (stress), show visual indicator
  const displayValue = Math.round(value);
  const isGood = config.inverted ? value <= 3 : value >= 4;

  return (
    <div className={`${sizes.container} rounded-xl ${config.bgColor} ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className={`${sizes.icon} ${config.color}`} />
        {showLabel && (
          <span className={`${sizes.label} text-gray-600`}>{config.label}</span>
        )}
      </div>
      {showValue && (
        <p className={`${sizes.value} font-bold text-gray-900 mt-1`}>
          {displayValue}/5
          {config.inverted && (
            <span className={`ml-1 text-xs ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
              {isGood ? '(Low)' : '(High)'}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * MetricsGrid - Grid layout for all 4 metrics
 */
interface MetricsGridProps {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  size?: 'sm' | 'md' | 'lg';
  columns?: 2 | 4;
  className?: string;
}

export function MetricsGrid({
  mood,
  stress,
  sleep,
  physicalHealth,
  size = 'md',
  columns = 4,
  className = '',
}: MetricsGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-3 ${className}`}>
      <MetricDisplay type="mood" value={mood} size={size} />
      <MetricDisplay type="stress" value={stress} size={size} />
      <MetricDisplay type="sleep" value={sleep} size={size} />
      <MetricDisplay type="physicalHealth" value={physicalHealth} size={size} />
    </div>
  );
}

/**
 * MetricBar - Horizontal bar representation of metric
 */
interface MetricBarProps {
  type: 'mood' | 'stress' | 'sleep' | 'physicalHealth';
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function MetricBar({
  type,
  value,
  showLabel = true,
  className = '',
}: MetricBarProps) {
  const config = METRIC_CONFIGS[type];
  const Icon = config.icon;
  const percentage = (value / 5) * 100;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 w-16">{config.label}</span>
      )}
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color.replace('text-', 'bg-')} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-8 text-right">
        {Math.round(value)}
      </span>
    </div>
  );
}
