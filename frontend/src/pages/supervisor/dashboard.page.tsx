import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { CheckCircle2, AlertTriangle, Clock, UserPlus, ChevronRight } from 'lucide-react';
import { formatDisplayDate } from '../../lib/date-utils';
import { cn } from '../../lib/utils';
import { supervisorService } from '../../services/supervisor.service';

// Severity config for badges
const severityConfig: Record<string, { label: string; variant: 'danger' | 'warning' | 'default' }> = {
  CRITICAL: { label: 'Critical', variant: 'danger' },
  HIGH: { label: 'High', variant: 'danger' },
  MEDIUM: { label: 'Medium', variant: 'warning' },
  LOW: { label: 'Low', variant: 'default' },
};

const typeLabels: Record<string, string> = {
  INJURY: 'Injury',
  ILLNESS: 'Illness',
  MENTAL_HEALTH: 'Mental Health',
  MEDICAL_EMERGENCY: 'Medical Emergency',
  HEALTH_SAFETY: 'Health & Safety',
  OTHER: 'Other',
};

// Incident status config
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  RESOLVED: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-50' },
  CLOSED: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

export function SupervisorDashboard() {
  const navigate = useNavigate();

  // Incident stats - single source of truth for all stats
  const { data: incidentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['supervisor-incidents-stats'],
    queryFn: () => supervisorService.getIncidentStats(),
    staleTime: 60 * 1000,
  });

  // Pending incidents for table (limit 5 for dashboard overview)
  const { data: pendingIncidents, isLoading: pendingLoading } = useQuery({
    queryKey: ['supervisor-incidents', 'pending', 1, 5],
    queryFn: () => supervisorService.getPendingIncidents({ page: 1, limit: 5 }),
    staleTime: 60 * 1000,
  });

  // Recently assigned incidents (limit 3 for dashboard overview)
  const { data: assignedIncidents, isLoading: assignedLoading } = useQuery({
    queryKey: ['supervisor-incidents', 'assigned', 1, 3],
    queryFn: () => supervisorService.getAssignedIncidents({ page: 1, limit: 3 }),
    staleTime: 60 * 1000,
  });

  const hasPending = (incidentStats?.pending || 0) > 0;
  const hasUrgent = (incidentStats?.urgent || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage incident assignments to WHS officers</p>
      </div>

      {/* Incident Stats - Only 3 cards, focused on supervisor's job */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          value={statsLoading ? '-' : incidentStats?.pending || 0}
          label="Pending"
          color={hasPending ? 'warning' : 'gray'}
        />
        <StatCard
          icon={AlertTriangle}
          value={statsLoading ? '-' : incidentStats?.urgent || 0}
          label="Urgent"
          color={hasUrgent ? 'danger' : 'gray'}
        />
        <StatCard
          icon={CheckCircle2}
          value={statsLoading ? '-' : incidentStats?.assigned || 0}
          label="Assigned"
          color="success"
        />
      </div>

      {/* Pending Incidents Table */}
      <Card>
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning-500" />
              Pending Incidents
              {hasPending && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-warning-100 text-warning-700 rounded-full">
                  {incidentStats?.pending}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/supervisor/incidents-assignment')}
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pendingLoading ? (
            <SkeletonTable rows={3} columns={5} />
          ) : !pendingIncidents?.data?.length ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success-500 mx-auto mb-3" />
              <p className="text-gray-900 font-medium">All caught up!</p>
              <p className="text-gray-500 text-sm mt-1">No incidents pending assignment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Case</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingIncidents.data.map((incident) => {
                    const severity = severityConfig[incident.severity] || severityConfig.LOW;
                    const isUrgent = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';

                    return (
                      <tr
                        key={incident.id}
                        className={cn(
                          'hover:bg-gray-50 cursor-pointer transition-colors',
                          isUrgent && 'bg-red-50/30'
                        )}
                        onClick={() => navigate(`/incidents/${incident.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isUrgent && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                              </span>
                            )}
                            <span className="font-medium text-gray-900">{incident.caseNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={incident.reporter?.avatar}
                              firstName={incident.reporter?.firstName}
                              lastName={incident.reporter?.lastName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {incident.reporter?.firstName} {incident.reporter?.lastName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {incident.reporter?.team?.name || 'No Team'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-gray-700">
                            {typeLabels[incident.type] || incident.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={severity.variant} size="sm">
                            {severity.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-gray-500">
                            {formatDisplayDate(incident.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant={isUrgent ? 'danger' : 'primary'}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/supervisor/incidents-assignment');
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Assign</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer with count */}
          {pendingIncidents?.pagination && pendingIncidents.pagination.total > 5 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-center">
              <button
                onClick={() => navigate('/supervisor/incidents-assignment')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View all {pendingIncidents.pagination.total} pending incidents →
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Assigned Incidents */}
      <Card>
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-500" />
              Recently Assigned
              {(incidentStats?.assigned || 0) > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-success-100 text-success-700 rounded-full">
                  {incidentStats?.assigned}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/supervisor/incidents-assignment')}
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {assignedLoading ? (
            <SkeletonTable rows={2} columns={6} />
          ) : !assignedIncidents?.data?.length ? (
            <div className="p-8 text-center">
              <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No assigned incidents yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Case</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">WHS Officer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Assigned By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignedIncidents.data.map((incident) => {
                    const severity = severityConfig[incident.severity] || severityConfig.LOW;
                    const status = statusConfig[incident.status] || statusConfig.OPEN;

                    return (
                      <tr
                        key={incident.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/incidents/${incident.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{incident.caseNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={incident.reporter?.avatar}
                              firstName={incident.reporter?.firstName}
                              lastName={incident.reporter?.lastName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {incident.reporter?.firstName} {incident.reporter?.lastName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant={severity.variant} size="sm">
                            {severity.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={incident.whsOfficer?.avatar}
                              firstName={incident.whsOfficer?.firstName}
                              lastName={incident.whsOfficer?.lastName}
                              size="sm"
                            />
                            <span className="text-sm text-gray-700 truncate">
                              {incident.whsOfficer?.firstName} {incident.whsOfficer?.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-gray-700">
                            {incident.whsAssigner?.firstName} {incident.whsAssigner?.lastName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-1 text-xs font-medium rounded-full', status.bg, status.color)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-sm text-gray-500">
                            {incident.whsAssignedAt ? formatDisplayDate(incident.whsAssignedAt) : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer with count */}
          {assignedIncidents?.pagination && assignedIncidents.pagination.total > 3 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-center">
              <button
                onClick={() => navigate('/supervisor/incidents-assignment')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View all {assignedIncidents.pagination.total} assigned incidents →
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
