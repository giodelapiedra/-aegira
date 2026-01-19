/**
 * Auth Store Tests
 *
 * Tests for Zustand auth store state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../src/store/auth.store';
import type { User, Company } from '../../src/types/user';

// ============================================
// TEST DATA
// ============================================

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'WORKER',
  teamId: 'team-123',
  companyId: 'company-123',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockCompany: Company = {
  id: 'company-123',
  name: 'Test Company',
  timezone: 'Asia/Manila',
  workDays: 'MON,TUE,WED,THU,FRI',
  shiftStart: '08:00',
  shiftEnd: '17:00',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockAccessToken = 'mock-access-token-12345';

// ============================================
// STORE TESTS
// ============================================

describe('Auth Store - Initial State', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('starts with null user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
  });

  it('starts with null company', () => {
    const state = useAuthStore.getState();
    expect(state.company).toBeNull();
  });

  it('starts with null accessToken', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
  });

  it('starts as not authenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('starts as loading', () => {
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(true);
  });
});

describe('Auth Store - setUser', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('sets user correctly', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
  });

  it('does not change other state properties', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.company).toBeNull();
    expect(state.accessToken).toBeNull();
  });
});

describe('Auth Store - setCompany', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('sets company correctly', () => {
    useAuthStore.getState().setCompany(mockCompany);
    const state = useAuthStore.getState();
    expect(state.company).toEqual(mockCompany);
  });
});

describe('Auth Store - setAccessToken', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('sets access token correctly', () => {
    useAuthStore.getState().setAccessToken(mockAccessToken);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(mockAccessToken);
  });
});

describe('Auth Store - login', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('sets user, company, and access token', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    const state = useAuthStore.getState();

    expect(state.user).toEqual(mockUser);
    expect(state.company).toEqual(mockCompany);
    expect(state.accessToken).toBe(mockAccessToken);
  });

  it('sets isAuthenticated to true', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  });

  it('sets isLoading to false', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
  });
});

describe('Auth Store - logout', () => {
  beforeEach(() => {
    // Start with authenticated state
    useAuthStore.setState({
      user: mockUser,
      company: mockCompany,
      accessToken: mockAccessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('clears user', () => {
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
  });

  it('clears company', () => {
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.company).toBeNull();
  });

  it('clears access token', () => {
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
  });

  it('sets isAuthenticated to false', () => {
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('sets isLoading to false', () => {
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
  });
});

describe('Auth Store - setLoading', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('sets loading to true', () => {
    useAuthStore.getState().setLoading(true);
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(true);
  });

  it('sets loading to false', () => {
    useAuthStore.setState({ isLoading: true });
    useAuthStore.getState().setLoading(false);
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
  });
});

// ============================================
// STATE TRANSITIONS TESTS
// ============================================

describe('Auth Store - State Transitions', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('transitions from loading to authenticated', () => {
    const { login } = useAuthStore.getState();

    // Initial: loading
    expect(useAuthStore.getState().isLoading).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Login
    login(mockUser, mockCompany, mockAccessToken);

    // After login: authenticated, not loading
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('transitions from authenticated to unauthenticated', () => {
    // Start authenticated
    useAuthStore.setState({
      user: mockUser,
      company: mockCompany,
      accessToken: mockAccessToken,
      isAuthenticated: true,
      isLoading: false,
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Logout
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ============================================
// USER ROLE TESTS
// ============================================

describe('Auth Store - User Roles', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('stores WORKER role', () => {
    const workerUser: User = { ...mockUser, role: 'WORKER' };
    useAuthStore.getState().login(workerUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().user?.role).toBe('WORKER');
  });

  it('stores TEAM_LEAD role', () => {
    const teamLeadUser: User = { ...mockUser, role: 'TEAM_LEAD' };
    useAuthStore.getState().login(teamLeadUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().user?.role).toBe('TEAM_LEAD');
  });

  it('stores SUPERVISOR role', () => {
    const supervisorUser: User = { ...mockUser, role: 'SUPERVISOR' };
    useAuthStore.getState().login(supervisorUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().user?.role).toBe('SUPERVISOR');
  });

  it('stores EXECUTIVE role', () => {
    const executiveUser: User = { ...mockUser, role: 'EXECUTIVE' };
    useAuthStore.getState().login(executiveUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().user?.role).toBe('EXECUTIVE');
  });

  it('stores ADMIN role', () => {
    const adminUser: User = { ...mockUser, role: 'ADMIN' };
    useAuthStore.getState().login(adminUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().user?.role).toBe('ADMIN');
  });
});

// ============================================
// COMPANY DATA TESTS
// ============================================

describe('Auth Store - Company Data', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('stores company timezone', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().company?.timezone).toBe('Asia/Manila');
  });

  it('stores company work days', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().company?.workDays).toBe('MON,TUE,WED,THU,FRI');
  });

  it('stores company shift times', () => {
    useAuthStore.getState().login(mockUser, mockCompany, mockAccessToken);
    expect(useAuthStore.getState().company?.shiftStart).toBe('08:00');
    expect(useAuthStore.getState().company?.shiftEnd).toBe('17:00');
  });
});
