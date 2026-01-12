/**
 * Reusable Page Header Component
 * Consistent page titles with optional actions and breadcrumbs
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from './Button';

// ============================================
// TYPES
// ============================================

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  breadcrumbs?: Breadcrumb[];
  actions?: PageHeaderAction[];
  badge?: {
    label: string;
    variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  };
  className?: string;
  children?: React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
  badge,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="hover:text-primary-600 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Title Section */}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    badge.variant === 'success' && 'bg-success-50 text-success-700',
                    badge.variant === 'warning' && 'bg-warning-50 text-warning-700',
                    badge.variant === 'danger' && 'bg-danger-50 text-danger-700',
                    badge.variant === 'primary' && 'bg-primary-50 text-primary-700',
                    (!badge.variant || badge.variant === 'secondary') && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {description && (
              <p className="text-gray-500 mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action, index) => {
              const icon = action.icon ? <action.icon className="h-4 w-4" /> : undefined;
              const variant = action.variant || 'secondary';

              if (action.href && !action.disabled) {
                return (
                  <Link key={index} to={action.href}>
                    <Button variant={variant} leftIcon={icon}>
                      {action.label}
                    </Button>
                  </Link>
                );
              }

              return (
                <Button
                  key={index}
                  variant={variant}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  leftIcon={icon}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Additional Content */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
