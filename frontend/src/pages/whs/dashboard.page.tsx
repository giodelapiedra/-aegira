import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Activity,
} from 'lucide-react';
import { whsService, type WHSDashboardData } from '../../services/whs.service';

export function WHSDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['whs', 'dashboard'],
    queryFn: () => whsService.getDashboard(),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto mb-3" />
        <p className="text-gray-500">Failed to load WHS dashboard</p>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary-600" />
            WHS Control Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Fill forms and manage safety compliance</p>
        </div>
        <Link to="/whs/fill-forms">
          <Button variant="primary">
            <FileText className="h-4 w-4 mr-2" />
            Fill Forms
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary-50 to-white border-primary-200">
          <div className="text-center py-4">
            <FileText className="h-8 w-8 text-primary-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-primary-700">{stats?.totalMembers || 0}</p>
            <p className="text-sm text-primary-600">Total Members</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-warning-50 to-white border-warning-200">
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-warning-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-warning-700">{stats?.openIncidents || 0}</p>
            <p className="text-sm text-warning-600">Open Incidents</p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safety Incidents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger-500" />
              Safety Incidents
            </CardTitle>
            <Link to="/team/incidents" className="text-sm text-primary-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {data?.safetyIncidents && data.safetyIncidents.length > 0 ? (
              <div className="space-y-3">
                {data.safetyIncidents.slice(0, 5).map((incident) => (
                  <Link
                    key={incident.id}
                    to={`/incidents/${incident.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500">{incident.caseNumber}</span>
                        </div>
                        <p className="font-medium text-gray-900 truncate mt-1">{incident.title}</p>
                        <p className="text-sm text-gray-500">{incident.team}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          incident.severity === 'CRITICAL' && 'bg-danger-100 text-danger-700',
                          incident.severity === 'HIGH' && 'bg-orange-100 text-orange-700',
                          incident.severity === 'MEDIUM' && 'bg-warning-100 text-warning-700',
                          incident.severity === 'LOW' && 'bg-gray-100 text-gray-700'
                        )}>
                          {incident.severity}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          incident.status === 'OPEN' && 'bg-danger-100 text-danger-700',
                          incident.status === 'IN_PROGRESS' && 'bg-warning-100 text-warning-700'
                        )}>
                          {incident.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-success-300 mx-auto mb-3" />
                <p className="text-gray-500">No open safety incidents</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2">
                    <div className={cn(
                      'p-1.5 rounded-full',
                      activity.action.includes('VERIFIED') && 'bg-success-100',
                      activity.action.includes('UPLOADED') && 'bg-primary-100',
                      activity.action.includes('REJECTED') && 'bg-danger-100',
                      activity.action.includes('GENERATED') && 'bg-primary-100'
                    )}>
                      <Activity className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-400">{formatDisplayDateTime(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/whs/fill-forms"
              className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
            >
              <FileText className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">Fill Forms</p>
              <p className="text-sm text-gray-500">Generate RTW certificates and other forms</p>
            </Link>
            <Link
              to="/team/incidents"
              className="p-4 rounded-lg border border-gray-200 hover:border-danger-300 hover:bg-danger-50 transition-colors text-left"
            >
              <AlertTriangle className="h-6 w-6 text-danger-600 mb-2" />
              <p className="font-medium text-gray-900">Safety Incidents</p>
              <p className="text-sm text-gray-500">View and manage incidents</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
