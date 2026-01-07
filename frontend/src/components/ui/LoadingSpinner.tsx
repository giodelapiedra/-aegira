/**
 * Reusable Loading Spinner Component
 * Consistent loading states across the app
 */

import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// TYPES
// ============================================

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export interface LoadingPageProps {
  label?: string;
  minHeight?: string;
}

// ============================================
// SIZE STYLES
// ============================================

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

// ============================================
// COMPONENTS
// ============================================

/**
 * Basic loading spinner
 */
export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-primary-500', sizeClasses[size])} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </div>
  );
}

/**
 * Loading overlay for content areas
 */
export function LoadingOverlay({ isLoading, label, children, className }: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <LoadingSpinner size="lg" label={label} />
        </div>
      )}
    </div>
  );
}

/**
 * Full page loading state
 */
export function LoadingPage({ label = 'Loading...', minHeight = '400px' }: LoadingPageProps) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight }}
    >
      <LoadingSpinner size="xl" />
      <p className="text-gray-500 mt-4">{label}</p>
    </div>
  );
}

/**
 * Skeleton loader for text
 */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-gray-200 rounded animate-pulse',
            i === lines - 1 && lines > 1 && 'w-3/4'
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton loader for cards
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/**
 * Skeleton loader for table rows
 */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}
