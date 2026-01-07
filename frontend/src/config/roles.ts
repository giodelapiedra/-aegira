import type { Role } from '../types/user';

// Role hierarchy - higher number = more permissions
// Must match backend/src/types/roles.ts
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 6,           // System-wide control
  EXECUTIVE: 5,       // Company owner
  SUPERVISOR: 4,      // Multi-team oversight
  CLINICIAN: 4,       // Rehabilitation management (parallel to SUPERVISOR)
  WHS_CONTROL: 4,     // Safety compliance (parallel to SUPERVISOR)
  TEAM_LEAD: 3,       // Single team management
  WORKER: 2,          // Basic access
  MEMBER: 2,          // Legacy - same as WORKER
};

// Centralized role permissions - mirrors backend configuration
export const ROLE_PERMISSIONS = {
  // ===== User Management =====
  canCreateUsers: ['ADMIN', 'EXECUTIVE'] as Role[],
  canManageUsers: ['ADMIN', 'EXECUTIVE'] as Role[],

  // ===== Dashboard & Analytics =====
  canViewDashboard: ['ADMIN', 'EXECUTIVE', 'SUPERVISOR'] as Role[],
  canViewAllPersonnel: ['ADMIN', 'EXECUTIVE', 'SUPERVISOR'] as Role[],

  // ===== Team Management =====
  canManageTeams: ['ADMIN', 'EXECUTIVE', 'SUPERVISOR', 'TEAM_LEAD'] as Role[],
  canApproveExceptions: ['ADMIN', 'EXECUTIVE', 'SUPERVISOR', 'TEAM_LEAD'] as Role[],

  // ===== Company Settings =====
  canManageCompanySettings: ['ADMIN', 'EXECUTIVE'] as Role[],

  // ===== WHS Dashboard =====
  canViewWHSDashboard: ['ADMIN', 'EXECUTIVE', 'WHS_CONTROL'] as Role[],
  canViewSafetyIncidents: ['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR'] as Role[],

  // ===== Rehabilitation (Clinician) =====
  canManageRehab: ['ADMIN', 'EXECUTIVE', 'CLINICIAN'] as Role[],
  canViewAllRehab: ['ADMIN', 'EXECUTIVE', 'CLINICIAN', 'SUPERVISOR'] as Role[],
  canViewClinicianDashboard: ['ADMIN', 'EXECUTIVE', 'CLINICIAN'] as Role[],

  // ===== System Logs =====
  canViewSystemLogs: ['ADMIN', 'EXECUTIVE'] as Role[],
} as const;

// Role display configuration
export const ROLE_CONFIG: Record<Role, { label: string; color: string; bgColor: string }> = {
  ADMIN: {
    label: 'Admin',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  EXECUTIVE: {
    label: 'Executive',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  CLINICIAN: {
    label: 'Clinician',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
  WHS_CONTROL: {
    label: 'WHS Control',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  TEAM_LEAD: {
    label: 'Team Lead',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  WORKER: {
    label: 'Worker',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  MEMBER: {
    label: 'Member',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
};

// Utility functions
export function hasHigherRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[managerRole] > ROLE_HIERARCHY[targetRole];
}

export function hasPermission(
  userRole: Role,
  permission: keyof typeof ROLE_PERMISSIONS
): boolean {
  return ROLE_PERMISSIONS[permission].includes(userRole);
}

// Get roles that a user can assign to others
export function getAssignableRoles(userRole: Role): Role[] {
  const userLevel = ROLE_HIERARCHY[userRole];
  return (Object.entries(ROLE_HIERARCHY) as [Role, number][])
    .filter(([_, level]) => level < userLevel)
    .map(([role]) => role);
}

// Get all roles below the given role (for role change dropdowns)
export function getRolesBelowLevel(userRole: Role): Role[] {
  return getAssignableRoles(userRole);
}
