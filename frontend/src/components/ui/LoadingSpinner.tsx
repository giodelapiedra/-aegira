/**
 * Simple Loading Spinner
 * For buttons and inline loading states
 * For page-level loading, use Skeleton components instead
 */

import { cn } from '../../lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  color?: 'primary' | 'white' | 'gray';
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

const colorClasses = {
  primary: 'border-primary-200 border-t-primary-600',
  white: 'border-white/30 border-t-white',
  gray: 'border-gray-200 border-t-gray-600',
};

export function LoadingSpinner({
  size = 'md',
  className,
  color = 'primary'
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    />
  );
}

/** For use inside buttons */
export function ButtonSpinner({ className }: { className?: string }) {
  return <LoadingSpinner size="sm" color="white" className={className} />;
}
