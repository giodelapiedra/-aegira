import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { SkeletonDashboard } from '../../components/ui/Skeleton';
import { SeverityBadge, IncidentStatusBadge } from '../../components/ui/StatusBadge';
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  ChevronRight,
  Clipboard,
} from 'lucide-react';
import { whsService } from '../../services/whs.service';
import { cn } from '../../lib/utils';

// Calculate days since a date
function getDaysAgo(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function WHSDashboard() {
  // Fetch my analytics summary for KPIs
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['whs', 'analytics', 'summary'],
    queryFn: whsService.getAnalyticsSummary,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch my assigned incidents
  const { data: myIncidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['whs', 'my-incidents', { limit: 7 }],
    queryFn: () => whsService.getMyAssignedIncidents({ limit: 7 }),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = summaryLoading || incidentsLoading;

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Shield className="h-6 w-6 text-primary-600" />
            </div>
            WHS Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Manage safety incidents and compliance</p>
        </div>
        <Link to="/whs/official-forms">
          <Button variant="primary">
            <FileText className="h-4 w-4 mr-2" />
            Official Forms
          </Button>
        </Link>
      </div>

      {/* KPI Cards - 5 cards for enterprise view */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={Clipboard}
          value={summary?.total || 0}
          label="My Cases"
          color="primary"
          description="Total assigned"
        />
        <StatCard
          icon={Activity}
          value={summary?.active || 0}
          label="Active"
          color="warning"
          description="Open + In Progress"
        />
        <StatCard
          icon={CheckCircle2}
          value={summary?.resolved || 0}
          label="Resolved"
          color="success"
          description="Closed cases"
        />
        <StatCard
          icon={AlertTriangle}
          value={summary?.overdue || 0}
          label="Overdue"
          color="danger"
          description="Exceeds SLA"
        />
        <StatCard
          icon={Clock}
          value={summary?.pendingRTW || 0}
          label="Pending RTW"
          color="gray"
          description="Need certificate"
        />
      </div>

      {/* My Assigned Cases - Full width, main focus */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              My Assigned Cases
            </CardTitle>
            <CardDescription>Cases requiring your attention</CardDescription>
          </div>
          <Link to="/whs/my-incidents">
            <Button variant="ghost" size="sm">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {myIncidents?.data && myIncidents.data.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {myIncidents.data.map((incident) => {
                const daysOpen = getDaysAgo(incident.whsAssignedAt);
                const isOverdue = daysOpen !== null && (
                  (incident.severity === 'CRITICAL' && daysOpen > 1) ||
                  (incident.severity === 'HIGH' && daysOpen > 3) ||
                  (incident.severity === 'MEDIUM' && daysOpen > 7) ||
                  (incident.severity === 'LOW' && daysOpen > 14)
                );

                return (
                  <Link
                    key={incident.id}
                    to={`/incidents/${incident.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500">{incident.caseNumber}</span>
                          <SeverityBadge severity={incident.severity} size="sm" />
                        </div>
                        <p className="font-medium text-gray-900 truncate">{incident.title}</p>
                        <p className="text-sm text-gray-500">
                          {incident.reporter?.firstName} {incident.reporter?.lastName}
                          {incident.reporter?.team?.name && ` • ${incident.reporter.team.name}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <IncidentStatusBadge status={incident.status} size="sm" />
                        {daysOpen !== null && (
                          <span className={cn(
                            'text-xs flex items-center gap-1',
                            isOverdue ? 'text-danger-600 font-medium' : 'text-gray-400'
                          )}>
                            <Clock className="h-3 w-3" />
                            {daysOpen}d
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-success-50 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-success-600" />
              </div>
              <p className="text-gray-600 font-medium">No cases assigned</p>
              <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
