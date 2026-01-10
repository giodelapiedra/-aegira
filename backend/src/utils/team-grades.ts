/**
 * Team Grades Utility
 *
 * Reusable utility for calculating team performance grades.
 * Used by Executive and Supervisor roles to monitor team performance.
 *
 * CALCULATION LOGIC:
 * - Team Score = Average of member scores (equal weight per member)
 * - Member Score = (GREEN×100 + YELLOW×75 + ABSENT×0) / Counted Days
 * - Excludes: Holidays, Approved Exemptions, Future days, New members (<3 work days)
 *
 * GRADE SCALE:
 * - A (Excellent): >= 90
 * - B (Good): >= 80
 * - C (Fair): >= 70
 * - D (Poor): < 70
 *
 * TREND CALCULATION:
 * - Compares current period vs previous period of same length
 * - Up: +3 or more points
 * - Down: -3 or more points
 * - Stable: between -3 and +3
 *
 * @module utils/team-grades
 */

import { prisma } from '../config/prisma.js';
import {
  calculatePerformanceScore,
  getPerformanceGrade,
  ATTENDANCE_SCORES,
} from './attendance.js';
import {
  getLastNDaysRange,
  getStartOfDay,
  getEndOfDay,
  formatLocalDate,
  countWorkDaysInRange,
  getStartOfNextDay,
  DEFAULT_TIMEZONE,
} from './date-helpers.js';

// ===========================================
// TYPES
// ===========================================

/**
 * Team grade summary for overview displays
 */
export interface TeamGradeSummary {
  id: string;
  name: string;
  leader: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
  memberCount: number;

  // Grade info
  grade: string;        // A, B, C, D
  gradeLabel: string;   // Excellent, Good, Fair, Poor
  score: number;        // 0-100

  // Key metrics
  attendanceRate: number;   // % who checked in vs expected
  onTimeRate: number;       // % GREEN out of total check-ins

  // Breakdown
  breakdown: {
    green: number;
    yellow: number;
    absent: number;
    excused: number;
  };

  // Trend (vs previous period)
  trend: 'up' | 'down' | 'stable';
  scoreDelta: number;

  // Risk indicators
  atRiskCount: number;      // Members with grade D
  membersNeedingAttention: number; // Members with grade C or D

  // Onboarding members (excluded from grade calculation)
  onboardingCount: number;  // Members with < 3 check-in days
  includedMemberCount: number; // Members actually included in grade calculation
}

/**
 * Overall summary across all teams
 */
export interface TeamsOverviewSummary {
  totalTeams: number;
  totalMembers: number;
  avgScore: number;
  avgGrade: string;
  teamsAtRisk: number;          // Teams with grade C or D
  teamsCritical: number;        // Teams with grade D
  teamsImproving: number;       // Teams with upward trend
  teamsDeclining: number;       // Teams with downward trend
}

/**
 * Complete teams overview response
 */
export interface TeamsOverviewResult {
  teams: TeamGradeSummary[];
  summary: TeamsOverviewSummary;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

/**
 * Options for calculating team grades
 */
export interface TeamGradeOptions {
  days?: number;                    // Period in days (default: 30)
  companyId: string;
  timezone?: string;
  teamIds?: string[];               // Filter to specific teams (optional)
  includeInactiveTeams?: boolean;   // Include inactive teams (default: false)
  minWorkDays?: number;             // Min work days for member to be counted (default: 3)
}

// ===========================================
// CONSTANTS
// ===========================================

/** Minimum work days for a member to be included in team grade calculation */
const DEFAULT_MIN_WORK_DAYS = 3;

/**
 * Minimum ACTUAL check-in days for a member to be included in team grade calculation.
 *
 * IMPORTANT: Only VALID check-in days count toward this threshold:
 * - GREEN (on-time check-in) = COUNTS ✓
 * - YELLOW (late check-in) = COUNTS ✓
 * - ABSENT (no check-in, no exemption) = does NOT count
 * - EXCUSED (on approved exemption/leave) = does NOT count
 * - Holiday = does NOT count (no check-in expected)
 *
 * This ensures new members have enough data before affecting team grades.
 */
const MIN_CHECKIN_DAYS_THRESHOLD = 3;

/** Trend threshold - score change needed to be considered up/down */
const TREND_THRESHOLD = 3;

// ===========================================
// MAIN FUNCTIONS
// ===========================================

/**
 * Calculate grades for all teams in a company.
 *
 * This is the main function used by Executive and Supervisor dashboards.
 * Returns team grades sorted by grade (worst first) for attention prioritization.
 *
 * @param options - Configuration options
 * @returns Promise<TeamsOverviewResult> - Teams with grades and summary
 *
 * @example
 * ```typescript
 * const result = await calculateTeamsOverview({
 *   companyId: 'company-uuid',
 *   days: 30,
 *   timezone: 'Asia/Manila'
 * });
 * ```
 */
export async function calculateTeamsOverview(
  options: TeamGradeOptions
): Promise<TeamsOverviewResult> {
  const {
    days = 30,
    companyId,
    timezone = DEFAULT_TIMEZONE,
    teamIds,
    includeInactiveTeams = false,
    minWorkDays = DEFAULT_MIN_WORK_DAYS,
  } = options;

  // Calculate date ranges
  const { start: startDate, end: endDate } = getLastNDaysRange(days, timezone);

  // Previous period for trend comparison
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - days + 1);

  // Build team query
  const teamWhere: any = { companyId };
  if (!includeInactiveTeams) {
    teamWhere.isActive = true;
  }
  if (teamIds && teamIds.length > 0) {
    teamWhere.id = { in: teamIds };
  }

  // Fetch teams with leaders and active members
  const teams = await prisma.team.findMany({
    where: teamWhere,
    include: {
      leader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
      members: {
        where: {
          isActive: true,
          role: { in: ['MEMBER', 'WORKER'] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamJoinedAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Fetch holidays for current and previous period
  const [currentHolidays, prevHolidays] = await Promise.all([
    prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true },
    }),
    prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: prevStartDate, lte: prevEndDate },
      },
      select: { date: true },
    }),
  ]);

  const currentHolidayDates = currentHolidays.map(h => formatLocalDate(h.date, timezone));
  const prevHolidayDates = prevHolidays.map(h => formatLocalDate(h.date, timezone));

  // Calculate grades for each team
  const teamGrades: TeamGradeSummary[] = [];

  for (const team of teams) {
    const teamGrade = await calculateSingleTeamGrade({
      team,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      timezone,
      minWorkDays,
      currentHolidayDates,
      prevHolidayDates,
    });

    teamGrades.push(teamGrade);
  }

  // Sort by grade (worst first: D, C, B, A)
  const gradeOrder: Record<string, number> = { D: 0, C: 1, B: 2, A: 3 };
  teamGrades.sort((a, b) => {
    const gradeCompare = gradeOrder[a.grade] - gradeOrder[b.grade];
    if (gradeCompare !== 0) return gradeCompare;
    // Secondary sort by score (lowest first)
    return a.score - b.score;
  });

  // Calculate summary
  const summary = calculateOverviewSummary(teamGrades);

  return {
    teams: teamGrades,
    summary,
    period: {
      days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * Calculate grade for a single team.
 *
 * Can be used standalone when you only need one team's grade.
 * This uses the same calculation as calculateTeamsOverview for consistency.
 *
 * @param teamId - Team ID
 * @param options - Configuration options
 * @returns Promise<TeamGradeSummary | null> - Team grade or null if not found
 */
export async function calculateTeamGrade(
  teamId: string,
  options: Omit<TeamGradeOptions, 'teamIds'>
): Promise<TeamGradeSummary | null> {
  const result = await calculateTeamsOverview({
    ...options,
    teamIds: [teamId],
  });

  return result.teams[0] || null;
}

// ===========================================
// INTERNAL HELPERS
// ===========================================

/**
 * Calculate grade for a single team (internal helper)
 */
async function calculateSingleTeamGrade(params: {
  team: {
    id: string;
    name: string;
    workDays: string;
    leader: { id: string; firstName: string; lastName: string; avatar: string | null } | null;
    members: { id: string; firstName: string; lastName: string; teamJoinedAt: Date | null; createdAt: Date }[];
  };
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
  timezone: string;
  minWorkDays: number;
  currentHolidayDates: string[];
  prevHolidayDates: string[];
}): Promise<TeamGradeSummary> {
  const {
    team,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    timezone,
    minWorkDays,
    currentHolidayDates,
    prevHolidayDates,
  } = params;

  const memberIds = team.members.map(m => m.id);

  // Fetch exemptions for all members in current period
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      userId: true,
      startDate: true,
      endDate: true,
    },
  });

  // Build exemption map
  const exemptionsByUser = new Map<string, typeof exemptions>();
  for (const ex of exemptions) {
    const userExemptions = exemptionsByUser.get(ex.userId) || [];
    userExemptions.push(ex);
    exemptionsByUser.set(ex.userId, userExemptions);
  }

  // Calculate scores for each member
  const memberScores: number[] = [];
  let totalGreen = 0;
  let totalYellow = 0;
  let totalAbsent = 0;
  let totalExcused = 0;
  let totalExpectedWorkDays = 0;
  let totalActualCheckins = 0;
  let atRiskCount = 0;
  let needsAttentionCount = 0;
  let onboardingCount = 0;

  for (const member of team.members) {
    // Calculate effective start date for member
    const joinDate = member.teamJoinedAt || member.createdAt;
    const memberEffectiveStart = getStartOfNextDay(joinDate, timezone);
    const effectiveStartDate = memberEffectiveStart > startDate ? memberEffectiveStart : startDate;

    // Count work days for this member (excluding holidays)
    const memberWorkDays = countWorkDaysInRange(
      effectiveStartDate,
      endDate,
      team.workDays,
      timezone,
      currentHolidayDates
    );

    // Count exemption days
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDates = countExemptedDays(
      userExemptions,
      effectiveStartDate,
      endDate,
      team.workDays,
      timezone,
      currentHolidayDates
    );

    const expectedWorkDays = Math.max(0, memberWorkDays - exemptedDates);

    // Skip members with insufficient work days
    if (expectedWorkDays < minWorkDays) {
      onboardingCount++;
      continue;
    }

    // Get member's performance score using existing utility
    const performance = await calculatePerformanceScore(
      member.id,
      startDate,
      endDate,
      timezone
    );

    // Count ACTUAL check-in days (GREEN + YELLOW only)
    // These are the only days where we have real readiness data
    // NOT counted: ABSENT, UNEXCUSED, EXCUSED, holidays - no readiness data
    const actualCheckinDays = performance.breakdown.green + performance.breakdown.yellow;

    // Skip members with < MIN_CHECKIN_DAYS_THRESHOLD actual check-ins (onboarding)
    // Members need 3+ actual check-ins before being included in team grade
    // This ensures we have enough readiness DATA to assess the member
    if (actualCheckinDays < MIN_CHECKIN_DAYS_THRESHOLD) {
      onboardingCount++;
      continue;
    }

    memberScores.push(performance.score);
    totalGreen += performance.breakdown.green;
    totalYellow += performance.breakdown.yellow;
    totalAbsent += performance.breakdown.absent;
    totalExcused += performance.breakdown.excused;
    totalExpectedWorkDays += expectedWorkDays;
    totalActualCheckins += actualCheckinDays;

    // Check risk level
    const memberGrade = getPerformanceGrade(performance.score);
    if (memberGrade.grade === 'D') {
      atRiskCount++;
      needsAttentionCount++;
    } else if (memberGrade.grade === 'C') {
      needsAttentionCount++;
    }
  }

  // Track how many members are actually included in the grade calculation
  const includedMemberCount = memberScores.length;

  // Calculate team score (average of member scores)
  const teamScore = memberScores.length > 0
    ? Math.round(memberScores.reduce((sum, s) => sum + s, 0) / memberScores.length)
    : 0;

  const { grade, label: gradeLabel } = getPerformanceGrade(teamScore);

  // Calculate rates
  const attendanceRate = totalExpectedWorkDays > 0
    ? Math.round((totalActualCheckins / totalExpectedWorkDays) * 100)
    : 0;

  const onTimeRate = totalActualCheckins > 0
    ? Math.round((totalGreen / totalActualCheckins) * 100)
    : 0;

  // Calculate previous period score for trend
  const prevScore = await calculatePreviousPeriodScore(
    memberIds,
    prevStartDate,
    prevEndDate,
    timezone,
    minWorkDays
  );

  // Determine trend
  const scoreDelta = teamScore - prevScore;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (scoreDelta >= TREND_THRESHOLD) {
    trend = 'up';
  } else if (scoreDelta <= -TREND_THRESHOLD) {
    trend = 'down';
  }

  return {
    id: team.id,
    name: team.name,
    leader: team.leader ? {
      id: team.leader.id,
      name: `${team.leader.firstName} ${team.leader.lastName}`,
      avatar: team.leader.avatar,
    } : null,
    memberCount: team.members.length,
    grade,
    gradeLabel,
    score: teamScore,
    attendanceRate,
    onTimeRate,
    breakdown: {
      green: totalGreen,
      yellow: totalYellow,
      absent: totalAbsent,
      excused: totalExcused,
    },
    trend,
    scoreDelta: Math.round(scoreDelta * 10) / 10,
    atRiskCount,
    membersNeedingAttention: needsAttentionCount,
    onboardingCount,
    includedMemberCount,
  };
}

/**
 * Count exempted work days for a user
 */
function countExemptedDays(
  exemptions: { startDate: Date | null; endDate: Date | null }[],
  effectiveStart: Date,
  endDate: Date,
  workDaysString: string,
  timezone: string,
  holidayDates: string[]
): number {
  const holidaySet = new Set(holidayDates);
  const workDays = workDaysString.split(',').map(d => d.trim().toUpperCase());
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const exemptedDatesSet = new Set<string>();

  for (const exemption of exemptions) {
    if (!exemption.startDate || !exemption.endDate) continue;

    const exStart = exemption.startDate > effectiveStart ? exemption.startDate : effectiveStart;
    const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;

    let current = new Date(exStart);
    while (current <= exEnd) {
      const dateStr = formatLocalDate(current, timezone);
      const dayOfWeek = current.getDay();

      // Only count if it's a work day and not a holiday
      if (workDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
        exemptedDatesSet.add(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return exemptedDatesSet.size;
}

/**
 * Calculate previous period score for trend comparison
 */
async function calculatePreviousPeriodScore(
  memberIds: string[],
  prevStartDate: Date,
  prevEndDate: Date,
  timezone: string,
  minWorkDays: number
): Promise<number> {
  if (memberIds.length === 0) return 0;

  const scores: number[] = [];

  for (const memberId of memberIds) {
    const performance = await calculatePerformanceScore(
      memberId,
      prevStartDate,
      prevEndDate,
      timezone
    );

    // Only include if they had enough work days
    if (performance.countedDays >= minWorkDays) {
      scores.push(performance.score);
    }
  }

  return scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;
}

/**
 * Calculate summary statistics across all teams
 */
function calculateOverviewSummary(teams: TeamGradeSummary[]): TeamsOverviewSummary {
  if (teams.length === 0) {
    return {
      totalTeams: 0,
      totalMembers: 0,
      avgScore: 0,
      avgGrade: 'N/A',
      teamsAtRisk: 0,
      teamsCritical: 0,
      teamsImproving: 0,
      teamsDeclining: 0,
    };
  }

  const totalMembers = teams.reduce((sum, t) => sum + t.memberCount, 0);
  const avgScore = Math.round(teams.reduce((sum, t) => sum + t.score, 0) / teams.length);
  const { grade: avgGrade } = getPerformanceGrade(avgScore);

  const teamsAtRisk = teams.filter(t => t.grade === 'C' || t.grade === 'D').length;
  const teamsCritical = teams.filter(t => t.grade === 'D').length;
  const teamsImproving = teams.filter(t => t.trend === 'up').length;
  const teamsDeclining = teams.filter(t => t.trend === 'down').length;

  return {
    totalTeams: teams.length,
    totalMembers,
    avgScore,
    avgGrade,
    teamsAtRisk,
    teamsCritical,
    teamsImproving,
    teamsDeclining,
  };
}

// ===========================================
// EXPORTS
// ===========================================

export {
  DEFAULT_MIN_WORK_DAYS,
  TREND_THRESHOLD,
  MIN_CHECKIN_DAYS_THRESHOLD,
};
