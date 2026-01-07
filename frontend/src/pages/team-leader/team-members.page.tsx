import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, type TeamWithStats, type TeamMemberWithStats } from '../../services/team.service';
import { userService } from '../../services/user.service';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import {
  Users,
  Search,
  CheckCircle2,
  Flame,
  MoreVertical,
  Eye,
  UserMinus,
  ArrowRightLeft,
  Loader2,
  ChevronDown,
  Shield,
} from 'lucide-react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: () => teamService.getMyTeam(),
  });

  // Get all teams for transfer dropdown
  const { data: allTeamsData } = useQuery({
    queryKey: ['all-teams'],
    queryFn: () => teamService.getAll(),
    enabled: showTransferModal,
  });

  // Deactivate mutation
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

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      userService.update(userId, { teamId }),
    onSuccess: () => {
      toast.success('Member transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['all-teams'] });
      setShowTransferModal(false);
      setMemberToAction(null);
      setSelectedTeamId('');
    },
    onError: () => {
      toast.error('Failed to transfer member');
    },
  });

  const members: TeamMemberWithStats[] = team?.members || [];
  const allTeams: TeamWithStats[] = allTeamsData?.data || [];
  const otherTeams = allTeams.filter((t) => t.id !== team?.id);

  // Filter members
  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.firstName.toLowerCase().includes(searchLower) ||
      member.lastName.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower)
    );
  });

  const handleViewProfile = (member: TeamMemberWithStats) => {
    navigate(`/team/members/${member.id}`);
  };

  const handleTransfer = (member: TeamMemberWithStats) => {
    setMemberToAction(member);
    setShowTransferModal(true);
    setOpenDropdownId(null);
  };

  const handleDeactivate = (member: TeamMemberWithStats) => {
    setMemberToAction(member);
    setShowDeactivateModal(true);
    setOpenDropdownId(null);
  };

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
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
    <div className="space-y-4 md:space-y-6">
      {/* Header - Compact on mobile */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-4 md:p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <Users className="h-6 w-6 md:h-7 md:w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Team Members</h1>
            <p className="text-primary-100 text-xs md:text-sm mt-0.5">
              {team.name} • {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Stats - Horizontal scroll on mobile */}
      <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <div className="flex-shrink-0 w-[140px] md:w-auto bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{members.length}</p>
              <p className="text-[10px] md:text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 w-[140px] md:w-auto bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-success-50 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-success-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {members.filter((m) => m.isActive && !m.isOnLeave).length}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 w-[140px] md:w-auto bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-warning-50 flex items-center justify-center">
              <Shield className="h-4 w-4 md:h-5 md:w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {members.filter((m) => m.isOnLeave).length}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500">On Leave</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 w-[140px] md:w-auto bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Flame className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {members.length > 0
                  ? Math.round(members.reduce((acc, m) => acc + m.currentStreak, 0) / members.length)
                  : 0}
              </p>
              <p className="text-[10px] md:text-xs text-gray-500">Avg Streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search - Sticky on mobile */}
      <div className="sticky top-0 z-10 bg-gray-50 -mx-4 px-4 py-2 md:relative md:mx-0 md:px-0 md:py-0 md:bg-transparent">
        <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm md:shadow-none">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 bg-gray-50 md:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium">No members found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery ? 'Try a different search term' : 'No team members available'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="overflow-visible hidden md:block">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-t-xl">
                  <div className="col-span-4">Member</div>
                  <div className="col-span-2 text-center">Streak</div>
                  <div className="col-span-2 text-center">Check-ins</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Desktop Members */}
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group"
                  >
                    <div
                      className="col-span-4 flex items-center gap-3 cursor-pointer"
                      onClick={() => handleViewProfile(member)}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-white">
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-gray-900">{member.currentStreak}</span>
                        <span className="text-xs text-gray-500">days</span>
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      <span className="font-medium text-gray-900">{member.checkinCount}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      {!member.isActive ? (
                        <Badge variant="danger">Inactive</Badge>
                      ) : member.isOnLeave ? (
                        <Badge variant="warning">On Leave</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-end" ref={openDropdownId === member.id ? dropdownRef : null}>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === member.id ? null : member.id);
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>

                        {openDropdownId === member.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleViewProfile(member)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </button>
                            <button
                              onClick={() => handleTransfer(member)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              Transfer to Team
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => handleDeactivate(member)}
                              className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2"
                            >
                              <UserMinus className="h-4 w-4" />
                              Deactivate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
              >
                {/* Card Header - Tap to view profile */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => handleViewProfile(member)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span className="text-base font-semibold text-white">
                          {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Name & Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        {!member.isActive ? (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-gray-400" />
                        ) : member.isOnLeave ? (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-warning-500" />
                        ) : (
                          <span className="flex-shrink-0 h-2 w-2 rounded-full bg-success-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>

                    {/* Chevron */}
                    <ChevronDown className="h-5 w-5 text-gray-300 -rotate-90 flex-shrink-0" />
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
                  <div className="flex-1 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="font-bold text-gray-900">{member.currentStreak}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Streak</p>
                  </div>
                  <div className="flex-1 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-primary-500" />
                      <span className="font-bold text-gray-900">{member.checkinCount}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Check-ins</p>
                  </div>
                  <div className="flex-1 py-3 text-center">
                    {!member.isActive ? (
                      <Badge variant="danger" className="text-[10px] px-2 py-0.5">Inactive</Badge>
                    ) : member.isOnLeave ? (
                      <Badge variant="warning" className="text-[10px] px-2 py-0.5">On Leave</Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">Active</Badge>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">Status</p>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center border-t border-gray-100 bg-gray-50/50">
                  <button
                    onClick={() => handleViewProfile(member)}
                    className="flex-1 py-3 text-xs font-medium text-primary-600 hover:bg-primary-50 active:bg-primary-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <div className="w-px h-8 bg-gray-200" />
                  <button
                    onClick={() => handleTransfer(member)}
                    className="flex-1 py-3 text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transfer
                  </button>
                  <div className="w-px h-8 bg-gray-200" />
                  <button
                    onClick={() => handleDeactivate(member)}
                    className="flex-1 py-3 text-xs font-medium text-danger-600 hover:bg-danger-50 active:bg-danger-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserMinus className="h-4 w-4" />
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {showTransferModal && memberToAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTransferModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-slide-up">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Transfer Member</h2>
              <p className="text-sm text-gray-500 mb-6">
                Transfer {memberToAction.firstName} {memberToAction.lastName} to another team. This will remove them from your team.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Destination Team
                  </label>
                  <div className="relative">
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                    >
                      <option value="">Select a team...</option>
                      {otherTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.memberCount} members)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    transferMutation.mutate({
                      userId: memberToAction.id,
                      teamId: selectedTeamId,
                    })
                  }
                  disabled={!selectedTeamId || transferMutation.isPending}
                >
                  {transferMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                  )}
                  Transfer Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
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
