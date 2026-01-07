import { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate all queries related to a data type
 * This ensures fresh data is fetched across all pages after mutations
 */
export function invalidateRelatedQueries(
  queryClient: QueryClient,
  type: 'incidents' | 'exceptions' | 'checkins' | 'teams' | 'users' | 'analytics' | 'notifications'
) {
  const queryKeysMap: Record<string, string[][]> = {
    incidents: [
      ['incidents'],
      ['incident'], // Single incident detail page - matches ['incident', id]
      ['team-incidents'],
      ['team-incidents-analytics'],
      ['analytics-incidents'],
      ['analytics'], // Dashboard analytics might include incident counts
    ],
    exceptions: [
      ['exceptions'],
      ['exception'], // Single exception detail - matches ['exception', id]
      ['team-exceptions'],
      ['team-exceptions-analytics'],
      ['pending-approvals'],
      ['analytics'],
    ],
    checkins: [
      ['checkins'],
      ['checkin'],  // Matches ['checkin', 'today'] and other checkin queries
      ['today-checkin'],
      ['team-checkins'],
      ['team-trends'],
      ['team-members-analytics'],
      ['analytics'],
      ['dashboard'],
    ],
    teams: [
      ['teams'],
      ['team'],
      ['my-team'],
      ['team-members'],
    ],
    users: [
      ['users'],
      ['team-members'],
    ],
    analytics: [
      ['analytics'],
      ['team-trends'],
      ['team-members-analytics'],
      ['team-incidents-analytics'],
      ['team-exceptions-analytics'],
      ['dashboard'],
    ],
    notifications: [
      ['notifications'],
      ['unread-notifications'],
    ],
  };

  const keysToInvalidate = queryKeysMap[type] || [];

  keysToInvalidate.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}

/**
 * Invalidate all cached data - use sparingly (e.g., after login/logout)
 */
export function invalidateAllQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries();
}
