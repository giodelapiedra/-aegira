/**
 * Reusable Status Badge Component
 * Consistent status display across the app
 */

import { type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getStatusConfig,
  type StatusVariant,
  
  
  
  
} from '../../lib/status-config';

// ============================================
// TYPES
// ============================================

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  status: string;
  type: 'readiness' | 'exception' | 'incident' | 'severity';
  size?: BadgeSize;
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
}

export interface CustomBadgeProps {
  label: string;
  variant?: StatusVariant;
  icon?: LucideIcon;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

// ============================================
// SIZE STYLES
// ============================================

const sizeClasses: Record<BadgeSize, { badge: string; icon: string; dot: string }> = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
    dot: 'h-1.5 w-1.5',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs',
    icon: 'h-3.5 w-3.5',
    dot: 'h-2 w-2',
  },
  lg: {
    badge: 'px-3 py-1.5 text-sm',
    icon: 'h-4 w-4',
    dot: 'h-2.5 w-2.5',
  },
};

const variantClasses: Record<StatusVariant, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    dot: 'bg-success-500',
  },
  warning: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    dot: 'bg-warning-500',
  },
  danger: {
    bg: 'bg-danger-50',
    text: 'text-danger-700',
    dot: 'bg-danger-500',
  },
  primary: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    dot: 'bg-primary-500',
  },
  secondary: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

export function StatusBadge({
  status,
  type,
  size = 'md',
  showIcon = false,
  showDot = false,
  className,
}: StatusBadgeProps) {
  const config = getStatusConfig(type, status);
  const sizes = sizeClasses[size];
  const colors = variantClasses[config.variant];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        sizes.badge,
        colors.bg,
        colors.text,
        className
      )}
    >
      {showDot && (
        <span className={cn('rounded-full', sizes.dot, colors.dot)} />
      )}
      {showIcon && Icon && <Icon className={sizes.icon} />}
      {config.label}
    </span>
  );
}

// ============================================
// CUSTOM BADGE COMPONENT
// ============================================

export function Badge({
  label,
  variant = 'secondary',
  icon: Icon,
  size = 'md',
  showDot = false,
  className,
}: CustomBadgeProps) {
  const sizes = sizeClasses[size];
  const colors = variantClasses[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        sizes.badge,
        colors.bg,
        colors.text,
        className
      )}
    >
      {showDot && (
        <span className={cn('rounded-full', sizes.dot, colors.dot)} />
      )}
      {Icon && <Icon className={sizes.icon} />}
      {label}
    </span>
  );
}

// ============================================
// PRESET BADGES
// ============================================

export function ReadinessBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: {
  status: string;
  size?: BadgeSize;
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      type="readiness"
      size={size}
      showIcon={showIcon}
      className={className}
    />
  );
}

export function IncidentStatusBadge({
  status,
  size = 'md',
  showDot = true,
  className,
}: {
  status: string;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      type="incident"
      size={size}
      showDot={showDot}
      className={className}
    />
  );
}

export function SeverityBadge({
  severity,
  size = 'md',
  className,
}: {
  severity: string;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <StatusBadge
      status={severity}
      type="severity"
      size={size}
      className={className}
    />
  );
}

export function ExceptionStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: {
  status: string;
  size?: BadgeSize;
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      type="exception"
      size={size}
      showIcon={showIcon}
      className={className}
    />
  );
}
