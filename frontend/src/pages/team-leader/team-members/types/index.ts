/**
 * Team Members Types
 * Shared types for team members components and hooks
 */

import type { TeamMemberWithStats, TeamDetails, TeamWithStats } from '../../../../services/team.service';

// Re-export from team.service for convenience
export type { TeamMemberWithStats, TeamDetails, TeamWithStats };

/**
 * Shared props for MemberCard and MemberRow components
 */
export interface MemberItemProps {
  member: TeamMemberWithStats;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}

/**
 * Pagination configuration for TeamMembersPage
 */
export interface PaginationConfig {
  /** Enable pagination (default: false - show all) */
  enabled: boolean;
  /** Items per page (default: 10) */
  pageSize?: number;
  /** Show item count text (default: true) */
  showItemCount?: boolean;
}

/**
 * Page-level configuration for TeamMembersPage
 */
export interface TeamMembersPageProps {
  /** View specific team (for Executive/Supervisor viewing other teams) */
  teamId?: string;
  /** Show action buttons (default: true) */
  showActions?: boolean;
  /** Allow transfer action (default: true) */
  canTransfer?: boolean;
  /** Allow deactivate action (default: true) */
  canDeactivate?: boolean;
  /** Page mode */
  mode?: 'full' | 'readonly';
  /** Pagination configuration (default: disabled) */
  pagination?: PaginationConfig;
}
