/**
 * MemberGrid Component
 * Mobile grid wrapper for MemberCard components
 */

import { MemberCard } from './MemberCard';
import type { TeamMemberWithStats } from '../../../../services/team.service';

interface MemberGridProps {
  members: TeamMemberWithStats[];
  openDropdownId: string | null;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}

/**
 * Mobile grid layout for member cards
 */
export function MemberGrid({
  members,
  openDropdownId,
  onToggleMenu,
  onViewProfile,
  onTransfer,
  onDeactivate,
  showActions = true,
}: MemberGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {members.map((member) => (
        <MemberCard
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
    </div>
  );
}
