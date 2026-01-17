import api from './api';
import type { Incident, WHSOfficer } from '../types/user';

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface GetIncidentsParams {
  page?: number;
  limit?: number;
  whsOfficerId?: string;
  search?: string;
  severity?: string;
}

export interface IncidentStats {
  pending: number;
  critical: number;
  high: number;
  urgent: number;
  assigned: number;
}

export interface PersonnelStats {
  total: number;
  green: number;
  red: number;
  onLeave: number;
  notCheckedIn: number;
}

export interface PersonnelMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  team: {
    id: string;
    name: string;
  } | null;
  checkin: {
    readinessStatus: 'GREEN' | 'RED';
    readinessScore: number;
    createdAt: string;
  } | null;
  leave: {
    type: string;
    startDate: string;
    endDate: string;
  } | null;
  currentStatus: 'GREEN' | 'RED' | 'ON_LEAVE' | 'NOT_CHECKED_IN';
}

interface GetPersonnelParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // GREEN, RED, ON_LEAVE, NOT_CHECKED_IN
}

export const supervisorService = {
  // Get stats for dashboard
  async getIncidentStats(): Promise<IncidentStats> {
    const response = await api.get('/supervisor/incidents/stats');
    return response.data;
  },

  // Get incidents pending WHS assignment (TL approved, not yet assigned)
  async getPendingIncidents(params?: GetIncidentsParams): Promise<PaginatedResponse<Incident>> {
    const response = await api.get('/supervisor/incidents/pending', { params });
    return response.data;
  },

  // Get incidents already assigned to WHS
  async getAssignedIncidents(params?: GetIncidentsParams): Promise<PaginatedResponse<Incident>> {
    const response = await api.get('/supervisor/incidents/assigned', { params });
    return response.data;
  },

  // Assign incident to WHS officer
  async assignToWHS(incidentId: string, whsOfficerId: string, note?: string): Promise<Incident> {
    const response = await api.patch(`/supervisor/incidents/${incidentId}/assign-whs`, {
      whsOfficerId,
      note,
    });
    return response.data;
  },

  // Get list of WHS officers for dropdown
  async getWHSOfficers(): Promise<WHSOfficer[]> {
    const response = await api.get('/supervisor/whs-officers');
    return response.data;
  },

  // Personnel management
  async getPersonnelStats(): Promise<PersonnelStats> {
    const response = await api.get('/supervisor/personnel/stats');
    return response.data;
  },

  async getPersonnel(params?: GetPersonnelParams): Promise<PaginatedResponse<PersonnelMember>> {
    const response = await api.get('/supervisor/personnel', { params });
    return response.data;
  },
};
