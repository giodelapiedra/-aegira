/**
 * Centralized Skeleton Loading System
 * Modern, colorful shimmer effect for consistent loading states
 */

import { cn } from '../../lib/utils';

// ============================================
// BASE SKELETON
// ============================================

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  style?: React.CSSProperties;
}

export function Skeleton({ className, variant = 'default', style }: SkeletonProps) {
  const variantClasses = {
    default: 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
    primary: 'bg-gradient-to-r from-primary-100 via-primary-50 to-primary-100',
    success: 'bg-gradient-to-r from-green-100 via-green-50 to-green-100',
    warning: 'bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100',
  };

  return (
    <div
      className={cn(
        'animate-shimmer rounded-md',
        variantClasses[variant],
        className
      )}
      style={{
        backgroundSize: '200% 100%',
        ...style,
      }}
    />
  );
}

// ============================================
// SKELETON VARIANTS
// ============================================

/** Text skeleton - for titles, labels, paragraphs */
export function SkeletonText({
  lines = 1,
  className,
  lastLineWidth = '75%'
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 && lines > 1 ? lastLineWidth : '100%' } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Circle skeleton - for avatars, icons */
export function SkeletonCircle({
  size = 'md',
  className
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size], className)} />
  );
}

/** Card skeleton - for stat cards, info cards */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 p-5 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" variant="primary" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" variant="success" />
    </div>
  );
}

/** Stats card skeleton - for dashboard stats */
export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/** Table skeleton - full table loading */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Rows */}
      <table className="w-full">
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** List item skeleton */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 p-3', className)}>
      <SkeletonCircle size="md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" variant="primary" />
    </div>
  );
}

/** List skeleton */
export function SkeletonList({
  items = 5,
  className
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 divide-y divide-gray-50', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/** Chart skeleton */
export function SkeletonChart({
  height = 200,
  className
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            variant="primary"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// PAGE SKELETONS
// ============================================

/** Dashboard page skeleton */
export function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" variant="primary" />
      </div>

      {/* Stats */}
      <SkeletonStats count={4} />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart height={250} />
        <SkeletonList items={4} />
      </div>
    </div>
  );
}

/** Profile/Detail page skeleton */
export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <SkeletonCircle size="xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-6 w-16 rounded-full" variant="success" />
              <Skeleton className="h-6 w-20 rounded-full" variant="primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <SkeletonStats count={3} />

      {/* History */}
      <SkeletonTable rows={5} columns={4} />
    </div>
  );
}

/** Form page skeleton */
export function SkeletonForm({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 p-6 space-y-6', className)}>
      <Skeleton className="h-6 w-32" />

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <Skeleton className="h-10 w-24 rounded-lg" variant="primary" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// LOADING PAGE WRAPPER
// ============================================

interface LoadingPageProps {
  variant?: 'dashboard' | 'profile' | 'form' | 'table' | 'list';
  className?: string;
}

export function LoadingPage({ variant = 'dashboard', className }: LoadingPageProps) {
  const variants = {
    dashboard: <SkeletonDashboard />,
    profile: <SkeletonProfile />,
    form: <SkeletonForm />,
    table: <SkeletonTable rows={8} columns={5} />,
    list: <SkeletonList items={8} />,
  };

  return (
    <div className={cn('container mx-auto py-6 px-4', className)}>
      {variants[variant]}
    </div>
  );
}

// ============================================
// INLINE LOADING
// ============================================

interface InlineLoadingProps {
  className?: string;
  text?: string;
}

export function InlineLoading({ className, text = 'Loading...' }: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2 text-gray-500', className)}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
