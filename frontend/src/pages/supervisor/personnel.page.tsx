import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
  Palmtree,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import type { User } from '../../types/user';

interface CheckinData {
  userId: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  createdAt: string;
}

interface LeaveData {
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
}

export function PersonnelPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Get only MEMBER users with a team (personnel who can check in)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['all-personnel', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('role', 'MEMBER');
      params.append('limit', '200');
      const response = await api.get(`/users?${params.toString()}`);
      return response.data;
    },
  });

  // Get today's check-ins
  const { data: checkinsData } = useQuery({
    queryKey: ['all-checkins-today'],
    queryFn: async () => {
      const response = await api.get('/checkins?limit=500');
      return response.data;
    },
  });

  // Get approved leave for today
  const { data: leaveData } = useQuery({
    queryKey: ['approved-leave-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/exceptions?status=APPROVED&activeOn=${today}&limit=500`);
      return response.data;
    },
  });

  const allUsers: User[] = usersData?.data || [];
  const checkins: CheckinData[] = checkinsData?.data || [];
  const leaveExceptions: LeaveData[] = (leaveData?.data || []).map((e: any) => ({
    userId: e.userId,
    type: e.type,
    startDate: e.startDate,
    endDate: e.endDate,
  }));

  // Filter to only show MEMBERs/WORKERs with a team assigned
  const users = allUsers.filter((user) => (user.role === 'MEMBER' || user.role === 'WORKER') && user.teamId);

  // Create checkin map
  const checkinMap = new Map(checkins.map((c) => [c.userId, c]));

  // Create leave map (user is on approved leave today)
  const leaveMap = new Map(leaveExceptions.map((e) => [e.userId, e]));

  // Filter by check-in status if needed
  const filteredUsers = users.filter((user) => {
    if (!statusFilter) return true;
    const checkin = checkinMap.get(user.id);
    const isOnLeave = leaveMap.has(user.id);
    if (statusFilter === 'ON_LEAVE') return isOnLeave;
    if (statusFilter === 'NOT_CHECKED_IN') return !checkin && !isOnLeave;
    return checkin?.readinessStatus === statusFilter;
  });

  // Calculate stats
  const totalUsers = users.length;
  const onLeaveCount = users.filter((u) => leaveMap.has(u.id)).length;
  const greenCount = users.filter((u) => checkinMap.get(u.id)?.readinessStatus === 'GREEN').length;
  const yellowCount = users.filter((u) => checkinMap.get(u.id)?.readinessStatus === 'YELLOW').length;
  const redCount = users.filter((u) => checkinMap.get(u.id)?.readinessStatus === 'RED').length;
  const notCheckedInCount = users.filter((u) => !checkinMap.has(u.id) && !leaveMap.has(u.id)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-500 mt-1">View and monitor team members' daily check-in status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-primary-500" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-success-500" />
            <span className="text-sm text-gray-500">Green</span>
          </div>
          <p className="text-2xl font-bold text-success-600">{greenCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            <span className="text-sm text-gray-500">Yellow</span>
          </div>
          <p className="text-2xl font-bold text-warning-600">{yellowCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-danger-500" />
            <span className="text-sm text-gray-500">Red</span>
          </div>
          <p className="text-2xl font-bold text-danger-600">{redCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Palmtree className="h-5 w-5 text-primary-500" />
            <span className="text-sm text-gray-500">On Leave</span>
          </div>
          <p className="text-2xl font-bold text-primary-600">{onLeaveCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-500">Not Checked In</span>
          </div>
          <p className="text-2xl font-bold text-gray-600">{notCheckedInCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        >
          <option value="">All Status</option>
          <option value="GREEN">Green</option>
          <option value="YELLOW">Yellow</option>
          <option value="RED">Red</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="NOT_CHECKED_IN">Not Checked In</option>
        </select>
      </div>

      {/* Personnel Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {usersLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading personnel...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
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
                {filteredUsers.map((user) => {
                  const checkin = checkinMap.get(user.id);
                  const leave = leaveMap.get(user.id);
                  const isOnLeave = !!leave && !checkin;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {user.firstName.charAt(0)}
                              {user.lastName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.team?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {checkin ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                              checkin.readinessStatus === 'GREEN' &&
                                'bg-success-100 text-success-700',
                              checkin.readinessStatus === 'YELLOW' &&
                                'bg-warning-100 text-warning-700',
                              checkin.readinessStatus === 'RED' && 'bg-danger-100 text-danger-700'
                            )}
                          >
                            {checkin.readinessStatus === 'GREEN' && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {checkin.readinessStatus === 'YELLOW' && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {checkin.readinessStatus === 'RED' && <Activity className="h-3 w-3" />}
                            {checkin.readinessStatus}
                          </span>
                        ) : isOnLeave ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                            <Palmtree className="h-3 w-3" />
                            On Leave
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <Clock className="h-3 w-3" />
                            Not Checked In
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {checkin ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  checkin.readinessScore >= 70
                                    ? 'bg-success-500'
                                    : checkin.readinessScore >= 40
                                    ? 'bg-warning-500'
                                    : 'bg-danger-500'
                                )}
                                style={{ width: `${checkin.readinessScore}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{checkin.readinessScore}%</span>
                          </div>
                        ) : isOnLeave ? (
                          <span className="text-sm text-primary-500">
                            {leave.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
