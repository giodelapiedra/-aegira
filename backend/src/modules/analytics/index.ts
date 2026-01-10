import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import { generateTeamAnalyticsSummary } from '../../utils/ai.js';
import { env } from '../../config/env.js';
import { createSystemLog } from '../system-logs/index.js';
import {
  getTodayRange,
  getLastNDaysRange,
  getStartOfDay,
  getEndOfDay,
  getStartOfNextDay,
  isWorkDay,
  countWorkDaysInRange,
  calculateActualStreak,
  formatLocalDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import {
  calculateTeamGrade,
} from '../../utils/team-grades.js';
import { calculateTeamsOverviewOptimized } from '../../utils/team-grades-optimized.js';

const analyticsRoutes = new Hono<AppContext>();

// Helper: Get company timezone
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// GET /analytics/dashboard - Get dashboard analytics (company-scoped, except for ADMIN)
analyticsRoutes.get('/dashboard', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');

  // Get company timezone and today's date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // ADMIN role: Super admin - can see ALL data across ALL companies (developer oversight)
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';

  // Check if today is a company holiday
  const todayDateStr = formatLocalDate(today, timezone);
  const todayHoliday = await prisma.holiday.findFirst({
    where: {
      companyId: isAdmin ? undefined : companyId,
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    select: { name: true },
  });

  // Build all where clauses upfront
  const memberWhere: any = {
    isActive: true,
    role: { in: ['MEMBER', 'WORKER'] },
    teamId: { not: null },
  };
  const checkinWhere: any = {
    createdAt: { gte: today, lt: tomorrow },
    user: { teamId: { not: null }, role: { in: ['MEMBER', 'WORKER'] }, isActive: true },
  };
  const exceptionWhere: any = { status: 'PENDING' };
  const incidentWhere: any = { status: { in: ['OPEN', 'IN_PROGRESS'] } };
  // Members on approved leave today
  const onLeaveWhere: any = {
    status: 'APPROVED',
    startDate: { lte: tomorrow },
    endDate: { gte: today },
    user: { isActive: true, role: { in: ['MEMBER', 'WORKER'] }, teamId: { not: null } },
  };

  // Only filter by companyId for non-admin roles
  if (!isAdmin) {
    memberWhere.companyId = companyId;
    checkinWhere.companyId = companyId;
    exceptionWhere.companyId = companyId;
    incidentWhere.companyId = companyId;
    onLeaveWhere.companyId = companyId;
  }

  // Execute all queries in parallel using $transaction (single round-trip to DB)
  const [totalMembers, todayCheckins, pendingExceptions, openIncidents, onLeaveCount] = await prisma.$transaction([
    prisma.user.count({ where: memberWhere }),
    prisma.checkin.findMany({ where: checkinWhere, select: { readinessStatus: true } }),
    prisma.exception.count({ where: exceptionWhere }),
    prisma.incident.count({ where: incidentWhere }),
    prisma.exception.count({ where: onLeaveWhere }),
  ]);

  // Count by status
  const greenCount = todayCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
  const yellowCount = todayCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
  const redCount = todayCheckins.filter((c) => c.readinessStatus === 'RED').length;

  // Calculate check-in rate
  // If today is a holiday, check-in rate is N/A (return 100% or special indicator)
  let checkinRate: number;
  if (todayHoliday) {
    // Holiday - everyone is effectively "exempted", show 100% or 0 expected
    checkinRate = 100;
  } else {
    // Normal day - exclude members on leave from expected count
    const expectedToCheckin = Math.max(0, totalMembers - onLeaveCount);
    checkinRate = expectedToCheckin > 0
      ? Math.round((todayCheckins.length / expectedToCheckin) * 100)
      : 0;
  }

  return c.json({
    totalMembers,
    greenCount,
    yellowCount,
    redCount,
    onLeaveCount,
    pendingExceptions,
    openIncidents,
    checkinRate,
    isHoliday: !!todayHoliday,
    holidayName: todayHoliday?.name || null,
  });
});

// GET /analytics/recent-checkins - Get recent check-ins (company-scoped, except for ADMIN)
analyticsRoutes.get('/recent-checkins', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '10');

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = {
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  const checkins = await prisma.checkin.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return c.json(checkins);
});

// GET /analytics/readiness - Get readiness analytics (company-scoped, except for ADMIN)
analyticsRoutes.get('/readiness', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const days = parseInt(c.req.query('days') || '7');

  // Get company timezone and date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: startDate } = getLastNDaysRange(days, timezone);

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = {
    createdAt: { gte: startDate },
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  const checkins = await prisma.checkin.findMany({
    where,
    select: {
      readinessStatus: true,
      readinessScore: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date (timezone-aware)
  const dailyStats: Record<string, { green: number; yellow: number; red: number; total: number }> = {};

  checkins.forEach((checkin) => {
    const dateKey = formatLocalDate(new Date(checkin.createdAt), timezone);
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { green: 0, yellow: 0, red: 0, total: 0 };
    }
    dailyStats[dateKey].total++;
    if (checkin.readinessStatus === 'GREEN') dailyStats[dateKey].green++;
    if (checkin.readinessStatus === 'YELLOW') dailyStats[dateKey].yellow++;
    if (checkin.readinessStatus === 'RED') dailyStats[dateKey].red++;
  });

  return c.json({
    period: { days, startDate },
    dailyStats,
  });
});

// GET /analytics/team/:teamId - Get team analytics
analyticsRoutes.get('/team/:teamId', async (c) => {
  const teamId = c.req.param('teamId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    include: {
      members: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view their own team's analytics
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view analytics for your own team' }, 403);
  }

  const memberIds = team.members.map((m) => m.id);

  // Get company timezone and today's date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Get today's check-ins for team
  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: today, lte: tomorrow },
    },
  });

  const greenCount = todayCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
  const yellowCount = todayCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
  const redCount = todayCheckins.filter((c) => c.readinessStatus === 'RED').length;

  return c.json({
    teamId,
    totalMembers: memberIds.length,
    checkedIn: todayCheckins.length,
    greenCount,
    yellowCount,
    redCount,
    checkinRate: memberIds.length > 0
      ? Math.round((todayCheckins.length / memberIds.length) * 100)
      : 0,
  });
});

// GET /analytics/trends - Get trend analytics (company-scoped, except for ADMIN)
analyticsRoutes.get('/trends', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const days = parseInt(c.req.query('days') || '30');

  // Get company timezone and date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: startDate } = getLastNDaysRange(days, timezone);

  // ADMIN: see all trends across all companies, but only from members with teams
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const checkinWhere: any = {
    createdAt: { gte: startDate },
    user: { teamId: { not: null }, role: { in: ['MEMBER', 'WORKER'] }, isActive: true },
  };
  const incidentWhere: any = { createdAt: { gte: startDate } };

  if (!isAdmin) {
    checkinWhere.companyId = companyId;
    incidentWhere.companyId = companyId;
  }

  // Execute both groupBy queries in parallel using Promise.all (groupBy doesn't work well in $transaction)
  const [checkins, incidents] = await Promise.all([
    prisma.checkin.groupBy({
      by: ['readinessStatus'],
      where: checkinWhere,
      _count: true,
    }),
    prisma.incident.groupBy({
      by: ['severity'],
      where: incidentWhere,
      _count: true,
    }),
  ]);

  return c.json({
    period: { days, startDate },
    checkinsByStatus: checkins,
    incidentsBySeverity: incidents,
  });
});

// GET /analytics/export - Export analytics data (company-scoped, except for ADMIN)
// IMPORTANT: Has pagination to prevent memory issues with large datasets
analyticsRoutes.get('/export', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '1000'), 5000); // Max 5000 per request

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = {
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };

  if (!isAdmin) {
    where.companyId = companyId;
  }

  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  // Use Promise.all for parallel count and data fetch
  const [checkins, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.checkin.count({ where }),
  ]);

  return c.json({
    data: checkins,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /analytics/team/:teamId/ai-summary - Generate AI summary for a specific team
analyticsRoutes.post('/team/:teamId/ai-summary', async (c) => {
  // Check if OpenAI API key is configured
  if (!env.OPENAI_API_KEY) {
    return c.json({ error: 'AI features are not configured' }, 503);
  }

  const teamId = c.req.param('teamId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');
  const body = await c.req.json();
  const { startDate: startDateParam, endDate: endDateParam } = body;

  // Get company timezone (centralized)
  const timezone = await getCompanyTimezone(companyId);

  // Parse dates (timezone-aware)
  const { start: defaultStart, end: defaultEnd } = getLastNDaysRange(30, timezone);
  const startDate = startDateParam
    ? getStartOfDay(new Date(startDateParam), timezone)
    : defaultStart;
  const endDate = endDateParam
    ? getEndOfDay(new Date(endDateParam), timezone)
    : defaultEnd;

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    include: {
      members: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentStreak: true,
          longestStreak: true,
          lastCheckinDate: true,
          teamJoinedAt: true,
          createdAt: true,
        }
      },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only generate AI summary for their own team
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only generate AI summaries for your own team' }, 403);
  }

  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';
  const memberIds = team.members.map(m => m.id);

  // Get today's date range (timezone-aware)
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Fetch holidays for the period to exclude from work days count
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { date: true },
  });
  const holidayDates = holidays.map(h => formatLocalDate(h.date, timezone));
  const holidaySet = new Set(holidayDates);

  // Fetch exemptions for all team members for the period
  const memberExemptions = await prisma.exception.findMany({
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

  // Build exemption map: userId -> array of exemptions
  const exemptionsByUser = new Map<string, typeof memberExemptions>();
  for (const exemption of memberExemptions) {
    const userExemptions = exemptionsByUser.get(exemption.userId) || [];
    userExemptions.push(exemption);
    exemptionsByUser.set(exemption.userId, userExemptions);
  }

  // Helper: Check if a date is exempted for a user
  const isDateExemptedForUser = (userId: string, dateStr: string): boolean => {
    const userExemptions = exemptionsByUser.get(userId) || [];
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStartStr = formatLocalDate(exemption.startDate, timezone);
      const exEndStr = formatLocalDate(exemption.endDate, timezone);
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return true;
      }
    }
    return false;
  };

  // Get ALL check-ins for the period
  const allCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      readinessStatus: true,
      readinessScore: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group check-ins by userId
  const checkinsByUser = new Map<string, typeof allCheckins>();
  for (const checkin of allCheckins) {
    const userCheckins = checkinsByUser.get(checkin.userId) || [];
    userCheckins.push(checkin);
    checkinsByUser.set(checkin.userId, userCheckins);
  }

  // Process each member
  const memberAnalytics = team.members.map((member) => {
    // Use teamJoinedAt (when user was assigned to team) with fallback to createdAt
    // Check-in requirement starts the DAY AFTER joining (not same day)
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    // Effective start is NEXT DAY after joining
    const memberEffectiveStart = getStartOfNextDay(joinDate, timezone);
    const effectiveStartDate = memberEffectiveStart > startDate ? memberEffectiveStart : startDate;

    // Count exemption days for this member in the period
    // FIX: Use Set to avoid double-counting overlapping exemptions
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > effectiveStartDate ? exemption.startDate : effectiveStartDate;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      // Iterate through each day in the exemption range and add to set
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = formatLocalDate(current, timezone);
        // Only add if it's a work day and not a holiday (avoid double-exclusion)
        const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ...
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }
    const exemptionDaysCount = exemptedDatesSet.size;

    // Expected work days = work days minus holidays minus exemption days
    const workDaysBeforeExemptions = countWorkDaysInRange(effectiveStartDate, endDate, teamWorkDays, timezone, holidayDates);
    const expectedWorkDays = Math.max(0, workDaysBeforeExemptions - exemptionDaysCount);

    const checkins = checkinsByUser.get(member.id) || [];

    // Filter check-ins to only include those on VALID work days (not holidays, not exempted)
    const validCheckins = checkins.filter(c => {
      const checkinDateStr = formatLocalDate(c.createdAt, timezone);
      // Exclude if on a holiday
      if (holidaySet.has(checkinDateStr)) return false;
      // Exclude if on an exempted day for this user
      if (isDateExemptedForUser(member.id, checkinDateStr)) return false;
      return true;
    });

    // Find today's check-in
    const todayCheckin = checkins.find(c => {
      const checkinDate = new Date(c.createdAt);
      return checkinDate >= today && checkinDate < tomorrow;
    });

    // Calculate stats from VALID check-ins only
    const greenCount = validCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
    const yellowCount = validCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
    const redCount = validCheckins.filter((c) => c.readinessStatus === 'RED').length;

    // avgScore from valid check-ins only (excludes holidays & exemptions)
    const avgScore = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / validCheckins.length)
      : 0;

    const avgMood = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.mood, 0) / validCheckins.length * 10) / 10
      : 0;

    const avgStress = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.stress, 0) / validCheckins.length * 10) / 10
      : 0;

    const avgSleep = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.sleep, 0) / validCheckins.length * 10) / 10
      : 0;

    // Calculate check-in rate based on expected work days (after exemptions)
    const checkinRate = expectedWorkDays > 0
      ? Math.min(100, Math.round((validCheckins.length / expectedWorkDays) * 100))
      : 0;

    const missedWorkDays = Math.max(0, expectedWorkDays - validCheckins.length);

    // Determine risk level
    // HIGH: 4+ missed work days (almost 1 full week), or 3+ RED, or 40%+ RED
    // MEDIUM: 2-3 missed work days, or 3+ YELLOW, or 2+ RED
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (redCount >= 3 || (checkins.length > 0 && redCount / checkins.length > 0.4)) {
      riskLevel = 'high';
    } else if (yellowCount >= 3 || redCount >= 2) {
      riskLevel = 'medium';
    }
    if (missedWorkDays >= 4) {
      riskLevel = 'high';
    } else if (missedWorkDays >= 2 && riskLevel === 'low') {
      riskLevel = 'medium';
    }

    // Calculate the actual streak based on team schedule
    const actualStreak = calculateActualStreak(
      member.currentStreak,
      member.lastCheckinDate,
      teamWorkDays
    );

    return {
      name: `${member.firstName} ${member.lastName}`,
      currentStreak: actualStreak,
      longestStreak: member.longestStreak,
      lastCheckinDate: member.lastCheckinDate,
      todayCheckedIn: !!todayCheckin,
      todayStatus: todayCheckin?.readinessStatus || null,
      todayScore: todayCheckin?.readinessScore || null,
      checkinCount: validCheckins.length,
      expectedWorkDays,
      missedWorkDays,
      checkinRate,
      greenCount,
      yellowCount,
      redCount,
      avgScore,
      avgMood,
      avgStress,
      avgSleep,
      riskLevel,
    };
  });

  // Sort by risk and score
  memberAnalytics.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return a.avgScore - b.avgScore;
  });

  // Get incidents and exceptions for the period
  const [openIncidents, pendingExceptions] = await prisma.$transaction([
    prisma.incident.count({
      where: {
        reportedBy: { in: memberIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),
    prisma.exception.count({
      where: {
        userId: { in: memberIds },
        status: 'PENDING',
      },
    }),
  ]);

  // ============================================
  // PERIOD COMPARISON: Calculate previous period metrics (timezone-aware)
  // ============================================
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevEndDateTime = new Date(startDate);
  prevEndDateTime.setDate(prevEndDateTime.getDate() - 1);
  const prevEndDate = getEndOfDay(prevEndDateTime, timezone);
  const prevStartDateTime = new Date(prevEndDate);
  prevStartDateTime.setDate(prevStartDateTime.getDate() - periodDays + 1);
  const prevStartDate = getStartOfDay(prevStartDateTime, timezone);

  // Get previous period check-ins and exemptions (for fair comparison)
  const [prevCheckins, prevExemptions] = await Promise.all([
    prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
      select: {
        userId: true,
        readinessStatus: true,
        readinessScore: true,
        createdAt: true,
      },
    }),
    prisma.exception.findMany({
      where: {
        userId: { in: memberIds },
        status: 'APPROVED',
        startDate: { lte: prevEndDate },
        endDate: { gte: prevStartDate },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  // Group previous exemptions by user for quick lookup
  const prevExemptionsByUser = new Map<string, typeof prevExemptions>();
  for (const ex of prevExemptions) {
    const userExemptions = prevExemptionsByUser.get(ex.userId) || [];
    userExemptions.push(ex);
    prevExemptionsByUser.set(ex.userId, userExemptions);
  }

  // Calculate current period aggregate metrics
  // Team avgScore = average of member averages (Option A - fair representation per member)
  // Only include members who have at least 1 valid check-in (exclude members with 0 required days)
  const membersWithCheckins = memberAnalytics.filter(m => m.checkinCount > 0);
  const currentAvgScore = membersWithCheckins.length > 0
    ? Math.round(membersWithCheckins.reduce((sum, m) => sum + m.avgScore, 0) / membersWithCheckins.length)
    : 0;
  const currentTotalCheckins = memberAnalytics.reduce((sum, m) => sum + m.checkinCount, 0);
  const currentGreenCount = memberAnalytics.reduce((sum, m) => sum + m.greenCount, 0);
  const currentYellowCount = memberAnalytics.reduce((sum, m) => sum + m.yellowCount, 0);
  const currentRedCount = memberAnalytics.reduce((sum, m) => sum + m.redCount, 0);
  const currentAtRiskCount = memberAnalytics.filter(m => m.riskLevel === 'high').length;
  const currentWorkDays = countWorkDaysInRange(startDate, endDate, teamWorkDays, timezone, holidayDates);
  // Total expected work days across all members (accounting for individual exemptions)
  const totalExpectedWorkDays = memberAnalytics.reduce((sum, m) => sum + m.expectedWorkDays, 0);
  const currentCheckinRate = totalExpectedWorkDays > 0
    ? Math.round((currentTotalCheckins / totalExpectedWorkDays) * 100)
    : 0;

  // Fetch holidays for previous period
  const prevHolidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: prevStartDate,
        lte: prevEndDate,
      },
    },
    select: { date: true },
  });
  const prevHolidayDates = prevHolidays.map(h => formatLocalDate(h.date, timezone));

  // Calculate previous period aggregate metrics
  // First, group previous check-ins by user and calculate per-member averages
  const prevCheckinsByUser = new Map<string, typeof prevCheckins>();
  for (const checkin of prevCheckins) {
    const userCheckins = prevCheckinsByUser.get(checkin.userId) || [];
    userCheckins.push(checkin);
    prevCheckinsByUser.set(checkin.userId, userCheckins);
  }

  // Calculate previous period member averages and team average (same logic as current period)
  const prevMemberAvgScores: number[] = [];
  let prevAtRiskCount = 0;
  let prevTotalCheckins = 0;
  let prevGreenCount = 0;
  let prevYellowCount = 0;
  let prevRedCount = 0;

  for (const userId of memberIds) {
    const userCheckins = prevCheckinsByUser.get(userId) || [];
    if (userCheckins.length > 0) {
      // Calculate member's average for previous period
      const memberAvg = Math.round(userCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / userCheckins.length);
      prevMemberAvgScores.push(memberAvg);

      prevTotalCheckins += userCheckins.length;
      prevGreenCount += userCheckins.filter(c => c.readinessStatus === 'GREEN').length;
      prevYellowCount += userCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
      const userRedCount = userCheckins.filter(c => c.readinessStatus === 'RED').length;
      prevRedCount += userRedCount;

      // Check if at risk
      if (userRedCount >= 3 || (userCheckins.length > 0 && userRedCount / userCheckins.length > 0.4)) {
        prevAtRiskCount++;
      }
    }
  }

  // Previous period team avgScore = average of member averages
  const prevAvgScore = prevMemberAvgScores.length > 0
    ? Math.round(prevMemberAvgScores.reduce((sum, s) => sum + s, 0) / prevMemberAvgScores.length)
    : 0;

  // Calculate previous period expected work days per member (matching current period methodology)
  const prevWorkDays = countWorkDaysInRange(prevStartDate, prevEndDate, teamWorkDays, timezone, prevHolidayDates);
  let prevTotalExpectedWorkDays = 0;
  for (const member of team.members) {
    // Calculate per-member expected work days, accounting for exemptions
    // Check-in requirement starts the DAY AFTER joining (not same day)
    const memberJoinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const memberEffectiveStart = getStartOfNextDay(memberJoinDate, timezone);
    const effectivePrevStart = memberEffectiveStart > prevStartDate ? memberEffectiveStart : prevStartDate;

    // Count exemption days for this member in the previous period
    // FIX: Use Set to avoid double-counting overlapping exemptions
    const userPrevExemptions = prevExemptionsByUser.get(member.id) || [];
    const prevExemptedDatesSet = new Set<string>();
    const prevHolidaySet = new Set(prevHolidayDates);
    for (const exemption of userPrevExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > effectivePrevStart ? exemption.startDate : effectivePrevStart;
      const exEnd = exemption.endDate < prevEndDate ? exemption.endDate : prevEndDate;
      // Iterate through each day in the exemption range and add to set
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = formatLocalDate(current, timezone);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !prevHolidaySet.has(dateStr)) {
          prevExemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }
    const prevExemptionDaysCount = prevExemptedDatesSet.size;

    const memberPrevWorkDays = countWorkDaysInRange(effectivePrevStart, prevEndDate, teamWorkDays, timezone, prevHolidayDates);
    prevTotalExpectedWorkDays += Math.max(0, memberPrevWorkDays - prevExemptionDaysCount);
  }

  const prevCheckinRate = prevTotalExpectedWorkDays > 0
    ? Math.round((prevTotalCheckins / prevTotalExpectedWorkDays) * 100)
    : 0;

  // Build comparison object
  const periodComparison = {
    current: {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      checkinRate: currentCheckinRate,
      avgScore: currentAvgScore,
      atRiskCount: currentAtRiskCount,
      totalCheckins: currentTotalCheckins,
      greenCount: currentGreenCount,
      yellowCount: currentYellowCount,
      redCount: currentRedCount,
    },
    previous: {
      periodStart: prevStartDate.toISOString(),
      periodEnd: prevEndDate.toISOString(),
      checkinRate: prevCheckinRate,
      avgScore: prevAvgScore,
      atRiskCount: prevAtRiskCount,
      totalCheckins: prevTotalCheckins,
      greenCount: prevGreenCount,
      yellowCount: prevYellowCount,
      redCount: prevRedCount,
    },
    changes: {
      checkinRate: currentCheckinRate - prevCheckinRate,
      avgScore: currentAvgScore - prevAvgScore,
      atRiskCount: currentAtRiskCount - prevAtRiskCount,
      totalCheckins: currentTotalCheckins - prevTotalCheckins,
    },
  };

  try {
    const user = c.get('user');
    const summary = await generateTeamAnalyticsSummary({
      teamName: team.name,
      totalMembers: team.members.length,
      periodDays,
      memberAnalytics,
      openIncidents,
      pendingExceptions,
    });

    // Map frontend status to database enum
    const statusMap: Record<string, 'HEALTHY' | 'ATTENTION' | 'CRITICAL'> = {
      healthy: 'HEALTHY',
      attention: 'ATTENTION',
      critical: 'CRITICAL',
    };

    // Save to database
    const savedSummary = await prisma.aISummary.create({
      data: {
        companyId,
        teamId,
        generatedById: user.id,
        summary: summary.summary,
        highlights: summary.highlights,
        concerns: summary.concerns,
        recommendations: summary.recommendations,
        overallStatus: statusMap[summary.overallStatus] || 'HEALTHY',
        periodStart: startDate,
        periodEnd: endDate,
        aggregateData: {
          totalMembers: team.members.length,
          openIncidents,
          pendingExceptions,
          memberAnalytics,
          periodComparison,
        },
      },
    });

    // Log AI summary generation to system logs
    await createSystemLog({
      companyId,
      userId: user.id,
      action: 'AI_SUMMARY_GENERATED',
      entityType: 'ai_summary',
      entityId: savedSummary.id,
      description: `AI Insights report generated for team "${team.name}" (${formatLocalDate(startDate)} to ${formatLocalDate(endDate)}) - Status: ${summary.overallStatus.toUpperCase()}`,
      metadata: {
        teamId,
        teamName: team.name,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        periodDays,
        overallStatus: summary.overallStatus,
        totalMembers: team.members.length,
        highlightsCount: summary.highlights.length,
        concernsCount: summary.concerns.length,
        recommendationsCount: summary.recommendations.length,
      },
    });

    return c.json({
      ...summary,
      id: savedSummary.id,
      createdAt: savedSummary.createdAt,
    });
  } catch (error) {
    console.error('Team AI Summary generation failed:', error);
    return c.json({ error: 'Failed to generate AI summary' }, 500);
  }
});

// GET /analytics/team/:teamId/ai-summary - Get saved AI summary for a team
analyticsRoutes.get('/team/:teamId/ai-summary', async (c) => {
  const teamId = c.req.param('teamId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view AI summaries for their own team
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view AI summaries for your own team' }, 403);
  }

  // Get the latest AI summary for this team generated by this user
  const savedSummary = await prisma.aISummary.findFirst({
    where: {
      teamId,
      companyId,
      generatedById: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!savedSummary) {
    return c.json({ exists: false });
  }

  // Map database enum to frontend status
  const statusMap: Record<string, 'healthy' | 'attention' | 'critical'> = {
    HEALTHY: 'healthy',
    ATTENTION: 'attention',
    CRITICAL: 'critical',
  };

  return c.json({
    exists: true,
    id: savedSummary.id,
    summary: savedSummary.summary,
    highlights: savedSummary.highlights,
    concerns: savedSummary.concerns,
    recommendations: savedSummary.recommendations,
    overallStatus: statusMap[savedSummary.overallStatus] || 'healthy',
    periodStart: savedSummary.periodStart,
    periodEnd: savedSummary.periodEnd,
    createdAt: savedSummary.createdAt,
  });
});

// GET /analytics/team/:teamId/ai-summary/history - Get all AI summaries for a team (history)
// Privacy: Only returns summaries generated by the requesting user
analyticsRoutes.get('/team/:teamId/ai-summary/history', async (c) => {
  const teamId = c.req.param('teamId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true, name: true, leaderId: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view AI summary history for their own team
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view AI summaries for your own team' }, 403);
  }

  // Get AI summaries for this team, filtered by user who generated them (privacy)
  // Each user only sees their own generated summaries
  const summaries = await prisma.aISummary.findMany({
    where: {
      teamId,
      companyId,
      generatedById: user.id, // Privacy filter: only show user's own summaries
    },
    include: {
      generatedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Map database enum to frontend status
  const statusMap: Record<string, 'healthy' | 'attention' | 'critical'> = {
    HEALTHY: 'healthy',
    ATTENTION: 'attention',
    CRITICAL: 'critical',
  };

  return c.json({
    teamId,
    teamName: team.name,
    summaries: summaries.map((s) => ({
      id: s.id,
      summary: s.summary,
      highlights: s.highlights,
      concerns: s.concerns,
      recommendations: s.recommendations,
      overallStatus: statusMap[s.overallStatus] || 'healthy',
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      createdAt: s.createdAt,
      generatedBy: s.generatedBy
        ? `${s.generatedBy.firstName} ${s.generatedBy.lastName}`
        : 'Unknown',
    })),
  });
});

// GET /analytics/team/:teamId/ai-summary/:summaryId - Get a specific AI summary by ID
// Privacy: Only allows access to summaries generated by the requesting user
analyticsRoutes.get('/team/:teamId/ai-summary/:summaryId', async (c) => {
  const teamId = c.req.param('teamId');
  const summaryId = c.req.param('summaryId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true, name: true, leaderId: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view AI summaries for their own team
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view AI summaries for your own team' }, 403);
  }

  // Get the specific AI summary - must be generated by requesting user (privacy)
  const summary = await prisma.aISummary.findFirst({
    where: {
      id: summaryId,
      teamId,
      companyId,
      generatedById: user.id, // Privacy filter: only access own summaries
    },
    include: {
      generatedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!summary) {
    return c.json({ error: 'Summary not found' }, 404);
  }

  // Map database enum to frontend status
  const statusMap: Record<string, 'healthy' | 'attention' | 'critical'> = {
    HEALTHY: 'healthy',
    ATTENTION: 'attention',
    CRITICAL: 'critical',
  };

  return c.json({
    id: summary.id,
    teamName: team.name,
    summary: summary.summary,
    highlights: summary.highlights,
    concerns: summary.concerns,
    recommendations: summary.recommendations,
    overallStatus: statusMap[summary.overallStatus] || 'healthy',
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    createdAt: summary.createdAt,
    generatedBy: summary.generatedBy
      ? `${summary.generatedBy.firstName} ${summary.generatedBy.lastName}`
      : 'Unknown',
    aggregateData: summary.aggregateData,
  });
});

// ===========================================
// TEAMS OVERVIEW (Executive & Supervisor only)
// ===========================================

/**
 * GET /analytics/teams-overview
 *
 * Returns all teams with their performance grades for Executive and Supervisor dashboards.
 * Uses the same calculation logic as individual team analytics for consistency.
 *
 * ACCESS: EXECUTIVE, SUPERVISOR only
 *
 * Query Parameters:
 * - days: number (default: 30) - Period in days (7, 14, 30)
 * - sort: string (default: 'grade') - Sort by: 'grade', 'name', 'score', 'members'
 * - order: string (default: 'asc') - Sort order: 'asc', 'desc'
 *
 * Response:
 * {
 *   teams: TeamGradeSummary[],
 *   summary: TeamsOverviewSummary,
 *   period: { days, startDate, endDate }
 * }
 */
analyticsRoutes.get('/teams-overview', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');

  // Access control: Only EXECUTIVE and SUPERVISOR can access
  const userRole = user.role?.toUpperCase();
  const allowedRoles = ['EXECUTIVE', 'SUPERVISOR', 'ADMIN'];

  if (!allowedRoles.includes(userRole)) {
    return c.json({
      error: 'Access denied. Only Executive and Supervisor roles can access teams overview.',
    }, 403);
  }

  // Parse query parameters
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '30', 10), 7), 90);
  const sortBy = c.req.query('sort') || 'grade';
  const sortOrder = c.req.query('order') || 'asc';

  try {
    // Get company timezone
    const timezone = await getCompanyTimezone(companyId);

    // Calculate teams overview using OPTIMIZED utility (batched queries)
    const result = await calculateTeamsOverviewOptimized({
      companyId,
      days,
      timezone,
    });

    // Apply custom sorting if requested
    if (sortBy !== 'grade') {
      const sortedTeams = [...result.teams];

      sortedTeams.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'score':
            comparison = a.score - b.score;
            break;
          case 'members':
            comparison = a.memberCount - b.memberCount;
            break;
          case 'attendance':
            comparison = a.attendanceRate - b.attendanceRate;
            break;
          default:
            // Default: grade (worst first)
            const gradeOrder: Record<string, number> = { D: 0, C: 1, B: 2, A: 3 };
            comparison = gradeOrder[a.grade] - gradeOrder[b.grade];
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

      result.teams = sortedTeams;
    }

    return c.json(result);
  } catch (error) {
    console.error('Teams overview error:', error);
    return c.json({ error: 'Failed to fetch teams overview' }, 500);
  }
});

/**
 * GET /analytics/teams-overview/:teamId
 *
 * Returns detailed grade information for a single team.
 * Used when drilling down from the overview to a specific team.
 *
 * ACCESS: EXECUTIVE, SUPERVISOR only
 *
 * Path Parameters:
 * - teamId: string - Team UUID
 *
 * Query Parameters:
 * - days: number (default: 30) - Period in days
 */
analyticsRoutes.get('/teams-overview/:teamId', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const teamId = c.req.param('teamId');

  // Access control: Only EXECUTIVE and SUPERVISOR can access
  const userRole = user.role?.toUpperCase();
  const allowedRoles = ['EXECUTIVE', 'SUPERVISOR', 'ADMIN'];

  if (!allowedRoles.includes(userRole)) {
    return c.json({
      error: 'Access denied. Only Executive and Supervisor roles can access team grades.',
    }, 403);
  }

  // Validate team exists and belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Parse query parameters
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '30', 10), 7), 90);

  try {
    // Get company timezone
    const timezone = await getCompanyTimezone(companyId);

    // Calculate single team grade using reusable utility
    const teamGrade = await calculateTeamGrade(teamId, {
      companyId,
      days,
      timezone,
    });

    if (!teamGrade) {
      return c.json({ error: 'Failed to calculate team grade' }, 500);
    }

    return c.json(teamGrade);
  } catch (error) {
    console.error('Team grade error:', error);
    return c.json({ error: 'Failed to fetch team grade' }, 500);
  }
});

export { analyticsRoutes };
