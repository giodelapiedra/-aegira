/**
 * Centralized Stat Card Component
 * Used across all dashboard pages for displaying metrics
 */

import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

export type StatCardColor = 'primary' | 'success' | 'warning' | 'danger' | 'gray' | 'purple' | 'blue';
export type StatCardTrend = 'up' | 'down' | 'neutral';

export interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: StatCardColor;
  className?: string;
  isLoading?: boolean;
  onClick?: () => void;
  tooltip?: string;
  subtext?: string;
  trend?: StatCardTrend;
}

const colorStyles: Record<StatCardColor, { 
  bottomBorder: string; 
  bottomShadowColor: string;
  iconBg: string; 
  iconColor: string; 
  labelColor: string;
  valueColor: string;
}> = {
  primary: {
    bottomBorder: 'border-b-2 border-primary-500',
    bottomShadowColor: 'rgb(99 102 241 / 0.2)',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    labelColor: 'text-primary-600',
    valueColor: 'text-gray-900',
  },
  success: {
    bottomBorder: 'border-b-2 border-success-500',
    bottomShadowColor: 'rgb(16 185 129 / 0.2)',
    iconBg: 'bg-success-100',
    iconColor: 'text-success-600',
    labelColor: 'text-success-600',
    valueColor: 'text-gray-900',
  },
  warning: {
    bottomBorder: 'border-b-2 border-warning-500',
    bottomShadowColor: 'rgb(245 158 11 / 0.2)',
    iconBg: 'bg-warning-100',
    iconColor: 'text-warning-600',
    labelColor: 'text-warning-600',
    valueColor: 'text-gray-900',
  },
  danger: {
    bottomBorder: 'border-b-2 border-danger-500',
    bottomShadowColor: 'rgb(239 68 68 / 0.2)',
    iconBg: 'bg-danger-100',
    iconColor: 'text-danger-600',
    labelColor: 'text-danger-600',
    valueColor: 'text-gray-900',
  },
  gray: {
    bottomBorder: 'border-b-2 border-gray-400',
    bottomShadowColor: 'rgb(156 163 175 / 0.2)',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    labelColor: 'text-gray-600',
    valueColor: 'text-gray-900',
  },
  purple: {
    bottomBorder: 'border-b-2 border-purple-500',
    bottomShadowColor: 'rgb(168 85 247 / 0.2)',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    labelColor: 'text-purple-600',
    valueColor: 'text-gray-900',
  },
  blue: {
    bottomBorder: 'border-b-2 border-blue-500',
    bottomShadowColor: 'rgb(59 130 246 / 0.2)',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    labelColor: 'text-blue-600',
    valueColor: 'text-gray-900',
  },
};

export function StatCard({
  icon: Icon,
  value,
  label,
  color = 'gray',
  className,
  isLoading = false,
  onClick,
  tooltip,
  subtext,
  trend,
}: StatCardProps) {
  const styles = colorStyles[color];
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 border-0 relative',
        styles.bottomBorder,
        isClickable && 'cursor-pointer hover:shadow-md transition-all',
        className
      )}
      style={{
        boxShadow: `0 2px 0 0 ${styles.bottomShadowColor}`,
      }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title={tooltip}
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', styles.iconBg)}>
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
        <div className="flex-1">
          {isLoading ? (
            <Skeleton className="h-7 w-12 mb-1" />
          ) : (
            <p className={cn('text-2xl font-bold', styles.valueColor)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
          <p className={cn('text-sm font-medium', styles.labelColor)}>{label}</p>
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend === 'up' && 'text-success-600',
              trend === 'down' && 'text-danger-600',
              trend === 'neutral' && 'text-gray-500'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-4 w-4" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4" />}
          </div>
        )}
      </div>
      {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
    </div>
  );
}

// Grid wrapper for consistent spacing
interface StatCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function StatCardGrid({ children, columns = 4, className }: StatCardGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {children}
    </div>
  );
}
