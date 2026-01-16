import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { SkeletonDashboard } from '../../components/ui/Skeleton';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileText,
  
} from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';

export function SupervisorDashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => analyticsService.getDashboardStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes - dashboard stats don't need real-time updates
  });

  const { data: recentCheckins, isLoading: _checkinsLoading } = useQuery({
    queryKey: ['dashboard', 'recentCheckins'],
    queryFn: () => analyticsService.getRecentCheckins(10),
    staleTime: 2 * 60 * 1000, // 2 minutes - recent checkins can be slightly stale
  });

  if (statsLoading) {
    return <SkeletonDashboard />;
  }

  if (statsError) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto mb-3" />
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Personnel',
      value: stats?.totalMembers || 0,
      icon: Users,
      color: 'bg-primary-500',
      change: '+3',
      trend: 'up',
    },
    {
      label: 'Green Status',
      value: stats?.greenCount || 0,
      icon: CheckCircle2,
      color: 'bg-success-500',
      percentage: stats && stats.totalMembers > 0 ? Math.round((stats.greenCount / stats.totalMembers) * 100) : 0,
    },
    {
      label: 'Yellow Status',
      value: stats?.yellowCount || 0,
      icon: AlertTriangle,
      color: 'bg-warning-500',
      percentage: stats && stats.totalMembers > 0 ? Math.round((stats.yellowCount / stats.totalMembers) * 100) : 0,
    },
    {
      label: 'Red Status',
      value: stats?.redCount || 0,
      icon: XCircle,
      color: 'bg-danger-500',
      percentage: stats && stats.totalMembers > 0 ? Math.round((stats.redCount / stats.totalMembers) * 100) : 0,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'bg-success-500';
      case 'YELLOW':
        return 'bg-warning-500';
      case 'RED':
        return 'bg-danger-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Personnel readiness overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                {stat.percentage !== undefined && (
                  <p className="text-sm text-gray-500 mt-1">{stat.percentage}% of total</p>
                )}
                {stat.change && (
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 text-sm mt-2',
                      stat.trend === 'up' ? 'text-success-600' : 'text-danger-600'
                    )}
                  >
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {stat.change} this week
                  </div>
                )}
              </div>
              <div className={cn('p-3 rounded-lg', stat.color)}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary-100">
              <Activity className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.checkinRate || 0}%</p>
              <p className="text-sm text-gray-500">Today's Check-in Rate</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning-100">
              <FileText className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingExceptions || 0}</p>
              <p className="text-sm text-gray-500">Pending Exceptions</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-danger-100">
              <AlertTriangle className="h-6 w-6 text-danger-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.openIncidents || 0}</p>
              <p className="text-sm text-gray-500">Open Incidents</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Readiness Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              Readiness Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Green */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Ready (Green)</span>
                  <span className="text-sm text-gray-500">
                    {stats?.greenCount || 0} personnel
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats ? (stats.greenCount / stats.totalMembers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Yellow */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Caution (Yellow)</span>
                  <span className="text-sm text-gray-500">
                    {stats?.yellowCount || 0} personnel
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats ? (stats.yellowCount / stats.totalMembers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Red */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Not Ready (Red)</span>
                  <span className="text-sm text-gray-500">
                    {stats?.redCount || 0} personnel
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-danger-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${stats ? (stats.redCount / stats.totalMembers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Check-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Recent Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckins && recentCheckins.length > 0 ? (
              <div className="space-y-4">
                {recentCheckins.map((checkin) => (
                  <div key={checkin.id} className="flex items-center gap-3">
                    <Avatar
                      firstName={checkin.user.firstName}
                      lastName={checkin.user.lastName}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {checkin.user.firstName} {checkin.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDisplayDateTime(checkin.createdAt)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        getStatusColor(checkin.readinessStatus)
                      )}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent check-ins</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left">
              <Users className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">View Team</p>
              <p className="text-sm text-gray-500">See all members</p>
            </button>
            <button className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left">
              <FileText className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">Approvals</p>
              <p className="text-sm text-gray-500">Review requests</p>
            </button>
            <button className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left">
              <AlertTriangle className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">Incidents</p>
              <p className="text-sm text-gray-500">View reports</p>
            </button>
            <button className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left">
              <TrendingUp className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">Analytics</p>
              <p className="text-sm text-gray-500">View trends</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
