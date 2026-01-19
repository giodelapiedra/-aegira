import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import { whsService } from '../../services/whs.service';
import { Pagination } from '../../components/ui/Pagination';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import {
  incidentStatusConfig,
  incidentSeverityConfig,
  incidentTypeConfig,
} from '../../lib/status-config';
import type { Incident } from '../../types/user';

type StatusFilter = '' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export function WHSMyIncidentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats (uses default 30s staleTime from App.tsx)
  const { data: stats } = useQuery({
    queryKey: ['whs', 'my-incidents', 'stats'],
    queryFn: whsService.getMyAssignedIncidentsStats,
  });

  // Fetch incidents with server-side filtering
  const { data, isLoading } = useQuery({
    queryKey: ['whs', 'my-incidents', { status: statusFilter, search: debouncedSearch, page, limit }],
    queryFn: () => whsService.getMyAssignedIncidents({
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page,
      limit,
    }),
  });

  const incidents = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Assigned Incidents</h1>
        <p className="text-gray-600 mt-1">Cases assigned to you by Supervisors</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={ClipboardList}
          value={stats?.total ?? 0}
          label="Total Assigned"
          color="primary"
        />
        <StatCard
          icon={Clock}
          value={stats?.active ?? 0}
          label="Active Cases"
          color="warning"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats?.resolved ?? 0}
          label="Resolved"
          color="success"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by case # or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} columns={6} />
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No incidents found</h3>
            <p className="text-gray-500">
              {search || statusFilter
                ? 'No incidents match your search or filter.'
                : 'You have no incidents assigned to you yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Case #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned By
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {incidents.map((incident: Incident) => {
                  const severity = incidentSeverityConfig[incident.severity] || incidentSeverityConfig.MEDIUM;
                  const status = incidentStatusConfig[incident.status] || incidentStatusConfig.OPEN;
                  const incidentType = incidentTypeConfig[incident.type] || incidentTypeConfig.OTHER;
                  const StatusIcon = status.icon;

                  return (
                    <tr
                      key={incident.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900">{incident.caseNumber}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={incident.reporter?.avatar}
                            firstName={incident.reporter?.firstName}
                            lastName={incident.reporter?.lastName}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {incident.reporter?.firstName} {incident.reporter?.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {incident.reporter?.team?.name || 'No Team'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700">{incidentType.label}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', severity.dotColor)} />
                          <span className={cn('text-sm font-medium', severity.textColor)}>
                            {severity.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={status.variant as 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'info' | 'default'} className="inline-flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm text-gray-900">
                            {incident.whsAssigner?.firstName} {incident.whsAssigner?.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {incident.whsAssignedAt ? formatDisplayDateTime(incident.whsAssignedAt) : '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incidents/${incident.id}`);
                          }}
                        >
                          Manage
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
