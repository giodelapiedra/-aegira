/**
 * Admin Dashboard Page
 * Uses centralized components and utilities - no duplicate code
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  ChevronRight,
  Shield,
  ScrollText,
  UserCog,
  BarChart3,
  FileText,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';
import { formatRelativeTime, formatDisplayDateTime } from '../../lib/date-utils';
import { Avatar } from '../../components/ui/Avatar';
import { analyticsService } from '../../services/analytics.service';
import { systemLogsService, getActionColor } from '../../services/system-logs.service';
import api from '../../services/api';

// Import reusable components
import { StatCard, StatCardGrid } from '../../components/ui/StatCard';
import { Skeleton, SkeletonDashboard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

// ============================================
// TYPES
// ============================================

interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  checkinRate: number;
  greenCount: number;
  redCount: number;
  openIncidents: number;
  pendingExceptions: number;
}

// ============================================
// QUICK ACTIONS CONFIG
// ============================================

const quickActions = [
  {
    label: 'PDF Templates',
    description: 'Create and manage PDF templates for WHS',
    icon: FileText,
    href: '/admin/templates',
    color: 'bg-primary-500',
  },
  {
    label: 'System Logs',
    description: 'View activity logs and user activity',
    icon: ScrollText,
    href: '/system-logs',
    color: 'bg-success-500',
  },
];

// ============================================
// COMPONENT
// ============================================

export function AdminDashboard() {
  const { user, company } = useUser();

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      const [dashboardStats, teamsRes] = await Promise.all([
        analyticsService.getDashboardStats(),
        api.get('/teams'),
      ]);

      return {
        totalUsers: dashboardStats.totalMembers,
        totalTeams: teamsRes.data?.length || 0,
        checkinRate: dashboardStats.checkinRate,
        greenCount: dashboardStats.greenCount,
        redCount: dashboardStats.redCount,
        openIncidents: dashboardStats.openIncidents,
        pendingExceptions: dashboardStats.pendingExceptions,
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch recent system logs
  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-recent-logs'],
    queryFn: async () => {
      const response = await systemLogsService.getLogs({ limit: 5 });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - logs don't need real-time updates
  });

  // Fetch log statistics
  const { data: logStats } = useQuery({
    queryKey: ['admin-log-stats'],
    queryFn: () => systemLogsService.getStats(),
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch recent check-ins
  const { data: recentCheckins, isLoading: checkinsLoading } = useQuery({
    queryKey: ['admin-recent-checkins'],
    queryFn: () => analyticsService.getRecentCheckins(10),
    staleTime: 2 * 60 * 1000, // 2 minutes - recent checkins can be slightly stale
  });

  return (
    <div className="w-full space-y-6">
      {/* Welcome Banner */}
      <WelcomeBanner userName={user?.firstName} companyName={company?.name} />

      {/* Stats Grid - Using Centralized StatCard */}
      <StatCardGrid columns={4}>
        <StatCard
          icon={Users}
          value={stats?.totalUsers || 0}
          label="Total Personnel"
          color="primary"
          isLoading={statsLoading}
        />
        <StatCard
          icon={CheckCircle2}
          value={stats?.greenCount || 0}
          label="Green Status"
          color="success"
          isLoading={statsLoading}
        />
        <StatCard
          icon={XCircle}
          value={stats?.redCount || 0}
          label="At Risk"
          color="danger"
          isLoading={statsLoading}
        />
      </StatCardGrid>

      {/* Secondary Stats - Using Centralized StatCard */}
      <StatCardGrid columns={3}>
        <StatCard
          icon={Activity}
          value={`${stats?.checkinRate || 0}%`}
          label="Check-in Rate"
          color="primary"
          isLoading={statsLoading}
        />
        <StatCard
          icon={FileText}
          value={stats?.pendingExceptions || 0}
          label="Pending Exceptions"
          color="warning"
          isLoading={statsLoading}
        />
        <StatCard
          icon={AlertTriangle}
          value={stats?.openIncidents || 0}
          label="Open Incidents"
          color="danger"
          isLoading={statsLoading}
        />
      </StatCardGrid>

      {/* Quick Actions */}
      <QuickActionsGrid actions={quickActions} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recent Activity */}
        <RecentActivityCard logs={recentLogs} isLoading={logsLoading} />

        {/* Company Overview */}
        <CompanyOverviewCard stats={stats} logStats={logStats} isLoading={statsLoading} />
      </div>

      {/* Readiness Distribution */}
      <ReadinessDistributionCard stats={stats} />

      {/* Recent Check-ins */}
      <RecentCheckinsCard checkins={recentCheckins} isLoading={checkinsLoading} />
    </div>
  );
}

// ============================================
// SUB-COMPONENTS (Private to this page)
// ============================================

function WelcomeBanner({ userName, companyName }: { userName?: string; companyName?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Admin Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold mb-1 text-gray-900">Welcome back, {userName}!</h1>
          <p className="text-gray-600">
            Managing <span className="font-semibold text-gray-900">{companyName}</span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
          <UserCog className="h-5 w-5 text-gray-700" />
          <span className="font-medium text-gray-900">Administrator</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionsGrid({ actions }: { actions: typeof quickActions }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="group bg-white rounded-xl p-5 border border-gray-200 hover:border-primary-200 hover:shadow-lg transition-all duration-200 h-full flex flex-col"
          >
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-4 flex-shrink-0', action.color)}>
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
              {action.label}
            </h3>
            <p className="text-sm text-gray-500 mt-1 flex-1">{action.description}</p>
            <div className="flex items-center gap-1 text-primary-600 text-sm font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Go to</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentActivityCard({ logs, isLoading }: { logs?: any[]; isLoading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        <Link
          to="/system-logs"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <SkeletonDashboard />
        ) : logs && logs.length > 0 ? (
          <div className="space-y-3">
            {logs.map((log) => (
              <ActivityLogItem key={log.id} log={log} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ScrollText}
            title="No recent activity"
            variant="compact"
          />
        )}
      </div>
    </div>
  );
}

function ActivityLogItem({ log }: { log: any }) {
  const colorClass = getActionColor(log.action);
  const colorStyles = {
    success: 'bg-success-100 text-success-600',
    danger: 'bg-danger-100 text-danger-600',
    warning: 'bg-warning-100 text-warning-600',
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', colorStyles[colorClass as keyof typeof colorStyles] || colorStyles.secondary)}>
        <Activity className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 line-clamp-1">{log.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CompanyOverviewCard({
  stats,
  logStats,
  isLoading
}: {
  stats?: AdminStats;
  logStats?: any;
  isLoading: boolean;
}) {
  const overviewItems = [
    {
      icon: Users,
      iconBg: 'bg-primary-100',
      iconColor: 'text-primary-600',
      label: 'Active Team Members',
      value: stats?.totalUsers || 0,
    },
    {
      icon: BarChart3,
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      label: "Today's Check-in Rate",
      value: `${stats?.checkinRate || 0}%`,
    },
    {
      icon: AlertTriangle,
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      label: 'Pending Actions',
      value: (stats?.pendingExceptions || 0) + (stats?.openIncidents || 0),
    },
    {
      icon: Activity,
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-600',
      label: 'Activity This Week',
      value: logStats?.weekLogs || 0,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">Company Overview</h2>
      <div className="space-y-4 flex-1">
        {overviewItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', item.iconBg)}>
                <item.icon className={cn('h-4 w-4', item.iconColor)} />
              </div>
              <span className="text-sm text-gray-600">{item.label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-10" />
            ) : (
              <span className="font-semibold text-gray-900">{item.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessDistributionCard({ stats }: { stats?: AdminStats }) {
  const distribution = [
    { label: 'Ready', count: stats?.greenCount || 0, textColor: 'text-success-600' },
    { label: 'At Risk', count: stats?.redCount || 0, textColor: 'text-danger-600' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Readiness Distribution</h2>
      <div className="space-y-4">
        {distribution.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-sm text-gray-500">{item.count} personnel</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', item.textColor.replace('text-', 'bg-'))}
                style={{
                  width: `${stats && stats.totalUsers > 0 ? (item.count / stats.totalUsers) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentCheckinsCard({ checkins, isLoading }: { checkins?: any[]; isLoading: boolean }) {
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
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Check-ins</h2>
      </div>

      {isLoading ? (
        <SkeletonDashboard />
      ) : checkins && checkins.length > 0 ? (
        <div className="space-y-4">
          {checkins.map((checkin) => (
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
        <EmptyState
          icon={Clock}
          title="No recent check-ins"
          variant="compact"
        />
      )}
    </div>
  );
}
