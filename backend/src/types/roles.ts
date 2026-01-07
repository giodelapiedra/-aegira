export const ROLES = {
  ADMIN: 'ADMIN',           // Level 6 - System-wide control
  EXECUTIVE: 'EXECUTIVE',   // Level 5 - Company owner
  SUPERVISOR: 'SUPERVISOR', // Level 4 - Multi-team oversight
  CLINICIAN: 'CLINICIAN',   // Level 4 - Rehabilitation management (parallel)
  WHS_CONTROL: 'WHS_CONTROL', // Level 4 - Safety compliance (parallel)
  TEAM_LEAD: 'TEAM_LEAD',   // Level 3 - Single team management
  WORKER: 'WORKER',         // Level 2 - Basic access
  MEMBER: 'MEMBER',         // Legacy - same as WORKER (Level 2)
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Role hierarchy - higher number = more access
// Note: SUPERVISOR, CLINICIAN, WHS_CONTROL are parallel (same level, different domains)
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 6,
  EXECUTIVE: 5,
  SUPERVISOR: 4,
  CLINICIAN: 4,     // Same level as Supervisor (parallel)
  WHS_CONTROL: 4,   // Same level as Supervisor (parallel)
  TEAM_LEAD: 3,
  WORKER: 2,
  MEMBER: 2,        // Legacy - same level as WORKER
};

// Role permission groups for centralized access control
export const ROLE_PERMISSIONS = {
  // ===== User Management =====
  canCreateUsers: [ROLES.ADMIN, ROLES.EXECUTIVE] as Role[],
  canManageUsers: [ROLES.ADMIN, ROLES.EXECUTIVE] as Role[],

  // ===== Dashboard & Analytics =====
  canViewDashboard: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.SUPERVISOR] as Role[],
  canViewAllPersonnel: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.SUPERVISOR] as Role[],

  // ===== Team Management =====
  canManageTeams: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.SUPERVISOR, ROLES.TEAM_LEAD] as Role[],
  canApproveExceptions: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.SUPERVISOR, ROLES.TEAM_LEAD] as Role[],

  // ===== Company Settings =====
  canManageCompanySettings: [ROLES.ADMIN, ROLES.EXECUTIVE] as Role[],

  // ===== WHS Dashboard =====
  canViewWHSDashboard: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL] as Role[],
  canViewSafetyIncidents: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL, ROLES.SUPERVISOR] as Role[],

  // ===== Rehabilitation (Clinician) =====
  canManageRehab: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN] as Role[],
  canViewAllRehab: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN, ROLES.SUPERVISOR] as Role[],
  canViewClinicianDashboard: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN] as Role[],

  // ===== System Logs =====
  canViewSystemLogs: [ROLES.ADMIN, ROLES.EXECUTIVE] as Role[],
} as const;

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
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, level]) => level < userLevel)
    .map(([role]) => role as Role);
}

// Check if role is a domain-specific role (WHS, Clinician)
export function isDomainRole(role: Role): boolean {
  return role === ROLES.WHS_CONTROL || role === ROLES.CLINICIAN;
}

// Get the domain for a role
export function getRoleDomain(role: Role): string | null {
  switch (role) {
    case ROLES.WHS_CONTROL:
      return 'safety';
    case ROLES.CLINICIAN:
      return 'rehabilitation';
    default:
      return null;
  }
}
