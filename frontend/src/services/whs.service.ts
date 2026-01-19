import api from './api';

export interface WHSDashboardData {
  stats: {
    totalMembers: number;
    openIncidents: number;
  };
  safetyIncidents: {
    id: string;
    caseNumber: string;
    title: string;
    type: string;
    severity: string;
    status: string;
    reporter: string;
    team: string;
    createdAt: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    description: string;
    createdAt: string;
  }[];
}

export const whsService = {
  // ===== Dashboard =====
  getDashboard: async (): Promise<WHSDashboardData> => {
    const response = await api.get('/whs/dashboard');
    return response.data;
  },

  // ===== Safety Incidents =====
  getSafetyIncidents: async (params?: {
    status?: string;
    severity?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; pagination: any }> => {
    const response = await api.get('/whs/incidents', { params });
    return response.data;
  },

  // ===== My Assigned Incidents (for WHS officer) =====
  getMyAssignedIncidents: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; pagination: any }> => {
    const response = await api.get('/whs/my-incidents', { params });
    return response.data;
  },

  // ===== My Assigned Incidents Stats =====
  getMyAssignedIncidentsStats: async (): Promise<{
    total: number;
    active: number;
    resolved: number;
    byStatus: { open: number; inProgress: number; resolved: number; closed: number };
  }> => {
    const response = await api.get('/whs/my-incidents/stats');
    return response.data;
  },

  // ===== Analytics =====
  getAnalyticsSummary: async (): Promise<{
    total: number;
    active: number;
    resolved: number;
    critical: number;
    pendingRTW: number;
    overdue: number;
    avgResolutionDays: number | null;
    byStatus: {
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
    };
  }> => {
    const response = await api.get('/whs/analytics/summary');
    return response.data;
  },

  getAnalyticsBreakdown: async (): Promise<{
    byType: Array<{ type: string; _count: { type: number } }>;
    bySeverity: Array<{ severity: string; _count: { severity: number } }>;
    byStatus: Array<{ status: string; _count: { status: number } }>;
  }> => {
    const response = await api.get('/whs/analytics/breakdown');
    return response.data;
  },

  getOverdueCases: async (): Promise<{
    data: Array<{
      id: string;
      caseNumber: string;
      type: string;
      severity: string;
      status: string;
      title: string;
      whsAssignedAt: string;
      days_open: number;
      reporter_first_name: string | null;
      reporter_last_name: string | null;
      team_name: string | null;
    }>;
  }> => {
    const response = await api.get('/whs/analytics/overdue-cases');
    return response.data;
  },

  getRTWPending: async (): Promise<{
    data: Array<{
      id: string;
      caseNumber: string;
      type: string;
      resolvedAt: string;
      daysSinceResolved: number | null;
      reporter: { firstName: string; lastName: string };
      team: { name: string } | null;
    }>;
  }> => {
    const response = await api.get('/whs/analytics/rtw-pending');
    return response.data;
  },
};
