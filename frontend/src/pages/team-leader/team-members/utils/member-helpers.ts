/**
 * Team Members Helper Functions
 * Constants and utilities for member-related operations
 */

import type { TeamMemberWithStats } from '../../../../services/team.service';

/**
 * Role hierarchy for sorting (higher number = higher rank)
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 5,
  EXECUTIVE: 4,
  SUPERVISOR: 3,
  TEAM_LEAD: 2,
  WORKER: 1,
};

/**
 * Role badge styles
 */
export const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  EXECUTIVE: 'bg-blue-50 text-blue-700',
  SUPERVISOR: 'bg-indigo-50 text-indigo-700',
  TEAM_LEAD: 'bg-cyan-50 text-cyan-700',
  WORKER: 'bg-gray-50 text-gray-600',
};

/**
 * Get display name for role
 */
export function getRoleDisplay(role: string | undefined): string {
  return (role || 'WORKER').toLowerCase().replace('_', ' ');
}

/**
 * Get style class for role badge
 */
export function getRoleStyle(role: string | undefined): string {
  const normalizedRole = (role || 'WORKER').toUpperCase();
  return ROLE_STYLES[normalizedRole] || ROLE_STYLES.WORKER;
}

/**
 * Filter members by search query
 */
export function filterMembers(
  members: TeamMemberWithStats[],
  searchQuery: string
): TeamMemberWithStats[] {
  if (!searchQuery.trim()) return members;

  const searchLower = searchQuery.toLowerCase();
  return members.filter((member) =>
    member.firstName.toLowerCase().includes(searchLower) ||
    member.lastName.toLowerCase().includes(searchLower) ||
    member.email.toLowerCase().includes(searchLower)
  );
}

/**
 * Sort members by role hierarchy (higher roles first), then alphabetically
 */
export function sortMembersByRole(members: TeamMemberWithStats[]): TeamMemberWithStats[] {
  return [...members].sort((a, b) => {
    const roleA = ROLE_HIERARCHY[a.role?.toUpperCase() || 'WORKER'] || 1;
    const roleB = ROLE_HIERARCHY[b.role?.toUpperCase() || 'WORKER'] || 1;

    if (roleA !== roleB) return roleB - roleA;

    // Then alphabetically by name
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });
}

/**
 * Filter and sort members (combined operation)
 */
export function filterAndSortMembers(
  members: TeamMemberWithStats[],
  searchQuery: string
): TeamMemberWithStats[] {
  const filtered = filterMembers(members, searchQuery);
  return sortMembersByRole(filtered);
}
