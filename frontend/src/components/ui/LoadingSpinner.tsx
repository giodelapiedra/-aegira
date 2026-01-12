/**
 * Reusable Loading Spinner Component
 * Fancy ring loader with colorful animations
 */

import { cn } from '../../lib/utils';

// ============================================
// TYPES
// ============================================

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

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
// SIZE CONFIG
// ============================================

const sizeConfig: Record<SpinnerSize, { width: number; className: string }> = {
  xs: { width: 16, className: 'w-4 h-4' },
  sm: { width: 24, className: 'w-6 h-6' },
  md: { width: 40, className: 'w-10 h-10' },
  lg: { width: 64, className: 'w-16 h-16' },
  xl: { width: 96, className: 'w-24 h-24' },
};

// ============================================
// RING LOADER SVG COMPONENT
// ============================================

interface RingLoaderProps {
  size?: SpinnerSize;
  className?: string;
}

export function RingLoader({ size = 'md', className }: RingLoaderProps) {
  const config = sizeConfig[size];

  return (
    <svg
      className={cn(config.className, className)}
      viewBox="0 0 240 240"
    >
      <circle
        className="ring-loader-a"
        cx="120"
        cy="120"
        r="105"
        fill="none"
        stroke="#f42f25"
        strokeWidth="20"
        strokeDasharray="0 660"
        strokeDashoffset="-330"
        strokeLinecap="round"
      />
      <circle
        className="ring-loader-b"
        cx="120"
        cy="120"
        r="35"
        fill="none"
        stroke="#f49725"
        strokeWidth="20"
        strokeDasharray="0 220"
        strokeDashoffset="-110"
        strokeLinecap="round"
      />
      <circle
        className="ring-loader-c"
        cx="85"
        cy="120"
        r="70"
        fill="none"
        stroke="#255ff4"
        strokeWidth="20"
        strokeDasharray="0 440"
        strokeLinecap="round"
      />
      <circle
        className="ring-loader-d"
        cx="155"
        cy="120"
        r="70"
        fill="none"
        stroke="#f42582"
        strokeWidth="20"
        strokeDasharray="0 440"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================
// COMPONENTS
// ============================================

/**
 * Basic loading spinner - uses fancy ring loader
 */
export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <RingLoader size={size} />
      {label && <span className="text-sm text-gray-500 font-medium">{label}</span>}
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
      <p className="text-gray-500 mt-4 font-medium">{label}</p>
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
