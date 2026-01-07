import api from './api';
import type { Team, User } from '../types/user';
import type { ExceptionType, ExceptionStatus } from './exemption.service';

export interface TeamWithStats extends Team {
  memberCount: number;
  leader?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

// Member profile types
export interface MemberCheckin {
  id: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes?: string;
  lowScoreReason?: string;
  lowScoreDetails?: string;
  createdAt: string;
}

export interface MemberExemption {
  id: string;
  type: ExceptionType;
  reason: string;
  startDate: string | null;
  endDate: string | null;
  status: ExceptionStatus;
  isExemption: boolean;
  reviewNote?: string;
  createdAt: string;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MemberIncident {
  id: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  location?: string;
  createdAt: string;
}

export interface MemberAnalytics {
  trendData: {
    date: string;
    score: number;
    status: 'GREEN' | 'YELLOW' | 'RED';
  }[];
  statusCounts: {
    green: number;
    yellow: number;
    red: number;
  };
  avgMetrics: {
    mood: number;
    stress: number;
    sleep: number;
    physicalHealth: number;
  };
  avgReadinessScore: number;
}

// Team Analytics types
export interface TeamAnalytics {
  team: {
    id: string;
    name: string;
    totalMembers: number;
    timezone: string;
    createdAt: string;
  };
  period: {
    type: string;
    startDate: string;
    endDate: string;
  };
  teamGrade: {
    score: number;
    letter: string;
    color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    label: string;
    avgReadiness: number;
    periodAvgReadiness: number; // Period average readiness (from trendData)
    todayAvgReadiness: number;  // Today's average readiness
    compliance: number;         // Period compliance (used for grade)
    todayCompliance: number;    // Today's compliance
  } | null;
  complianceDetails: {
    checkedIn: number;
    activeMembers: number;
    onLeave: number;
    notCheckedIn: number;
  };
  statusDistribution: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
  trendData: {
    date: string;
    score: number | null;
    compliance: number | null; // null when all members on exemption (no one expected)
    checkedIn: number;
    onExemption: number;
    hasData: boolean;
  }[];
  topReasons: {
    reason: string;
    label: string;
    count: number;
  }[];
  avgMetrics: {
    mood: number;
    stress: number;
    sleep: number;
    physicalHealth: number;
  };
  membersNeedingAttention: {
    id: string;
    name: string;
    avatar: string | null;
    issue: 'RED_STATUS' | 'NO_CHECKIN';
    details: string;
  }[];
  membersOnLeave: {
    id: string;
    name: string;
    avatar: string | null;
    leaveType: string;
    startDate: string;
    endDate: string;
  }[];
}

export interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate?: string;
  teamId?: string;
  teamJoinedAt?: string;
  createdAt: string;
  team?: {
    id: string;
    name: string;
    leaderId: string;
  };
  isOnLeave: boolean;
  activeExemption?: {
    id: string;
    type: ExceptionType;
    endDate: string;
  };
  stats: {
    totalCheckins: number;
    attendanceScore: number;
    exemptionsCount: number;
    incidentsCount: number;
  };
  recentCheckins: MemberCheckin[];
}

// Member with stats returned by /teams/my endpoint
export interface TeamMemberWithStats extends Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'avatar'> {
  currentStreak: number;
  longestStreak: number;
  checkinCount: number;
  isActive: boolean;
  isOnLeave: boolean;
  leaveType: string | null;
  leaveEndDate: string | null;
}

export interface TeamDetails extends Omit<Team, 'members'> {
  members: TeamMemberWithStats[];
  leader?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  company?: { id: string; name: string; timezone: string };
}

export interface TeamStats {
  totalMembers: number;
  checkedIn: number;
  notCheckedIn: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExceptions: number;
  openIncidents: number;
  checkinRate: number;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  leaderId?: string;
  workDays?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  leaderId?: string;
  workDays?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

export const teamService = {
  async getAll(): Promise<{ data: TeamWithStats[] }> {
    const response = await api.get<{ data: TeamWithStats[] }>('/teams');
    return response.data;
  },

  async getMyTeam(): Promise<TeamDetails> {
    const response = await api.get<TeamDetails>('/teams/my');
    return response.data;
  },

  async getById(id: string): Promise<TeamDetails> {
    const response = await api.get<TeamDetails>(`/teams/${id}`);
    return response.data;
  },

  async getStats(id: string): Promise<TeamStats> {
    const response = await api.get<TeamStats>(`/teams/${id}/stats`);
    return response.data;
  },

  async create(data: CreateTeamData): Promise<Team> {
    const response = await api.post<Team>('/teams', data);
    return response.data;
  },

  async update(id: string, data: UpdateTeamData): Promise<Team> {
    const response = await api.put<Team>(`/teams/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/teams/${id}`);
    return response.data;
  },

  async addMember(teamId: string, userId: string): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`/teams/${teamId}/members`, { userId });
    return response.data;
  },

  async removeMember(teamId: string, userId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  // Member management
  async getMemberProfile(userId: string): Promise<MemberProfile> {
    const response = await api.get<MemberProfile>(`/teams/members/${userId}/profile`);
    return response.data;
  },

  async getMemberCheckins(
    userId: string,
    params?: { page?: number; limit?: number; status?: 'GREEN' | 'YELLOW' | 'RED' }
  ): Promise<{
    data: MemberCheckin[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get(`/teams/members/${userId}/checkins`, { params });
    return response.data;
  },

  async getMemberExemptions(userId: string): Promise<{ data: MemberExemption[] }> {
    const response = await api.get(`/teams/members/${userId}/exemptions`);
    return response.data;
  },

  async getMemberIncidents(userId: string): Promise<{ data: MemberIncident[] }> {
    const response = await api.get(`/teams/members/${userId}/incidents`);
    return response.data;
  },

  async getMemberAnalytics(userId: string, days?: number): Promise<MemberAnalytics> {
    const response = await api.get<MemberAnalytics>(`/teams/members/${userId}/analytics`, {
      params: { days },
    });
    return response.data;
  },

  async getTeamAnalytics(period?: string, startDate?: string, endDate?: string): Promise<TeamAnalytics> {
    const response = await api.get<TeamAnalytics>('/teams/my/analytics', {
      params: { period, startDate, endDate },
    });
    return response.data;
  },
};
