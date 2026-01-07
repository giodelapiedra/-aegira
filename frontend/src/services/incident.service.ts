import api from './api';
import type { Incident, IncidentActivity } from '../types/user';

export interface CreateIncidentData {
  type: 'INJURY' | 'ILLNESS' | 'MENTAL_HEALTH' | 'EQUIPMENT' | 'ENVIRONMENTAL' | 'OTHER';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location?: string;
  incidentDate?: string;
  attachments?: string[];
  requestException?: boolean; // Request exception/leave along with incident report
}

export const incidentService = {
  async create(data: CreateIncidentData): Promise<Incident> {
    const response = await api.post<Incident>('/incidents', data);
    return response.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
    teamId?: string;
  }): Promise<{
    data: Incident[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get('/incidents', { params });
    return response.data;
  },

  async getById(id: string): Promise<Incident> {
    const response = await api.get<Incident>(`/incidents/${id}`);
    return response.data;
  },

  async updateStatus(
    id: string,
    status: Incident['status'],
    note?: string
  ): Promise<Incident> {
    const response = await api.patch<Incident>(`/incidents/${id}/status`, { status, note });
    return response.data;
  },

  async assign(id: string, assigneeId: string, note?: string): Promise<Incident> {
    const response = await api.patch<Incident>(`/incidents/${id}/assign`, { assigneeId, note });
    return response.data;
  },

  async getMyIncidents(): Promise<Incident[]> {
    const response = await api.get<Incident[]>('/incidents/my');
    return response.data;
  },

  async addComment(id: string, comment: string): Promise<IncidentActivity> {
    const response = await api.post<IncidentActivity>(`/incidents/${id}/comments`, { comment });
    return response.data;
  },

  async getActivities(id: string): Promise<IncidentActivity[]> {
    const response = await api.get<IncidentActivity[]>(`/incidents/${id}/activities`);
    return response.data;
  },

  // Return to Work Certificate
  async uploadRTWCertificate(
    id: string,
    data: { certificateUrl: string; certDate?: string; notes?: string }
  ): Promise<Incident> {
    const response = await api.put<Incident>(`/incidents/${id}/rtw-certificate`, data);
    return response.data;
  },

  async removeRTWCertificate(id: string): Promise<Incident> {
    const response = await api.delete<Incident>(`/incidents/${id}/rtw-certificate`);
    return response.data;
  },
};
