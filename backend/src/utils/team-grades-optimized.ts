/**
 * OPTIMIZED Team Grades Utility
 *
 * This is an optimized version that batches all database queries upfront
 * instead of running N+1 queries per member.
 *
 * IMPORTANT: Uses the SAME formula as Team Analytics for consistency:
 * Grade = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
 *
 * Where:
 * - Team Avg Readiness = Average of member readiness scores from check-ins
 * - Period Compliance = % of members who checked in vs expected work days
 *
 * @module utils/team-grades-optimized
 */

import { prisma } from '../config/prisma.js';
import {
  getLastNDaysRange,
  toDbDate,
  DEFAULT_TIMEZONE,
} from './date-helpers.js';

import type {
  TeamGradeSummary,
  TeamsOverviewSummary,
  TeamsOverviewResult,
  TeamGradeOptions,
} from './team-grades.js';

// ===========================================
// CONSTANTS
// ===========================================

const TREND_THRESHOLD = 3;

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
export const MIN_CHECKIN_DAYS_THRESHOLD = 3;

// ===========================================
// GRADE CALCULATION (SAME AS TEAM ANALYTICS)
// ===========================================

/**
 * Get grade info based on score - SAME as Team Analytics
 * Grade = (avgReadiness × 60%) + (compliance × 40%)
 */
function getGradeInfo(score: number): { grade: string; label: string; color: string } {
  if (score >= 97) return { grade: 'A+', label: 'Outstanding', color: 'GREEN' };
  if (score >= 93) return { grade: 'A', label: 'Excellent', color: 'GREEN' };
  if (score >= 90) return { grade: 'A-', label: 'Excellent', color: 'GREEN' };
  if (score >= 87) return { grade: 'B+', label: 'Very Good', color: 'GREEN' };
  if (score >= 83) return { grade: 'B', label: 'Good', color: 'GREEN' };
  if (score >= 80) return { grade: 'B-', label: 'Good', color: 'YELLOW' };
  if (score >= 77) return { grade: 'C+', label: 'Satisfactory', color: 'YELLOW' };
  if (score >= 73) return { grade: 'C', label: 'Satisfactory', color: 'YELLOW' };
  if (score >= 70) return { grade: 'C-', label: 'Satisfactory', color: 'YELLOW' };
  if (score >= 67) return { grade: 'D+', label: 'Needs Improvement', color: 'ORANGE' };
  if (score >= 63) return { grade: 'D', label: 'Needs Improvement', color: 'ORANGE' };
  if (score >= 60) return { grade: 'D-', label: 'Needs Improvement', color: 'ORANGE' };
  return { grade: 'F', label: 'Critical', color: 'RED' };
}

/**
 * Simplified grade for summary (A, B, C, D)
 */
function getSimpleGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}

// ===========================================
// OPTIMIZED MAIN FUNCTION
// ===========================================

/**
 * OPTIMIZED: Calculate grades for all teams in a company.
 *
 * Uses SAME formula as Team Analytics for consistency:
 * Grade = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
 */
export async function calculateTeamsOverviewOptimized(
  options: TeamGradeOptions
): Promise<TeamsOverviewResult> {
  const {
    days = 30,
    companyId,
    timezone = DEFAULT_TIMEZONE,
    teamIds,
    includeInactiveTeams = false,
  } = options;

  // Calculate date ranges
  // IMPORTANT: Use (days - 1) to match Team Analytics behavior
  // Team Analytics uses getLastNDaysRange(13) for 14 days, getLastNDaysRange(6) for 7 days
  // This ensures: start = today - (days-1), end = today, giving exactly 'days' days
  const { start: startDate, end: endDate } = getLastNDaysRange(days - 1, timezone);

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

  // ============================================
  // OPTIMIZED: USE DailyTeamSummary (PRE-COMPUTED)
  // This is much faster than computing on-the-fly
  // ============================================

  // Convert dates to DB format for DailyTeamSummary query
  const dbStartDate = toDbDate(startDate, timezone);
  const dbEndDate = toDbDate(endDate, timezone);
  const dbPrevStartDate = toDbDate(prevStartDate, timezone);
  const dbPrevEndDate = toDbDate(prevEndDate, timezone);

  // Batch fetch all data
  const [teams, currentSummaries, prevSummaries] = await Promise.all([
    // 1. Fetch all teams with leaders and members (for member averages & onboarding threshold)
    prisma.team.findMany({
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
            teamId: true,
            totalCheckins: true,      // For onboarding threshold
            avgReadinessScore: true,  // For member average calculation
            lastReadinessStatus: true, // For at-risk detection
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    // 2. Fetch DailyTeamSummary for current period (pre-computed data!)
    prisma.dailyTeamSummary.findMany({
      where: {
        companyId,
        date: { gte: dbStartDate, lte: dbEndDate },
        ...(teamIds && teamIds.length > 0 ? { teamId: { in: teamIds } } : {}),
      },
      select: {
        teamId: true,
        date: true,
        isWorkDay: true,
        isHoliday: true,
        checkedInCount: true,
        expectedToCheckIn: true,
        onLeaveCount: true,
        greenCount: true,
        yellowCount: true,
        redCount: true,
        avgReadinessScore: true,
      },
    }),

    // 3. Fetch DailyTeamSummary for previous period (for trend comparison)
    prisma.dailyTeamSummary.findMany({
      where: {
        companyId,
        date: { gte: dbPrevStartDate, lte: dbPrevEndDate },
        ...(teamIds && teamIds.length > 0 ? { teamId: { in: teamIds } } : {}),
      },
      select: {
        teamId: true,
        checkedInCount: true,
        expectedToCheckIn: true,
        avgReadinessScore: true,
        isWorkDay: true,
        isHoliday: true,
      },
    }),
  ]);

  // ============================================
  // BUILD LOOKUP MAPS FOR FAST ACCESS
  // ============================================

  // Current period summaries by teamId
  const currentSummariesByTeam = new Map<string, typeof currentSummaries>();
  for (const summary of currentSummaries) {
    if (!currentSummariesByTeam.has(summary.teamId)) {
      currentSummariesByTeam.set(summary.teamId, []);
    }
    currentSummariesByTeam.get(summary.teamId)!.push(summary);
  }

  // Previous period summaries by teamId
  const prevSummariesByTeam = new Map<string, typeof prevSummaries>();
  for (const summary of prevSummaries) {
    if (!prevSummariesByTeam.has(summary.teamId)) {
      prevSummariesByTeam.set(summary.teamId, []);
    }
    prevSummariesByTeam.get(summary.teamId)!.push(summary);
  }

  // ============================================
  // CALCULATE GRADES FOR EACH TEAM (FROM SUMMARIES)
  // ============================================

  const teamGrades: TeamGradeSummary[] = [];

  for (const team of teams) {
    // Get pre-computed summaries for this team
    const teamCurrentSummaries = currentSummariesByTeam.get(team.id) || [];
    const teamPrevSummaries = prevSummariesByTeam.get(team.id) || [];

    // Calculate team grade from DailyTeamSummary data
    const teamGrade = calculateTeamGradeFromSummaries({
      team,
      currentSummaries: teamCurrentSummaries,
      prevSummaries: teamPrevSummaries,
      timezone,
    });

    teamGrades.push(teamGrade);
  }

  // Sort by score (lowest first for attention)
  teamGrades.sort((a, b) => {
    // Primary: by score (lowest first)
    if (a.score !== b.score) return a.score - b.score;
    // Secondary: by name
    return a.name.localeCompare(b.name);
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

// ===========================================
// HELPER: Calculate team grade from DailyTeamSummary (pre-computed!)
// Uses formula:
// Grade = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
//
// IMPORTANT: Compliance uses TOTAL SUM method for consistency:
// Period Compliance = totalCheckedIn / totalExpected
// This treats each check-in equally (more accurate and intuitive)
// ===========================================

type DailyTeamSummaryData = {
  teamId: string;
  date: Date;
  isWorkDay: boolean;
  isHoliday: boolean;
  checkedInCount: number;
  expectedToCheckIn: number;
  onLeaveCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  avgReadinessScore: number | null;
};

type TeamWithMembers = {
  id: string;
  name: string;
  leader: { id: string; firstName: string; lastName: string; avatar: string | null } | null;
  members: {
    id: string;
    firstName: string;
    lastName: string;
    teamId: string | null;
    totalCheckins: number;
    avgReadinessScore: number | null;
    lastReadinessStatus: string | null;
  }[];
};

function calculateTeamGradeFromSummaries(params: {
  team: TeamWithMembers;
  currentSummaries: DailyTeamSummaryData[];
  prevSummaries: Pick<DailyTeamSummaryData, 'teamId' | 'checkedInCount' | 'expectedToCheckIn' | 'avgReadinessScore' | 'isWorkDay' | 'isHoliday'>[];
  timezone: string;
}): TeamGradeSummary {
  const { team, currentSummaries, prevSummaries } = params;

  // ============================================
  // AGGREGATE TOTALS FROM DailyTeamSummary
  // Only count work days (not holidays)
  // ============================================

  let totalCheckins = 0;
  let totalExpected = 0;
  let totalGreen = 0;
  let totalYellow = 0;
  let totalRed = 0;
  let totalExcused = 0;

  // Current period: aggregate from pre-computed summaries
  for (const summary of currentSummaries) {
    // Skip non-work days and holidays
    if (!summary.isWorkDay || summary.isHoliday) continue;

    totalCheckins += summary.checkedInCount;
    totalExpected += summary.expectedToCheckIn;
    totalExcused += summary.onLeaveCount;
    totalGreen += summary.greenCount;
    totalYellow += summary.yellowCount;
    totalRed += summary.redCount;
  }

  // Previous period: aggregate for trend comparison
  let prevTotalCheckins = 0;
  let prevTotalExpected = 0;

  for (const summary of prevSummaries) {
    if (!summary.isWorkDay || summary.isHoliday) continue;

    prevTotalCheckins += summary.checkedInCount;
    prevTotalExpected += summary.expectedToCheckIn;
  }

  // ============================================
  // CALCULATE TEAM AVG READINESS FROM MEMBERS
  // Use member.avgReadinessScore (pre-computed on each check-in)
  // Apply MIN_CHECKIN_DAYS_THRESHOLD for onboarding members
  // ============================================

  const memberAverages: number[] = [];
  let onboardingCount = 0;
  let atRiskCount = 0;
  let needsAttentionCount = 0;

  for (const member of team.members) {
    // Check if member has met the minimum check-in threshold
    if (member.totalCheckins < MIN_CHECKIN_DAYS_THRESHOLD) {
      onboardingCount++;
      continue;
    }

    // Use pre-computed avgReadinessScore from User model
    if (member.avgReadinessScore !== null) {
      memberAverages.push(member.avgReadinessScore);

      // Check at-risk status
      if (member.avgReadinessScore < 60) {
        atRiskCount++;
        needsAttentionCount++;
      } else if (member.avgReadinessScore < 70) {
        needsAttentionCount++;
      }
    }

    // Also check lastReadinessStatus for at-risk detection
    if (member.lastReadinessStatus === 'RED') {
      // Already counted above if avgReadinessScore < 60
    }
  }

  const includedMemberCount = memberAverages.length;

  // Team Avg Readiness = average of member averages
  const avgReadiness = memberAverages.length > 0
    ? Math.round(memberAverages.reduce((a, b) => a + b, 0) / memberAverages.length)
    : 0;

  // ============================================
  // CALCULATE COMPLIANCE USING TOTAL SUM METHOD
  // Period Compliance = totalCheckedIn / totalExpected
  // ============================================

  const periodCompliance = totalExpected > 0
    ? Math.round((totalCheckins / totalExpected) * 100)
    : 0;

  // ============================================
  // CALCULATE GRADE SCORE
  // Grade = (avgReadiness × 60%) + (compliance × 40%)
  // ============================================

  const score = Math.round((avgReadiness * 0.6) + (periodCompliance * 0.4));
  const gradeInfo = getGradeInfo(score);

  // On-time rate (GREEN out of total check-ins)
  const onTimeRate = totalCheckins > 0
    ? Math.round((totalGreen / totalCheckins) * 100)
    : 0;

  // ============================================
  // CALCULATE TREND (compare with previous period)
  // ============================================

  // Previous period compliance
  const prevPeriodCompliance = prevTotalExpected > 0
    ? Math.round((prevTotalCheckins / prevTotalExpected) * 100)
    : 0;

  // For previous avgReadiness, we'd need to re-calculate from historical data
  // For simplicity, use current member averages (they represent historical performance)
  // This is a reasonable approximation since avgReadinessScore is cumulative
  const prevAvgReadiness = avgReadiness; // Use same avg for now

  const prevScore = Math.round((prevAvgReadiness * 0.6) + (prevPeriodCompliance * 0.4));

  // Determine trend
  const scoreDelta = score - prevScore;
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
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    score,
    attendanceRate: periodCompliance,
    onTimeRate,
    breakdown: {
      green: totalGreen,
      yellow: totalYellow,
      absent: Math.max(0, totalExpected - totalCheckins),
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

// ===========================================
// HELPER: Calculate summary
// ===========================================

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
  const avgGrade = getSimpleGrade(avgScore);

  return {
    totalTeams: teams.length,
    totalMembers,
    avgScore,
    avgGrade,
    teamsAtRisk: teams.filter(t => t.score < 70).length,
    teamsCritical: teams.filter(t => t.score < 60).length,
    teamsImproving: teams.filter(t => t.trend === 'up').length,
    teamsDeclining: teams.filter(t => t.trend === 'down').length,
  };
}

/**
 * Calculate grade for a single team (optimized).
 * Reuses the batch logic for consistency.
 *
 * @param teamId - Team ID
 * @param options - Configuration options
 * @returns Promise<TeamGradeSummary | null> - Team grade or null if not found
 */
export async function calculateSingleTeamGradeOptimized(
  teamId: string,
  options: Omit<TeamGradeOptions, 'teamIds'>
): Promise<TeamGradeSummary | null> {
  const result = await calculateTeamsOverviewOptimized({
    ...options,
    teamIds: [teamId],
  });

  return result.teams[0] || null;
}
