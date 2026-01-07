import api from './api';

export interface SystemLog {
  id: string;
  companyId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
    role: string;
  } | null;
}

export interface SystemLogStats {
  totalLogs: number;
  todayLogs: number;
  weekLogs: number;
  actionCounts: { action: string; count: number }[];
  entityTypeCounts: { entityType: string; count: number }[];
  mostActiveUsers: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
      avatar: string | null;
    };
    activityCount: number;
  }[];
}

export interface LogAction {
  value: string;
  label: string;
  category: string;
}

export interface LogEntityType {
  value: string;
  label: string;
}

export interface SystemLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
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

export const systemLogsService = {
  // Get paginated system logs
  async getLogs(params: SystemLogsParams = {}): Promise<PaginatedResponse<SystemLog>> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.action) queryParams.append('action', params.action);
    if (params.entityType) queryParams.append('entityType', params.entityType);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.search) queryParams.append('search', params.search);

    const response = await api.get<PaginatedResponse<SystemLog>>(
      `/system-logs?${queryParams.toString()}`
    );
    return response.data;
  },

  // Get system log statistics
  async getStats(): Promise<SystemLogStats> {
    const response = await api.get<SystemLogStats>('/system-logs/stats');
    return response.data;
  },

  // Get available action types
  async getActions(): Promise<LogAction[]> {
    const response = await api.get<LogAction[]>('/system-logs/actions');
    return response.data;
  },

  // Get available entity types
  async getEntityTypes(): Promise<LogEntityType[]> {
    const response = await api.get<LogEntityType[]>('/system-logs/entity-types');
    return response.data;
  },

  // Get single log detail
  async getLogById(id: string): Promise<SystemLog> {
    const response = await api.get<SystemLog>(`/system-logs/${id}`);
    return response.data;
  },
};

// Helper to format action label
export function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper to get action color
export function getActionColor(action: string): string {
  if (action.includes('CREATED') || action.includes('ADDED')) return 'success';
  if (action.includes('DELETED') || action.includes('REMOVED') || action.includes('DEACTIVATED')) return 'danger';
  if (action.includes('UPDATED') || action.includes('CHANGED')) return 'warning';
  if (action.includes('LOGIN') || action.includes('ACCEPTED')) return 'primary';
  if (action.includes('LOGOUT') || action.includes('REJECTED') || action.includes('CANCELLED')) return 'secondary';
  return 'primary';
}

// Helper to get action icon name
export function getActionIcon(action: string): string {
  if (action.startsWith('USER_')) return 'user';
  if (action.startsWith('TEAM_')) return 'users';
  if (action.startsWith('INCIDENT_')) return 'alert-triangle';
  if (action.startsWith('EXCEPTION_')) return 'file-text';
  if (action.startsWith('CHECKIN_')) return 'clipboard-check';
  if (action.startsWith('SETTINGS_')) return 'settings';
  return 'activity';
}
