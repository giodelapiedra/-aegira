/**
 * Team Members Module
 * Entry point for team members page
 */

// Main page component
export { TeamMembersPage } from './TeamMembersPage';

// Hooks (for reuse in other pages)
export { useTeamMembers, useMemberMutations, useTransferTeams } from './hooks';

// Components (for reuse in other pages)
export {
  MemberCard,
  MemberRow,
  MemberGrid,
  MemberTable,
  MemberSearchBar,
  TransferMemberModal,
} from './components';

// Types
export type { TeamMembersPageProps, MemberItemProps, PaginationConfig } from './types';

// Utils
export {
  ROLE_HIERARCHY,
  ROLE_STYLES,
  getRoleDisplay,
  getRoleStyle,
  filterMembers,
  sortMembersByRole,
  filterAndSortMembers,
} from './utils/member-helpers';
