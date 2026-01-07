import api from './api';
import type { DashboardStats, Checkin, User } from '../types/user';

export interface RecentCheckin extends Checkin {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatar'>;
}

export interface ReadinessAnalytics {
  period: { days: number; startDate: string };
  dailyStats: Record<string, { green: number; yellow: number; red: number; total: number }>;
}

export interface TeamAnalytics {
  teamId: string;
  totalMembers: number;
  checkedIn: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  checkinRate: number;
}

export interface TrendAnalytics {
  period: { days: number; startDate: string };
  checkinsByStatus: Array<{ readinessStatus: string; _count: number }>;
  incidentsBySeverity: Array<{ severity: string; _count: number }>;
}

export interface AISummaryResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  memberHighlights?: string[]; // Specific member insights
  overallStatus: 'healthy' | 'attention' | 'critical';
  id?: string;
  createdAt?: string;
}

export interface SavedAISummaryResponse {
  exists: boolean;
  id?: string;
  summary?: string;
  highlights?: string[];
  concerns?: string[];
  recommendations?: string[];
  overallStatus?: 'healthy' | 'attention' | 'critical';
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
}

export interface AISummaryHistoryItem {
  id: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  overallStatus: 'healthy' | 'attention' | 'critical';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  generatedBy: string;
}

export interface AISummaryHistoryResponse {
  teamId: string;
  teamName: string;
  summaries: AISummaryHistoryItem[];
}

export interface AISummaryDetail extends AISummaryHistoryItem {
  teamName: string;
  aggregateData?: {
    totalMembers: number;
    openIncidents: number;
    pendingExceptions: number;
    memberAnalytics: Array<{
      name: string;
      riskLevel: 'low' | 'medium' | 'high';
      avgScore: number;
      checkinRate: number;
      greenCount: number;
      yellowCount: number;
      redCount: number;
    }>;
  };
}

export const analyticsService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/analytics/dashboard');
    return response.data;
  },

  async getRecentCheckins(limit = 10): Promise<RecentCheckin[]> {
    const response = await api.get<RecentCheckin[]>('/analytics/recent-checkins', {
      params: { limit },
    });
    return response.data;
  },

  async getReadinessAnalytics(days = 7): Promise<ReadinessAnalytics> {
    const response = await api.get<ReadinessAnalytics>('/analytics/readiness', {
      params: { days },
    });
    return response.data;
  },

  async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
    const response = await api.get<TeamAnalytics>(`/analytics/team/${teamId}`);
    return response.data;
  },

  async getTrends(days = 30): Promise<TrendAnalytics> {
    const response = await api.get<TrendAnalytics>('/analytics/trends', {
      params: { days },
    });
    return response.data;
  },

  async exportData(startDate?: string, endDate?: string): Promise<{ data: Checkin[]; count: number }> {
    const response = await api.get<{ data: Checkin[]; count: number }>('/analytics/export', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  async generateTeamAISummary(teamId: string, startDate: Date, endDate: Date): Promise<AISummaryResult> {
    const response = await api.post<AISummaryResult>(`/analytics/team/${teamId}/ai-summary`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    return response.data;
  },

  async getTeamAISummary(teamId: string): Promise<SavedAISummaryResponse> {
    const response = await api.get<SavedAISummaryResponse>(`/analytics/team/${teamId}/ai-summary`);
    return response.data;
  },

  async getTeamAISummaryHistory(teamId: string): Promise<AISummaryHistoryResponse> {
    const response = await api.get<AISummaryHistoryResponse>(`/analytics/team/${teamId}/ai-summary/history`);
    return response.data;
  },

  async getTeamAISummaryById(teamId: string, summaryId: string): Promise<AISummaryDetail> {
    const response = await api.get<AISummaryDetail>(`/analytics/team/${teamId}/ai-summary/${summaryId}`);
    return response.data;
  },
};
