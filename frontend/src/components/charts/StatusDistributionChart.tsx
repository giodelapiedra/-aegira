/**
 * Status Distribution Chart
 * Shows the distribution of check-in statuses (GREEN/YELLOW/RED) as a donut chart
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface StatusData {
  green: number;
  yellow: number;
  red: number;
}

interface StatusDistributionChartProps {
  data: StatusData;
  size?: number;
  showLegend?: boolean;
}

export function StatusDistributionChart({
  data,
  size = 180,
  showLegend = true,
}: StatusDistributionChartProps) {
  const total = data.green + data.yellow + data.red;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <p>No check-in data available</p>
      </div>
    );
  }

  const chartData = [
    { name: 'Ready', value: data.green, color: '#22c55e', icon: CheckCircle2 },
    { name: 'Limited', value: data.yellow, color: '#f59e0b', icon: AlertCircle },
    { name: 'Not Ready', value: data.red, color: '#ef4444', icon: XCircle },
  ].filter((d) => d.value > 0);

  const getPercentage = (value: number) => Math.round((value / total) * 100);

  // Determine primary status (highest count)
  const primaryStatus = chartData.reduce((prev, current) =>
    prev.value > current.value ? prev : current
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium" style={{ color: data.color }}>
            {data.name}
          </p>
          <p className="text-lg font-bold text-gray-900">{data.value} check-ins</p>
          <p className="text-xs text-gray-500">{getPercentage(data.value)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-4">Status Distribution</h3>

      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="relative" style={{ width: size, height: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={size * 0.35}
                outerRadius={size * 0.45}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">
              {getPercentage(primaryStatus.value)}%
            </span>
            <span className="text-xs text-gray-500">{primaryStatus.name}</span>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex-1 space-y-3">
            {chartData.map((item) => {
              const Icon = item.icon;
              const percentage = getPercentage(item.value);

              return (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    <span className="text-xs text-gray-400">({percentage}%)</span>
                  </div>
                </div>
              );
            })}

            {/* Total */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total Check-ins</span>
                <span className="text-sm font-bold text-gray-900">{total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
