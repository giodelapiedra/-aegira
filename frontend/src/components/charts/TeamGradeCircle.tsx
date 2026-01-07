/**
 * Team Grade Circle
 * Circular progress indicator showing team grade with color coding
 */

import { cn } from '../../lib/utils';

interface TeamGradeCircleProps {
  score: number;
  color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  label: string;
  size?: number;
}

const COLOR_MAP = {
  GREEN: {
    stroke: 'stroke-success-500',
    text: 'text-success-600',
    bg: 'bg-success-50',
    gradient: 'from-success-500 to-success-600',
  },
  YELLOW: {
    stroke: 'stroke-warning-500',
    text: 'text-warning-600',
    bg: 'bg-warning-50',
    gradient: 'from-warning-500 to-warning-600',
  },
  ORANGE: {
    stroke: 'stroke-orange-500',
    text: 'text-orange-600',
    bg: 'bg-orange-50',
    gradient: 'from-orange-500 to-orange-600',
  },
  RED: {
    stroke: 'stroke-danger-500',
    text: 'text-danger-600',
    bg: 'bg-danger-50',
    gradient: 'from-danger-500 to-danger-600',
  },
};

export function TeamGradeCircle({ score, color, label, size = 180 }: TeamGradeCircleProps) {
  const colors = COLOR_MAP[color];
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const strokeDashoffset = circumference - progress;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={size}
          height={size}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-gray-100"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            className={colors.stroke}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-4xl font-bold', colors.text)}>
            {score}%
          </span>
          <span className={cn('text-sm font-medium mt-1', colors.text)}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

// Empty state component
export function TeamGradeEmpty({ size = 180 }: { size?: number }) {
  const radius = (size - 20) / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="absolute inset-0 -rotate-90"
          width={size}
          height={size}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-gray-100"
            strokeDasharray="8 4"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-300">--%</span>
          <span className="text-sm font-medium text-gray-400 mt-1">No Data</span>
        </div>
      </div>
    </div>
  );
}
