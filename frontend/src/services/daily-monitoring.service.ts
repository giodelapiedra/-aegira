/**
 * Daily Monitoring Service
 * Handles daily monitoring API calls for Team Leaders
 */

import api from './api';
import type { Exemption } from './exemption.service';

// ============================================
// TYPES
// ============================================

export type ReadinessStatus = 'GREEN' | 'YELLOW' | 'RED';
export type SeverityLevel = 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE' | 'MINOR';

export interface TeamInfo {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
}

export interface MonitoringStats {
  totalMembers: number;
  activeMembers: number;  // Total - on leave
  onLeave: number;        // Members currently on approved exemption
  checkedIn: number;
  notCheckedIn: number;   // Active members who haven't checked in (excludes on leave)
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExemptions: number;
  activeExemptions: number;
  suddenChanges: number;
  criticalChanges: number;
  isHoliday?: boolean;
  holidayName?: string | null;
}

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  teamId?: string;
}

export interface StatsResponse {
  team: TeamInfo;
  stats: MonitoringStats;
  generatedAt: string;
}

export interface CheckinsPaginatedResponse {
  data: TodayCheckin[];
  pagination: PaginationInfo;
}

export interface NotCheckedInPaginatedResponse {
  data: NotCheckedInMember[];
  pagination: PaginationInfo;
  isHoliday: boolean;
  holidayName?: string;
}

export interface SuddenChangesPaginatedResponse {
  data: DetailedSuddenChange[];
  pagination: PaginationInfo;
  summary: {
    total: number;
    criticalCount: number;
    significantCount: number;
    notableCount: number;
    minorCount: number;
  };
}

export interface ExemptionWithDetails {
  id: string;
  type: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  startDate: string;
  endDate: string;
  notes?: string;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  user: CheckinUser;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  triggeredByCheckin?: {
    id: string;
    mood: number;
    stress: number;
    sleep: number;
    physicalHealth: number;
    readinessScore: number;
    readinessStatus: ReadinessStatus;
    notes?: string;
    createdAt: string;
  };
  isActiveToday: boolean;
}

export interface ExemptionsPaginatedResponse {
  data: ExemptionWithDetails[];
  pagination: PaginationInfo;
  summary: {
    pendingCount: number;
    approvedCount: number;
    activeCount: number;
  };
}

export interface CheckinUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  currentStreak?: number;
}

export type LowScoreReason =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'POOR_SLEEP'
  | 'HIGH_STRESS'
  | 'PERSONAL_ISSUES'
  | 'FAMILY_EMERGENCY'
  | 'WORK_RELATED'
  | 'OTHER';

export interface TodayCheckin {
  id: string;
  userId: string;
  user: CheckinUser;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  readinessScore: number;
  readinessStatus: ReadinessStatus;
  createdAt: string;
  // Low score reason (for RED status)
  lowScoreReason?: LowScoreReason;
  lowScoreDetails?: string;
  // Analytics
  averageScore: number | null;
  changeFromAverage: number | null;
  hasExemptionRequest: boolean;
  exemptionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export interface NotCheckedInMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
}

export interface SuddenChange {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  todayScore: number;
  todayStatus: ReadinessStatus;
  averageScore: number;
  change: number;
  severity: SeverityLevel;
  checkinId: string;
  checkinTime: string;
}

export interface DailyMonitoringData {
  team: TeamInfo;
  stats: MonitoringStats;
  todayCheckins: TodayCheckin[];
  notCheckedInMembers: NotCheckedInMember[];
  suddenChanges: SuddenChange[];
  pendingExemptions: Exemption[];
  activeExemptions: Exemption[];
  generatedAt: string;
}

export interface DetailedSuddenChange extends SuddenChange {
  user: CheckinUser;
  metrics: {
    mood: number;
    stress: number;
    sleep: number;
    physicalHealth: number;
  };
  history: number[];
}

export interface SuddenChangesData {
  changes: DetailedSuddenChange[];
  total: number;
  criticalCount: number;
  significantCount: number;
}

export interface MemberStats {
  totalCheckins: number;
  averageScore: number;
  averageMood: number;
  averageStress: number;
  averageSleep: number;
  averagePhysical: number;
  greenDays: number;
  yellowDays: number;
  redDays: number;
}

export interface MemberCheckin {
  id: string;
  date: string;
  score: number;
  status: ReadinessStatus;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  notes?: string;
  lowScoreReason?: LowScoreReason;
  lowScoreDetails?: string;
}

export interface MemberDetailData {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    currentStreak?: number;
    longestStreak?: number;
    team?: {
      id: string;
      name: string;
    };
  };
  stats: MemberStats;
  checkins: MemberCheckin[];
  exemptions: Exemption[];
}

// ============================================
// API FUNCTIONS
// ============================================

export interface TeamOption {
  id: string;
  name: string;
  memberCount: number;
}

/**
 * Get available teams for selection (higher roles only)
 */
export async function getAvailableTeams(): Promise<TeamOption[]> {
  const response = await api.get('/daily-monitoring/teams');
  return response.data;
}

/**
 * Get complete daily monitoring data
 * @param teamId - Optional team ID for higher roles (EXECUTIVE/ADMIN/SUPERVISOR)
 */
export async function getDailyMonitoring(teamId?: string): Promise<DailyMonitoringData> {
  const response = await api.get('/daily-monitoring', {
    params: teamId ? { teamId } : undefined,
  });
  return response.data;
}

/**
 * Get detailed sudden changes
 */
export async function getSuddenChanges(minDrop?: number): Promise<SuddenChangesData> {
  const response = await api.get('/daily-monitoring/sudden-changes', {
    params: minDrop ? { minDrop } : undefined,
  });
  return response.data;
}

/**
 * Get detailed history for a member
 */
export async function getMemberDetail(
  memberId: string,
  days?: number
): Promise<MemberDetailData> {
  const response = await api.get(`/daily-monitoring/member/${memberId}`, {
    params: days ? { days } : undefined,
  });
  return response.data;
}

// ============================================
// NEW PAGINATED API FUNCTIONS
// ============================================

/**
 * Get lightweight stats only (fast endpoint for initial page load)
 * @param teamId - Optional team ID for higher roles
 */
export async function getStats(teamId?: string): Promise<StatsResponse> {
  const response = await api.get('/daily-monitoring/stats', {
    params: teamId ? { teamId } : undefined,
  });
  return response.data;
}

/**
 * Get paginated today's check-ins
 * @param params - Pagination and filter params
 */
export async function getCheckinsPaginated(
  params: PaginatedParams & { status?: ReadinessStatus }
): Promise<CheckinsPaginatedResponse> {
  const response = await api.get('/daily-monitoring/checkins', { params });
  return response.data;
}

/**
 * Get paginated members who haven't checked in today
 * Excludes members on approved leave
 * @param params - Pagination and filter params
 */
export async function getNotCheckedInPaginated(
  params: PaginatedParams
): Promise<NotCheckedInPaginatedResponse> {
  const response = await api.get('/daily-monitoring/not-checked-in', { params });
  return response.data;
}

/**
 * Get paginated sudden changes with summary counts
 * @param params - Pagination and filter params
 */
export async function getSuddenChangesPaginated(
  params: PaginatedParams & { minDrop?: number; severity?: SeverityLevel }
): Promise<SuddenChangesPaginatedResponse> {
  const response = await api.get('/daily-monitoring/sudden-changes', { params });
  return response.data;
}

/**
 * Get paginated exemptions (pending + active)
 * IMPORTANT: Only APPROVED exemptions affect "on leave" calculations
 * @param params - Pagination and filter params
 */
export async function getExemptionsPaginated(
  params: PaginatedParams & { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'active' }
): Promise<ExemptionsPaginatedResponse> {
  const response = await api.get('/daily-monitoring/exemptions', { params });
  return response.data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get severity color class
 */
export function getSeverityColor(severity: SeverityLevel): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
    CRITICAL: {
      bg: 'bg-danger-50',
      text: 'text-danger-700',
      border: 'border-danger-200',
    },
    SIGNIFICANT: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
    NOTABLE: {
      bg: 'bg-warning-50',
      text: 'text-warning-700',
      border: 'border-warning-200',
    },
    MINOR: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
  };
  return colors[severity];
}

/**
 * Get severity label
 */
export function getSeverityLabel(severity: SeverityLevel): string {
  const labels: Record<SeverityLevel, string> = {
    CRITICAL: 'Critical Drop',
    SIGNIFICANT: 'Significant Drop',
    NOTABLE: 'Notable Drop',
    MINOR: 'Minor Drop',
  };
  return labels[severity];
}

/**
 * Get readiness status color
 */
export function getStatusColor(status: ReadinessStatus): {
  bg: string;
  text: string;
  dot: string;
} {
  const colors: Record<ReadinessStatus, { bg: string; text: string; dot: string }> = {
    GREEN: {
      bg: 'bg-success-50',
      text: 'text-success-700',
      dot: 'bg-success-500',
    },
    YELLOW: {
      bg: 'bg-warning-50',
      text: 'text-warning-700',
      dot: 'bg-warning-500',
    },
    RED: {
      bg: 'bg-danger-50',
      text: 'text-danger-700',
      dot: 'bg-danger-500',
    },
  };
  return colors[status];
}

/**
 * Format metric value with color indicator
 */
export function getMetricColor(value: number, inverted = false): string {
  if (inverted) {
    // Lower is better (e.g., stress)
    if (value <= 3) return 'text-success-600';
    if (value <= 6) return 'text-warning-600';
    return 'text-danger-600';
  }
  // Higher is better (e.g., mood, sleep)
  if (value >= 7) return 'text-success-600';
  if (value >= 4) return 'text-warning-600';
  return 'text-danger-600';
}

/**
 * Format time ago
 * @param dateString - ISO date string
 * @param timezone - Company timezone for display fallback
 */
export function formatTimeAgo(dateString: string, timezone: string = 'Asia/Manila'): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { timeZone: timezone });
}

/**
 * Get low score reason label
 */
export const LOW_SCORE_REASON_LABELS: Record<LowScoreReason, string> = {
  PHYSICAL_INJURY: 'Physical Injury',
  ILLNESS_SICKNESS: 'Illness / Sickness',
  POOR_SLEEP: 'Poor Sleep',
  HIGH_STRESS: 'High Stress',
  PERSONAL_ISSUES: 'Personal Issues',
  FAMILY_EMERGENCY: 'Family Emergency',
  WORK_RELATED: 'Work-Related Issues',
  OTHER: 'Other',
};

export function getLowScoreReasonLabel(reason: LowScoreReason): string {
  return LOW_SCORE_REASON_LABELS[reason] || reason;
}
