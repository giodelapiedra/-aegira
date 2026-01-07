/**
 * Centralized role and permission helpers
 * Consistent authorization checks across all modules
 */

import { Role, ROLE_HIERARCHY } from '../types/roles.js';
import { AuthUser } from '../middlewares/auth.middleware.js';

// ============================================
// ROLE CHECK HELPERS
// ============================================

/**
 * Check if user has one of the specified roles
 */
export function hasRole(user: AuthUser, roles: Role[]): boolean {
  return roles.includes(user.role as Role);
}

/**
 * Check if user is Executive
 */
export function isExecutive(user: AuthUser): boolean {
  return user.role === 'EXECUTIVE';
}

/**
 * Check if user is Admin or Executive
 */
export function isAdminOrHigher(user: AuthUser): boolean {
  return hasRole(user, ['EXECUTIVE', 'ADMIN']);
}

/**
 * Check if user is Supervisor or higher
 */
export function isSupervisorOrHigher(user: AuthUser): boolean {
  return hasRole(user, ['EXECUTIVE', 'ADMIN', 'SUPERVISOR']);
}

/**
 * Check if user is Team Lead or higher
 */
export function isTeamLeadOrHigher(user: AuthUser): boolean {
  return hasRole(user, ['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']);
}

/**
 * Check if user has higher or equal role level than target
 */
export function hasHigherOrEqualRole(user: AuthUser, targetRole: Role): boolean {
  return ROLE_HIERARCHY[user.role as Role] >= ROLE_HIERARCHY[targetRole];
}

/**
 * Check if user can manage another user based on role hierarchy
 */
export function canManageUser(manager: AuthUser, targetRole: Role): boolean {
  // Only Executive can manage Executives
  if (targetRole === 'EXECUTIVE') {
    return isExecutive(manager);
  }

  // Admins and Executives can manage everyone else
  return isAdminOrHigher(manager) && hasHigherOrEqualRole(manager, targetRole);
}
