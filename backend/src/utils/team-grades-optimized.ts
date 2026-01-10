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
  formatLocalDate,
  countWorkDaysInRange,
  getStartOfNextDay,
  getStartOfDay,
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

const DEFAULT_MIN_WORK_DAYS = 3;
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
const MIN_CHECKIN_DAYS_THRESHOLD = 3;

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
    minWorkDays = DEFAULT_MIN_WORK_DAYS,
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
  // BATCH FETCH ALL DATA UPFRONT (OPTIMIZED)
  // ============================================

  const [teams, holidays, allCheckins, allExceptions] = await Promise.all([
    // 1. Fetch all teams with leaders and members
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
            teamJoinedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    // 2. Fetch all holidays for current + previous period
    prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: prevStartDate, lte: endDate },
      },
      select: { date: true },
    }),

    // 3. Fetch ALL check-ins for all members in date range (with readinessScore)
    prisma.checkin.findMany({
      where: {
        companyId,
        createdAt: { gte: prevStartDate, lte: endDate },
      },
      select: {
        userId: true,
        createdAt: true,
        readinessScore: true,
        readinessStatus: true,
      },
    }),

    // 4. Fetch ALL approved exceptions for all members
    prisma.exception.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: prevStartDate },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    }),

  ]);

  // ============================================
  // BUILD LOOKUP MAPS FOR FAST ACCESS
  // ============================================

  // Holiday dates for current and previous period
  const currentHolidayDates = holidays
    .filter(h => h.date >= startDate && h.date <= endDate)
    .map(h => formatLocalDate(h.date, timezone));
  const prevHolidayDates = holidays
    .filter(h => h.date >= prevStartDate && h.date <= prevEndDate)
    .map(h => formatLocalDate(h.date, timezone));

  // Check-ins by userId -> date -> checkin (using readinessScore)
  const checkinsByUser = new Map<string, Map<string, { readinessScore: number; readinessStatus: string }>>();
  for (const checkin of allCheckins) {
    if (!checkinsByUser.has(checkin.userId)) {
      checkinsByUser.set(checkin.userId, new Map());
    }
    const dateStr = formatLocalDate(checkin.createdAt, timezone);
    // Keep only first check-in per day (in case of duplicates)
    if (!checkinsByUser.get(checkin.userId)!.has(dateStr)) {
      checkinsByUser.get(checkin.userId)!.set(dateStr, {
        readinessScore: checkin.readinessScore,
        readinessStatus: checkin.readinessStatus,
      });
    }
  }

  // Exceptions by userId
  const exceptionsMap = new Map<string, typeof allExceptions>();
  for (const ex of allExceptions) {
    if (!exceptionsMap.has(ex.userId)) {
      exceptionsMap.set(ex.userId, []);
    }
    exceptionsMap.get(ex.userId)!.push(ex);
  }

  // ============================================
  // CALCULATE GRADES FOR EACH TEAM (IN MEMORY)
  // ============================================

  const teamGrades: TeamGradeSummary[] = [];

  for (const team of teams) {
    // Get member IDs for this team
    const memberIds = team.members.map(m => m.id);

    // Calculate team grade using pre-fetched data
    const teamGrade = calculateTeamGradeFromData({
      team,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      timezone,
      minWorkDays,
      currentHolidayDates,
      prevHolidayDates,
      checkinsByUser,
      exceptionsMap,
      memberIds,
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
// HELPER: Calculate team grade from pre-fetched data
// Uses SAME formula as Team Analytics:
// Grade = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
//
// IMPORTANT: Compliance is calculated as AVERAGE of daily compliance rates
// (same as Team Analytics), NOT total check-ins / total expected.
// ===========================================

function calculateTeamGradeFromData(params: {
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
  checkinsByUser: Map<string, Map<string, { readinessScore: number; readinessStatus: string }>>;
  exceptionsMap: Map<string, { startDate: Date | null; endDate: Date | null }[]>;
  memberIds: string[];
}): TeamGradeSummary {
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
    checkinsByUser,
    exceptionsMap,
    memberIds,
  } = params;

  const holidaySet = new Set(currentHolidayDates);
  const prevHolidaySet = new Set(prevHolidayDates);
  const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Build member effective start dates
  const memberEffectiveStarts = new Map<string, Date>();
  for (const member of team.members) {
    const joinDate = member.teamJoinedAt || member.createdAt;
    memberEffectiveStarts.set(member.id, getStartOfNextDay(new Date(joinDate), timezone));
  }

  // ============================================
  // CALCULATE DAILY COMPLIANCE (same as Team Analytics)
  // For each work day: compliance = checkedIn / expectedToCheckin
  // Period compliance = AVERAGE of daily compliance rates
  // ============================================

  const dailyCompliances: number[] = [];
  const prevDailyCompliances: number[] = [];

  // Track scores PER MEMBER for member-weighted average (same as Team Analytics)
  // Team Analytics uses average of member averages, not flat average of all scores
  const memberScores = new Map<string, number[]>();
  const prevMemberScores = new Map<string, number[]>();

  // Track totals for breakdown
  let totalGreen = 0;
  let totalYellow = 0;
  let totalRed = 0;
  let totalExcused = 0;
  let totalExpected = 0;
  let totalCheckins = 0;

  // Iterate through each day in current period
  let currentDay = new Date(startDate);
  while (currentDay <= endDate) {
    const dateStr = formatLocalDate(currentDay, timezone);
    const dayOfWeek = currentDay.getDay();

    // Skip non-work days and holidays
    if (!workDaysList.includes(dayNames[dayOfWeek]) || holidaySet.has(dateStr)) {
      currentDay.setDate(currentDay.getDate() + 1);
      continue;
    }

    // ============================================
    // COMPLIANCE CALCULATION - SAME AS TEAM ANALYTICS
    // Expected = regular expected members + exempted members who checked in
    // CheckedIn = expected members who checked in + exempted members who checked in
    // ============================================

    // First pass: identify expected members (not on exemption)
    const expectedMembers: string[] = [];
    const exemptedMembers: string[] = [];

    // Normalize current day for exemption comparison (same as Team Analytics)
    const currentDayStart = getStartOfDay(currentDay, timezone);

    for (const member of team.members) {
      const memberEffStart = memberEffectiveStarts.get(member.id)!;

      // Skip if member hasn't started yet
      if (currentDay < memberEffStart) continue;

      // Check if member is on exemption today
      // Use getStartOfDay to normalize dates (same as Team Analytics)
      const userExemptions = exceptionsMap.get(member.id) || [];
      const isExempted = userExemptions.some(ex => {
        if (!ex.startDate || !ex.endDate) return false;
        const exemptStart = getStartOfDay(ex.startDate, timezone);
        const exemptEnd = getStartOfDay(ex.endDate, timezone);
        // Check if date falls within exemption period (INCLUSIVE of both start and end)
        return currentDayStart >= exemptStart && currentDayStart <= exemptEnd;
      });

      if (isExempted) {
        exemptedMembers.push(member.id);
      } else {
        expectedMembers.push(member.id);
      }
    }

    // Second pass: count check-ins for each category
    let expectedCheckedIn = 0;
    let exemptedButCheckedIn = 0;

    // Count expected members who checked in
    for (const memberId of expectedMembers) {
      const memberCheckins = checkinsByUser.get(memberId);
      const checkin = memberCheckins?.get(dateStr);

      totalExpected++;

      if (checkin) {
        expectedCheckedIn++;
        totalCheckins++;

        // Track score per member (for member-weighted average)
        if (!memberScores.has(memberId)) memberScores.set(memberId, []);
        memberScores.get(memberId)!.push(checkin.readinessScore);

        if (checkin.readinessStatus === 'GREEN') totalGreen++;
        else if (checkin.readinessStatus === 'YELLOW') totalYellow++;
        else if (checkin.readinessStatus === 'RED') totalRed++;
      }
    }

    // Count exempted members who ALSO checked in (same as Team Analytics)
    // They're counted in both numerator and denominator for compliance
    for (const memberId of exemptedMembers) {
      const memberCheckins = checkinsByUser.get(memberId);
      const checkin = memberCheckins?.get(dateStr);

      totalExcused++;

      if (checkin) {
        exemptedButCheckedIn++;
        totalCheckins++;

        // Track score per member (for member-weighted average)
        if (!memberScores.has(memberId)) memberScores.set(memberId, []);
        memberScores.get(memberId)!.push(checkin.readinessScore);

        if (checkin.readinessStatus === 'GREEN') totalGreen++;
        else if (checkin.readinessStatus === 'YELLOW') totalYellow++;
        else if (checkin.readinessStatus === 'RED') totalRed++;
      }
    }

    // Calculate daily compliance (same as Team Analytics)
    // Expected = regular expected + exempted who checked in
    // CheckedIn = expected who checked in + exempted who checked in
    const dayExpected = expectedMembers.length + exemptedButCheckedIn;
    const dayCheckedIn = expectedCheckedIn + exemptedButCheckedIn;

    if (dayExpected > 0) {
      const dayCompliance = Math.min(100, Math.round((dayCheckedIn / dayExpected) * 100));
      dailyCompliances.push(dayCompliance);
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  // --- PREVIOUS PERIOD (for trend) ---
  // Use same logic as current period for consistency
  let prevDay = new Date(prevStartDate);
  while (prevDay <= prevEndDate) {
    const dateStr = formatLocalDate(prevDay, timezone);
    const dayOfWeek = prevDay.getDay();

    if (!workDaysList.includes(dayNames[dayOfWeek]) || prevHolidaySet.has(dateStr)) {
      prevDay.setDate(prevDay.getDate() + 1);
      continue;
    }

    // First pass: identify expected and exempted members
    const prevExpectedMembers: string[] = [];
    const prevExemptedMembers: string[] = [];

    // Normalize prev day for exemption comparison (same as Team Analytics)
    const prevDayStart = getStartOfDay(prevDay, timezone);

    for (const member of team.members) {
      const memberEffStart = memberEffectiveStarts.get(member.id)!;
      if (prevDay < memberEffStart) continue;

      const userExemptions = exceptionsMap.get(member.id) || [];
      const isExempted = userExemptions.some(ex => {
        if (!ex.startDate || !ex.endDate) return false;
        const exemptStart = getStartOfDay(ex.startDate, timezone);
        const exemptEnd = getStartOfDay(ex.endDate, timezone);
        return prevDayStart >= exemptStart && prevDayStart <= exemptEnd;
      });

      if (isExempted) {
        prevExemptedMembers.push(member.id);
      } else {
        prevExpectedMembers.push(member.id);
      }
    }

    // Second pass: count check-ins
    let prevExpectedCheckedIn = 0;
    let prevExemptedButCheckedIn = 0;

    for (const memberId of prevExpectedMembers) {
      const memberCheckins = checkinsByUser.get(memberId);
      const checkin = memberCheckins?.get(dateStr);

      if (checkin) {
        prevExpectedCheckedIn++;
        // Track score per member (for member-weighted average)
        if (!prevMemberScores.has(memberId)) prevMemberScores.set(memberId, []);
        prevMemberScores.get(memberId)!.push(checkin.readinessScore);
      }
    }

    for (const memberId of prevExemptedMembers) {
      const memberCheckins = checkinsByUser.get(memberId);
      const checkin = memberCheckins?.get(dateStr);

      if (checkin) {
        prevExemptedButCheckedIn++;
        // Track score per member (for member-weighted average)
        if (!prevMemberScores.has(memberId)) prevMemberScores.set(memberId, []);
        prevMemberScores.get(memberId)!.push(checkin.readinessScore);
      }
    }

    // Same compliance formula as current period
    const prevDayExpected = prevExpectedMembers.length + prevExemptedButCheckedIn;
    const prevDayCheckedIn = prevExpectedCheckedIn + prevExemptedButCheckedIn;

    if (prevDayExpected > 0) {
      const dayCompliance = Math.min(100, Math.round((prevDayCheckedIn / prevDayExpected) * 100));
      prevDailyCompliances.push(dayCompliance);
    }

    prevDay.setDate(prevDay.getDate() + 1);
  }

  // ============================================
  // CALCULATE GRADE USING SAME FORMULA AS TEAM ANALYTICS
  // Grade = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
  // ============================================

  // Team Avg Readiness = AVERAGE OF MEMBER AVERAGES (same as Team Analytics!)
  // This ensures each member is weighted equally, regardless of check-in count
  // IMPORTANT: Only include members with >= MIN_CHECKIN_DAYS_THRESHOLD actual check-ins
  const memberAverages: number[] = [];
  let onboardingCount = 0;
  const membersWithScores = new Set<string>();

  for (const [memberId, scores] of memberScores) {
    // scores.length = number of ACTUAL check-in days (GREEN/YELLOW/RED)
    // Only actual check-ins count toward threshold - we need real readiness data
    // NOT counted: holidays, exemption days, absent days (no readiness data)
    if (scores.length < MIN_CHECKIN_DAYS_THRESHOLD) {
      onboardingCount++;
      continue;
    }

    if (scores.length > 0) {
      const memberAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      memberAverages.push(memberAvg);
      membersWithScores.add(memberId);
    }
  }

  // Also count members who have no check-ins at all as onboarding
  for (const member of team.members) {
    if (!memberScores.has(member.id)) {
      // Member has no check-ins in this period - count as onboarding
      onboardingCount++;
    }
  }

  const includedMemberCount = memberAverages.length;

  const avgReadiness = memberAverages.length > 0
    ? Math.round(memberAverages.reduce((a, b) => a + b, 0) / memberAverages.length)
    : 0;

  // Period Compliance = AVERAGE of daily compliance rates (same as Team Analytics!)
  const periodCompliance = dailyCompliances.length > 0
    ? Math.round(dailyCompliances.reduce((a, b) => a + b, 0) / dailyCompliances.length)
    : 0;

  // Calculate score using formula: (avgReadiness × 60%) + (compliance × 40%)
  const score = Math.round((avgReadiness * 0.6) + (periodCompliance * 0.4));

  // Get grade info
  const gradeInfo = getGradeInfo(score);

  // On-time rate (GREEN out of total check-ins)
  const onTimeRate = totalCheckins > 0
    ? Math.round((totalGreen / totalCheckins) * 100)
    : 0;

  // ============================================
  // CALCULATE PREVIOUS PERIOD FOR TREND
  // ============================================

  // Previous period: also use member averages
  // Apply same MIN_CHECKIN_DAYS_THRESHOLD filter for consistency
  const prevMemberAverages: number[] = [];
  for (const [_memberId, scores] of prevMemberScores) {
    // Skip members with < MIN_CHECKIN_DAYS_THRESHOLD check-ins
    if (scores.length < MIN_CHECKIN_DAYS_THRESHOLD) {
      continue;
    }
    if (scores.length > 0) {
      const memberAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      prevMemberAverages.push(memberAvg);
    }
  }

  const prevAvgReadiness = prevMemberAverages.length > 0
    ? Math.round(prevMemberAverages.reduce((a, b) => a + b, 0) / prevMemberAverages.length)
    : 0;

  const prevPeriodCompliance = prevDailyCompliances.length > 0
    ? Math.round(prevDailyCompliances.reduce((a, b) => a + b, 0) / prevDailyCompliances.length)
    : 0;

  const prevScore = Math.round((prevAvgReadiness * 0.6) + (prevPeriodCompliance * 0.4));

  // Determine trend
  const scoreDelta = score - prevScore;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (scoreDelta >= TREND_THRESHOLD) {
    trend = 'up';
  } else if (scoreDelta <= -TREND_THRESHOLD) {
    trend = 'down';
  }

  // Count at-risk members (those with avg readiness < 60)
  let atRiskCount = 0;
  let needsAttentionCount = 0;
  for (const member of team.members) {
    const memberCheckins = checkinsByUser.get(member.id);
    if (!memberCheckins) {
      atRiskCount++;
      needsAttentionCount++;
      continue;
    }

    const scores: number[] = [];
    memberCheckins.forEach((checkin, dateStr) => {
      // Only count if within current period
      const checkinDate = new Date(dateStr);
      if (checkinDate >= startDate && checkinDate <= endDate) {
        scores.push(checkin.readinessScore);
      }
    });

    if (scores.length > 0) {
      const memberAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (memberAvg < 60) {
        atRiskCount++;
        needsAttentionCount++;
      } else if (memberAvg < 70) {
        needsAttentionCount++;
      }
    }
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
    attendanceRate: periodCompliance, // This is now AVERAGE daily compliance (same as Team Analytics)
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
// HELPER: Calculate member stats from check-ins
// ===========================================

function calculateMemberStats(
  checkinData: Map<string, { readinessScore: number; readinessStatus: string }> | undefined,
  startDate: Date,
  endDate: Date,
  workDaysString: string,
  timezone: string,
  holidayDates: string[],
  exemptions: { startDate: Date | null; endDate: Date | null }[]
): {
  readinessScores: number[];
  checkinCount: number;
  excusedCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
} {
  const holidaySet = new Set(holidayDates);
  const workDays = workDaysString.split(',').map(d => d.trim().toUpperCase());
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const readinessScores: number[] = [];
  let checkinCount = 0;
  let excusedCount = 0;
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  // Iterate through date range
  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatLocalDate(current, timezone);
    const dayOfWeek = current.getDay();

    // Skip non-work days and holidays
    if (!workDays.includes(dayNames[dayOfWeek]) || holidaySet.has(dateStr)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Check if date is covered by exemption
    const isExempted = exemptions.some(ex => {
      if (!ex.startDate || !ex.endDate) return false;
      return current >= ex.startDate && current <= ex.endDate;
    });

    if (isExempted) {
      excusedCount++;
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Check for check-in
    const checkin = checkinData?.get(dateStr);

    if (checkin) {
      readinessScores.push(checkin.readinessScore);
      checkinCount++;

      if (checkin.readinessStatus === 'GREEN') {
        greenCount++;
      } else if (checkin.readinessStatus === 'YELLOW') {
        yellowCount++;
      } else if (checkin.readinessStatus === 'RED') {
        redCount++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    readinessScores,
    checkinCount,
    excusedCount,
    greenCount,
    yellowCount,
    redCount,
  };
}

// ===========================================
// HELPER: Count exempted days
// ===========================================

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

      if (workDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
        exemptedDatesSet.add(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return exemptedDatesSet.size;
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
