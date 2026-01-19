/**
 * Unit Tests for roles.ts
 *
 * Tests role hierarchy, permissions, and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  hasHigherRole,
  canManageRole,
  hasPermission,
  getAssignableRoles,
  isDomainRole,
  getRoleDomain,
  type Role,
} from '../../../src/types/roles.js';

// ============================================
// ROLE CONSTANTS TESTS
// ============================================

describe('ROLES constant', () => {
  it('has all expected roles', () => {
    expect(ROLES.ADMIN).toBe('ADMIN');
    expect(ROLES.EXECUTIVE).toBe('EXECUTIVE');
    expect(ROLES.SUPERVISOR).toBe('SUPERVISOR');
    expect(ROLES.CLINICIAN).toBe('CLINICIAN');
    expect(ROLES.WHS_CONTROL).toBe('WHS_CONTROL');
    expect(ROLES.TEAM_LEAD).toBe('TEAM_LEAD');
    expect(ROLES.WORKER).toBe('WORKER');
    expect(ROLES.MEMBER).toBe('MEMBER');
  });
});

describe('ROLE_HIERARCHY', () => {
  it('ADMIN has highest level (6)', () => {
    expect(ROLE_HIERARCHY.ADMIN).toBe(6);
  });

  it('EXECUTIVE has level 5', () => {
    expect(ROLE_HIERARCHY.EXECUTIVE).toBe(5);
  });

  it('SUPERVISOR, CLINICIAN, WHS_CONTROL are parallel at level 4', () => {
    expect(ROLE_HIERARCHY.SUPERVISOR).toBe(4);
    expect(ROLE_HIERARCHY.CLINICIAN).toBe(4);
    expect(ROLE_HIERARCHY.WHS_CONTROL).toBe(4);
  });

  it('TEAM_LEAD has level 3', () => {
    expect(ROLE_HIERARCHY.TEAM_LEAD).toBe(3);
  });

  it('WORKER and MEMBER are at same level (2)', () => {
    expect(ROLE_HIERARCHY.WORKER).toBe(2);
    expect(ROLE_HIERARCHY.MEMBER).toBe(2);
  });
});

// ============================================
// hasHigherRole TESTS
// ============================================

describe('hasHigherRole', () => {
  it('ADMIN has higher role than EXECUTIVE', () => {
    expect(hasHigherRole('ADMIN', 'EXECUTIVE')).toBe(true);
  });

  it('EXECUTIVE has higher role than SUPERVISOR', () => {
    expect(hasHigherRole('EXECUTIVE', 'SUPERVISOR')).toBe(true);
  });

  it('SUPERVISOR has higher role than TEAM_LEAD', () => {
    expect(hasHigherRole('SUPERVISOR', 'TEAM_LEAD')).toBe(true);
  });

  it('TEAM_LEAD has higher role than WORKER', () => {
    expect(hasHigherRole('TEAM_LEAD', 'WORKER')).toBe(true);
  });

  it('same role returns true (equal)', () => {
    expect(hasHigherRole('SUPERVISOR', 'SUPERVISOR')).toBe(true);
  });

  it('parallel roles (SUPERVISOR, CLINICIAN, WHS_CONTROL) are equal', () => {
    expect(hasHigherRole('SUPERVISOR', 'CLINICIAN')).toBe(true);
    expect(hasHigherRole('CLINICIAN', 'SUPERVISOR')).toBe(true);
    expect(hasHigherRole('WHS_CONTROL', 'SUPERVISOR')).toBe(true);
  });

  it('lower role returns false', () => {
    expect(hasHigherRole('WORKER', 'TEAM_LEAD')).toBe(false);
    expect(hasHigherRole('TEAM_LEAD', 'SUPERVISOR')).toBe(false);
  });
});

// ============================================
// canManageRole TESTS
// ============================================

describe('canManageRole', () => {
  it('ADMIN can manage EXECUTIVE', () => {
    expect(canManageRole('ADMIN', 'EXECUTIVE')).toBe(true);
  });

  it('ADMIN can manage all lower roles', () => {
    expect(canManageRole('ADMIN', 'SUPERVISOR')).toBe(true);
    expect(canManageRole('ADMIN', 'TEAM_LEAD')).toBe(true);
    expect(canManageRole('ADMIN', 'WORKER')).toBe(true);
  });

  it('EXECUTIVE can manage SUPERVISOR and below', () => {
    expect(canManageRole('EXECUTIVE', 'SUPERVISOR')).toBe(true);
    expect(canManageRole('EXECUTIVE', 'TEAM_LEAD')).toBe(true);
    expect(canManageRole('EXECUTIVE', 'WORKER')).toBe(true);
  });

  it('EXECUTIVE cannot manage ADMIN', () => {
    expect(canManageRole('EXECUTIVE', 'ADMIN')).toBe(false);
  });

  it('same role cannot manage itself (strictly higher required)', () => {
    expect(canManageRole('SUPERVISOR', 'SUPERVISOR')).toBe(false);
    expect(canManageRole('ADMIN', 'ADMIN')).toBe(false);
  });

  it('parallel roles cannot manage each other', () => {
    expect(canManageRole('SUPERVISOR', 'CLINICIAN')).toBe(false);
    expect(canManageRole('CLINICIAN', 'WHS_CONTROL')).toBe(false);
  });

  it('SUPERVISOR can manage TEAM_LEAD and WORKER', () => {
    expect(canManageRole('SUPERVISOR', 'TEAM_LEAD')).toBe(true);
    expect(canManageRole('SUPERVISOR', 'WORKER')).toBe(true);
  });

  it('TEAM_LEAD can only manage WORKER', () => {
    expect(canManageRole('TEAM_LEAD', 'WORKER')).toBe(true);
    expect(canManageRole('TEAM_LEAD', 'SUPERVISOR')).toBe(false);
  });

  it('WORKER cannot manage anyone', () => {
    expect(canManageRole('WORKER', 'MEMBER')).toBe(false);
    expect(canManageRole('WORKER', 'WORKER')).toBe(false);
  });
});

// ============================================
// hasPermission TESTS
// ============================================

describe('hasPermission', () => {
  describe('canCreateUsers permission', () => {
    it('ADMIN has canCreateUsers', () => {
      expect(hasPermission('ADMIN', 'canCreateUsers')).toBe(true);
    });

    it('EXECUTIVE has canCreateUsers', () => {
      expect(hasPermission('EXECUTIVE', 'canCreateUsers')).toBe(true);
    });

    it('SUPERVISOR does NOT have canCreateUsers', () => {
      expect(hasPermission('SUPERVISOR', 'canCreateUsers')).toBe(false);
    });

    it('WORKER does NOT have canCreateUsers', () => {
      expect(hasPermission('WORKER', 'canCreateUsers')).toBe(false);
    });
  });

  describe('canViewDashboard permission', () => {
    it('ADMIN has canViewDashboard', () => {
      expect(hasPermission('ADMIN', 'canViewDashboard')).toBe(true);
    });

    it('EXECUTIVE has canViewDashboard', () => {
      expect(hasPermission('EXECUTIVE', 'canViewDashboard')).toBe(true);
    });

    it('SUPERVISOR has canViewDashboard', () => {
      expect(hasPermission('SUPERVISOR', 'canViewDashboard')).toBe(true);
    });

    it('TEAM_LEAD does NOT have canViewDashboard', () => {
      expect(hasPermission('TEAM_LEAD', 'canViewDashboard')).toBe(false);
    });
  });

  describe('canManageTeams permission', () => {
    it('TEAM_LEAD has canManageTeams', () => {
      expect(hasPermission('TEAM_LEAD', 'canManageTeams')).toBe(true);
    });

    it('SUPERVISOR has canManageTeams', () => {
      expect(hasPermission('SUPERVISOR', 'canManageTeams')).toBe(true);
    });

    it('WORKER does NOT have canManageTeams', () => {
      expect(hasPermission('WORKER', 'canManageTeams')).toBe(false);
    });
  });

  describe('canApproveExceptions permission', () => {
    it('TEAM_LEAD has canApproveExceptions', () => {
      expect(hasPermission('TEAM_LEAD', 'canApproveExceptions')).toBe(true);
    });

    it('ADMIN has canApproveExceptions', () => {
      expect(hasPermission('ADMIN', 'canApproveExceptions')).toBe(true);
    });

    it('WORKER does NOT have canApproveExceptions', () => {
      expect(hasPermission('WORKER', 'canApproveExceptions')).toBe(false);
    });
  });

  describe('canViewWHSDashboard permission', () => {
    it('WHS_CONTROL has canViewWHSDashboard', () => {
      expect(hasPermission('WHS_CONTROL', 'canViewWHSDashboard')).toBe(true);
    });

    it('EXECUTIVE has canViewWHSDashboard', () => {
      expect(hasPermission('EXECUTIVE', 'canViewWHSDashboard')).toBe(true);
    });

    it('SUPERVISOR does NOT have canViewWHSDashboard', () => {
      expect(hasPermission('SUPERVISOR', 'canViewWHSDashboard')).toBe(false);
    });
  });

  describe('canManageRehab permission', () => {
    it('CLINICIAN has canManageRehab', () => {
      expect(hasPermission('CLINICIAN', 'canManageRehab')).toBe(true);
    });

    it('EXECUTIVE has canManageRehab', () => {
      expect(hasPermission('EXECUTIVE', 'canManageRehab')).toBe(true);
    });

    it('SUPERVISOR does NOT have canManageRehab', () => {
      expect(hasPermission('SUPERVISOR', 'canManageRehab')).toBe(false);
    });
  });

  describe('canViewSystemLogs permission', () => {
    it('ADMIN has canViewSystemLogs', () => {
      expect(hasPermission('ADMIN', 'canViewSystemLogs')).toBe(true);
    });

    it('EXECUTIVE has canViewSystemLogs', () => {
      expect(hasPermission('EXECUTIVE', 'canViewSystemLogs')).toBe(true);
    });

    it('SUPERVISOR does NOT have canViewSystemLogs', () => {
      expect(hasPermission('SUPERVISOR', 'canViewSystemLogs')).toBe(false);
    });
  });
});

// ============================================
// getAssignableRoles TESTS
// ============================================

describe('getAssignableRoles', () => {
  it('ADMIN can assign all roles except ADMIN', () => {
    const assignable = getAssignableRoles('ADMIN');
    expect(assignable).toContain('EXECUTIVE');
    expect(assignable).toContain('SUPERVISOR');
    expect(assignable).toContain('TEAM_LEAD');
    expect(assignable).toContain('WORKER');
    expect(assignable).not.toContain('ADMIN');
  });

  it('EXECUTIVE can assign SUPERVISOR and below', () => {
    const assignable = getAssignableRoles('EXECUTIVE');
    expect(assignable).toContain('SUPERVISOR');
    expect(assignable).toContain('CLINICIAN');
    expect(assignable).toContain('WHS_CONTROL');
    expect(assignable).toContain('TEAM_LEAD');
    expect(assignable).toContain('WORKER');
    expect(assignable).not.toContain('EXECUTIVE');
    expect(assignable).not.toContain('ADMIN');
  });

  it('SUPERVISOR can assign TEAM_LEAD and WORKER', () => {
    const assignable = getAssignableRoles('SUPERVISOR');
    expect(assignable).toContain('TEAM_LEAD');
    expect(assignable).toContain('WORKER');
    expect(assignable).not.toContain('SUPERVISOR');
    expect(assignable).not.toContain('EXECUTIVE');
  });

  it('TEAM_LEAD can only assign WORKER', () => {
    const assignable = getAssignableRoles('TEAM_LEAD');
    expect(assignable).toContain('WORKER');
    expect(assignable).toContain('MEMBER');
    expect(assignable).not.toContain('TEAM_LEAD');
  });

  it('WORKER cannot assign any roles', () => {
    const assignable = getAssignableRoles('WORKER');
    expect(assignable).toEqual([]);
  });
});

// ============================================
// isDomainRole TESTS
// ============================================

describe('isDomainRole', () => {
  it('WHS_CONTROL is a domain role', () => {
    expect(isDomainRole('WHS_CONTROL')).toBe(true);
  });

  it('CLINICIAN is a domain role', () => {
    expect(isDomainRole('CLINICIAN')).toBe(true);
  });

  it('ADMIN is NOT a domain role', () => {
    expect(isDomainRole('ADMIN')).toBe(false);
  });

  it('SUPERVISOR is NOT a domain role', () => {
    expect(isDomainRole('SUPERVISOR')).toBe(false);
  });

  it('WORKER is NOT a domain role', () => {
    expect(isDomainRole('WORKER')).toBe(false);
  });
});

// ============================================
// getRoleDomain TESTS
// ============================================

describe('getRoleDomain', () => {
  it('WHS_CONTROL has safety domain', () => {
    expect(getRoleDomain('WHS_CONTROL')).toBe('safety');
  });

  it('CLINICIAN has rehabilitation domain', () => {
    expect(getRoleDomain('CLINICIAN')).toBe('rehabilitation');
  });

  it('ADMIN has no domain (null)', () => {
    expect(getRoleDomain('ADMIN')).toBe(null);
  });

  it('EXECUTIVE has no domain (null)', () => {
    expect(getRoleDomain('EXECUTIVE')).toBe(null);
  });

  it('SUPERVISOR has no domain (null)', () => {
    expect(getRoleDomain('SUPERVISOR')).toBe(null);
  });

  it('TEAM_LEAD has no domain (null)', () => {
    expect(getRoleDomain('TEAM_LEAD')).toBe(null);
  });

  it('WORKER has no domain (null)', () => {
    expect(getRoleDomain('WORKER')).toBe(null);
  });
});

// ============================================
// ROLE_PERMISSIONS STRUCTURE TESTS
// ============================================

describe('ROLE_PERMISSIONS structure', () => {
  it('has all expected permission keys', () => {
    expect(ROLE_PERMISSIONS).toHaveProperty('canCreateUsers');
    expect(ROLE_PERMISSIONS).toHaveProperty('canManageUsers');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewDashboard');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewAllPersonnel');
    expect(ROLE_PERMISSIONS).toHaveProperty('canManageTeams');
    expect(ROLE_PERMISSIONS).toHaveProperty('canApproveExceptions');
    expect(ROLE_PERMISSIONS).toHaveProperty('canManageCompanySettings');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewWHSDashboard');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewSafetyIncidents');
    expect(ROLE_PERMISSIONS).toHaveProperty('canManageRehab');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewAllRehab');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewClinicianDashboard');
    expect(ROLE_PERMISSIONS).toHaveProperty('canViewSystemLogs');
  });

  it('each permission is an array of roles', () => {
    Object.values(ROLE_PERMISSIONS).forEach((roles) => {
      expect(Array.isArray(roles)).toBe(true);
      roles.forEach((role) => {
        expect(Object.values(ROLES)).toContain(role);
      });
    });
  });
});
