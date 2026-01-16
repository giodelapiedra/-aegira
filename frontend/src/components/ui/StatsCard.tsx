/**
 * Reusable Stats Card Component
 * Used across dashboard pages for displaying metrics
 */

import { type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

// ============================================
// TYPES
// ============================================

export type StatsCardVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatsCardVariant;
  isLoading?: boolean;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

// ============================================
// VARIANT STYLES
// ============================================

const variantStyles: Record<StatsCardVariant, { icon: string; trend: string }> = {
  primary: {
    icon: 'bg-primary-50 text-primary-600',
    trend: 'text-primary-600',
  },
  secondary: {
    icon: 'bg-secondary-50 text-secondary-600',
    trend: 'text-secondary-600',
  },
  success: {
    icon: 'bg-success-50 text-success-600',
    trend: 'text-success-600',
  },
  warning: {
    icon: 'bg-warning-50 text-warning-600',
    trend: 'text-warning-600',
  },
  danger: {
    icon: 'bg-danger-50 text-danger-600',
    trend: 'text-danger-600',
  },
};

// ============================================
// COMPONENT
// ============================================

export function StatsCard({
  label,
  value,
  icon: Icon,
  variant = 'primary',
  isLoading = false,
  description,
  trend,
  className,
  onClick,
}: StatsCardProps) {
  const styles = variantStyles[variant];
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-4',
        isClickable && 'cursor-pointer hover:border-primary-200 hover:shadow-md transition-all',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Icon */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center text-sm font-medium',
              trend.isPositive ? 'text-success-600' : 'text-danger-600'
            )}
          >
            <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
        <p className="text-sm text-gray-500 mt-1">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATS CARD GRID
// ============================================

interface StatsCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsCardGrid({ children, columns = 4, className }: StatsCardGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {children}
    </div>
  );
}
