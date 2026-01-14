/**
 * MemberTable Component
 * Desktop table wrapper for MemberRow components
 */

import { MemberRow } from './MemberRow';
import type { TeamMemberWithStats } from '../../../../services/team.service';

interface MemberTableProps {
  members: TeamMemberWithStats[];
  openDropdownId: string | null;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}

/**
 * Desktop table layout for member rows
 */
export function MemberTable({
  members,
  openDropdownId,
  onToggleMenu,
  onViewProfile,
  onTransfer,
  onDeactivate,
  showActions = true,
}: MemberTableProps) {
  return (
    <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50/80 border-b border-gray-200">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Name
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Email
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Role
            </th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </th>
            <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Check-ins
            </th>
            <th className="w-12 px-6 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isMenuOpen={openDropdownId === member.id}
              onToggleMenu={onToggleMenu}
              onViewProfile={onViewProfile}
              onTransfer={onTransfer}
              onDeactivate={onDeactivate}
              showActions={showActions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
