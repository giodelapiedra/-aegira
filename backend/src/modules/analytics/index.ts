import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import { generateTeamAnalyticsSummary, generateExpertDataInterpretation } from '../../utils/ai.js';
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
  getTodayForDbDate,
  toDbDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import {
  calculateTeamsOverviewOptimized,
  calculateSingleTeamGradeOptimized,
} from '../../utils/team-grades-optimized.js';
import {
  getCompanySummariesForDate,
  getTeamSummaryForDate,
} from '../../utils/daily-summary.js';

const analyticsRoutes = new Hono<AppContext>();

// REMOVED: getCompanyTimezone helper - now use c.get('timezone') from context
// Timezone is fetched once in auth middleware and available everywhere

// GET /analytics/dashboard - Get dashboard analytics (company-scoped, except for ADMIN)
// OPTIMIZED: Uses pre-computed DailyTeamSummary for fast queries
analyticsRoutes.get('/dashboard', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const userId = c.get('userId');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');
  const todayDate = getTodayForDbDate(timezone);

  // ADMIN role: Super admin - can see ALL data across ALL companies (developer oversight)
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isTeamLead = userRole === 'TEAM_LEAD';

  // TEAM_LEAD: Only see their own team's data
  let teamIdFilter: string | undefined;
  if (isTeamLead) {
    // Get team where user is the leader
    const team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });
    if (!team) {
      return c.json({ error: 'You are not assigned to lead any team' }, 403);
    }
    teamIdFilter = team.id;
  }

  // Build where clause
  const where: any = { date: todayDate };
  if (isAdmin) {
    // Admin sees all companies
  } else if (isTeamLead && teamIdFilter) {
    // Team lead sees only their team
    where.teamId = teamIdFilter;
    where.companyId = companyId;
  } else {
    // Other roles see all teams in their company
    where.companyId = companyId;
  }

  // Get today's summaries from DailyTeamSummary (pre-computed data)
  const summaries = await prisma.dailyTeamSummary.findMany({ where });

  // Aggregate from summaries
  let totalMembers = 0;
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;
  let onLeaveCount = 0;
  let totalExpected = 0;
  let totalCheckedIn = 0;
  let isHoliday = false;

  for (const summary of summaries) {
    totalMembers += summary.totalMembers;
    greenCount += summary.greenCount;
    yellowCount += summary.yellowCount;
    redCount += summary.redCount;
    onLeaveCount += summary.onLeaveCount;
    totalExpected += summary.expectedToCheckIn;
    totalCheckedIn += summary.checkedInCount;
    if (summary.isHoliday) isHoliday = true;
  }

  // Get pending exceptions and open incidents (these aren't in summary)
  // TEAM_LEAD: Only see exceptions/incidents from their team members
  let teamMemberIds: string[] | undefined;
  if (isTeamLead && teamIdFilter) {
    teamMemberIds = (await prisma.user.findMany({
      where: { teamId: teamIdFilter, isActive: true },
      select: { id: true },
    })).map(u => u.id);
  }

  const exceptionWhere: any = { status: 'PENDING' };
  const incidentWhere: any = { status: { in: ['OPEN', 'IN_PROGRESS'] } };
  
  if (isAdmin) {
    // Admin sees all
  } else if (isTeamLead && teamMemberIds) {
    // Team lead sees only their team's exceptions/incidents
    exceptionWhere.userId = { in: teamMemberIds };
    incidentWhere.reportedBy = { in: teamMemberIds };
  } else {
    exceptionWhere.companyId = companyId;
    incidentWhere.companyId = companyId;
  }

  const [pendingExceptions, openIncidents, holidayRecord] = await Promise.all([
    prisma.exception.count({ where: exceptionWhere }),
    prisma.incident.count({ where: incidentWhere }),
    // Get holiday name if it's a holiday
    isHoliday ? prisma.holiday.findFirst({
      where: isAdmin ? { date: todayDate } : { companyId, date: todayDate },
      select: { name: true },
    }) : null,
  ]);

  // Calculate check-in rate from summaries
  let checkinRate: number;
  if (isHoliday) {
    checkinRate = 100;
  } else {
    checkinRate = totalExpected > 0
      ? Math.round((totalCheckedIn / totalExpected) * 100)
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
    isHoliday,
    holidayName: holidayRecord?.name || null,
  });
});

// GET /analytics/recent-checkins - Get recent check-ins (company-scoped, except for ADMIN)
analyticsRoutes.get('/recent-checkins', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '10');

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isTeamLead = userRole === 'TEAM_LEAD';

  // TEAM_LEAD: Only see check-ins from their team members
  let teamIdFilter: string | undefined;
  if (isTeamLead) {
    const team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });
    if (!team) {
      return c.json({ error: 'You are not assigned to lead any team' }, 403);
    }
    teamIdFilter = team.id;
  }

  const where: any = {
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };
  
  if (isAdmin) {
    // Admin sees all companies
  } else if (isTeamLead && teamIdFilter) {
    // Team lead sees only their team's check-ins
    where.user.teamId = teamIdFilter;
    where.companyId = companyId;
  } else {
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
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '7');

  // Get company timezone and date range (timezone-aware)
  const timezone = c.get('timezone');
  const { start: startDate } = getLastNDaysRange(days, timezone);

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isTeamLead = userRole === 'TEAM_LEAD';

  // TEAM_LEAD: Only see readiness data from their team members
  let teamIdFilter: string | undefined;
  if (isTeamLead) {
    const team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });
    if (!team) {
      return c.json({ error: 'You are not assigned to lead any team' }, 403);
    }
    teamIdFilter = team.id;
  }

  const where: any = {
    createdAt: { gte: startDate },
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };
  
  if (isAdmin) {
    // Admin sees all companies
  } else if (isTeamLead && teamIdFilter) {
    // Team lead sees only their team's check-ins
    where.user.teamId = teamIdFilter;
    where.companyId = companyId;
  } else {
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
// OPTIMIZED: Uses pre-computed DailyTeamSummary for fast queries
analyticsRoutes.get('/team/:teamId', async (c) => {
  const teamId = c.req.param('teamId');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');

  // Verify team belongs to company
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true, leaderId: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view their own team's analytics
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view analytics for your own team' }, 403);
  }

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');
  const todayDate = getTodayForDbDate(timezone);

  // Get today's summary from DailyTeamSummary (pre-computed)
  const summary = await prisma.dailyTeamSummary.findUnique({
    where: {
      teamId_date: { teamId, date: todayDate },
    },
  });

  // If no summary exists yet (e.g., no check-ins today), return zeros
  if (!summary) {
    // Get member count directly
    const memberCount = await prisma.user.count({
      where: {
        teamId,
        isActive: true,
        role: { in: ['MEMBER', 'WORKER'] },
      },
    });

    return c.json({
      teamId,
      totalMembers: memberCount,
      checkedIn: 0,
      greenCount: 0,
      yellowCount: 0,
      redCount: 0,
      checkinRate: 0,
    });
  }

  return c.json({
    teamId,
    totalMembers: summary.totalMembers,
    checkedIn: summary.checkedInCount,
    greenCount: summary.greenCount,
    yellowCount: summary.yellowCount,
    redCount: summary.redCount,
    checkinRate: summary.expectedToCheckIn > 0
      ? Math.round((summary.checkedInCount / summary.expectedToCheckIn) * 100)
      : 0,
  });
});

// GET /analytics/trends - Get trend analytics (company-scoped, except for ADMIN)
analyticsRoutes.get('/trends', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '30');

  // Get company timezone and date range (timezone-aware)
  const timezone = c.get('timezone');
  const { start: startDate } = getLastNDaysRange(days, timezone);

  // ADMIN: see all trends across all companies, but only from members with teams
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isTeamLead = userRole === 'TEAM_LEAD';

  // TEAM_LEAD: Only see trends from their team members
  let teamIdFilter: string | undefined;
  let teamMemberIds: string[] | undefined;
  if (isTeamLead) {
    const team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });
    if (!team) {
      return c.json({ error: 'You are not assigned to lead any team' }, 403);
    }
    teamIdFilter = team.id;
    // Get team member IDs for filtering incidents
    teamMemberIds = (await prisma.user.findMany({
      where: { teamId: teamIdFilter, isActive: true },
      select: { id: true },
    })).map(u => u.id);
  }

  const checkinWhere: any = {
    createdAt: { gte: startDate },
    user: { teamId: { not: null }, role: { in: ['MEMBER', 'WORKER'] }, isActive: true },
  };
  const incidentWhere: any = { createdAt: { gte: startDate } };

  if (isAdmin) {
    // Admin sees all companies
  } else if (isTeamLead && teamIdFilter) {
    // Team lead sees only their team's data
    checkinWhere.user.teamId = teamIdFilter;
    checkinWhere.companyId = companyId;
    incidentWhere.reportedBy = { in: teamMemberIds };
    incidentWhere.companyId = companyId;
  } else {
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
  const userId = c.get('userId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '1000'), 5000); // Max 5000 per request

  // ADMIN: see all check-ins across all companies, but only from members with teams
  const userRole = user.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isTeamLead = userRole === 'TEAM_LEAD';

  // TEAM_LEAD: Only export check-ins from their team members
  let teamIdFilter: string | undefined;
  if (isTeamLead) {
    const team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });
    if (!team) {
      return c.json({ error: 'You are not assigned to lead any team' }, 403);
    }
    teamIdFilter = team.id;
  }

  const where: any = {
    // Only include check-ins from members who have teams assigned (for ALL roles)
    user: {
      teamId: { not: null },
      role: { in: ['MEMBER', 'WORKER'] },
      isActive: true,
    },
  };

  if (isAdmin) {
    // Admin sees all companies
  } else if (isTeamLead && teamIdFilter) {
    // Team lead exports only their team's check-ins
    where.user.teamId = teamIdFilter;
    where.companyId = companyId;
  } else {
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
  const timezone = c.get('timezone');

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

  // Fetch EXCUSED absences for all team members for the period
  // EXCUSED absences should be treated like exemptions (not counted against worker)
  const excusedAbsences = await prisma.absence.findMany({
    where: {
      userId: { in: memberIds },
      status: 'EXCUSED',
      absenceDate: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      absenceDate: true,
    },
  });

  // Build excused absences map: userId -> Set of date strings
  const excusedAbsencesByUser = new Map<string, Set<string>>();
  for (const absence of excusedAbsences) {
    const dateStr = formatLocalDate(absence.absenceDate, timezone);
    const userAbsences = excusedAbsencesByUser.get(absence.userId) || new Set();
    userAbsences.add(dateStr);
    excusedAbsencesByUser.set(absence.userId, userAbsences);
  }

  // Build exemption map: userId -> array of exemptions
  const exemptionsByUser = new Map<string, typeof memberExemptions>();
  for (const exemption of memberExemptions) {
    const userExemptions = exemptionsByUser.get(exemption.userId) || [];
    userExemptions.push(exemption);
    exemptionsByUser.set(exemption.userId, userExemptions);
  }

  // Helper: Check if a date is exempted for a user (includes exemptions + EXCUSED absences)
  const isDateExemptedForUser = (userId: string, dateStr: string): boolean => {
    // Check exemptions (Exception model - leave requests)
    const userExemptions = exemptionsByUser.get(userId) || [];
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStartStr = formatLocalDate(exemption.startDate, timezone);
      const exEndStr = formatLocalDate(exemption.endDate, timezone);
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return true;
      }
    }
    // Check EXCUSED absences (Absence model - TL approved absences)
    const userExcusedAbsences = excusedAbsencesByUser.get(userId);
    if (userExcusedAbsences?.has(dateStr)) {
      return true;
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

    // Also add EXCUSED absences to exempted dates (TL approved = no penalty)
    const userExcusedAbsences = excusedAbsencesByUser.get(member.id);
    if (userExcusedAbsences) {
      for (const dateStr of userExcusedAbsences) {
        exemptedDatesSet.add(dateStr);
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

    // Calculate metrics from VALID check-ins only (excludes holidays & exemptions)
    // IMPORTANT: Only includes ACTUAL check-ins - absent workers have NO check-in, so NO metrics data
    // Absent workers don't affect metrics because they never submitted mood/stress/sleep/physicalHealth scales
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

    const avgPhysical = validCheckins.length > 0
      ? Math.round(validCheckins.reduce((sum, c) => sum + c.physicalHealth, 0) / validCheckins.length * 10) / 10
      : 0;

    // Calculate check-in rate based on expected work days (after exemptions)
    const checkinRate = expectedWorkDays > 0
      ? Math.min(100, Math.round((validCheckins.length / expectedWorkDays) * 100))
      : 0;

    const missedWorkDays = Math.max(0, expectedWorkDays - validCheckins.length);

    // Determine risk level based on Score only
    // Score already factors in Mood, Stress, Sleep, Physical
    // HIGH: avgScore < 40 (RED zone)
    // MEDIUM: avgScore 40-69 (YELLOW zone)
    // LOW: avgScore >= 70 (GREEN zone)
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (validCheckins.length > 0) {
      if (avgScore < 40) {
        riskLevel = 'high';
      } else if (avgScore < 70) {
        riskLevel = 'medium';
      }
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
      exemptionDaysCount,
      missedWorkDays,
      checkinRate,
      greenCount,
      yellowCount,
      redCount,
      avgScore,
      avgMood,
      avgStress,
      avgSleep,
      avgPhysical,
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

  // Get previous period check-ins, exemptions, and EXCUSED absences (for fair comparison)
  const [prevCheckins, prevExemptions, prevExcusedAbsences] = await Promise.all([
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
    prisma.absence.findMany({
      where: {
        userId: { in: memberIds },
        status: 'EXCUSED',
        absenceDate: { gte: prevStartDate, lte: prevEndDate },
      },
      select: {
        userId: true,
        absenceDate: true,
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

  // Group previous EXCUSED absences by user
  const prevExcusedAbsencesByUser = new Map<string, Set<string>>();
  for (const absence of prevExcusedAbsences) {
    const dateStr = formatLocalDate(absence.absenceDate, timezone);
    const userAbsences = prevExcusedAbsencesByUser.get(absence.userId) || new Set();
    userAbsences.add(dateStr);
    prevExcusedAbsencesByUser.set(absence.userId, userAbsences);
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

    // Also add EXCUSED absences for previous period (TL approved = no penalty)
    const userPrevExcusedAbsences = prevExcusedAbsencesByUser.get(member.id);
    if (userPrevExcusedAbsences) {
      for (const dateStr of userPrevExcusedAbsences) {
        prevExemptedDatesSet.add(dateStr);
      }
    }

    const prevExemptionDaysCount = prevExemptedDatesSet.size;

    const memberPrevWorkDays = countWorkDaysInRange(effectivePrevStart, prevEndDate, teamWorkDays, timezone, prevHolidayDates);
    prevTotalExpectedWorkDays += Math.max(0, memberPrevWorkDays - prevExemptionDaysCount);
  }

  const prevCheckinRate = prevTotalExpectedWorkDays > 0
    ? Math.round((prevTotalCheckins / prevTotalExpectedWorkDays) * 100)
    : 0;

  // =====================================================
  // USE DailyTeamSummary FOR CONSISTENCY WITH TEAM ANALYTICS
  // This ensures AI Insights shows the same values as Team Analytics page
  // =====================================================
  // Convert dates to DB format (noon UTC) for proper DailyTeamSummary comparison
  // DailyTeamSummary.date is stored as noon UTC, must use toDbDate() for matching
  const dbStartDate = toDbDate(startDate, timezone);
  const dbEndDate = toDbDate(endDate, timezone);

  const dailySummaries = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId,
      companyId,
      date: { gte: dbStartDate, lte: dbEndDate },
      isWorkDay: true,
      isHoliday: false,
    },
    select: {
      checkedInCount: true,
      expectedToCheckIn: true,
      avgReadinessScore: true,
      greenCount: true,
      yellowCount: true,
      redCount: true,
    },
  });

  // Calculate period stats from DailyTeamSummary (same as Team Analytics)
  let summaryTotalCheckins = 0;
  let summaryTotalExpected = 0;
  let summaryWeightedReadiness = 0;
  let summaryTotalGreen = 0;
  let summaryTotalYellow = 0;
  let summaryTotalRed = 0;

  for (const day of dailySummaries) {
    summaryTotalCheckins += day.checkedInCount;
    summaryTotalExpected += day.expectedToCheckIn;
    if (day.avgReadinessScore !== null && day.checkedInCount > 0) {
      summaryWeightedReadiness += day.avgReadinessScore * day.checkedInCount;
    }
    summaryTotalGreen += day.greenCount;
    summaryTotalYellow += day.yellowCount;
    summaryTotalRed += day.redCount;
  }

  // Use DailyTeamSummary values (consistent with Team Analytics)
  // Fallback to raw calculation if no daily summaries exist
  const periodCompliance = summaryTotalExpected > 0
    ? Math.round((summaryTotalCheckins / summaryTotalExpected) * 100)
    : currentCheckinRate; // Fallback

  const periodAvgReadiness = summaryTotalCheckins > 0
    ? Math.round(summaryWeightedReadiness / summaryTotalCheckins)
    : currentAvgScore; // Fallback

  // Build comparison object - use periodCompliance for consistency with Team Analytics
  const periodComparison = {
    current: {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      checkinRate: periodCompliance, // Use DailyTeamSummary-based compliance
      avgScore: currentAvgScore,
      atRiskCount: currentAtRiskCount,
      totalCheckins: summaryTotalCheckins, // Use DailyTeamSummary total
      greenCount: summaryTotalGreen,
      yellowCount: summaryTotalYellow,
      redCount: summaryTotalRed,
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
      checkinRate: periodCompliance - prevCheckinRate,
      avgScore: currentAvgScore - prevAvgScore,
      atRiskCount: currentAtRiskCount - prevAtRiskCount,
      totalCheckins: summaryTotalCheckins - prevTotalCheckins,
    },
  };

  // Calculate team grade for snapshot (consistent with Team Analytics page)
  // periodCompliance and periodAvgReadiness are already calculated above from DailyTeamSummary
  // Formula: (Team Avg Score × 60%) + (Compliance × 40%)
  const gradeScore = Math.round((periodAvgReadiness * 0.60) + (periodCompliance * 0.40));
  const getGradeInfoLocal = (score: number) => {
    if (score >= 90) return { letter: 'A', label: 'Excellent', color: 'GREEN' };
    if (score >= 80) return { letter: 'B', label: 'Good', color: 'GREEN' };
    if (score >= 70) return { letter: 'C+', label: 'Satisfactory', color: 'YELLOW' };
    if (score >= 60) return { letter: 'C', label: 'Fair', color: 'YELLOW' };
    if (score >= 50) return { letter: 'D', label: 'Needs Improvement', color: 'ORANGE' };
    return { letter: 'F', label: 'Critical', color: 'RED' };
  };
  const gradeInfo = getGradeInfoLocal(gradeScore);

  // Build teamGrade object for AI generator (uses DailyTeamSummary values)
  const teamGradeForAI = {
    score: gradeScore,
    letter: gradeInfo.letter,
    label: gradeInfo.label,
    avgReadiness: periodAvgReadiness,
    compliance: periodCompliance, // This is from DailyTeamSummary, consistent with Team Analytics
  };

  try {
    const user = c.get('user');

    // Calculate team averages from all check-ins for Expert Data Interpretation
    const teamAvgMood = allCheckins.length > 0
      ? Math.round(allCheckins.reduce((sum, c) => sum + c.mood, 0) / allCheckins.length * 10) / 10
      : 0;
    const teamAvgStress = allCheckins.length > 0
      ? Math.round(allCheckins.reduce((sum, c) => sum + c.stress, 0) / allCheckins.length * 10) / 10
      : 0;
    const teamAvgSleep = allCheckins.length > 0
      ? Math.round(allCheckins.reduce((sum, c) => sum + c.sleep, 0) / allCheckins.length * 10) / 10
      : 0;
    const teamAvgPhysicalHealth = allCheckins.length > 0
      ? Math.round(allCheckins.reduce((sum, c) => sum + c.physicalHealth, 0) / allCheckins.length * 10) / 10
      : 0;

    // Build member stats for Expert Data Interpretation
    const memberStats = memberAnalytics.map((m: any) => ({
      name: m.name,
      avgScore: m.avgScore,
      checkinCount: m.checkinCount,
      redCount: m.redCount,
      riskLevel: m.riskLevel,
      avgMood: m.avgMood,
      avgStress: m.avgStress,
      avgSleep: m.avgSleep,
      avgPhysical: m.avgPhysical,
    }));

    // Calculate status distribution
    const statusDistributionForAI = {
      GREEN: allCheckins.filter((c: any) => c.readinessStatus === 'GREEN').length,
      YELLOW: allCheckins.filter((c: any) => c.readinessStatus === 'YELLOW').length,
      RED: allCheckins.filter((c: any) => c.readinessStatus === 'RED').length,
    };

    // Generate Expert Data Interpretation (narrative style) - NEW FORMAT
    const expertInterpretation = await generateExpertDataInterpretation({
      teamName: team.name,
      totalMembers: team.members.length,
      totalCheckins: allCheckins.length,
      periodStart: formatLocalDate(startDate, timezone),
      periodEnd: formatLocalDate(endDate, timezone),
      statusDistribution: statusDistributionForAI,
      averages: {
        score: periodAvgReadiness,
        mood: teamAvgMood,
        stress: teamAvgStress,
        sleep: teamAvgSleep,
        physical: teamAvgPhysicalHealth,
      },
      memberStats,
    });

    // Also generate structured summary for highlights/concerns/recommendations
    const summary = await generateTeamAnalyticsSummary({
      teamName: team.name,
      totalMembers: team.members.length,
      periodDays,
      memberAnalytics,
      openIncidents,
      pendingExceptions,
      teamGrade: teamGradeForAI, // Pass correct team grade to AI
    });

    // Map frontend status to database enum
    const statusMap: Record<string, 'HEALTHY' | 'ATTENTION' | 'CRITICAL'> = {
      healthy: 'HEALTHY',
      attention: 'ATTENTION',
      critical: 'CRITICAL',
    };

    // Calculate team health score (different formula: Readiness 40% + Compliance 30% + Consistency 30%)
    // For simplicity, use streak data to estimate consistency
    const avgStreak = membersWithCheckins.length > 0
      ? membersWithCheckins.reduce((sum, m) => sum + (m.currentStreak || 0), 0) / membersWithCheckins.length
      : 0;
    const consistencyScore = Math.min(100, avgStreak * 10); // 10 days streak = 100%
    const teamHealthScore = Math.round(
      (periodAvgReadiness * 0.40) + (periodCompliance * 0.30) + (consistencyScore * 0.30)
    );

    // Get top performers (top 3 by avgScore, minimum 70% check-in rate)
    const topPerformers = [...memberAnalytics]
      .filter(m => m.checkinRate >= 70 && m.checkinCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(m => ({
        name: m.name,
        avgScore: m.avgScore,
        checkinRate: m.checkinRate,
        currentStreak: m.currentStreak || 0,
      }));

    // Get top reasons for low scores (from check-in data)
    // Aggregate reasons from check-ins with low scores
    const lowScoreCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: startDate, lte: endDate },
        readinessScore: { lt: 70 },
        lowScoreReason: { not: null },
      },
      select: {
        lowScoreReason: true,
      },
    });

    // Count reason occurrences
    const reasonCounts = new Map<string, number>();
    for (const checkin of lowScoreCheckins) {
      if (checkin.lowScoreReason) {
        reasonCounts.set(checkin.lowScoreReason, (reasonCounts.get(checkin.lowScoreReason) || 0) + 1);
      }
    }

    // Convert to sorted array with labels
    const reasonLabels: Record<string, string> = {
      POOR_SLEEP: 'Poor Sleep',
      HIGH_STRESS: 'High Stress',
      PHYSICAL_ILLNESS: 'Physical Illness',
      MENTAL_HEALTH: 'Mental Health',
      PERSONAL_ISSUES: 'Personal Issues',
      WORK_ISSUES: 'Work Issues',
      FATIGUE: 'Fatigue',
      OTHER: 'Other',
    };

    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        label: reasonLabels[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Save to database with complete aggregateData
    // Use expertNarrative as main summary (new format)
    const savedSummary = await prisma.aISummary.create({
      data: {
        companyId,
        teamId,
        generatedById: user.id,
        summary: expertInterpretation.narrative, // NEW: Use Expert Data Interpretation narrative
        highlights: summary.highlights,
        concerns: summary.concerns,
        recommendations: summary.recommendations,
        overallStatus: statusMap[expertInterpretation.overallStatus] || 'HEALTHY',
        periodStart: startDate,
        periodEnd: endDate,
        aggregateData: {
          totalMembers: team.members.length,
          openIncidents,
          pendingExceptions,
          memberAnalytics,
          periodComparison,
          // Add team grade snapshot (consistent with Team Analytics page)
          // Uses DailyTeamSummary for exact same values as Team Analytics
          teamHealthScore,
          teamGrade: {
            score: gradeScore,
            letter: gradeInfo.letter,
            label: gradeInfo.label,
            avgReadiness: periodAvgReadiness,
            compliance: periodCompliance,
          },
          // Status distribution from DailyTeamSummary
          statusDistribution: {
            green: summaryTotalGreen,
            yellow: summaryTotalYellow,
            red: summaryTotalRed,
            total: summaryTotalCheckins,
          },
          // Wellness metrics for display
          teamAvgMood,
          teamAvgStress,
          teamAvgSleep,
          teamAvgPhysicalHealth,
          topPerformers,
          topReasons,
          expertNarrative: expertInterpretation.narrative, // Also store in aggregateData for reference
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
      description: `AI Insights report generated for team "${team.name}" (${formatLocalDate(startDate, timezone)} to ${formatLocalDate(endDate, timezone)}) - Status: ${expertInterpretation.overallStatus.toUpperCase()}`,
      metadata: {
        teamId,
        teamName: team.name,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        periodDays,
        overallStatus: expertInterpretation.overallStatus,
        totalMembers: team.members.length,
        highlightsCount: summary.highlights.length,
        concernsCount: summary.concerns.length,
        recommendationsCount: summary.recommendations.length,
      },
    });

    return c.json({
      summary: expertInterpretation.narrative,
      highlights: summary.highlights,
      concerns: summary.concerns,
      recommendations: summary.recommendations,
      overallStatus: expertInterpretation.overallStatus,
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
    const timezone = c.get('timezone');

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
    const timezone = c.get('timezone');

    // Calculate single team grade using optimized utility
    const teamGrade = await calculateSingleTeamGradeOptimized(teamId, {
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
