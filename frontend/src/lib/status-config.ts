/**
 * Centralized status configuration
 * Used for consistent styling of status badges, colors, and labels across the app
 */

import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Activity,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type StatusVariant = 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'info';

export interface StatusConfig {
  label: string;
  variant: StatusVariant;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}

// ============================================
// READINESS STATUS CONFIG
// ============================================

export const readinessStatusConfig: Record<string, StatusConfig> = {
  GREEN: {
    label: 'Ready for Duty',
    variant: 'success',
    icon: CheckCircle2,
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    dotColor: 'bg-success-500',
  },
  YELLOW: {
    label: 'Limited Readiness',
    variant: 'warning',
    icon: AlertCircle,
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
  },
  RED: {
    label: 'Not Ready',
    variant: 'danger',
    icon: XCircle,
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    dotColor: 'bg-danger-500',
  },
};

// ============================================
// EXCEPTION STATUS CONFIG
// ============================================

export const exceptionStatusConfig: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending Review',
    variant: 'warning',
    icon: Clock,
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'success',
    icon: CheckCircle2,
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    dotColor: 'bg-success-500',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'danger',
    icon: XCircle,
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    dotColor: 'bg-danger-500',
  },
};

// ============================================
// INCIDENT STATUS CONFIG
// ============================================

export const incidentStatusConfig: Record<string, StatusConfig> = {
  OPEN: {
    label: 'Open',
    variant: 'danger',
    icon: AlertCircle,
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    dotColor: 'bg-danger-500',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    variant: 'warning',
    icon: Activity,
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
  },
  RESOLVED: {
    label: 'Resolved',
    variant: 'success',
    icon: CheckCircle2,
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    dotColor: 'bg-success-500',
  },
  CLOSED: {
    label: 'Closed',
    variant: 'secondary',
    icon: CheckCircle2,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-500',
  },
};

// ============================================
// INCIDENT SEVERITY CONFIG
// ============================================

export const incidentSeverityConfig: Record<string, StatusConfig> = {
  LOW: {
    label: 'Low',
    variant: 'info',
    icon: AlertCircle,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
  },
  MEDIUM: {
    label: 'Medium',
    variant: 'warning',
    icon: AlertTriangle,
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
  },
  HIGH: {
    label: 'High',
    variant: 'danger',
    icon: AlertTriangle,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Critical',
    variant: 'danger',
    icon: XCircle,
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    dotColor: 'bg-danger-500',
  },
};

// ============================================
// EXCEPTION TYPE CONFIG
// ============================================

export const exceptionTypeConfig: Record<string, { label: string; description: string }> = {
  SICK_LEAVE: {
    label: 'Sick Leave',
    description: 'Time off due to illness or medical condition',
  },
  PERSONAL_LEAVE: {
    label: 'Personal Leave',
    description: 'Personal matters requiring time away',
  },
  MEDICAL_APPOINTMENT: {
    label: 'Medical Appointment',
    description: 'Scheduled medical visit or check-up',
  },
  FAMILY_EMERGENCY: {
    label: 'Family Emergency',
    description: 'Urgent family situation requiring attention',
  },
  OTHER: {
    label: 'Other',
    description: 'Other reason not listed above',
  },
};

// ============================================
// INCIDENT TYPE CONFIG
// ============================================

export const incidentTypeConfig: Record<string, { label: string; description: string }> = {
  INJURY: {
    label: 'Injury',
    description: 'Physical injury or accident',
  },
  ILLNESS: {
    label: 'Illness',
    description: 'Sickness or health issue',
  },
  MENTAL_HEALTH: {
    label: 'Mental Health',
    description: 'Mental health concern or crisis',
  },
  EQUIPMENT: {
    label: 'Equipment',
    description: 'Equipment malfunction or issue',
  },
  ENVIRONMENTAL: {
    label: 'Environmental',
    description: 'Environmental hazard or concern',
  },
  OTHER: {
    label: 'Other',
    description: 'Other incident type',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status configuration by type and value
 */
export function getStatusConfig(
  type: 'readiness' | 'exception' | 'incident' | 'severity',
  value: string
): StatusConfig {
  const defaultConfig: StatusConfig = {
    label: value,
    variant: 'secondary',
    icon: AlertCircle,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-500',
  };

  switch (type) {
    case 'readiness':
      return readinessStatusConfig[value] || defaultConfig;
    case 'exception':
      return exceptionStatusConfig[value] || defaultConfig;
    case 'incident':
      return incidentStatusConfig[value] || defaultConfig;
    case 'severity':
      return incidentSeverityConfig[value] || defaultConfig;
    default:
      return defaultConfig;
  }
}

/**
 * Get score color based on value (1-10 scale)
 * @param value - Score value (1-10)
 * @param inverted - If true, lower is better (e.g., stress)
 */
export function getScoreColor(value: number, inverted = false): string {
  if (inverted) {
    if (value <= 3) return 'text-success-600';
    if (value <= 6) return 'text-warning-600';
    return 'text-danger-600';
  }
  if (value >= 7) return 'text-success-600';
  if (value >= 4) return 'text-warning-600';
  return 'text-danger-600';
}

/**
 * Get score background color based on value (1-10 scale)
 */
export function getScoreBgColor(value: number, inverted = false): string {
  if (inverted) {
    if (value <= 3) return 'bg-success-50';
    if (value <= 6) return 'bg-warning-50';
    return 'bg-danger-50';
  }
  if (value >= 7) return 'bg-success-50';
  if (value >= 4) return 'bg-warning-50';
  return 'bg-danger-50';
}

/**
 * Get readiness status from score
 */
export function getReadinessStatusFromScore(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score >= 70) return 'GREEN';
  if (score >= 40) return 'YELLOW';
  return 'RED';
}

/**
 * Get variant color classes for badges/buttons
 */
export function getVariantClasses(variant: StatusVariant): {
  bg: string;
  text: string;
  border: string;
  hover: string;
} {
  const variants: Record<StatusVariant, { bg: string; text: string; border: string; hover: string }> = {
    success: {
      bg: 'bg-success-50',
      text: 'text-success-700',
      border: 'border-success-200',
      hover: 'hover:bg-success-100',
    },
    warning: {
      bg: 'bg-warning-50',
      text: 'text-warning-700',
      border: 'border-warning-200',
      hover: 'hover:bg-warning-100',
    },
    danger: {
      bg: 'bg-danger-50',
      text: 'text-danger-700',
      border: 'border-danger-200',
      hover: 'hover:bg-danger-100',
    },
    primary: {
      bg: 'bg-primary-50',
      text: 'text-primary-700',
      border: 'border-primary-200',
      hover: 'hover:bg-primary-100',
    },
    secondary: {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-100',
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100',
    },
  };

  return variants[variant] || variants.secondary;
}

// ============================================
// COMPLIANCE COLOR UTILITIES
// ============================================

/**
 * Get compliance color classes for text display (simple)
 * Returns a single text color class
 * Thresholds: >= 100% (Perfect/Green), >= 80% (Good/Blue), >= 60% (Warning/Yellow), < 60% (Poor/Red)
 */
export function getComplianceTextColor(compliance: number | null): string {
  if (compliance === null) return 'text-gray-500';
  if (compliance >= 100) return 'text-green-600';
  if (compliance >= 80) return 'text-blue-600';
  if (compliance >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get compliance color classes for card display (full)
 * Returns all color classes needed for a card component
 * Thresholds: >= 100% (Perfect/Green), >= 80% (Good/Blue), >= 60% (Warning/Yellow), < 60% (Poor/Red)
 */
export function getComplianceColorClasses(compliance: number | null): {
  bg: string;
  border: string;
  icon: string;
  text: string;
  label: string;
  subtext: string;
} {
  if (compliance === null) {
    return {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: 'text-gray-500',
      text: 'text-gray-500',
      label: 'text-gray-500',
      subtext: 'text-gray-400',
    };
  }

  if (compliance >= 100) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-100',
      icon: 'text-green-600',
      text: 'text-green-700',
      label: 'text-green-600',
      subtext: 'text-green-400',
    };
  }

  if (compliance >= 80) {
    return {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: 'text-blue-600',
      text: 'text-blue-700',
      label: 'text-blue-600',
      subtext: 'text-blue-400',
    };
  }

  if (compliance >= 60) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-100',
      icon: 'text-yellow-600',
      text: 'text-yellow-700',
      label: 'text-yellow-600',
      subtext: 'text-yellow-400',
    };
  }

  return {
    bg: 'bg-red-50',
    border: 'border-red-100',
    icon: 'text-red-600',
    text: 'text-red-700',
    label: 'text-red-600',
    subtext: 'text-red-400',
  };
}

/**
 * Get compliance color classes for gradient card display
 * Returns gradient and border classes for summary cards
 * Thresholds: >= 100% (Perfect/Green), >= 80% (Good/Blue), >= 60% (Warning/Yellow), < 60% (Poor/Red)
 */
export function getComplianceGradientClasses(compliance: number | null): {
  bg: string;
  border: string;
  label: string;
  value: string;
  subtext: string;
} {
  if (compliance === null) {
    return {
      bg: 'from-gray-50 to-gray-100/50',
      border: 'border-gray-200',
      label: 'text-gray-500',
      value: 'text-gray-500',
      subtext: 'text-gray-400',
    };
  }

  if (compliance >= 100) {
    return {
      bg: 'from-green-50 to-green-100/50',
      border: 'border-green-200',
      label: 'text-green-600',
      value: 'text-green-700',
      subtext: 'text-green-500',
    };
  }

  if (compliance >= 80) {
    return {
      bg: 'from-blue-50 to-blue-100/50',
      border: 'border-blue-200',
      label: 'text-blue-600',
      value: 'text-blue-700',
      subtext: 'text-blue-500',
    };
  }

  if (compliance >= 60) {
    return {
      bg: 'from-yellow-50 to-yellow-100/50',
      border: 'border-yellow-200',
      label: 'text-yellow-600',
      value: 'text-yellow-700',
      subtext: 'text-yellow-500',
    };
  }

  return {
    bg: 'from-red-50 to-red-100/50',
    border: 'border-red-200',
    label: 'text-red-600',
    value: 'text-red-700',
    subtext: 'text-red-500',
  };
}
