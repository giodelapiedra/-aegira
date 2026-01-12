import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Edit,
  UserPlus,
  UserMinus,
  Crown,
  X,
  Trash2,
  Clock,
  Calendar,
  Globe,
  Power,
  PowerOff,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { useUser } from '../../hooks/useUser';
import api from '../../services/api';
import { getTimezoneLabel } from '../../constants/timezones';
import { getNowInTimezone, formatShiftTime } from '../../lib/date-utils';

interface Team {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  isActive: boolean;
  memberCount: number;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  reactivatedAt: string | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

const DAYS_OF_WEEK = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
];

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar: string | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  teamId: string | null;
}

export function TeamsPage() {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [showInactiveTeams, setShowInactiveTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
    workDays: 'MON,TUE,WED,THU,FRI',
    shiftStart: '08:00',
    shiftEnd: '17:00',
  });
  const [currentTimeInTz, setCurrentTimeInTz] = useState<string>('');
  const queryClient = useQueryClient();
  const toast = useToast();

  // Get company timezone from auth store (already loaded on login)
  const { company } = useUser();
  const companyTimezone = company?.timezone || 'Asia/Manila';

  // Update current time in company timezone every minute
  useEffect(() => {
    const updateTime = () => {
      const { hour, minute } = getNowInTimezone(companyTimezone);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      setCurrentTimeInTz(`${displayHour}:${String(minute).padStart(2, '0')} ${period}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [companyTimezone]);

  const toggleWorkDay = (day: string) => {
    const currentDays = formData.workDays.split(',').filter(Boolean);
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    // Sort days in order
    const orderedDays = DAYS_OF_WEEK.map((d) => d.value).filter((d) => newDays.includes(d));
    setFormData({ ...formData, workDays: orderedDays.join(',') });
  };

  // Fetch teams (include inactive when toggle is on)
  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', showInactiveTeams],
    queryFn: async () => {
      const url = showInactiveTeams ? '/teams?includeInactive=true' : '/teams';
      const response = await api.get(url);
      return response.data;
    },
  });

  // Fetch users for leader selection and member management
  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const response = await api.get('/users?limit=100');
      return response.data;
    },
  });

  // Fetch team members when viewing a team
  const { data: teamMembersData } = useQuery({
    queryKey: ['team-members', selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam) return null;
      const response = await api.get(`/teams/${selectedTeam.id}`);
      return response.data;
    },
    enabled: !!selectedTeam && showMembersModal,
  });

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.post('/teams', {
        name: data.name,
        description: data.description || null,
        leaderId: data.leaderId || null,
        workDays: data.workDays,
        shiftStart: data.shiftStart,
        shiftEnd: data.shiftEnd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateModal(false);
      setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
      toast.success('Team Created', 'The team has been created successfully.');
    },
    onError: () => {
      toast.error('Error', 'Failed to create team. Please try again.');
    },
  });

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      await api.put(`/teams/${data.id}`, {
        name: data.name,
        description: data.description || null,
        leaderId: data.leaderId || null,
        workDays: data.workDays,
        shiftStart: data.shiftStart,
        shiftEnd: data.shiftEnd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowEditModal(false);
      setSelectedTeam(null);
      setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
      toast.success('Team Updated', 'The team has been updated successfully.');
    },
    onError: () => {
      toast.error('Error', 'Failed to update team. Please try again.');
    },
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowDeleteConfirm(false);
      setSelectedTeam(null);
      toast.success('Team Deleted', 'The team has been deleted successfully.');
    },
    onError: () => {
      toast.error('Error', 'Failed to delete team. Please try again.');
    },
  });

  // Deactivate team mutation
  const deactivateMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.post(`/teams/${id}/deactivate`, { reason });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowDeactivateModal(false);
      setSelectedTeam(null);
      setDeactivationReason('');
      toast.success('Team Deactivated', data.message || 'Workers are now exempted from check-in.');
    },
    onError: () => {
      toast.error('Error', 'Failed to deactivate team. Please try again.');
    },
  });

  // Reactivate team mutation
  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/teams/${id}/reactivate`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowReactivateConfirm(false);
      setSelectedTeam(null);
      toast.success('Team Reactivated', data.message || 'Workers must check in starting today.');
    },
    onError: () => {
      toast.error('Error', 'Failed to reactivate team. Please try again.');
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      await api.post(`/teams/${teamId}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Member Added', 'The member has been added to the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to add member. Please try again.');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowRemoveMemberConfirm(false);
      setSelectedMember(null);
      toast.success('Member Removed', 'The member has been removed from the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to remove member. Please try again.');
    },
  });

  const teams: Team[] = teamsData?.data || [];
  const users: User[] = usersData?.data || [];
  const teamMembers: TeamMember[] = teamMembersData?.members || [];

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  // Users without a team (for adding) - MEMBER or WORKER role only
  // Only show users who have NO team assigned (teamId === null)
  const availableUsers = users.filter(
    (user) =>
      (user.role === 'MEMBER' || user.role === 'WORKER') &&
      user.teamId === null
  );

  // Only TEAM_LEAD role users can be assigned as team leaders
  const teamLeadUsers = users.filter((user) => user.role === 'TEAM_LEAD');

  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      leaderId: team.leaderId || '',
      workDays: team.workDays || 'MON,TUE,WED,THU,FRI',
      shiftStart: team.shiftStart || '08:00',
      shiftEnd: team.shiftEnd || '17:00',
    });
    setShowEditModal(true);
  };

  const openMembersModal = (team: Team) => {
    setSelectedTeam(team);
    setShowMembersModal(true);
  };

  const openDeleteConfirm = (team: Team) => {
    setSelectedTeam(team);
    setShowDeleteConfirm(true);
  };

  const openDeactivateModal = (team: Team) => {
    setSelectedTeam(team);
    setDeactivationReason('');
    setShowDeactivateModal(true);
  };

  const openReactivateConfirm = (team: Team) => {
    setSelectedTeam(team);
    setShowReactivateConfirm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-1">Create and manage teams in your company</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Search and Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactiveTeams}
            onChange={(e) => setShowInactiveTeams(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">Show inactive teams</span>
        </label>
      </div>

      {/* Teams Grid */}
      {teamsLoading ? (
        <div className="p-8 text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="text-gray-500 mt-4">Loading teams...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Teams Yet</h2>
          <p className="text-gray-500 mb-6">Create your first team to get started</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow ${
                team.isActive ? 'border-gray-200' : 'border-orange-200 bg-orange-50/50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    team.isActive
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600'
                      : 'bg-gradient-to-br from-orange-400 to-orange-500'
                  }`}>
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      {!team.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{team.memberCount} members</p>
                  </div>
                </div>
              </div>

              {!team.isActive && team.deactivatedReason && (
                <div className="flex items-start gap-2 mb-4 p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Deactivated</p>
                    <p className="text-orange-700">{team.deactivatedReason}</p>
                  </div>
                </div>
              )}

              {team.description && team.isActive && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{team.description}</p>
              )}

              {team.leader && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-status-yellow-50 rounded-lg">
                  <Crown className="h-4 w-4 text-status-yellow-600" />
                  <span className="text-sm text-status-yellow-800">
                    {team.leader.firstName} {team.leader.lastName}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                {team.isActive ? (
                  <>
                    <button
                      onClick={() => openMembersModal(team)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      Members
                    </button>
                    <button
                      onClick={() => openEditModal(team)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit Team"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openDeactivateModal(team)}
                      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Deactivate Team"
                    >
                      <PowerOff className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(team)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openReactivateConfirm(team)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <Power className="h-4 w-4" />
                      Reactivate
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(team)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create New Team</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name <span className="text-danger-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Engineering Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the team..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Leader <span className="text-gray-400 text-xs">(TEAM_LEAD role only)</span>
                </label>
                <select
                  value={formData.leaderId}
                  onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="">No leader assigned</option>
                  {teamLeadUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                {teamLeadUsers.length === 0 && (
                  <p className="text-xs text-warning-600 mt-1">
                    No Team Lead accounts found. Create a user with TEAM_LEAD role first.
                  </p>
                )}
              </div>

              {/* Schedule Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Work Schedule</span>
                  </div>
                </div>

                {/* Timezone Notice */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Company Timezone:</span>{' '}
                      <span>{getTimezoneLabel(companyTimezone)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1 ml-6">
                    Current time: {currentTimeInTz} — All schedule times use this timezone
                  </p>
                </div>

                {/* Work Days */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-2">Work Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWorkDay(day.value)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          formData.workDays.split(',').includes(day.value)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shift Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Shift Start
                    </label>
                    <input
                      type="time"
                      value={formData.shiftStart}
                      onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formatShiftTime(formData.shiftStart)}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Shift End
                    </label>
                    <input
                      type="time"
                      value={formData.shiftEnd}
                      onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formatShiftTime(formData.shiftEnd)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Team</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTeam(null);
                  setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name <span className="text-danger-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Engineering Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the team..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Leader <span className="text-gray-400 text-xs">(TEAM_LEAD role only)</span>
                </label>
                <select
                  value={formData.leaderId}
                  onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="">No leader assigned</option>
                  {teamLeadUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
                {teamLeadUsers.length === 0 && (
                  <p className="text-xs text-warning-600 mt-1">
                    No Team Lead accounts found. Create a user with TEAM_LEAD role first.
                  </p>
                )}
              </div>

              {/* Schedule Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Work Schedule</span>
                  </div>
                </div>

                {/* Timezone Notice */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Company Timezone:</span>{' '}
                      <span>{getTimezoneLabel(companyTimezone)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1 ml-6">
                    Current time: {currentTimeInTz} — All schedule times use this timezone
                  </p>
                </div>

                {/* Work Days */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-2">Work Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWorkDay(day.value)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          formData.workDays.split(',').includes(day.value)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shift Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Shift Start
                    </label>
                    <input
                      type="time"
                      value={formData.shiftStart}
                      onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formatShiftTime(formData.shiftStart)}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Shift End
                    </label>
                    <input
                      type="time"
                      value={formData.shiftEnd}
                      onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formatShiftTime(formData.shiftEnd)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTeam(null);
                  setFormData({ name: '', description: '', leaderId: '', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateMutation.mutate({ id: selectedTeam.id, ...formData })}
                disabled={!formData.name || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                <p className="text-sm text-gray-500">{selectedTeam.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowMembersModal(false);
                  setSelectedTeam(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Current Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Current Members ({teamMembers.length})
                </h4>
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No members yet</p>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={member.avatar}
                            firstName={member.firstName}
                            lastName={member.lastName}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                              {selectedTeam.leaderId === member.id && (
                                <Crown className="inline h-4 w-4 text-status-yellow-500 ml-1" />
                              )}
                            </p>
                            <p className="text-sm text-gray-500">{member.role}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRemoveMemberConfirm(true);
                          }}
                          className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                          title="Remove from team"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Members - Only show for active teams */}
              {selectedTeam.isActive ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Add Members</h4>
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No available workers without a team
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
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
                              <p className="text-sm text-gray-500">{user.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              addMemberMutation.mutate({
                                teamId: selectedTeam.id,
                                userId: user.id,
                              })
                            }
                            className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                            title="Add to team"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                  <p className="text-sm text-orange-700 text-center">
                    Cannot add members to an inactive team. Reactivate the team first.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setShowMembersModal(false);
                  setSelectedTeam(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm && !!selectedTeam}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedTeam(null);
        }}
        onConfirm={() => selectedTeam && deleteMutation.mutate(selectedTeam.id)}
        title="Delete Team?"
        message={
          <>
            Are you sure you want to delete <span className="font-medium">{selectedTeam?.name}</span>?
            All members will be unassigned from this team.
          </>
        }
        confirmText="Delete Team"
        type="danger"
        action="delete"
        isLoading={deleteMutation.isPending}
      />

      {/* Remove Member Confirmation */}
      <ConfirmModal
        isOpen={showRemoveMemberConfirm && !!selectedMember}
        onClose={() => {
          setShowRemoveMemberConfirm(false);
          setSelectedMember(null);
        }}
        onConfirm={() => {
          if (selectedTeam && selectedMember) {
            removeMemberMutation.mutate({
              teamId: selectedTeam.id,
              userId: selectedMember.id,
            });
          }
        }}
        title="Remove Member?"
        message={
          <>
            Are you sure you want to remove{' '}
            <span className="font-medium">
              {selectedMember?.firstName} {selectedMember?.lastName}
            </span>{' '}
            from this team?
          </>
        }
        confirmText="Remove"
        type="danger"
        action="remove"
        isLoading={removeMemberMutation.isPending}
      />

      {/* Deactivate Team Modal */}
      {showDeactivateModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <PowerOff className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Deactivate Team</h3>
                  <p className="text-sm text-gray-500">{selectedTeam.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setSelectedTeam(null);
                  setDeactivationReason('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">What happens when you deactivate a team:</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-700">
                    <li>All {selectedTeam.memberCount} workers will be automatically exempted from check-in</li>
                    <li>Their attendance scores will NOT be affected</li>
                    <li>You can reactivate the team at any time</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for deactivation <span className="text-danger-500">*</span>
                </label>
                <textarea
                  value={deactivationReason}
                  onChange={(e) => setDeactivationReason(e.target.value)}
                  placeholder="e.g., Project completed, Team restructuring, Budget constraints..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowDeactivateModal(false);
                  setSelectedTeam(null);
                  setDeactivationReason('');
                }}
              >
                Cancel
              </Button>
              <button
                className="flex-1 px-4 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => {
                  deactivateMutation.mutate({
                    id: selectedTeam.id,
                    reason: deactivationReason,
                  });
                }}
                disabled={!deactivationReason.trim() || deactivateMutation.isPending}
              >
                {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Team Confirmation */}
      <ConfirmModal
        isOpen={showReactivateConfirm && !!selectedTeam}
        onClose={() => {
          setShowReactivateConfirm(false);
          setSelectedTeam(null);
        }}
        onConfirm={() => selectedTeam && reactivateMutation.mutate(selectedTeam.id)}
        title="Reactivate Team?"
        message={
          <>
            Are you sure you want to reactivate <span className="font-medium">{selectedTeam?.name}</span>?
            <br /><br />
            <span className="text-sm text-gray-600">
              All workers will need to check in starting today. Their exemptions will be ended.
            </span>
          </>
        }
        confirmText="Reactivate"
        type="primary"
        action="update"
        isLoading={reactivateMutation.isPending}
      />
    </div>
  );
}
