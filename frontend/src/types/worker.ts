/**
 * Worker Dashboard Types
 *
 * Type definitions for the consolidated worker dashboard API.
 */

// ============================================
// USER
// ============================================

export interface WorkerDashboardUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar: string | null;
  teamId: string | null;
  currentStreak: number;
  longestStreak: number;
  totalCheckins: number;
  avgReadinessScore: number;
  lastReadinessStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
}

// ============================================
// TEAM
// ============================================

export interface WorkerDashboardTeam {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  leaderId: string | null;
}

// ============================================
// LEAVE STATUS
// ============================================

export interface WorkerDashboardException {
  id: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  reason: string;
}

export interface WorkerDashboardLeaveStatus {
  isOnLeave: boolean;
  isReturning: boolean;
  isBeforeStart: boolean;
  effectiveStartDate: string | null;
  currentException: WorkerDashboardException | null;
}

// ============================================
// CHECK-IN
// ============================================

export interface WorkerDashboardCheckin {
  id: string;
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  lowScoreReason: string | null;
  lowScoreDetails: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkerDashboardRecentCheckin {
  id: string;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  createdAt: string;
}

// ============================================
// WEEK STATS
// ============================================

export interface WorkerDashboardDayStatus {
  status: string;
  score: number;
}

export interface WorkerDashboardWeekStats {
  weekStart: string;
  weekEnd: string;
  totalCheckins: number;
  scheduledDaysThisWeek: number;
  scheduledDaysSoFar: number;
  avgScore: number;
  avgStatus: 'GREEN' | 'YELLOW' | 'RED' | null;
  dailyStatus: Record<string, WorkerDashboardDayStatus | null>;
  workDays: string[];
  currentStreak: number;
  longestStreak: number;
}

// ============================================
// EXEMPTION
// ============================================

export interface WorkerDashboardPendingExemption {
  id: string;
  type: string;
  reason: string;
  scoreAtRequest: number | null;
  createdAt: string;
}

export interface WorkerDashboardActiveExemption {
  id: string;
  userId: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  reason: string;
}

// ============================================
// MAIN RESPONSE
// ============================================

export interface WorkerDashboardResponse {
  user: WorkerDashboardUser;
  team: WorkerDashboardTeam | null;
  leaveStatus: WorkerDashboardLeaveStatus;
  todayCheckin: WorkerDashboardCheckin | null;
  weekStats: WorkerDashboardWeekStats | null;
  recentCheckins: WorkerDashboardRecentCheckin[];
  pendingExemption: WorkerDashboardPendingExemption | null;
  activeExemptions: WorkerDashboardActiveExemption[];
  isHoliday: boolean;
  holidayName: string | null;
  isWorkDay: boolean;
  timezone: string; // Company timezone (IANA format, e.g., 'Asia/Manila')
}
