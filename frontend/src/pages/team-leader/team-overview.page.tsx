/**
 * Team Overview Page - Clean UI Design
 *
 * Shows team members with clean card-based layout.
 * Keeps all functionality: view profile, transfer team, deactivate.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  
  UserCheck,
  UserPlus,
  UserMinus,
  X,
  Building2,
  MoreHorizontal,
  Eye,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Skeleton, SkeletonDashboard } from '../../components/ui/Skeleton';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import api from '../../services/api';
import { useUser } from '../../hooks/useUser';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
  currentStreak?: number;
  longestStreak?: number;
  checkinCount?: number;
  isActive?: boolean;
}

interface TeamStats {
  totalMembers: number;
  checkedIn: number;
  notCheckedIn: number;
  isWorkDay?: boolean;
  isHoliday?: boolean;
  holidayName?: string | null;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExceptions: number;
  openIncidents: number;
  checkinRate: number;
  avgReadinessScore?: number | null;
  onLeaveCount?: number;
}

interface TodayCheckin {
  id: string;
  userId: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface AvailableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
  teamId: string | null;
}

export function TeamOverviewPage() {
  const navigate = useNavigate();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const toast = useToast();

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Check if current user is the team leader
  const isTeamLeader = team?.leader?.id === currentUser?.id;

  // Get team stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['team-stats', team?.id],
    queryFn: async () => {
      const response = await api.get(`/teams/${team.id}/stats`);
      return response.data as TeamStats;
    },
    enabled: !!team?.id,
    staleTime: 60 * 1000,
  });

  // Get today's check-ins for team
  const { data: checkinsData } = useQuery({
    queryKey: ['team-checkins', team?.id],
    queryFn: async () => {
      const response = await api.get(`/checkins?teamId=${team.id}&limit=50`);
      return response.data;
    },
    enabled: !!team?.id,
    staleTime: 30 * 1000,
  });

  // Fetch available users (MEMBER role only, not in any team)
  const { data: usersData } = useQuery({
    queryKey: ['available-users'],
    queryFn: async () => {
      const response = await api.get('/users?limit=100');
      return response.data;
    },
    enabled: showAddMemberModal && isTeamLeader,
    staleTime: 60 * 1000,
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/teams/${team.id}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['available-users'] });
      toast.success('Member Added', 'The member has been added to the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to add member. Please try again.');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/teams/${team.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['available-users'] });
      setShowRemoveMemberConfirm(false);
      setSelectedMember(null);
      toast.success('Member Removed', 'The member has been removed from the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to remove member. Please try again.');
    },
  });

  const todayCheckins: TodayCheckin[] = checkinsData?.data || [];
  // Filter out the team leader from members list
  const members: TeamMember[] = (team?.members || []).filter(
    (member: TeamMember) => member.id !== team?.leader?.id
  );

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const email = member.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // Filter available users
  const availableUsers: AvailableUser[] = (usersData?.data || []).filter(
    (user: AvailableUser) =>
      (user.role === 'MEMBER' || user.role === 'WORKER') &&
      user.teamId === null
  );

  // Create a map of userId to their check-in
  const checkinMap = new Map(todayCheckins.map((c) => [c.userId, c]));

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Navigate to member profile
  const handleViewProfile = (memberId: string) => {
    navigate(`/team/members/${memberId}`);
  };

  if (teamLoading) {
    return <SkeletonDashboard />;
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Team Assigned</h2>
        <p className="text-gray-500">You are not currently assigned to a team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary-600 mb-1">
            <Building2 className="h-4 w-4" />
            <span className="font-medium">{team.company?.name || 'Company'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
          <p className="text-gray-500 mt-1">
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {isTeamLeader && (
            <Button onClick={() => setShowAddMemberModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Members"
          value={stats?.totalMembers || members.length}
          icon={Users}
          iconBg="bg-primary-100"
          iconColor="text-primary-600"
          isLoading={statsLoading}
        />
        <StatCard
          label="Checked In"
          value={stats?.checkedIn || 0}
          icon={UserCheck}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          isLoading={statsLoading}
        />
        <StatCard
          label="Not Checked In"
          value={stats?.notCheckedIn || 0}
          icon={Clock}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-600"
          isLoading={statsLoading}
        />
        <StatCard
          label="On Leave"
          value={stats?.onLeaveCount || 0}
          icon={UserMinus}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          isLoading={statsLoading}
        />
        <StatCard
          label="Avg Score"
          value={stats?.avgReadinessScore ? Math.round(stats.avgReadinessScore) : '—'}
          icon={Activity}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          isLoading={statsLoading}
        />
      </div>

      {/* Today's Readiness Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500">Today's Readiness</h2>
          {stats?.isHoliday && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              🎉 {stats.holidayName || 'Holiday'}
            </span>
          )}
          {stats?.isWorkDay === false && !stats?.isHoliday && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Rest Day
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats?.greenCount || 0}</p>
              <p className="text-xs text-green-600">Ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-yellow-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats?.yellowCount || 0}</p>
              <p className="text-xs text-yellow-600">Caution</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{stats?.redCount || 0}</p>
              <p className="text-xs text-red-600">At Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Team Members</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-48"
            />
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchQuery ? 'No members found' : 'No team members'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMembers.map((member) => {
                const checkin = checkinMap.get(member.id);
                const isMenuOpen = openMenuId === member.id;

                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={member.avatar}
                          firstName={member.firstName}
                          lastName={member.lastName}
                          size="sm"
                        />
                        <span className="text-gray-900">{member.firstName} {member.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{member.email}</td>
                    <td className="px-4 py-3 text-center">
                      {checkin ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                          checkin.readinessStatus === 'GREEN' && 'bg-green-100 text-green-700',
                          checkin.readinessStatus === 'YELLOW' && 'bg-yellow-100 text-yellow-700',
                          checkin.readinessStatus === 'RED' && 'bg-red-100 text-red-700'
                        )}>
                          {checkin.readinessStatus === 'GREEN' && 'Ready'}
                          {checkin.readinessStatus === 'YELLOW' && 'Caution'}
                          {checkin.readinessStatus === 'RED' && 'At Risk'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          {stats?.isWorkDay === false ? 'Rest day' : 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : member.id);
                          }}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </button>

                        {isMenuOpen && (
                          <>
                            {/* Backdrop to close menu on outside click */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 bottom-full mb-1 w-40 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-[100] min-w-max">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewProfile(member.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
                              >
                                <Eye className="h-4 w-4 flex-shrink-0" />
                                View Profile
                              </button>
                              {isTeamLeader && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMember(member);
                                    setShowRemoveMemberConfirm(true);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 whitespace-nowrap"
                                >
                                  <UserMinus className="h-4 w-4 flex-shrink-0" />
                                  Remove
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && isTeamLeader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
                <p className="text-sm text-gray-500">Select members to add to your team</p>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No available members to add</p>
                  <p className="text-sm mt-1">All members are already in a team</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.avatar}
                          firstName={user.firstName}
                          lastName={user.lastName}
                          size="md"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => addMemberMutation.mutate(user.id)}
                        disabled={addMemberMutation.isPending}
                        className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Add to team"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShowAddMemberModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      <ConfirmModal
        isOpen={showRemoveMemberConfirm && !!selectedMember}
        onClose={() => {
          setShowRemoveMemberConfirm(false);
          setSelectedMember(null);
        }}
        onConfirm={() => {
          if (selectedMember) {
            removeMemberMutation.mutate(selectedMember.id);
          }
        }}
        title="Remove Member?"
        message={
          <>
            Are you sure you want to remove{' '}
            <span className="font-medium">
              {selectedMember?.firstName} {selectedMember?.lastName}
            </span>{' '}
            from your team?
          </>
        }
        confirmText="Remove"
        type="danger"
        action="remove"
        isLoading={removeMemberMutation.isPending}
      />
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
