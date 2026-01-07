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
};
