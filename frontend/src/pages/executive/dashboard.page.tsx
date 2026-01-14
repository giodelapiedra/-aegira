import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Activity,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Building2,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';
import { analyticsService } from '../../services/analytics.service';

interface CompanyStats {
  totalUsers: number;
  activeUsers: number;
  todayCheckins: number;
  checkinRate: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  openIncidents: number;
  pendingExceptions: number;
}

export function ExecutiveDashboard() {
  const { user, company } = useUser();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['executive-stats'],
    queryFn: async () => {
      const dashboardStats = await analyticsService.getDashboardStats();

      return {
        totalUsers: dashboardStats.totalMembers,
        activeUsers: dashboardStats.totalMembers,
        todayCheckins: dashboardStats.greenCount + dashboardStats.yellowCount + dashboardStats.redCount,
        checkinRate: dashboardStats.checkinRate,
        greenCount: dashboardStats.greenCount,
        yellowCount: dashboardStats.yellowCount,
        redCount: dashboardStats.redCount,
        openIncidents: dashboardStats.openIncidents,
        pendingExceptions: dashboardStats.pendingExceptions,
      } as CompanyStats;
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="h-10 w-10 text-danger-500 mb-3" />
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  const quickActions = [
    {
      label: 'Create Account',
      description: 'Create new user accounts directly',
      icon: UserPlus,
      href: '/executive/create-account',
      color: 'bg-primary-500',
    },
    {
      label: 'Manage Users',
      description: 'View and manage company users',
      icon: Users,
      href: '/executive/users',
      color: 'bg-secondary-500',
    },
    {
      label: 'View Dashboard',
      description: 'See company-wide analytics',
      icon: Activity,
      href: '/dashboard',
      color: 'bg-success-500',
    },
    {
      label: 'Company Settings',
      description: 'Configure company preferences',
      icon: Building2,
      href: '/executive/settings',
      color: 'bg-warning-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-200 mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Executive Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="text-primary-100">
              Managing <span className="font-semibold">{company?.name}</span>
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
            <Building2 className="h-5 w-5" />
            <span className="font-medium">{company?.name}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          color="primary"
          isLoading={isLoading}
        />
        <StatCard
          label="Check-in Rate"
          value={`${stats?.checkinRate || 0}%`}
          icon={TrendingUp}
          color="success"
          isLoading={isLoading}
        />
        <StatCard
          label="Open Incidents"
          value={stats?.openIncidents || 0}
          icon={AlertTriangle}
          color="danger"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending Approvals"
          value={stats?.pendingExceptions || 0}
          icon={CheckCircle2}
          color="secondary"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="group bg-white rounded-xl p-5 border border-gray-200 hover:border-primary-200 hover:shadow-lg transition-all duration-200"
            >
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center mb-4',
                action.color
              )}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {action.label}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{action.description}</p>
              <div className="flex items-center gap-1 text-primary-600 text-sm font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Go to</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Company Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary-600" />
                </div>
                <span className="text-sm text-gray-600">Active Team Members</span>
              </div>
              <span className="font-semibold text-gray-900">{stats?.totalUsers || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-success-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-success-600" />
                </div>
                <span className="text-sm text-gray-600">Today's Check-in Rate</span>
              </div>
              <span className="font-semibold text-gray-900">{stats?.checkinRate || 0}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-warning-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-warning-600" />
                </div>
                <span className="text-sm text-gray-600">Pending Actions</span>
              </div>
              <span className="font-semibold text-gray-900">
                {stats?.pendingExceptions || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
          <div className="space-y-3">
            <ChecklistItem
              label="Create your company"
              completed={true}
            />
            <ChecklistItem
              label="Add team members"
              completed={(stats?.totalUsers || 0) > 1}
              href="/executive/create-account"
            />
            <ChecklistItem
              label="Set up teams"
              completed={false}
              href="/executive/teams"
            />
            <ChecklistItem
              label="Configure company settings"
              completed={false}
              href="/executive/settings"
            />
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
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
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

function ChecklistItem({
  label,
  completed,
  href,
}: {
  label: string;
  completed: boolean;
  href?: string;
}) {
  const content = (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg transition-colors',
      completed ? 'bg-success-50' : 'bg-gray-50',
      href && !completed && 'hover:bg-gray-100 cursor-pointer'
    )}>
      <div className={cn(
        'h-6 w-6 rounded-full flex items-center justify-center',
        completed ? 'bg-success-500' : 'bg-gray-300'
      )}>
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-white" />
        ) : (
          <div className="h-2 w-2 bg-white rounded-full" />
        )}
      </div>
      <span className={cn(
        'text-sm',
        completed ? 'text-success-700 line-through' : 'text-gray-700'
      )}>
        {label}
      </span>
      {href && !completed && (
        <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
      )}
    </div>
  );

  if (href && !completed) {
    return <Link to={href}>{content}</Link>;
  }

  return content;
}
