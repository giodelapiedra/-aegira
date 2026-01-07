import api from './api';
import type { User, Role } from '../types/user';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  teamId?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  teamId?: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: Role;
  teamId?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const userService = {
  async create(data: CreateUserData): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  async getAll(params?: UserListParams): Promise<PaginatedResponse<User>> {
    const response = await api.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },

  async updateRole(id: string, role: Role): Promise<User> {
    const response = await api.patch<User>(`/users/${id}/role`, { role });
    return response.data;
  },

  async deactivate(id: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/users/${id}`);
    return response.data;
  },

  async reactivate(id: string): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`/users/${id}/reactivate`);
    return response.data;
  },
};
