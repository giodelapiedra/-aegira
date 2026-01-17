/**
 * UI Components Index
 * Central export for all reusable UI components
 */

// Core Components
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardTitleProps, CardDescriptionProps, CardContentProps, CardFooterProps } from './Card';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

export { Pagination, usePagination } from './Pagination';
export type { PaginationProps } from './Pagination';

// Stats & Dashboard Components
export { StatCard, StatCardGrid } from './StatCard';
export type { StatCardProps, StatCardColor } from './StatCard';

// Page Layout Components
export { PageHeader } from './PageHeader';
export type { PageHeaderProps, PageHeaderAction, Breadcrumb } from './PageHeader';

// Loading & State Components
export { LoadingSpinner, ButtonSpinner } from './LoadingSpinner';
export type { LoadingSpinnerProps, SpinnerSize } from './LoadingSpinner';

// Skeleton Loading System
export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonList,
  SkeletonListItem,
  SkeletonChart,
  SkeletonDashboard,
  SkeletonProfile,
  SkeletonForm,
  LoadingPage,
  InlineLoading,
} from './Skeleton';

export { EmptyState, NoDataFound, NoSearchResults, ErrorState } from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';

// Status Components
export { StatusBadge, ReadinessBadge, IncidentStatusBadge, SeverityBadge, ExceptionStatusBadge } from './StatusBadge';
export type { StatusBadgeProps, BadgeSize } from './StatusBadge';

// Data Display Components
export { DataTable, TableCellText, TableCellMuted, TableCellTruncate } from './DataTable';
export type { DataTableProps, Column, PaginationInfo } from './DataTable';

// Branding Components
export { Logo } from './Logo';
export type { LogoProps } from './Logo';
