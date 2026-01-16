/**
 * TeamMembersPage - Main Orchestrator
 * Mobile-first design with cards for mobile, table for desktop
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield } from 'lucide-react';
import { SkeletonTable } from '../../../components/ui/Skeleton';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { EmptyState, NoSearchResults } from '../../../components/ui/EmptyState';
import { Pagination, usePagination } from '../../../components/ui/Pagination';
import { useToast } from '../../../components/ui/Toast';

import { MemberGrid, MemberTable, MemberSearchBar, TransferMemberModal } from './components';
import { useTeamMembers, useMemberMutations, useTransferTeams } from './hooks';
import { filterAndSortMembers } from './utils/member-helpers';
import type { TeamMemberWithStats } from '../../../services/team.service';
import type { TeamMembersPageProps } from './types';

/**
 * Team Members Page Component
 * Reusable across roles with configurable props
 */
export function TeamMembersPage({
  teamId,
  showActions = true,
  canTransfer = true,
  canDeactivate = true,
  mode = 'full',
  pagination,
}: TeamMembersPageProps) {
  const navigate = useNavigate();
  const toast = useToast();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [memberToAction, setMemberToAction] = useState<TeamMemberWithStats | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Determine if actions are available based on mode and props
  const isReadonly = mode === 'readonly';
  const allowTransfer = showActions && canTransfer && !isReadonly;
  const allowDeactivate = showActions && canDeactivate && !isReadonly;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch team data
  const { team, isLoading: teamLoading } = useTeamMembers({ teamId });

  // Fetch teams for transfer (lazy - only when modal opens)
  const { teams: transferTeams, isLoading: teamsLoading } = useTransferTeams({
    enabled: showTransferModal,
    excludeTeamId: team?.id,
  });

  // Member mutations
  const { transferMutation, deactivateMutation } = useMemberMutations({
    onTransferSuccess: () => {
      toast.success('Member transferred successfully');
      setShowTransferModal(false);
      setMemberToAction(null);
      setSelectedTeamId('');
    },
    onTransferError: () => {
      toast.error('Failed to transfer member');
    },
    onDeactivateSuccess: () => {
      toast.success('Member deactivated successfully');
      setShowDeactivateModal(false);
      setMemberToAction(null);
    },
    onDeactivateError: () => {
      toast.error('Failed to deactivate member');
    },
  });

  // Memoized filtered and sorted members
  const members = useMemo(() => team?.members || [], [team?.members]);
  const filteredMembers = useMemo(
    () => filterAndSortMembers(members, searchQuery),
    [members, searchQuery]
  );

  // Pagination (only if enabled)
  const paginationEnabled = pagination?.enabled ?? false;
  const pageSize = pagination?.pageSize ?? 10;
  const {
    paginatedData,
    paginationProps,
    setCurrentPage,
  } = usePagination(filteredMembers, {
    pageSize: paginationEnabled ? pageSize : filteredMembers.length,
  });

  // Use paginated data if pagination enabled, otherwise all filtered members
  const displayMembers = paginationEnabled ? (paginatedData || []) : filteredMembers;

  // Reset to page 1 when search changes
  useEffect(() => {
    if (paginationEnabled) {
      setCurrentPage(1);
    }
  }, [searchQuery, paginationEnabled, setCurrentPage]);

  // Handlers
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

  const handleConfirmTransfer = useCallback(() => {
    if (memberToAction && selectedTeamId) {
      transferMutation.mutate({ userId: memberToAction.id, teamId: selectedTeamId });
    }
  }, [memberToAction, selectedTeamId, transferMutation]);

  const handleConfirmDeactivate = useCallback(() => {
    if (memberToAction) {
      deactivateMutation.mutate(memberToAction.id);
    }
  }, [memberToAction, deactivateMutation]);

  // Loading state
  if (teamLoading) {
    return <SkeletonTable rows={8} columns={5} />;
  }

  // No team state
  if (!team) {
    return (
      <EmptyState
        icon={Users}
        title="No Team Assigned"
        description="Contact your administrator"
      />
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
            <p className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <MemberSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Content */}
      {filteredMembers.length === 0 ? (
        searchQuery ? (
          <NoSearchResults
            searchTerm={searchQuery}
            onClear={() => setSearchQuery('')}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No team members"
            description="Members will appear here"
            variant="compact"
          />
        )
      ) : (
        <>
          {/* Mobile Card View */}
          <MemberGrid
            members={displayMembers}
            openDropdownId={openDropdownId}
            onToggleMenu={setOpenDropdownId}
            onViewProfile={handleViewProfile}
            onTransfer={allowTransfer ? handleTransfer : undefined}
            onDeactivate={allowDeactivate ? handleDeactivate : undefined}
            showActions={showActions && !isReadonly}
          />

          {/* Desktop Table View */}
          <MemberTable
            members={displayMembers}
            openDropdownId={openDropdownId}
            onToggleMenu={setOpenDropdownId}
            onViewProfile={handleViewProfile}
            onTransfer={allowTransfer ? handleTransfer : undefined}
            onDeactivate={allowDeactivate ? handleDeactivate : undefined}
            showActions={showActions && !isReadonly}
          />

          {/* Pagination */}
          {paginationEnabled && (
            <Pagination
              {...paginationProps}
              showItemCount={pagination?.showItemCount ?? true}
              className="mt-4"
            />
          )}
        </>
      )}

      {/* Transfer Modal */}
      {memberToAction && (
        <TransferMemberModal
          member={memberToAction}
          teams={transferTeams}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setMemberToAction(null);
            setSelectedTeamId('');
          }}
          onTransfer={handleConfirmTransfer}
          isLoading={transferMutation.isPending}
          isLoadingTeams={teamsLoading}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => {
          setShowDeactivateModal(false);
          setMemberToAction(null);
        }}
        onConfirm={handleConfirmDeactivate}
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
