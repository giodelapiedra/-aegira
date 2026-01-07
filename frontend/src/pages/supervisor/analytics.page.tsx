import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { analyticsService } from '../../services/analytics.service';

export function AnalyticsPage() {
  // Get dashboard stats from analytics service
  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsService.getDashboardStats(),
  });

  // Use dashboard stats for all metrics
  const totalUsers = dashboardStats?.totalMembers || 0;
  const greenCount = dashboardStats?.greenCount || 0;
  const yellowCount = dashboardStats?.yellowCount || 0;
  const redCount = dashboardStats?.redCount || 0;
  const todayCheckins = greenCount + yellowCount + redCount;
  const checkinRate = dashboardStats?.checkinRate || 0;
  const openIncidents = dashboardStats?.openIncidents || 0;
  const pendingExceptions = dashboardStats?.pendingExceptions || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Overview of company readiness and safety metrics</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Personnel"
          value={totalUsers}
          icon={Users}
          color="primary"
          isLoading={isLoading}
        />
        <StatCard
          label="Check-in Rate"
          value={`${checkinRate}%`}
          icon={TrendingUp}
          color="success"
          trend={checkinRate >= 80 ? 'up' : checkinRate >= 50 ? 'neutral' : 'down'}
          isLoading={isLoading}
        />
        <StatCard
          label="Open Incidents"
          value={openIncidents}
          icon={AlertTriangle}
          color="warning"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingExceptions}
          icon={Clock}
          color="secondary"
          isLoading={isLoading}
        />
      </div>

      {/* Readiness Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Readiness Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ReadinessCard
            label="Ready"
            count={greenCount}
            total={todayCheckins}
            color="success"
          />
          <ReadinessCard
            label="Caution"
            count={yellowCount}
            total={todayCheckins}
            color="warning"
          />
          <ReadinessCard
            label="At Risk"
            count={redCount}
            total={todayCheckins}
            color="danger"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-in Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Check-in Progress</h2>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary-600 bg-primary-100">
                  Today's Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-primary-600">
                  {todayCheckins}/{totalUsers}
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200">
              <div
                style={{ width: `${checkinRate}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{todayCheckins} checked in</span>
              <span>{totalUsers - todayCheckins} remaining</span>
            </div>
          </div>

          {/* Breakdown by status */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success-500" />
                <span className="text-sm text-gray-600">Green (Ready)</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{greenCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning-500" />
                <span className="text-sm text-gray-600">Yellow (Caution)</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{yellowCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-danger-500" />
                <span className="text-sm text-gray-600">Red (At Risk)</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{redCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-600">Not Checked In</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{totalUsers - todayCheckins}</span>
            </div>
          </div>
        </div>

        {/* Incidents & Exceptions Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Incidents & Approvals</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-warning-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning-500 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-warning-900">Open Incidents</p>
                  <p className="text-sm text-warning-600">Awaiting action</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-warning-700">{openIncidents}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-500 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-primary-900">Pending Approvals</p>
                  <p className="text-sm text-primary-600">Exception requests</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-primary-700">{pendingExceptions}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    secondary: 'bg-secondary-50 text-secondary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend === 'up' && 'text-success-600',
              trend === 'down' && 'text-danger-600',
              trend === 'neutral' && 'text-gray-500'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
          </div>
        )}
      </div>
      <div>
        {isLoading ? (
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ReadinessCard({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'success' | 'warning' | 'danger';
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    success: {
      bg: 'bg-success-50',
      text: 'text-success-700',
      bar: 'bg-success-500',
      icon: 'bg-success-500',
    },
    warning: {
      bg: 'bg-warning-50',
      text: 'text-warning-700',
      bar: 'bg-warning-500',
      icon: 'bg-warning-500',
    },
    danger: {
      bg: 'bg-danger-50',
      text: 'text-danger-700',
      bar: 'bg-danger-500',
      icon: 'bg-danger-500',
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={cn('p-4 rounded-xl', classes.bg)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', classes.icon)}>
          {color === 'success' && <CheckCircle2 className="h-5 w-5 text-white" />}
          {color === 'warning' && <AlertTriangle className="h-5 w-5 text-white" />}
          {color === 'danger' && <Activity className="h-5 w-5 text-white" />}
        </div>
        <span className={cn('text-2xl font-bold', classes.text)}>{count}</span>
      </div>
      <p className={cn('font-medium', classes.text)}>{label}</p>
      <div className="mt-2">
        <div className="h-2 bg-white/50 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', classes.bar)} style={{ width: `${percentage}%` }} />
        </div>
        <p className={cn('text-xs mt-1', classes.text)}>{percentage}% of check-ins</p>
      </div>
    </div>
  );
}
