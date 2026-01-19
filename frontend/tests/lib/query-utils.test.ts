/**
 * Query Utils Tests
 *
 * Tests for React Query utility functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateRelatedQueries, invalidateAllQueries } from '../../src/lib/query-utils';

// ============================================
// MOCK QUERY CLIENT
// ============================================

describe('Query Utils', () => {
  let queryClient: QueryClient;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient();
    invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
  });

  // ============================================
  // INVALIDATE RELATED QUERIES TESTS
  // ============================================

  describe('invalidateRelatedQueries', () => {
    describe('incidents type', () => {
      it('invalidates incident-related queries', () => {
        invalidateRelatedQueries(queryClient, 'incidents');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['incidents'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['incident'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-incidents'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['team-incidents-analytics'],
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['analytics-incidents'],
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
      });

      it('calls invalidateQueries 6 times for incidents', () => {
        invalidateRelatedQueries(queryClient, 'incidents');
        expect(invalidateQueriesSpy).toHaveBeenCalledTimes(6);
      });
    });

    describe('exceptions type', () => {
      it('invalidates exception-related queries', () => {
        invalidateRelatedQueries(queryClient, 'exceptions');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['exceptions'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['exception'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-exceptions'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['pending-approvals'],
        });
      });
    });

    describe('checkins type', () => {
      it('invalidates checkin-related queries', () => {
        invalidateRelatedQueries(queryClient, 'checkins');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['checkins'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['checkin'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['today-checkin'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-checkins'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      });
    });

    describe('teams type', () => {
      it('invalidates team-related queries', () => {
        invalidateRelatedQueries(queryClient, 'teams');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['teams'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['my-team'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-members'] });
      });
    });

    describe('users type', () => {
      it('invalidates user-related queries', () => {
        invalidateRelatedQueries(queryClient, 'users');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-members'] });
      });

      it('calls invalidateQueries 2 times for users', () => {
        invalidateRelatedQueries(queryClient, 'users');
        expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
      });
    });

    describe('analytics type', () => {
      it('invalidates analytics-related queries', () => {
        invalidateRelatedQueries(queryClient, 'analytics');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['team-trends'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['team-members-analytics'],
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      });
    });

    describe('notifications type', () => {
      it('invalidates notification-related queries', () => {
        invalidateRelatedQueries(queryClient, 'notifications');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['unread-notifications'],
        });
      });
    });

    describe('leave-status type', () => {
      it('invalidates leave-status queries', () => {
        invalidateRelatedQueries(queryClient, 'leave-status');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['leave-status'] });
      });

      it('calls invalidateQueries 1 time for leave-status', () => {
        invalidateRelatedQueries(queryClient, 'leave-status');
        expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('approved-leave-today type', () => {
      it('invalidates approved-leave-today queries', () => {
        invalidateRelatedQueries(queryClient, 'approved-leave-today');

        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['approved-leave-today'],
        });
      });
    });
  });

  // ============================================
  // INVALIDATE ALL QUERIES TESTS
  // ============================================

  describe('invalidateAllQueries', () => {
    it('calls invalidateQueries without parameters', () => {
      invalidateAllQueries(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledWith();
    });

    it('calls invalidateQueries once', () => {
      invalidateAllQueries(queryClient);

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================
// QUERY KEYS MAPPING TESTS
// ============================================

describe('Query Keys Mapping', () => {
  it('incidents includes analytics for dashboard updates', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateRelatedQueries(queryClient, 'incidents');

    // Verify analytics is included (for dashboard update)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
  });

  it('checkins includes dashboard for real-time updates', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateRelatedQueries(queryClient, 'checkins');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  it('exceptions includes pending-approvals for approval flow', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateRelatedQueries(queryClient, 'exceptions');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['pending-approvals'] });
  });

  it('users and teams both invalidate team-members', () => {
    const queryClient = new QueryClient();

    // For users
    let spy = vi.spyOn(queryClient, 'invalidateQueries');
    invalidateRelatedQueries(queryClient, 'users');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['team-members'] });

    spy.mockClear();

    // For teams
    invalidateRelatedQueries(queryClient, 'teams');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['team-members'] });
  });
});

// ============================================
// REAL-WORLD SCENARIOS
// ============================================

describe('Query Utils - Real-world Scenarios', () => {
  it('after creating incident, refreshes incident list and analytics', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    // After POST /incidents
    invalidateRelatedQueries(queryClient, 'incidents');

    // Should refresh list views
    expect(spy).toHaveBeenCalledWith({ queryKey: ['incidents'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['team-incidents'] });

    // Should refresh analytics
    expect(spy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
  });

  it('after check-in, refreshes dashboard and team data', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    // After POST /checkins
    invalidateRelatedQueries(queryClient, 'checkins');

    // Should refresh personal checkin status
    expect(spy).toHaveBeenCalledWith({ queryKey: ['today-checkin'] });

    // Should refresh team views
    expect(spy).toHaveBeenCalledWith({ queryKey: ['team-checkins'] });

    // Should refresh dashboard
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  it('after login, clears all cached data', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    // After successful login
    invalidateAllQueries(queryClient);

    // Should invalidate everything
    expect(spy).toHaveBeenCalledWith();
  });

  it('after approving exception, refreshes approvals and exceptions', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    // After PUT /exceptions/:id/approve
    invalidateRelatedQueries(queryClient, 'exceptions');

    // Should refresh exceptions list
    expect(spy).toHaveBeenCalledWith({ queryKey: ['exceptions'] });

    // Should refresh pending approvals count
    expect(spy).toHaveBeenCalledWith({ queryKey: ['pending-approvals'] });
  });
});
