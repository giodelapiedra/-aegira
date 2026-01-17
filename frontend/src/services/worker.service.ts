/**
 * Worker Service
 *
 * API service for worker-specific endpoints.
 * Provides consolidated dashboard data fetching.
 */

import api from './api';
import type { WorkerDashboardResponse } from '../types/worker';

export const workerService = {
  /**
   * Get consolidated worker dashboard data
   *
   * Fetches all data needed for worker pages in a single request:
   * - User profile with streaks
   * - Team schedule info
   * - Leave status
   * - Today's check-in
   * - Week statistics
   * - Recent check-ins
   * - Pending exemption
   * - Holiday status
   */
  async getDashboard(): Promise<WorkerDashboardResponse> {
    const response = await api.get<WorkerDashboardResponse>('/worker/dashboard');
    return response.data;
  },
};
