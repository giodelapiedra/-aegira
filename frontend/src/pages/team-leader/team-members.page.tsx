/**
 * Team Members Page
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, type TeamWithStats, type TeamMemberWithStats } from '../../services/team.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import {
  Users,
  Search,
  MoreHorizontal,
  Eye,
  UserMinus,
  ArrowRightLeft,
  Loader2,
  ChevronDown,
  X,
} from 'lucide-react';

// Constants - defined outside component to prevent recreation
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 5,
  EXECUTIVE: 4,
  SUPERVISOR: 3,
  TEAM_LEAD: 2,
  WORKER: 1,
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  EXECUTIVE: 'bg-blue-50 text-blue-700',
  SUPERVISOR: 'bg-indigo-50 text-indigo-700',
  TEAM_LEAD: 'bg-cyan-50 text-cyan-700',
  WORKER: 'bg-gray-50 text-gray-600',
};

// Utility functions - defined outside component
const getRoleDisplay = (role: string | undefined): string => {
  return (role || 'WORKER').toLowerCase().replace('_', ' ');
};

const getRoleStyle = (role: string | undefined): string => {
  const normalizedRole = (role || 'WORKER').toUpperCase();
  return ROLE_STYLES[normalizedRole] || ROLE_STYLES.WORKER;
};

export function TeamMembersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [memberToAction, setMemberToAction] = useState<TeamMemberWithStats | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: () => teamService.getMyTeam(),
  });

  const { data: allTeamsData } = useQuery({
    queryKey: ['all-teams-for-transfer'],
    queryFn: () => teamService.getAll({ forTransfer: true }),
    enabled: showTransferModal,
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => userService.deactivate(userId),
    onSuccess: () => {
      toast.success('Member deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      setShowDeactivateModal(false);
      setMemberToAction(null);
    },
    onError: () => {
      toast.error('Failed to deactivate member');
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      userService.update(userId, { teamId }),
    onSuccess: () => {
      toast.success('Member transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['all-teams-for-transfer'] });
      setShowTransferModal(false);
      setMemberToAction(null);
      setSelectedTeamId('');
    },
    onError: () => {
      toast.error('Failed to transfer member');
    },
  });

  // Memoized data
  const members = useMemo(() => team?.members || [], [team?.members]);
  const otherTeams = useMemo(() => {
    const allTeams: TeamWithStats[] = allTeamsData?.data || [];
    return allTeams.filter((t) => t.id !== team?.id);
  }, [allTeamsData?.data, team?.id]);

  // Memoized filtered and sorted members
  const filteredMembers = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();

    return members
      .filter((member) =>
        member.firstName.toLowerCase().includes(searchLower) ||
        member.lastName.toLowerCase().includes(searchLower) ||
        member.email.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => {
        // Sort by role hierarchy (higher roles first)
        const roleA = ROLE_HIERARCHY[a.role?.toUpperCase() || 'WORKER'] || 1;
        const roleB = ROLE_HIERARCHY[b.role?.toUpperCase() || 'WORKER'] || 1;
        if (roleA !== roleB) return roleB - roleA;
        // Then alphabetically by name
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [members, searchQuery]);

  // Memoized handlers
  const handleViewProfile = useCallback((member: TeamMemberWithStats) => {
    navigate(`/team/members/${member.id}`);
  }, [navigate]);

  const handleTransfer = useCallback((member: TeamMemberWithStats) => {
    setMemberToAction(member);
    setShowTransferModal(true);
    setOpenDropdownId(null);
  }, []);

  const handleDeactivate = useCallback((member: TeamMemberWithStats) => {
    setMemberToAction(member);
    setShowDeactivateModal(true);
    setOpenDropdownId(null);
  }, []);

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-600">No Team Assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-sm text-gray-500 mt-1">{team.name} - {members.length} member{members.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">
              {searchQuery ? 'No members found' : 'No team members'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try a different search term' : 'Members will appear here'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-sm font-normal text-gray-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-normal text-gray-500">Email</th>
                <th className="text-left px-6 py-4 text-sm font-normal text-gray-500">Role</th>
                <th className="text-left px-6 py-4 text-sm font-normal text-gray-500">Status</th>
                <th className="text-center px-6 py-4 text-sm font-normal text-gray-500">Check-ins</th>
                <th className="w-12 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, index) => {
                const isMenuOpen = openDropdownId === member.id;
                const isLast = index === filteredMembers.length - 1;

                return (
                  <tr
                    key={member.id}
                    className={`hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={member.avatar}
                          firstName={member.firstName}
                          lastName={member.lastName}
                          size="sm"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{member.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getRoleStyle(member.role)}`}>
                        {getRoleDisplay(member.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.isOnLeave ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                          On Leave
                        </span>
                      ) : member.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">{member.checkinCount}</td>
                    <td className="px-6 py-4">
                      <div className="relative flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(isMenuOpen ? null : member.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
                            <button
                              onClick={() => {
                                handleViewProfile(member);
                                setOpenDropdownId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </button>
                            <button
                              onClick={() => handleTransfer(member)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              Transfer
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => handleDeactivate(member)}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <UserMinus className="h-4 w-4" />
                              Deactivate
                            </button>
                          </div>
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

      {/* Transfer Modal */}
      {showTransferModal && memberToAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTransferModal(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Transfer Member</h2>
                <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Transfer {memberToAction.firstName} {memberToAction.lastName} to another team.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Team</label>
                <div className="relative">
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 appearance-none bg-white"
                  >
                    <option value="">Select team...</option>
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => transferMutation.mutate({ userId: memberToAction.id, teamId: selectedTeamId })}
                  disabled={!selectedTeamId || transferMutation.isPending}
                >
                  {transferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Transfer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={() => memberToAction && deactivateMutation.mutate(memberToAction.id)}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate ${memberToAction?.firstName} ${memberToAction?.lastName}?`}
        confirmText="Deactivate"
        type="danger"
        action="remove"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
