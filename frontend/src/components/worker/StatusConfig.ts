/**
 * Shared Status Configuration for Worker Pages
 *
 * Unified status config used by:
 * - checkin/ (dashboard status display)
 * - home/ (today's status card)
 * - request-exception.page.tsx (status badges)
 */

export const STATUS_CONFIG = {
  GREEN: {
    label: 'Ready for Duty',
    emoji: '😊',
    color: 'bg-success-500',
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    gradientFrom: 'from-success-500',
    gradientTo: 'to-success-600',
    ringColor: 'ring-success-500/20',
    variant: 'success' as const,
  },
  YELLOW: {
    label: 'Limited Readiness',
    emoji: '😐',
    color: 'bg-warning-500',
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    gradientFrom: 'from-warning-500',
    gradientTo: 'to-warning-600',
    ringColor: 'ring-warning-500/20',
    variant: 'warning' as const,
  },
  RED: {
    label: 'Not Ready',
    emoji: '😰',
    color: 'bg-danger-500',
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    gradientFrom: 'from-danger-500',
    gradientTo: 'to-danger-600',
    ringColor: 'ring-danger-500/20',
    variant: 'danger' as const,
  },
  DEFAULT: {
    label: 'Unknown',
    emoji: '😐',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    gradientFrom: 'from-gray-500',
    gradientTo: 'to-gray-600',
    ringColor: 'ring-gray-500/20',
    variant: 'default' as const,
  },
} as const;

export type ReadinessStatus = keyof typeof STATUS_CONFIG;

/**
 * Get full status configuration for a given status
 */
export const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status as ReadinessStatus] || STATUS_CONFIG.DEFAULT;

/**
 * Helper functions for individual properties (backwards compatibility)
 */
export const getStatusColor = (status: string) => getStatusConfig(status).color;
export const getStatusBgColor = (status: string) => getStatusConfig(status).bgColor;
export const getStatusTextColor = (status: string) => getStatusConfig(status).textColor;
export const getStatusBorderColor = (status: string) => getStatusConfig(status).borderColor;
export const getStatusLabel = (status: string) => getStatusConfig(status).label;
export const getStatusEmoji = (status: string) => getStatusConfig(status).emoji;
export const getStatusVariant = (status: string) => getStatusConfig(status).variant;

/**
 * Get gradient class string for backgrounds
 */
export const getStatusGradient = (status: string) =>
  `${getStatusConfig(status).gradientFrom} ${getStatusConfig(status).gradientTo}`;

/**
 * Get background gradient for card headers
 */
export const getStatusBgGradient = (status: string) =>
  `bg-gradient-to-r ${getStatusGradient(status)}`;
