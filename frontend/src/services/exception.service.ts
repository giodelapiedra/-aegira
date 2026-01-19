import api from './api';
import type { Exception } from '../types/user';

export interface CreateExceptionData {
  type: 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'MEDICAL_APPOINTMENT' | 'FAMILY_EMERGENCY' | 'OTHER';
  reason: string;
  startDate: string;
  endDate: string;
  notes?: string;
  linkedIncidentId?: string; // Optional link to an existing incident report
}

export const exceptionService = {
  async create(data: CreateExceptionData): Promise<Exception> {
    const response = await api.post<Exception>('/exceptions', data);
    return response.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    data: Exception[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get('/exceptions', { params });
    return response.data;
  },

  async getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }> {
    const response = await api.get('/exceptions/stats');
    return response.data;
  },

  async getById(id: string): Promise<Exception> {
    const response = await api.get<Exception>(`/exceptions/${id}`);
    return response.data;
  },

  async update(id: string, data: { startDate?: string; endDate?: string; reason?: string; notes?: string }): Promise<Exception> {
    const response = await api.put<Exception>(`/exceptions/${id}`, data);
    return response.data;
  },

  async approve(id: string, notes?: string): Promise<Exception> {
    const response = await api.patch<Exception>(`/exceptions/${id}/approve`, { notes });
    return response.data;
  },

  async reject(id: string, notes?: string): Promise<Exception> {
    const response = await api.patch<Exception>(`/exceptions/${id}/reject`, { notes });
    return response.data;
  },

  async endEarly(id: string, data: { returnDate: string; notes?: string }): Promise<Exception> {
    const response = await api.patch<Exception>(`/exceptions/${id}/end-early`, data);
    return response.data;
  },

  async cancel(id: string, notes?: string): Promise<void> {
    await api.delete(`/exceptions/${id}`, { data: { notes } });
  },

  async getPending(): Promise<Exception[]> {
    const response = await api.get<Exception[]>('/exceptions/pending');
    return response.data;
  },

  async getMyExceptions(): Promise<Exception[]> {
    const response = await api.get<Exception[]>('/exceptions/my');
    return response.data;
  },
};
