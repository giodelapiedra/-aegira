/**
 * Readiness Trend Chart
 * Shows member's readiness score over time with color-coded zones
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DataPoint {
  date: string;
  score: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
}

interface ReadinessTrendChartProps {
  data: DataPoint[];
  height?: number;
  showZones?: boolean;
  timezone: string; // Company timezone - REQUIRED
}

export function ReadinessTrendChart({
  data,
  height = 280,
  showZones = true,
  timezone,
}: ReadinessTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No check-in data available</p>
      </div>
    );
  }

  // Calculate trend
  const getTrend = () => {
    if (data.length < 2) return { direction: 'stable', change: 0 };

    const recent = data.slice(-3);
    const older = data.slice(0, 3);

    const recentAvg = recent.reduce((sum, d) => sum + d.score, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.score, 0) / older.length;

    const change = Math.round(recentAvg - olderAvg);

    if (change > 5) return { direction: 'up', change };
    if (change < -5) return { direction: 'down', change };
    return { direction: 'stable', change };
  };

  const trend = getTrend();

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const statusColors = {
        GREEN: 'text-success-600',
        YELLOW: 'text-warning-600',
        RED: 'text-danger-600',
      };

      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-500 mb-1">{formatDate(label)}</p>
          <p className={`text-lg font-bold ${statusColors[data.status as keyof typeof statusColors]}`}>
            {data.score}%
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {data.status === 'GREEN' ? 'Ready' : data.status === 'YELLOW' ? 'Caution' : 'Not Ready'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Get dot color based on status
  const getDotColor = (status: string) => {
    switch (status) {
      case 'GREEN': return '#22c55e';
      case 'YELLOW': return '#f59e0b';
      case 'RED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div>
      {/* Trend indicator */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Readiness Trend</h3>
        <div className="flex items-center gap-1.5">
          {trend.direction === 'up' && (
            <>
              <TrendingUp className="h-4 w-4 text-success-500" />
              <span className="text-sm font-medium text-success-600">+{trend.change}%</span>
            </>
          )}
          {trend.direction === 'down' && (
            <>
              <TrendingDown className="h-4 w-4 text-danger-500" />
              <span className="text-sm font-medium text-danger-600">{trend.change}%</span>
            </>
          )}
          {trend.direction === 'stable' && (
            <>
              <Minus className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Stable</span>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          {/* Color zones */}
          {showZones && (
            <>
              <ReferenceArea y1={70} y2={100} fill="#22c55e" fillOpacity={0.1} />
              <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.1} />
              <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.1} />
            </>
          )}

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
          />

          {/* Threshold lines */}
          <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="5 5" strokeOpacity={0.5} />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={getDotColor(payload.status)}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-success-500" />
          <span>Ready (70%+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-warning-500" />
          <span>Caution (40-69%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger-500" />
          <span>Not Ready (&lt;40%)</span>
        </div>
      </div>
    </div>
  );
}
