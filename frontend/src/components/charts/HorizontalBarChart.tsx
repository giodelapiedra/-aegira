/**
 * Horizontal Bar Chart Component
 * Clean, animated horizontal bars for category distribution
 */

import { cn } from '../../lib/utils';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface HorizontalBarChartProps {
  data: BarItem[];
  title?: string;
  subtitle?: string;
  showPercentage?: boolean;
  showValue?: boolean;
  maxItems?: number;
  className?: string;
  emptyMessage?: string;
  colorScheme?: 'default' | 'severity' | 'status' | 'type';
}

// Predefined color schemes
const colorSchemes = {
  default: [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#6b7280', // gray
  ],
  severity: {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#f59e0b',
    LOW: '#3b82f6',
  },
  status: {
    OPEN: '#ef4444',
    IN_PROGRESS: '#f59e0b',
    RESOLVED: '#10b981',
    CLOSED: '#6b7280',
  },
  type: {
    INJURY: '#ef4444',
    ILLNESS: '#f97316',
    MENTAL_HEALTH: '#8b5cf6',
    MEDICAL_EMERGENCY: '#ec4899',
    HEALTH_SAFETY: '#10b981',
    OTHER: '#6b7280',
  },
};

export function HorizontalBarChart({
  data,
  title,
  subtitle,
  showPercentage = true,
  showValue = true,
  maxItems = 10,
  className,
  emptyMessage = 'No data available',
  colorScheme = 'default',
}: HorizontalBarChartProps) {
  // Filter and limit data
  const filteredData = data.filter((item) => item.value > 0).slice(0, maxItems);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...filteredData.map((item) => item.value), 1);

  if (filteredData.length === 0) {
    return (
      <div className={cn('', className)}>
        {title && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  // Get color for item
  const getColor = (item: BarItem, index: number): string => {
    if (item.color) return item.color;

    if (colorScheme === 'default') {
      return colorSchemes.default[index % colorSchemes.default.length];
    }

    const schemeColors = colorSchemes[colorScheme] as Record<string, string>;
    return schemeColors[item.label] || colorSchemes.default[index % colorSchemes.default.length];
  };

  // Format label for display
  const formatLabel = (label: string): string => {
    return label
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className={cn('', className)}>
      {/* Header */}
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Bars */}
      <div className="space-y-3">
        {filteredData.map((item, index) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const barWidth = (item.value / maxValue) * 100;
          const color = getColor(item, index);

          return (
            <div key={item.label} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    {formatLabel(item.label)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {showValue && (
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  )}
                  {showPercentage && (
                    <span className="text-xs text-gray-400 w-10 text-right">({percentage}%)</span>
                  )}
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-sm font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  );
}
