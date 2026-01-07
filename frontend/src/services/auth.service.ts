import api from './api';
import type { AuthResponse, LoginCredentials, RegisterData, User } from '../types/user';

export const authService = {
  async getMe(): Promise<User> {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async logout(): Promise<void> {
    // Refresh token is sent via httpOnly cookie
    await api.post('/auth/logout');
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    // Refresh token is sent via httpOnly cookie
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post('/auth/reset-password', { token, password });
  },
};
