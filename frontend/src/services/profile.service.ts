import api from './api';
import type { User, Gender } from '../types/user';

export interface UpdateProfileData {
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string;
  gender?: Gender;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const profileService = {
  async getProfile(): Promise<User> {
    const response = await api.get('/users/me');
    return response.data;
  },

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await api.patch('/users/me', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordData): Promise<{ success: boolean; message: string }> {
    const response = await api.patch('/users/me/password', data);
    return response.data;
  },
};
