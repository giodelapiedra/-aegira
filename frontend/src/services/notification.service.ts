import api from './api';

export type NotificationFilter = 'all' | 'unread' | 'read' | 'archived';

export interface Notification {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  isArchived: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export const notificationService = {
  async getAll(params?: { limit?: number; filter?: NotificationFilter }): Promise<{ data: Notification[] }> {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await api.get('/notifications/unread');
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },

  async archive(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/archive`);
  },

  async unarchive(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/unarchive`);
  },

  async sendReminder(userId: string): Promise<void> {
    await api.post('/notifications/send-reminder', { userId });
  },

  // Helper to get the link for a notification based on its type
  getNotificationLink(notification: Notification): string | null {
    switch (notification.type) {
      case 'CHECKIN_REMINDER':
        return '/checkin';
      case 'EXCEPTION_APPROVED':
      case 'EXCEPTION_REJECTED':
        return '/request-exception'; // User sees their own requests
      case 'EXCEPTION_SUBMITTED':
        return '/team/approvals'; // Team leader sees pending approvals
      case 'INCIDENT_REPORTED':
      case 'INCIDENT_UPDATED':
        return '/team/incidents';
      case 'TEAM_MEMBER_RED':
      case 'TEAM_MEMBER_YELLOW':
        return '/team/overview';
      default:
        return null;
    }
  },

  // Helper to get icon type for notification
  getNotificationType(type: string): 'info' | 'success' | 'warning' | 'danger' {
    switch (type) {
      case 'EXCEPTION_APPROVED':
        return 'success';
      case 'EXCEPTION_REJECTED':
      case 'TEAM_MEMBER_RED':
      case 'INCIDENT_REPORTED':
        return 'danger';
      case 'TEAM_MEMBER_YELLOW':
      case 'CHECKIN_REMINDER':
      case 'EXCEPTION_SUBMITTED':
        return 'warning';
      default:
        return 'info';
    }
  },
};
