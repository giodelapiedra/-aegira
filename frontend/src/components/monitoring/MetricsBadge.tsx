/**
 * MetricsBadge Component
 * Displays individual metrics (mood, stress, sleep, physical) with color coding
 */

import { cn } from '../../lib/utils';
import {
  Smile,
  Frown,
  Meh,
  Brain,
  Moon,
  Heart,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type MetricType = 'mood' | 'stress' | 'sleep' | 'physical';

interface MetricsBadgeProps {
  type: MetricType;
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getMetricConfig(type: MetricType): {
  label: string;
  icon: LucideIcon;
  inverted: boolean;
} {
  const configs: Record<MetricType, { label: string; icon: LucideIcon; inverted: boolean }> = {
    mood: { label: 'Mood', icon: Smile, inverted: false },
    stress: { label: 'Stress', icon: Brain, inverted: true },
    sleep: { label: 'Sleep', icon: Moon, inverted: false },
    physical: { label: 'Physical', icon: Heart, inverted: false },
  };
  return configs[type];
}

function getValueColor(value: number, inverted: boolean): string {
  if (inverted) {
    // Lower is better (stress)
    if (value <= 3) return 'text-success-600 bg-success-50';
    if (value <= 6) return 'text-warning-600 bg-warning-50';
    return 'text-danger-600 bg-danger-50';
  }
  // Higher is better
  if (value >= 7) return 'text-success-600 bg-success-50';
  if (value >= 4) return 'text-warning-600 bg-warning-50';
  return 'text-danger-600 bg-danger-50';
}

function getMoodIcon(value: number): LucideIcon {
  if (value >= 7) return Smile;
  if (value >= 4) return Meh;
  return Frown;
}

// ============================================
// COMPONENT
// ============================================

export function MetricsBadge({
  type,
  value,
  size = 'md',
  showLabel = true,
  showIcon = true,
  className,
}: MetricsBadgeProps) {
  const config = getMetricConfig(type);
  const colorClass = getValueColor(value, config.inverted);
  const Icon = type === 'mood' ? getMoodIcon(value) : config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showLabel && <span className="text-gray-500">{config.label}:</span>}
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// ============================================
// METRICS ROW COMPONENT
// ============================================

interface MetricsRowProps {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function MetricsRow({
  mood,
  stress,
  sleep,
  physicalHealth,
  size = 'sm',
  showLabels = false,
  className,
}: MetricsRowProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <MetricsBadge type="mood" value={mood} size={size} showLabel={showLabels} />
      <MetricsBadge type="stress" value={stress} size={size} showLabel={showLabels} />
      <MetricsBadge type="sleep" value={sleep} size={size} showLabel={showLabels} />
      <MetricsBadge type="physical" value={physicalHealth} size={size} showLabel={showLabels} />
    </div>
  );
}
