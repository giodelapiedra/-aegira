/**
 * Team Members Page
 * Mobile-first design with cards for mobile, table for desktop
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, type TeamWithStats, type TeamMemberWithStats } from '../../services/team.service';
import { userService } from '../../services/user.service';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  Users,
  Search,
  MoreVertical,
  Eye,
  UserMinus,
  ArrowRightLeft,
  Loader2,
  ChevronDown,
  X,
  CheckCircle,
  Mail,
  Shield,
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

// Props for member components
interface MemberItemProps {
  member: TeamMemberWithStats;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer: (member: TeamMemberWithStats) => void;
  onDeactivate: (member: TeamMemberWithStats) => void;
}

// Memoized Mobile Card Component
const MemberCard = memo(({
  member,
  isMenuOpen,
  onToggleMenu,
  onViewProfile,
  onTransfer,
  onDeactivate
}: MemberItemProps) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    {/* Card Header with Avatar and Actions */}
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar
              src={member.avatar}
              firstName={member.firstName}
              lastName={member.lastName}
              size="lg"
            />
            {/* Status indicator on avatar */}
            {member.isActive && !member.isOnLeave && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {member.firstName} {member.lastName}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${getRoleStyle(member.role)}`}>
                {getRoleDisplay(member.role)}
              </span>
              {member.isOnLeave ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                  On Leave
                </span>
              ) : member.isActive ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(isMenuOpen ? null : member.id);
            }}
            className="p-2 -m-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => {
                  onViewProfile(member);
                  onToggleMenu(null);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
              >
                <Eye className="h-4 w-4 text-gray-400" />
                View Profile
              </button>
              <button
                onClick={() => onTransfer(member)}
                className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
              >
                <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                Transfer
              </button>
              <div className="border-t border-gray-100 my-1.5 mx-2" />
              <button
                onClick={() => onDeactivate(member)}
                className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
              >
                <UserMinus className="h-4 w-4" />
                Deactivate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Details */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            <span>{member.checkinCount} check-ins</span>
          </div>
        </div>
      </div>
    </div>

    {/* Quick Action - View Profile */}
    <button
      onClick={() => onViewProfile(member)}
      className="w-full py-3 px-4 bg-gray-50 text-sm font-medium text-primary-600 hover:bg-gray-100 transition-colors border-t border-gray-100 flex items-center justify-center gap-2"
    >
      <Eye className="h-4 w-4" />
      View Full Profile
    </button>
  </div>
));
MemberCard.displayName = 'MemberCard';

// Memoized Desktop Table Row Component
const MemberRow = memo(({
  member,
  isMenuOpen,
  onToggleMenu,
  onViewProfile,
  onTransfer,
  onDeactivate
}: MemberItemProps & { isLast?: boolean }) => (
  <tr className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-b-0">
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
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize ${getRoleStyle(member.role)}`}>
        {getRoleDisplay(member.role)}
      </span>
    </td>
    <td className="px-6 py-4">
      {member.isOnLeave ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          On Leave
        </span>
      ) : member.isActive ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          Inactive
        </span>
      )}
    </td>
    <td className="px-6 py-4 text-center">
      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-gray-100 text-sm font-medium text-gray-700">
        {member.checkinCount}
      </span>
    </td>
    <td className="px-6 py-4">
      <div className="relative flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(isMenuOpen ? null : member.id);
          }}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <button
              onClick={() => {
                onViewProfile(member);
                onToggleMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
            >
              <Eye className="h-4 w-4 text-gray-400" />
              View Profile
            </button>
            <button
              onClick={() => onTransfer(member)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4 text-gray-400" />
              Transfer
            </button>
            <div className="border-t border-gray-100 my-1.5 mx-2" />
            <button
              onClick={() => onDeactivate(member)}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
            >
              <UserMinus className="h-4 w-4" />
              Deactivate
            </button>
          </div>
        )}
      </div>
    </td>
  </tr>
));
MemberRow.displayName = 'MemberRow';

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
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Users className="h-10 w-10 text-gray-300" />
        </div>
        <p className="text-gray-600 font-medium">No Team Assigned</p>
        <p className="text-sm text-gray-400 mt-1">Contact your administrator</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Team Members</h1>
          <div className="flex items-center gap-2 mt-1">
            <Shield className="h-4 w-4 text-primary-500" />
            <p className="text-sm text-gray-500">{team.name}</p>
            <span className="text-gray-300">•</span>
            <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Search Bar - Full width on mobile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-sm pl-10 pr-4 py-3 md:py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
        />
      </div>

      {/* Empty State */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-16 text-center">
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
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                isMenuOpen={openDropdownId === member.id}
                onToggleMenu={setOpenDropdownId}
                onViewProfile={handleViewProfile}
                onTransfer={handleTransfer}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Check-ins</th>
                  <th className="w-12 px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isMenuOpen={openDropdownId === member.id}
                    onToggleMenu={setOpenDropdownId}
                    onViewProfile={handleViewProfile}
                    onTransfer={handleTransfer}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Transfer Modal - Mobile Optimized */}
      {showTransferModal && memberToAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTransferModal(false)} />
          <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in duration-200">
            {/* Modal Handle for mobile */}
            <div className="sm:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />

            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Transfer Member</h2>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-2 -m-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Member Preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                <Avatar
                  src={memberToAction.avatar}
                  firstName={memberToAction.firstName}
                  lastName={memberToAction.lastName}
                  size="md"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {memberToAction.firstName} {memberToAction.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{memberToAction.email}</p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination Team</label>
                <div className="relative">
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none bg-white transition-all"
                  >
                    <option value="">Select a team...</option>
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 py-3"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 py-3"
                  onClick={() => transferMutation.mutate({ userId: memberToAction.id, teamId: selectedTeamId })}
                  disabled={!selectedTeamId || transferMutation.isPending}
                >
                  {transferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
        message={`Are you sure you want to deactivate ${memberToAction?.firstName} ${memberToAction?.lastName}? They will no longer be able to access the system.`}
        confirmText="Deactivate"
        type="danger"
        action="remove"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
