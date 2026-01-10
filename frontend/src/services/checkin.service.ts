import api from './api';
import type { Checkin } from '../types/user';

export interface CreateCheckinData {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes?: string;
}

export interface LeaveException {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveStatus {
  isOnLeave: boolean;
  isReturning: boolean;
  isBeforeStart: boolean; // True if today is before user's effective start date
  effectiveStartDate?: string; // YYYY-MM-DD format - when check-in requirement begins
  currentException?: LeaveException;
  lastException?: LeaveException;
}

// Attendance types
export type AttendanceStatus = 'GREEN' | 'YELLOW' | 'ABSENT' | 'EXCUSED';

export interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
  score: number | null;
  isCounted: boolean;
  checkInTime?: string | null;
  minutesLate?: number;
  exceptionType?: string | null;
}

export interface CheckinWithAttendance extends Checkin {
  attendance?: {
    status: AttendanceStatus;
    score: number;
    minutesLate: number;
  };
  isReturning?: boolean;
}

// Low score reason types
export type LowScoreReason =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'POOR_SLEEP'
  | 'HIGH_STRESS'
  | 'PERSONAL_ISSUES'
  | 'FAMILY_EMERGENCY'
  | 'WORK_RELATED'
  | 'OTHER';

export interface LowScoreReasonData {
  reason: LowScoreReason;
  details?: string;
}

export const LOW_SCORE_REASONS: { value: LowScoreReason; label: string }[] = [
  { value: 'PHYSICAL_INJURY', label: 'Physical Injury' },
  { value: 'ILLNESS_SICKNESS', label: 'Illness / Sickness' },
  { value: 'POOR_SLEEP', label: 'Poor Sleep' },
  { value: 'HIGH_STRESS', label: 'High Stress' },
  { value: 'PERSONAL_ISSUES', label: 'Personal Issues' },
  { value: 'FAMILY_EMERGENCY', label: 'Family Emergency' },
  { value: 'WORK_RELATED', label: 'Work-Related Issues' },
  { value: 'OTHER', label: 'Other' },
];

export const checkinService = {
  async create(data: CreateCheckinData): Promise<CheckinWithAttendance> {
    const response = await api.post<CheckinWithAttendance>('/checkins', data);
    return response.data;
  },

  async getMyCheckins(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    data: Checkin[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get('/checkins/my', { params });
    return response.data;
  },

  async getById(id: string): Promise<Checkin> {
    const response = await api.get<Checkin>(`/checkins/${id}`);
    return response.data;
  },

  async getTodayCheckin(): Promise<Checkin | null> {
    try {
      const response = await api.get<Checkin | null>('/checkins/today');
      return response.data;
    } catch (error: unknown) {
      // Only return null for 404 (no check-in today), re-throw other errors
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  async getTeamCheckins(teamId: string): Promise<Checkin[]> {
    const response = await api.get<{ data: Checkin[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/checkins', {
      params: { teamId, limit: 100 },
    });
    return response.data.data;
  },

  async getLeaveStatus(): Promise<LeaveStatus> {
    const response = await api.get<LeaveStatus>('/checkins/leave-status');
    return response.data;
  },

  // Attendance endpoints
  async getAttendanceHistory(days: number = 30, status?: string): Promise<{
    data: AttendanceRecord[];
    period: { days: number; startDate: string; endDate: string };
  }> {
    const response = await api.get('/checkins/attendance/history', {
      params: { days, status },
    });
    return response.data;
  },

  // Low score reason
  async updateLowScoreReason(checkinId: string, data: LowScoreReasonData): Promise<Checkin> {
    const response = await api.patch<Checkin>(`/checkins/${checkinId}/low-score-reason`, data);
    return response.data;
  },

  // Weekly stats for worker dashboard
  async getWeekStats(): Promise<WeekStats> {
    const response = await api.get<WeekStats>('/checkins/week-stats');
    return response.data;
  },
};

// Weekly stats types
export interface WeekStats {
  weekStart: string;
  weekEnd: string;
  totalCheckins: number;
  scheduledDaysThisWeek: number;
  scheduledDaysSoFar: number;
  avgScore: number;
  avgStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
  dailyStatus: Record<string, { status: string; score: number } | null>;
  workDays: string[];
  currentStreak: number;
  longestStreak: number;
}
