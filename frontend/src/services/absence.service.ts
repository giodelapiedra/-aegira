import api from './api';
import type {
  Absence,
  AbsenceWithUser,
    AbsenceWithAll,
  JustifyAbsencesRequest,
  ReviewAbsenceRequest,
  PendingAbsencesResponse,
  AbsenceHistoryResponse,
  TeamPendingResponse,
  AbsenceStatsResponse,
} from '../types/absence';

export const absenceService = {
  // ============================================
  // WORKER ENDPOINTS
  // ============================================

  /**
   * Get worker's pending justifications
   * First detects and creates any new absences, then returns pending ones
   * This is called on app load to check if worker has blocking absences
   */
  async getMyPending(): Promise<PendingAbsencesResponse> {
    const response = await api.get<PendingAbsencesResponse>('/absences/my-pending');
    return response.data;
  },

  /**
   * Submit justification for absences
   * Worker provides reason and explanation for each absence
   */
  async justify(data: JustifyAbsencesRequest): Promise<{
    success: boolean;
    count: number;
    absences: Absence[];
  }> {
    const response = await api.post('/absences/justify', data);
    return response.data;
  },

  /**
   * Get worker's absence history
   */
  async getMyHistory(limit?: number): Promise<AbsenceHistoryResponse> {
    const response = await api.get<AbsenceHistoryResponse>('/absences/my-history', {
      params: { limit },
    });
    return response.data;
  },

  // ============================================
  // TEAM LEADER ENDPOINTS
  // ============================================

  /**
   * Get pending reviews for TL's team
   * Returns absences that have been justified but not yet reviewed
   */
  async getTeamPending(): Promise<TeamPendingResponse> {
    const response = await api.get<TeamPendingResponse>('/absences/team-pending');
    return response.data;
  },

  /**
   * Review an absence
   * TL marks as EXCUSED (no penalty) or UNEXCUSED (0 points)
   */
  async review(id: string, data: ReviewAbsenceRequest): Promise<AbsenceWithUser> {
    const response = await api.post<AbsenceWithUser>(`/absences/${id}/review`, data);
    return response.data;
  },

  /**
   * Get team absence history with pagination
   */
  async getTeamHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    data: AbsenceWithUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get('/absences/team-history', { params });
    return response.data;
  },

  // ============================================
  // COMMON ENDPOINTS
  // ============================================

  /**
   * Get absence by ID
   */
  async getById(id: string): Promise<AbsenceWithAll> {
    const response = await api.get<AbsenceWithAll>(`/absences/${id}`);
    return response.data;
  },

  /**
   * Get absence statistics for dashboard
   */
  async getStats(): Promise<AbsenceStatsResponse> {
    const response = await api.get<AbsenceStatsResponse>('/absences/stats');
    return response.data;
  },
};
