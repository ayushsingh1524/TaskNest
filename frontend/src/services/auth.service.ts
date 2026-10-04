import { apiClient } from '@/lib/axios';

export const authService = {
  async register(data: any) {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },
  
  async login(data: any) {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  async refresh() {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
  
  async forgotPassword(data: { email: string }) {
    const response = await apiClient.post('/auth/forgot-password', data);
    return response.data;
  },
  
  async resetPassword(data: any) {
    const response = await apiClient.post('/auth/reset-password', data);
    return response.data;
  }
};
