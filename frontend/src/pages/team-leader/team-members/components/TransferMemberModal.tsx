/**
 * TransferMemberModal Component
 * Modal for transferring a member to another team
 */

import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import type { TeamMemberWithStats, TeamWithStats } from '../../../../services/team.service';

interface TransferMemberModalProps {
  member: TeamMemberWithStats;
  teams: TeamWithStats[];
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onTransfer: () => void;
  isLoading: boolean;
  isLoadingTeams: boolean;
}

/**
 * Modal for transferring a team member
 * Mobile-optimized with bottom sheet pattern
 */
export function TransferMemberModal({
  member,
  teams,
  selectedTeamId,
  onSelectTeam,
  isOpen,
  onClose,
  onTransfer,
  isLoading,
  isLoadingTeams,
}: TransferMemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in duration-200">
        {/* Mobile drag handle */}
        <div className="sm:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Transfer Member</h2>
            <button
              onClick={onClose}
              className="p-2 -m-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Member Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
            <Avatar
              src={member.avatar}
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

          {/* Team Selection */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Team
            </label>
            <div className="relative">
              {isLoadingTeams ? (
                <div className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading teams...
                </div>
              ) : (
                <>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => onSelectTeam(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none bg-white transition-all"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 py-3"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 py-3"
              onClick={onTransfer}
              disabled={!selectedTeamId || isLoading}
              isLoading={isLoading}
            >
              Transfer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
