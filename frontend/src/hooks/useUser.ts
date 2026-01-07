import { useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { profileService } from '../services/profile.service';
import type { Role } from '../types/user';
import {
  hasPermission,
  getAssignableRoles,
  ROLE_PERMISSIONS,
} from '../config/roles';

export function useUser() {
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    try {
      const updatedUser = await profileService.getProfile();
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  }, [setUser]);

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  // Check permission using centralized config
  const checkPermission = (permission: keyof typeof ROLE_PERMISSIONS): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  // Role level checks
  const isExecutive = hasRole('EXECUTIVE');
  const isAdmin = hasRole(['EXECUTIVE', 'ADMIN']);
  const isSupervisor = hasRole(['EXECUTIVE', 'ADMIN', 'SUPERVISOR']);
  const isTeamLead = hasRole(['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']);
  const isMember = hasRole('MEMBER');

  // Permission-based checks using centralized config
  const canCreateUsers = checkPermission('canCreateUsers');
  const canManageUsers = checkPermission('canManageUsers');
  const canViewDashboard = checkPermission('canViewDashboard');
  const canApproveExceptions = checkPermission('canApproveExceptions');
  const canManageCompanySettings = checkPermission('canManageCompanySettings');
  const canViewAllPersonnel = checkPermission('canViewAllPersonnel');
  const canManageTeams = checkPermission('canManageTeams');

  // Get roles that the current user can assign
  const assignableRoles = user ? getAssignableRoles(user.role) : [];

  const getFullName = () => {
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`;
  };

  const getInitials = () => {
    if (!user) return '';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  };

  return {
    user,
    company,
    isAuthenticated,
    hasRole,
    checkPermission,
    // Role level checks
    isExecutive,
    isAdmin,
    isSupervisor,
    isTeamLead,
    isMember,
    // Permission-based checks
    canCreateUsers,
    canManageUsers,
    canViewDashboard,
    canApproveExceptions,
    canManageCompanySettings,
    canViewAllPersonnel,
    canManageTeams,
    // Assignable roles
    assignableRoles,
    // Utility functions
    getFullName,
    getInitials,
    refreshUser,
  };
}
