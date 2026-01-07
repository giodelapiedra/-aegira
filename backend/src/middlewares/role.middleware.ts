import { Context, Next } from 'hono';
import { Role, ROLE_PERMISSIONS, hasPermission } from '../types/roles.js';

export function requireRole(...allowedRoles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized: No user found' }, 401);
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return c.json(
        { error: 'Forbidden: Insufficient permissions' },
        403
      );
    }

    await next();
  };
}

// Permission-based middleware using centralized permissions
export function requirePermission(permission: keyof typeof ROLE_PERMISSIONS) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized: No user found' }, 401);
    }

    if (!hasPermission(user.role as Role, permission)) {
      return c.json(
        { error: 'Forbidden: Insufficient permissions' },
        403
      );
    }

    await next();
  };
}

// ===== Hierarchy-based Role Guards =====

// Admin only - system-wide access
export function requireSystemAdmin() {
  return requireRole('ADMIN');
}

// Admin and Executive
export function requireExecutive() {
  return requireRole('ADMIN', 'EXECUTIVE');
}

// Admin, Executive, and Supervisor
export function requireSupervisor() {
  return requireRole('ADMIN', 'EXECUTIVE', 'SUPERVISOR');
}

// Admin, Executive, Supervisor, and Team Lead
export function requireTeamLead() {
  return requireRole('ADMIN', 'EXECUTIVE', 'SUPERVISOR', 'TEAM_LEAD');
}

// ===== Domain-specific Role Guards =====

// WHS Control access (for safety compliance)
export function requireWHSControl() {
  return requireRole('ADMIN', 'EXECUTIVE', 'WHS_CONTROL');
}

// Clinician access (for rehabilitation management)
export function requireClinician() {
  return requireRole('ADMIN', 'EXECUTIVE', 'CLINICIAN');
}

// WHS or Supervisor (for viewing safety-related data)
export function requireSafetyAccess() {
  return requireRole('ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR');
}
