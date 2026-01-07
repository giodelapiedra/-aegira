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
  isWorkDay,
  countWorkDaysInRange,
  calculateActualStreak,
  formatLocalDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';

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

  // Calculate check-in rate (exclude members on leave from expected count)
  const expectedToCheckin = Math.max(0, totalMembers - onLeaveCount);
  const checkinRate = expectedToCheckin > 0
    ? Math.round((todayCheckins.length / expectedToCheckin) * 100)
    : 0;

  return c.json({
    totalMembers,
    greenCount,
    yellowCount,
    redCount,
    onLeaveCount,
    pendingExceptions,
    openIncidents,
    checkinRate,
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

  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';
  const memberIds = team.members.map(m => m.id);

  // Get today's date range (timezone-aware)
  const { start: today, end: tomorrow } = getTodayRange(timezone);

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
    // This ensures we don't count days before the user was in this team
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const memberJoinDate = getStartOfDay(joinDate, timezone);
    const effectiveStartDate = memberJoinDate > startDate ? memberJoinDate : startDate;
    const expectedWorkDays = countWorkDaysInRange(effectiveStartDate, endDate, teamWorkDays, timezone);

    const checkins = checkinsByUser.get(member.id) || [];

    // Find today's check-in
    const todayCheckin = checkins.find(c => {
      const checkinDate = new Date(c.createdAt);
      return checkinDate >= today && checkinDate < tomorrow;
    });

    // Calculate stats
    const greenCount = checkins.filter((c) => c.readinessStatus === 'GREEN').length;
    const yellowCount = checkins.filter((c) => c.readinessStatus === 'YELLOW').length;
    const redCount = checkins.filter((c) => c.readinessStatus === 'RED').length;

    const avgScore = checkins.length > 0
      ? Math.round(checkins.reduce((sum, c) => sum + c.readinessScore, 0) / checkins.length)
      : 0;

    const avgMood = checkins.length > 0
      ? Math.round(checkins.reduce((sum, c) => sum + c.mood, 0) / checkins.length * 10) / 10
      : 0;

    const avgStress = checkins.length > 0
      ? Math.round(checkins.reduce((sum, c) => sum + c.stress, 0) / checkins.length * 10) / 10
      : 0;

    const avgSleep = checkins.length > 0
      ? Math.round(checkins.reduce((sum, c) => sum + c.sleep, 0) / checkins.length * 10) / 10
      : 0;

    // Calculate check-in rate, cap at 100% (can't exceed 100% even with multiple check-ins per day)
    const checkinRate = expectedWorkDays > 0
      ? Math.min(100, Math.round((checkins.length / expectedWorkDays) * 100))
      : 0;

    const missedWorkDays = Math.max(0, expectedWorkDays - checkins.length);

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
      checkinCount: checkins.length,
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

  // Get previous period check-ins
  const prevCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: prevStartDate, lte: prevEndDate },
    },
    select: {
      userId: true,
      readinessStatus: true,
      readinessScore: true,
    },
  });

  // Calculate current period aggregate metrics
  const currentTotalCheckins = allCheckins.length;
  const currentAvgScore = currentTotalCheckins > 0
    ? Math.round(allCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / currentTotalCheckins)
    : 0;
  const currentGreenCount = allCheckins.filter(c => c.readinessStatus === 'GREEN').length;
  const currentYellowCount = allCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
  const currentRedCount = allCheckins.filter(c => c.readinessStatus === 'RED').length;
  const currentAtRiskCount = memberAnalytics.filter(m => m.riskLevel === 'high').length;
  const currentWorkDays = countWorkDaysInRange(startDate, endDate, teamWorkDays);
  const currentCheckinRate = currentWorkDays > 0 && memberIds.length > 0
    ? Math.round((currentTotalCheckins / (currentWorkDays * memberIds.length)) * 100)
    : 0;

  // Calculate previous period aggregate metrics
  const prevTotalCheckins = prevCheckins.length;
  const prevAvgScore = prevTotalCheckins > 0
    ? Math.round(prevCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / prevTotalCheckins)
    : 0;
  const prevGreenCount = prevCheckins.filter(c => c.readinessStatus === 'GREEN').length;
  const prevYellowCount = prevCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
  const prevRedCount = prevCheckins.filter(c => c.readinessStatus === 'RED').length;
  const prevWorkDays = countWorkDaysInRange(prevStartDate, prevEndDate, teamWorkDays);
  const prevCheckinRate = prevWorkDays > 0 && memberIds.length > 0
    ? Math.round((prevTotalCheckins / (prevWorkDays * memberIds.length)) * 100)
    : 0;

  // Calculate previous period at-risk count (simplified - based on red ratio)
  const prevCheckinsByUser = new Map<string, typeof prevCheckins>();
  for (const checkin of prevCheckins) {
    const userCheckins = prevCheckinsByUser.get(checkin.userId) || [];
    userCheckins.push(checkin);
    prevCheckinsByUser.set(checkin.userId, userCheckins);
  }
  let prevAtRiskCount = 0;
  for (const userId of memberIds) {
    const userCheckins = prevCheckinsByUser.get(userId) || [];
    const userRedCount = userCheckins.filter(c => c.readinessStatus === 'RED').length;
    if (userRedCount >= 3 || (userCheckins.length > 0 && userRedCount / userCheckins.length > 0.4)) {
      prevAtRiskCount++;
    }
  }

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

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
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

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true, name: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
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

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true, name: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
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

export { analyticsRoutes };
