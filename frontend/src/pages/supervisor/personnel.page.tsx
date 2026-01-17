import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  CheckCircle2,
  Activity,
  Clock,
  Palmtree,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { StatCard } from '../../components/ui/StatCard';
import { cn } from '../../lib/utils';
import { supervisorService, type PersonnelMember } from '../../services/supervisor.service';

export function PersonnelPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
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

  // Get stats (server-side)
  const { data: stats } = useQuery({
    queryKey: ['supervisor-personnel-stats'],
    queryFn: () => supervisorService.getPersonnelStats(),
    refetchInterval: 30000,
  });

  // Get personnel list (server-side filtered)
  const { data: personnelData, isLoading } = useQuery({
    queryKey: ['supervisor-personnel', debouncedSearch, statusFilter, page, limit],
    queryFn: () => supervisorService.getPersonnel({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      page,
      limit,
    }),
  });

  const personnel = personnelData?.data || [];
  const pagination = personnelData?.pagination;

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-500 mt-1">View and monitor team members' daily check-in status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={Users}
          value={stats?.total ?? 0}
          label="Total"
          color="primary"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats?.green ?? 0}
          label="Green"
          color="success"
        />
        <StatCard
          icon={Activity}
          value={stats?.red ?? 0}
          label="Red"
          color="danger"
        />
        <StatCard
          icon={Palmtree}
          value={stats?.onLeave ?? 0}
          label="On Leave"
          color="primary"
        />
        <StatCard
          icon={Clock}
          value={stats?.notCheckedIn ?? 0}
          label="Not Checked In"
          color="gray"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        >
          <option value="">All Status</option>
          <option value="GREEN">Green</option>
          <option value="RED">Red</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="NOT_CHECKED_IN">Not Checked In</option>
        </select>
      </div>

      {/* Personnel Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={8} columns={4} />
        ) : personnel.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No personnel found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Today's Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Readiness Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {personnel.map((member: PersonnelMember) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar
                          firstName={member.firstName}
                          lastName={member.lastName}
                          size="md"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.team?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.currentStatus === 'GREEN' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                          <CheckCircle2 className="h-3 w-3" />
                          GREEN
                        </span>
                      )}
                      {member.currentStatus === 'RED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                          <Activity className="h-3 w-3" />
                          RED
                        </span>
                      )}
                      {member.currentStatus === 'ON_LEAVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                          <Palmtree className="h-3 w-3" />
                          On Leave
                        </span>
                      )}
                      {member.currentStatus === 'NOT_CHECKED_IN' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <Clock className="h-3 w-3" />
                          Not Checked In
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.checkin ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                member.checkin.readinessScore >= 70
                                  ? 'bg-success-500'
                                  : member.checkin.readinessScore >= 40
                                  ? 'bg-warning-500'
                                  : 'bg-danger-500'
                              )}
                              style={{ width: `${member.checkin.readinessScore}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{member.checkin.readinessScore}%</span>
                        </div>
                      ) : member.leave ? (
                        <span className="text-sm text-primary-500">
                          {member.leave.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
