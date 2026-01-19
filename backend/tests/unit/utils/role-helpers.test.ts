/**
 * Unit Tests for role-helpers.ts
 *
 * Tests role authorization helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  hasRole,
  isExecutive,
  isAdminOrHigher,
  isSupervisorOrHigher,
  isTeamLeadOrHigher,
  hasHigherOrEqualRole,
  canManageUser,
} from '../../../src/utils/role-helpers.js';
import type { AuthUser } from '../../../src/middlewares/auth.middleware.js';

// Helper to create mock AuthUser
function createMockUser(role: string): AuthUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    role,
    companyId: 'company-123',
    teamId: null,
  } as AuthUser;
}

// ============================================
// hasRole TESTS
// ============================================

describe('hasRole', () => {
  it('returns true when user has one of the specified roles', () => {
    const admin = createMockUser('ADMIN');
    expect(hasRole(admin, ['ADMIN', 'EXECUTIVE'])).toBe(true);
  });

  it('returns false when user does not have any specified role', () => {
    const worker = createMockUser('WORKER');
    expect(hasRole(worker, ['ADMIN', 'EXECUTIVE'])).toBe(false);
  });

  it('returns true for exact role match', () => {
    const teamLead = createMockUser('TEAM_LEAD');
    expect(hasRole(teamLead, ['TEAM_LEAD'])).toBe(true);
  });

  it('handles single role array', () => {
    const supervisor = createMockUser('SUPERVISOR');
    expect(hasRole(supervisor, ['SUPERVISOR'])).toBe(true);
    expect(hasRole(supervisor, ['ADMIN'])).toBe(false);
  });

  it('handles empty roles array', () => {
    const admin = createMockUser('ADMIN');
    expect(hasRole(admin, [])).toBe(false);
  });
});

// ============================================
// isExecutive TESTS
// ============================================

describe('isExecutive', () => {
  it('returns true for EXECUTIVE role', () => {
    const executive = createMockUser('EXECUTIVE');
    expect(isExecutive(executive)).toBe(true);
  });

  it('returns false for ADMIN (even though higher)', () => {
    const admin = createMockUser('ADMIN');
    expect(isExecutive(admin)).toBe(false);
  });

  it('returns false for SUPERVISOR', () => {
    const supervisor = createMockUser('SUPERVISOR');
    expect(isExecutive(supervisor)).toBe(false);
  });

  it('returns false for WORKER', () => {
    const worker = createMockUser('WORKER');
    expect(isExecutive(worker)).toBe(false);
  });
});

// ============================================
// isAdminOrHigher TESTS
// ============================================

describe('isAdminOrHigher', () => {
  it('returns true for ADMIN', () => {
    const admin = createMockUser('ADMIN');
    expect(isAdminOrHigher(admin)).toBe(true);
  });

  it('returns true for EXECUTIVE', () => {
    const executive = createMockUser('EXECUTIVE');
    expect(isAdminOrHigher(executive)).toBe(true);
  });

  it('returns false for SUPERVISOR', () => {
    const supervisor = createMockUser('SUPERVISOR');
    expect(isAdminOrHigher(supervisor)).toBe(false);
  });

  it('returns false for TEAM_LEAD', () => {
    const teamLead = createMockUser('TEAM_LEAD');
    expect(isAdminOrHigher(teamLead)).toBe(false);
  });

  it('returns false for WORKER', () => {
    const worker = createMockUser('WORKER');
    expect(isAdminOrHigher(worker)).toBe(false);
  });
});

// ============================================
// isSupervisorOrHigher TESTS
// ============================================

describe('isSupervisorOrHigher', () => {
  it('returns true for ADMIN', () => {
    const admin = createMockUser('ADMIN');
    expect(isSupervisorOrHigher(admin)).toBe(true);
  });

  it('returns true for EXECUTIVE', () => {
    const executive = createMockUser('EXECUTIVE');
    expect(isSupervisorOrHigher(executive)).toBe(true);
  });

  it('returns true for SUPERVISOR', () => {
    const supervisor = createMockUser('SUPERVISOR');
    expect(isSupervisorOrHigher(supervisor)).toBe(true);
  });

  it('returns false for TEAM_LEAD', () => {
    const teamLead = createMockUser('TEAM_LEAD');
    expect(isSupervisorOrHigher(teamLead)).toBe(false);
  });

  it('returns false for WORKER', () => {
    const worker = createMockUser('WORKER');
    expect(isSupervisorOrHigher(worker)).toBe(false);
  });
});

// ============================================
// isTeamLeadOrHigher TESTS
// ============================================

describe('isTeamLeadOrHigher', () => {
  it('returns true for ADMIN', () => {
    const admin = createMockUser('ADMIN');
    expect(isTeamLeadOrHigher(admin)).toBe(true);
  });

  it('returns true for EXECUTIVE', () => {
    const executive = createMockUser('EXECUTIVE');
    expect(isTeamLeadOrHigher(executive)).toBe(true);
  });

  it('returns true for SUPERVISOR', () => {
    const supervisor = createMockUser('SUPERVISOR');
    expect(isTeamLeadOrHigher(supervisor)).toBe(true);
  });

  it('returns true for TEAM_LEAD', () => {
    const teamLead = createMockUser('TEAM_LEAD');
    expect(isTeamLeadOrHigher(teamLead)).toBe(true);
  });

  it('returns false for WORKER', () => {
    const worker = createMockUser('WORKER');
    expect(isTeamLeadOrHigher(worker)).toBe(false);
  });

  it('returns false for MEMBER', () => {
    const member = createMockUser('MEMBER');
    expect(isTeamLeadOrHigher(member)).toBe(false);
  });
});

// ============================================
// hasHigherOrEqualRole TESTS
// ============================================

describe('hasHigherOrEqualRole', () => {
  describe('ADMIN role', () => {
    const admin = createMockUser('ADMIN');

    it('is higher than all other roles', () => {
      expect(hasHigherOrEqualRole(admin, 'EXECUTIVE')).toBe(true);
      expect(hasHigherOrEqualRole(admin, 'SUPERVISOR')).toBe(true);
      expect(hasHigherOrEqualRole(admin, 'TEAM_LEAD')).toBe(true);
      expect(hasHigherOrEqualRole(admin, 'WORKER')).toBe(true);
    });

    it('is equal to ADMIN', () => {
      expect(hasHigherOrEqualRole(admin, 'ADMIN')).toBe(true);
    });
  });

  describe('EXECUTIVE role', () => {
    const executive = createMockUser('EXECUTIVE');

    it('is lower than ADMIN', () => {
      expect(hasHigherOrEqualRole(executive, 'ADMIN')).toBe(false);
    });

    it('is equal to EXECUTIVE', () => {
      expect(hasHigherOrEqualRole(executive, 'EXECUTIVE')).toBe(true);
    });

    it('is higher than SUPERVISOR and below', () => {
      expect(hasHigherOrEqualRole(executive, 'SUPERVISOR')).toBe(true);
      expect(hasHigherOrEqualRole(executive, 'TEAM_LEAD')).toBe(true);
      expect(hasHigherOrEqualRole(executive, 'WORKER')).toBe(true);
    });
  });

  describe('SUPERVISOR role', () => {
    const supervisor = createMockUser('SUPERVISOR');

    it('is lower than ADMIN and EXECUTIVE', () => {
      expect(hasHigherOrEqualRole(supervisor, 'ADMIN')).toBe(false);
      expect(hasHigherOrEqualRole(supervisor, 'EXECUTIVE')).toBe(false);
    });

    it('is equal to SUPERVISOR', () => {
      expect(hasHigherOrEqualRole(supervisor, 'SUPERVISOR')).toBe(true);
    });

    it('is higher than TEAM_LEAD and WORKER', () => {
      expect(hasHigherOrEqualRole(supervisor, 'TEAM_LEAD')).toBe(true);
      expect(hasHigherOrEqualRole(supervisor, 'WORKER')).toBe(true);
    });
  });

  describe('TEAM_LEAD role', () => {
    const teamLead = createMockUser('TEAM_LEAD');

    it('is lower than SUPERVISOR and above', () => {
      expect(hasHigherOrEqualRole(teamLead, 'ADMIN')).toBe(false);
      expect(hasHigherOrEqualRole(teamLead, 'EXECUTIVE')).toBe(false);
      expect(hasHigherOrEqualRole(teamLead, 'SUPERVISOR')).toBe(false);
    });

    it('is equal to TEAM_LEAD', () => {
      expect(hasHigherOrEqualRole(teamLead, 'TEAM_LEAD')).toBe(true);
    });

    it('is higher than WORKER', () => {
      expect(hasHigherOrEqualRole(teamLead, 'WORKER')).toBe(true);
    });
  });

  describe('WORKER role', () => {
    const worker = createMockUser('WORKER');

    it('is lower than all management roles', () => {
      expect(hasHigherOrEqualRole(worker, 'ADMIN')).toBe(false);
      expect(hasHigherOrEqualRole(worker, 'EXECUTIVE')).toBe(false);
      expect(hasHigherOrEqualRole(worker, 'SUPERVISOR')).toBe(false);
      expect(hasHigherOrEqualRole(worker, 'TEAM_LEAD')).toBe(false);
    });

    it('is equal to WORKER', () => {
      expect(hasHigherOrEqualRole(worker, 'WORKER')).toBe(true);
    });

    it('is equal to MEMBER (legacy)', () => {
      expect(hasHigherOrEqualRole(worker, 'MEMBER')).toBe(true);
    });
  });
});

// ============================================
// canManageUser TESTS
// ============================================

describe('canManageUser', () => {
  describe('EXECUTIVE managing users', () => {
    const executive = createMockUser('EXECUTIVE');

    it('can manage other EXECUTIVES', () => {
      expect(canManageUser(executive, 'EXECUTIVE')).toBe(true);
    });

    it('can manage SUPERVISORS', () => {
      expect(canManageUser(executive, 'SUPERVISOR')).toBe(true);
    });

    it('can manage TEAM_LEADS', () => {
      expect(canManageUser(executive, 'TEAM_LEAD')).toBe(true);
    });

    it('can manage WORKERS', () => {
      expect(canManageUser(executive, 'WORKER')).toBe(true);
    });
  });

  describe('ADMIN managing users', () => {
    const admin = createMockUser('ADMIN');

    it('cannot manage EXECUTIVES (only EXECUTIVE can)', () => {
      // Based on canManageUser logic: only Executive can manage Executives
      expect(canManageUser(admin, 'EXECUTIVE')).toBe(false);
    });

    it('can manage SUPERVISORS', () => {
      expect(canManageUser(admin, 'SUPERVISOR')).toBe(true);
    });

    it('can manage TEAM_LEADS', () => {
      expect(canManageUser(admin, 'TEAM_LEAD')).toBe(true);
    });

    it('can manage WORKERS', () => {
      expect(canManageUser(admin, 'WORKER')).toBe(true);
    });
  });

  describe('SUPERVISOR managing users', () => {
    const supervisor = createMockUser('SUPERVISOR');

    it('cannot manage EXECUTIVES', () => {
      expect(canManageUser(supervisor, 'EXECUTIVE')).toBe(false);
    });

    it('cannot manage other SUPERVISORS (not admin or higher)', () => {
      expect(canManageUser(supervisor, 'SUPERVISOR')).toBe(false);
    });

    it('cannot manage TEAM_LEADS (not admin or higher)', () => {
      expect(canManageUser(supervisor, 'TEAM_LEAD')).toBe(false);
    });
  });

  describe('TEAM_LEAD managing users', () => {
    const teamLead = createMockUser('TEAM_LEAD');

    it('cannot manage any roles', () => {
      expect(canManageUser(teamLead, 'EXECUTIVE')).toBe(false);
      expect(canManageUser(teamLead, 'SUPERVISOR')).toBe(false);
      expect(canManageUser(teamLead, 'TEAM_LEAD')).toBe(false);
      expect(canManageUser(teamLead, 'WORKER')).toBe(false);
    });
  });

  describe('WORKER managing users', () => {
    const worker = createMockUser('WORKER');

    it('cannot manage any roles', () => {
      expect(canManageUser(worker, 'EXECUTIVE')).toBe(false);
      expect(canManageUser(worker, 'SUPERVISOR')).toBe(false);
      expect(canManageUser(worker, 'TEAM_LEAD')).toBe(false);
      expect(canManageUser(worker, 'WORKER')).toBe(false);
    });
  });
});
