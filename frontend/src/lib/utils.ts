/**
 * Core Utilities
 * Essential utility functions used across the app
 *
 * Note: For date utilities, use lib/date-utils.ts
 * For status utilities, use lib/status-config.ts
 */

import { clsx, type ClassValue } from 'clsx';

// Re-export from centralized utilities for backwards compatibility
export {
  formatLocalDate,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
  formatRelativeTime,
} from './date-utils';

export {
  getStatusConfig,
  getScoreColor,
} from './status-config';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Get initials from first and last name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
