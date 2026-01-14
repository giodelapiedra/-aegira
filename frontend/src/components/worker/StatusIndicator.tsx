/**
 * StatusIndicator Component
 *
 * Reusable status badge for displaying readiness status (GREEN/YELLOW/RED)
 * Used across worker pages for consistent status display.
 */

import { getStatusConfig, type ReadinessStatus } from './StatusConfig';

interface StatusIndicatorProps {
  status: ReadinessStatus | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  showEmoji?: boolean;
  showScore?: boolean;
  score?: number;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'h-6 w-6',
    emoji: 'text-sm',
    label: 'text-xs',
    score: 'text-xs',
  },
  md: {
    container: 'h-8 w-8',
    emoji: 'text-lg',
    label: 'text-sm',
    score: 'text-sm',
  },
  lg: {
    container: 'h-10 w-10',
    emoji: 'text-xl',
    label: 'text-base',
    score: 'text-base',
  },
  xl: {
    container: 'h-14 w-14',
    emoji: 'text-3xl',
    label: 'text-lg',
    score: 'text-lg',
  },
};

export function StatusIndicator({
  status,
  size = 'md',
  showLabel = false,
  showEmoji = true,
  showScore = false,
  score,
  className = '',
}: StatusIndicatorProps) {
  const config = getStatusConfig(status);
  const sizes = sizeClasses[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status circle with emoji */}
      <div
        className={`${sizes.container} rounded-full ${config.color} flex items-center justify-center shadow-sm`}
      >
        {showEmoji && (
          <span className={sizes.emoji}>{config.emoji}</span>
        )}
        {showScore && score !== undefined && !showEmoji && (
          <span className={`${sizes.score} font-bold text-white`}>
            {Math.round(score)}
          </span>
        )}
      </div>

      {/* Label and/or score */}
      {(showLabel || (showScore && showEmoji)) && (
        <div className="flex flex-col">
          {showLabel && (
            <span className={`${sizes.label} font-medium ${config.textColor}`}>
              {config.label}
            </span>
          )}
          {showScore && score !== undefined && showEmoji && (
            <span className={`${sizes.score} text-gray-500`}>
              Score: {Math.round(score)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * StatusBadge - Pill-style status indicator
 */
interface StatusBadgeProps {
  status: ReadinessStatus | string;
  showEmoji?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  showEmoji = true,
  className = '',
}: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      {showEmoji && <span>{config.emoji}</span>}
      {config.label}
    </span>
  );
}

/**
 * StatusDot - Simple colored dot indicator
 */
interface StatusDotProps {
  status: ReadinessStatus | string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const dotSizes = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export function StatusDot({
  status,
  size = 'md',
  pulse = false,
  className = '',
}: StatusDotProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-block ${dotSizes[size]} rounded-full ${config.color} ${pulse ? 'animate-pulse' : ''} ${className}`}
    />
  );
}
