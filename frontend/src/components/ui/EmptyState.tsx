/**
 * Reusable Empty State Component
 * Consistent empty states across lists and pages
 */

import { FolderOpen, Search, AlertCircle, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from './Button';

// ============================================
// TYPES
// ============================================

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  variant?: 'default' | 'compact' | 'search' | 'error';
  className?: string;
}

// ============================================
// PRESET ICONS
// ============================================

const variantIcons: Record<string, LucideIcon> = {
  default: FolderOpen,
  compact: FolderOpen,
  search: Search,
  error: AlertCircle,
};

// ============================================
// COMPONENT
// ============================================

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'rounded-2xl flex items-center justify-center mb-4',
          isCompact ? 'h-12 w-12' : 'h-16 w-16',
          variant === 'error'
            ? 'bg-danger-50'
            : 'bg-gradient-to-br from-gray-100 to-gray-50'
        )}
      >
        <Icon
          className={cn(
            isCompact ? 'h-6 w-6' : 'h-8 w-8',
            variant === 'error' ? 'text-danger-500' : 'text-gray-400'
          )}
        />
      </div>

      {/* Text */}
      <h3
        className={cn(
          'font-semibold text-gray-900',
          isCompact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-gray-500 mt-1 max-w-sm',
            isCompact ? 'text-sm' : 'text-base'
          )}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && <EmptyStateButton action={action} isPrimary />}
          {secondaryAction && <EmptyStateButton action={secondaryAction} />}
        </div>
      )}
    </div>
  );
}

// ============================================
// HELPER COMPONENT
// ============================================

function EmptyStateButton({
  action,
  isPrimary = false,
}: {
  action: EmptyStateAction;
  isPrimary?: boolean;
}) {
  const variant = isPrimary || action.variant === 'primary' ? 'primary' : 'secondary';
  const icon = action.icon ? <action.icon className="h-4 w-4" /> : undefined;

  if (action.href) {
    return (
      <Link to={action.href}>
        <Button variant={variant} leftIcon={icon}>
          {action.label}
        </Button>
      </Link>
    );
  }

  return (
    <Button variant={variant} onClick={action.onClick} leftIcon={icon}>
      {action.label}
    </Button>
  );
}

// ============================================
// PRESET EMPTY STATES
// ============================================

export function NoDataFound({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      title="No data found"
      description="There's nothing to display here yet."
      action={
        onRetry
          ? { label: 'Retry', onClick: onRetry }
          : undefined
      }
    />
  );
}

export function NoSearchResults({ searchTerm, onClear }: { searchTerm?: string; onClear?: () => void }) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={
        searchTerm
          ? `No results for "${searchTerm}". Try a different search term.`
          : 'Try adjusting your search or filters.'
      }
      action={
        onClear
          ? { label: 'Clear search', onClick: onClear, variant: 'secondary' }
          : undefined
      }
    />
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Something went wrong"
      description={message || 'An error occurred while loading data.'}
      action={
        onRetry
          ? { label: 'Try again', onClick: onRetry, variant: 'primary' }
          : undefined
      }
    />
  );
}
