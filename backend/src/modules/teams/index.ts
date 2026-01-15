import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import type { AppContext } from '../../types/context.js';
import {
  getTodayRange,
  getLastNDaysRange,
  getPeriodRange,
  isWorkDay,
  formatLocalDate,
  formatDisplayDate,
  getStartOfDay,
  getEndOfDay,
  getStartOfNextDay,
  countWorkDaysInRange,
  isSameDay,
  getTodayForDbDate,
  toDbDate,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import { calculatePerformanceScore } from '../../utils/attendance.js';
import { MIN_CHECKIN_DAYS_THRESHOLD } from '../../utils/team-grades-optimized.js';
import { recalculateTodaySummary, generateWorkerHealthReport, getWorkerHistoryAroundDate } from '../../utils/daily-summary.js';

const teamsRoutes = new Hono<AppContext>();

// Helper: Get company timezone from context or default
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// Helper: Validate if a TEAM_LEAD can be assigned as team leader
// Returns error message if invalid, null if valid
async function validateTeamLeaderAssignment(
  leaderId: string,
  companyId: string,
  excludeTeamId?: string
): Promise<string | null> {
  const leader = await prisma.user.findFirst({
    where: { id: leaderId, companyId, isActive: true },
  });

  if (!leader) {
    return 'Invalid team leader';
  }

  // Leader should be TEAM_LEAD, SUPERVISOR, or higher role
  if (!['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'EXECUTIVE'].includes(leader.role)) {
    return 'Team leader must have Team Lead role or higher';
  }

  // For TEAM_LEAD role only: Check if they're already assigned to another team
  if (leader.role === 'TEAM_LEAD') {
    const whereClause: any = {
      leaderId,
      companyId,
      isActive: true,
    };

    // Exclude current team when updating
    if (excludeTeamId) {
      whereClause.id = { not: excludeTeamId };
    }

    const existingTeam = await prisma.team.findFirst({
      where: whereClause,
    });

    if (existingTeam) {
      return excludeTeamId
        ? 'This Team Leader is already assigned to another team. Please select a different Team Leader.'
        : 'This Team Leader is already assigned to a team. Please select a different Team Leader.';
    }
  }

  return null;
}

// GET /teams - List teams (company-scoped)
// Query params:
//   includeInactive=true to include deactivated teams
//   forTransfer=true to allow Team Leads to see all teams (for member transfer)
teamsRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');
  const includeInactive = c.req.query('includeInactive') === 'true';
  const forTransfer = c.req.query('forTransfer') === 'true';

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });

  // TEAM_LEAD: Can only see the team they lead (unless forTransfer=true)
  const isTeamLead = currentUser?.role?.toUpperCase() === 'TEAM_LEAD';
  let where: any = {
    companyId,
    ...(includeInactive ? {} : { isActive: true }),
  };

  if (isTeamLead && !forTransfer) {
    // Restrict to only their team (unless viewing teams for transfer)
    where.leaderId = currentUserId;
  }

  const teams = await prisma.team.findMany({
    where,
    include: {
      leader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }], // Active teams first
  });

  return c.json({
    data: teams, // memberCount is now a direct field on Team
  });
});

// GET /teams/my - Get current user's team with members
teamsRoutes.get('/my', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, role: true },
  });

  // First, try to find team where user is a member (has teamId)
  // If not found, try to find team where user is the leader
  let team = null;

  if (user?.teamId) {
    // User is assigned to a team as a member
    team = await prisma.team.findFirst({
      where: { id: user.teamId, companyId, isActive: true },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
            avgReadinessScore: true,
            lastReadinessStatus: true,
            totalCheckins: true,
          },
        },
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  // If no team found via teamId, check if user is a leader of a team
  if (!team) {
    team = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
            avgReadinessScore: true,
            lastReadinessStatus: true,
            totalCheckins: true,
          },
        },
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  if (!team) {
    return c.json({ error: 'You are not assigned to a team' }, 404);
  }

  // Filter out the team leader from members (they're the supervisor, not a member)
  const filteredMembers = team.members.filter(m => m.id !== team.leaderId);

  // Get member IDs to fetch additional stats
  const memberIds = filteredMembers.map(m => m.id);

  // Early return if no members - avoid unnecessary queries
  if (memberIds.length === 0) {
    return c.json({
      ...team,
      members: [],
    });
  }

  // Get today's date range for leave check (timezone-aware)
  const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Get date range for check-in counts (last 30 days for performance)
  const { start: thirtyDaysAgo } = getLastNDaysRange(30, timezone);

  // Run all queries in parallel for performance
  const [checkinCounts, membersWithStreaks, membersOnLeave] = await Promise.all([
    // Get check-in counts for each member (last 30 days only for performance)
    prisma.checkin.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
        createdAt: { gte: thirtyDaysAgo }, // Limit to last 30 days for faster query
      },
      _count: {
        userId: true,
      },
    }),
    // Get user streak data for all members
    prisma.user.findMany({
      where: {
        id: { in: memberIds },
      },
      select: {
        id: true,
        currentStreak: true,
        longestStreak: true,
        isActive: true,
      },
    }),
    // Get members currently on approved leave
    // End date = LAST DAY of exemption (not return date)
    prisma.exception.findMany({
      where: {
        userId: { in: memberIds },
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: {
        userId: true,
        type: true,
        endDate: true,
      },
    }),
  ]);

  // Create maps for quick lookup
  const checkinCountMap = new Map(checkinCounts.map(c => [c.userId, c._count.userId]));
  const streakMap = new Map(membersWithStreaks.map(u => [u.id, {
    currentStreak: u.currentStreak,
    longestStreak: u.longestStreak,
    isActive: u.isActive,
  }]));
  const leaveMap = new Map(membersOnLeave.map(e => [e.userId, { type: e.type, endDate: e.endDate }]));

  // Enhance members with streak, check-in count, and leave status
  const membersWithStats = filteredMembers.map(member => {
    const streakData = streakMap.get(member.id);
    const leaveData = leaveMap.get(member.id);
    return {
      ...member,
      currentStreak: streakData?.currentStreak || 0,
      longestStreak: streakData?.longestStreak || 0,
      checkinCount: checkinCountMap.get(member.id) || 0,
      isActive: streakData?.isActive ?? true,
      isOnLeave: !!leaveData,
      leaveType: leaveData?.type || null,
      leaveEndDate: leaveData?.endDate || null,
    };
  });

  return c.json({
    ...team,
    members: membersWithStats,
  });
});

// GET /teams/:id - Get team by ID with members (company-scoped)
teamsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });

  const team = await prisma.team.findFirst({
    where: { id, companyId },
    include: {
      members: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatar: true,
          avgReadinessScore: true,
          lastReadinessStatus: true,
          totalCheckins: true,
        },
      },
      leader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view the team they lead
  const isTeamLead = currentUser?.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view your own team' }, 403);
  }

  return c.json(team);
});

// GET /teams/:id/stats - Get team statistics
// OPTIMIZED: Uses pre-computed DailyTeamSummary for fast queries
teamsRoutes.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });

  // Verify team exists
  const team = await prisma.team.findFirst({
    where: { id, companyId },
    select: { id: true, leaderId: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view stats for the team they lead
  const isTeamLead = currentUser?.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view stats for your own team' }, 403);
  }

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);
  const todayForDb = getTodayForDbDate(timezone);

  // Get today's summary from DailyTeamSummary (pre-computed)
  const summary = await prisma.dailyTeamSummary.findUnique({
    where: {
      teamId_date: { teamId: id, date: todayForDb },
    },
  });

  // Get holiday name if it's a holiday
  const holidayRecord = summary?.isHoliday ? await prisma.holiday.findFirst({
    where: { companyId, date: todayForDb },
    select: { name: true },
  }) : null;

  // Get pending exceptions and open incidents (not stored in summary)
  const memberIds = await prisma.user.findMany({
    where: { teamId: id, isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
    select: { id: true },
  }).then(members => members.map(m => m.id));

  const [pendingExceptions, openIncidents] = await Promise.all([
    prisma.exception.count({
      where: { userId: { in: memberIds }, status: 'PENDING' },
    }),
    prisma.incident.count({
      where: { teamId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
  ]);

  // If summary exists, use pre-computed data
  if (summary) {
    return c.json({
      totalMembers: summary.totalMembers,
      checkedIn: summary.checkedInCount,
      notCheckedIn: summary.notCheckedInCount,
      isWorkDay: summary.isWorkDay,
      isHoliday: summary.isHoliday,
      holidayName: holidayRecord?.name || null,
      greenCount: summary.greenCount,
      yellowCount: summary.yellowCount,
      redCount: summary.redCount,
      pendingExceptions,
      openIncidents,
      checkinRate: summary.expectedToCheckIn > 0
        ? Math.round((summary.checkedInCount / summary.expectedToCheckIn) * 100)
        : 0,
      avgReadinessScore: summary.avgReadinessScore,
      onLeaveCount: summary.onLeaveCount,
    });
  }

  // Fallback: No summary yet, return zeros with member count
  return c.json({
    totalMembers: memberIds.length,
    checkedIn: 0,
    notCheckedIn: 0,
    isWorkDay: true,
    isHoliday: false,
    holidayName: null,
    greenCount: 0,
    yellowCount: 0,
    redCount: 0,
    pendingExceptions,
    openIncidents,
    checkinRate: 0,
    avgReadinessScore: null,
    onLeaveCount: 0,
  });
});

// GET /teams/:id/summary - Get team summary for date range
// Query params: days (default 7), startDate, endDate
teamsRoutes.get('/:id/summary', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');

  // Parse query params
  const days = parseInt(c.req.query('days') || '7', 10);
  const startDateParam = c.req.query('startDate');
  const endDateParam = c.req.query('endDate');

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });

  // Verify team exists
  const team = await prisma.team.findFirst({
    where: { id, companyId },
    select: { id: true, name: true, leaderId: true },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // TEAM_LEAD: Can only view summary for the team they lead
  const isTeamLead = currentUser?.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && team.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view summary for your own team' }, 403);
  }

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);

  // Calculate date range - use toDbDate for proper date comparison
  // DailyTeamSummary.date is stored as noon UTC, so we need to compare with noon UTC dates
  let dbStartDate: Date;
  let dbEndDate: Date;

  if (startDateParam && endDateParam) {
    dbStartDate = toDbDate(new Date(startDateParam), timezone);
    dbEndDate = toDbDate(new Date(endDateParam), timezone);
  } else {
    // Default: last N days
    const now = new Date();
    dbEndDate = toDbDate(now, timezone);

    const startDateObj = new Date(now);
    startDateObj.setDate(startDateObj.getDate() - (days - 1));
    dbStartDate = toDbDate(startDateObj, timezone);
  }

  // Get summaries for date range
  const summaries = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId: id,
      date: {
        gte: dbStartDate,
        lte: dbEndDate,
      },
    },
    orderBy: { date: 'desc' },
  });

  // Calculate aggregates
  const workDaySummaries = summaries.filter(s => s.isWorkDay && !s.isHoliday);
  const totalWorkDays = workDaySummaries.length;
  const totalExpected = workDaySummaries.reduce((sum, s) => sum + s.expectedToCheckIn, 0);
  const totalCheckedIn = workDaySummaries.reduce((sum, s) => sum + s.checkedInCount, 0);
  const totalGreen = workDaySummaries.reduce((sum, s) => sum + s.greenCount, 0);
  const totalYellow = workDaySummaries.reduce((sum, s) => sum + s.yellowCount, 0);
  const totalRed = workDaySummaries.reduce((sum, s) => sum + s.redCount, 0);

  const avgComplianceRate = totalExpected > 0
    ? Math.round((totalCheckedIn / totalExpected) * 100)
    : null;

  const scoresWithData = workDaySummaries.filter(s => s.avgReadinessScore !== null);
  const avgReadinessScore = scoresWithData.length > 0
    ? Math.round(scoresWithData.reduce((sum, s) => sum + (s.avgReadinessScore || 0), 0) / scoresWithData.length)
    : null;

  return c.json({
    teamId: id,
    teamName: team.name,
    period: {
      startDate: dbStartDate.toISOString(),
      endDate: dbEndDate.toISOString(),
      days,
    },
    summaries,
    aggregate: {
      totalWorkDays,
      totalExpected,
      totalCheckedIn,
      avgComplianceRate,
      avgReadinessScore,
      totalGreen,
      totalYellow,
      totalRed,
    },
  });
});

// POST /teams - Create team (Executive/Admin only)
teamsRoutes.post('/', async (c) => {
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Team leader is REQUIRED
  if (!body.leaderId) {
    return c.json({ error: 'Team leader is required. Please assign a team leader.' }, 400);
  }

  // Validate leader assignment
  const validationError = await validateTeamLeaderAssignment(body.leaderId, companyId);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const team = await prisma.team.create({
    data: {
      name: body.name,
      description: body.description || null,
      companyId,
      leaderId: body.leaderId,
      workDays: body.workDays || 'MON,TUE,WED,THU,FRI',
      shiftStart: body.shiftStart || '08:00',
      shiftEnd: body.shiftEnd || '17:00',
    },
    include: {
      leader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Log team creation
  const leaderName = team.leader ? `${team.leader.firstName} ${team.leader.lastName}` : 'Unknown';
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_CREATED',
    entityType: 'team',
    entityId: team.id,
    description: `${currentUser.firstName} ${currentUser.lastName} created team "${body.name}" with leader ${leaderName}`,
    metadata: { teamName: body.name, leaderId: body.leaderId },
  });

  return c.json(team, 201);
});

// PUT /teams/:id - Update team (Executive/Admin only)
teamsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const existing = await prisma.team.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Determine the new leader ID
  const newLeaderId = body.leaderId !== undefined ? body.leaderId : existing.leaderId;

  // Team must always have a leader - cannot remove without replacement
  if (!newLeaderId) {
    return c.json({ error: 'Team must have a team leader. Please assign a replacement leader.' }, 400);
  }

  // Validate new leader if changing
  if (body.leaderId && body.leaderId !== existing.leaderId) {
    const validationError = await validateTeamLeaderAssignment(body.leaderId, companyId, id);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }
  }

  // Check if workDays is being changed
  const workDaysChanged = body.workDays !== undefined && body.workDays !== existing.workDays;

  const team = await prisma.team.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      leaderId: newLeaderId,
      ...(body.workDays !== undefined && { workDays: body.workDays }),
      ...(body.shiftStart !== undefined && { shiftStart: body.shiftStart }),
      ...(body.shiftEnd !== undefined && { shiftEnd: body.shiftEnd }),
    },
  });

  // Log team update
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_UPDATED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} updated team "${team.name}"`,
    metadata: { updatedFields: Object.keys(body) },
  });

  // If workDays changed, recalculate today's summary (isWorkDay flag affected)
  if (workDaysChanged) {
    const timezone = await getCompanyTimezone(companyId);
    recalculateTodaySummary(id, timezone).catch(err => {
      console.error('Failed to recalculate summary after workDays change:', err);
    });
  }

  return c.json(team);
});

// POST /teams/:id/deactivate - Deactivate team and create exemptions for workers (Executive/Admin only)
teamsRoutes.post('/:id/deactivate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const team = await prisma.team.findFirst({
    where: { id, companyId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (!team.isActive) {
    return c.json({ error: 'Team is already deactivated' }, 400);
  }

  const reason = body.reason || 'Team temporarily deactivated';
  const endDate = body.endDate ? new Date(body.endDate) : null;
  const now = new Date();

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);
  const todayForDb = getTodayForDbDate(timezone);

  // Transaction: Deactivate team and create exemptions for all workers
  const result = await prisma.$transaction(async (tx) => {
    // 1. Deactivate the team
    const updatedTeam = await tx.team.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: now,
        deactivatedReason: reason,
        reactivatedAt: null,
      },
    });

    // 2. Create TEAM_INACTIVE exemptions for all workers in the team
    const exemptions = [];
    for (const member of team.members) {
      const exemption = await tx.exception.create({
        data: {
          userId: member.id,
          companyId,
          type: 'TEAM_INACTIVE',
          reason: `Team "${team.name}" deactivated: ${reason}`,
          startDate: todayForDb,
          endDate: endDate,
          status: 'APPROVED',
          reviewedById: currentUser.id,
          reviewNote: 'Auto-approved: Team deactivation',
          approvedBy: `${currentUser.firstName} ${currentUser.lastName}`,
          approvedAt: now,
          isExemption: true,
        },
      });
      exemptions.push(exemption);
    }

    return { team: updatedTeam, exemptions };
  });

  // Log team deactivation
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_UPDATED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} deactivated team "${team.name}" - ${team.members.length} workers exempted`,
    metadata: {
      teamName: team.name,
      reason,
      endDate: endDate?.toISOString(),
      exemptedWorkers: team.members.length,
    },
  });

  // Recalculate today's summary (workers now on exemption)
  recalculateTodaySummary(id, timezone).catch(err => {
    console.error('Failed to recalculate summary after team deactivation:', err);
  });

  return c.json({
    success: true,
    message: `Team "${team.name}" deactivated. ${team.members.length} workers are now exempted from check-in.`,
    team: result.team,
    exemptionsCreated: result.exemptions.length,
  });
});

// POST /teams/:id/reactivate - Reactivate team and end exemptions (Executive/Admin only)
teamsRoutes.post('/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const team = await prisma.team.findFirst({
    where: { id, companyId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (team.isActive) {
    return c.json({ error: 'Team is already active' }, 400);
  }

  const now = new Date();
  const memberIds = team.members.map((m) => m.id);

  // Get company timezone
  const timezone = await getCompanyTimezone(companyId);
  const yesterdayForDb = new Date(getTodayForDbDate(timezone));
  yesterdayForDb.setDate(yesterdayForDb.getDate() - 1);

  // Transaction: Reactivate team and end all TEAM_INACTIVE exemptions
  const result = await prisma.$transaction(async (tx) => {
    // 1. Reactivate the team
    const updatedTeam = await tx.team.update({
      where: { id },
      data: {
        isActive: true,
        reactivatedAt: now,
      },
    });

    // 2. End all active TEAM_INACTIVE exemptions for workers in this team
    // Set endDate to yesterday so workers need to check in starting today
    const updatedExemptions = await tx.exception.updateMany({
      where: {
        userId: { in: memberIds },
        type: 'TEAM_INACTIVE',
        status: 'APPROVED',
        OR: [
          { endDate: null }, // No end date (indefinite)
          { endDate: { gte: now } }, // End date is in the future
        ],
      },
      data: {
        endDate: yesterdayForDb,
      },
    });

    return { team: updatedTeam, exemptionsEnded: updatedExemptions.count };
  });

  // Log team reactivation
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_UPDATED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} reactivated team "${team.name}" - ${result.exemptionsEnded} exemptions ended`,
    metadata: {
      teamName: team.name,
      exemptionsEnded: result.exemptionsEnded,
    },
  });

  // Recalculate today's summary (workers no longer on exemption)
  recalculateTodaySummary(id, timezone).catch(err => {
    console.error('Failed to recalculate summary after team reactivation:', err);
  });

  return c.json({
    success: true,
    message: `Team "${team.name}" reactivated. Workers must check in starting today.`,
    team: result.team,
    exemptionsEnded: result.exemptionsEnded,
  });
});

// DELETE /teams/:id - Soft delete team (Executive/Admin only)
teamsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const existing = await prisma.team.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Soft delete - set isActive to false
  await prisma.team.update({
    where: { id },
    data: { isActive: false },
  });

  // Remove team assignment from members
  await prisma.user.updateMany({
    where: { teamId: id },
    data: { teamId: null, teamJoinedAt: null },
  });

  // Log team deletion
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_DELETED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} deleted team "${existing.name}"`,
    metadata: { teamName: existing.name },
  });

  return c.json({ success: true });
});

// POST /teams/:id/members - Add member to team
teamsRoutes.post('/:id/members', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  const team = await prisma.team.findFirst({
    where: { id, companyId },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Block adding members to inactive teams
  if (!team.isActive) {
    return c.json({ error: 'Cannot add members to an inactive team. Reactivate the team first.' }, 400);
  }

  // Allow EXECUTIVE, ADMIN, SUPERVISOR for any team
  // Allow TEAM_LEAD only for their own team
  const isTeamLeader = currentUser.role === 'TEAM_LEAD' && team.leaderId === currentUser.id;
  const hasPermission = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role) || isTeamLeader;

  if (!hasPermission) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: body.userId, companyId, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
    select: { id: true, firstName: true, lastName: true, teamId: true },
  });

  if (!user) {
    return c.json({ error: 'User not found or not a worker/member role' }, 404);
  }

  // Use transaction to update user and team memberCount atomically
  await prisma.$transaction(async (tx) => {
    // If user was in another team, decrement that team's memberCount
    if (user.teamId && user.teamId !== id) {
      await tx.team.update({
        where: { id: user.teamId },
        data: { memberCount: { decrement: 1 } },
      });
    }

    // Update user's team assignment
    await tx.user.update({
      where: { id: body.userId },
      data: { teamId: id, teamJoinedAt: new Date() },
    });

    // Increment new team's memberCount (only if not already in this team)
    if (user.teamId !== id) {
      await tx.team.update({
        where: { id },
        data: { memberCount: { increment: 1 } },
      });
    }
  });

  // Log member added
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_MEMBER_ADDED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} added ${user.firstName} ${user.lastName} to team "${team.name}"`,
    metadata: { teamName: team.name, memberId: body.userId, memberName: `${user.firstName} ${user.lastName}` },
  });

  // Recalculate daily team summary (member count changed)
  const timezone = await getCompanyTimezone(companyId);
  recalculateTodaySummary(id, timezone).catch(err => {
    console.error('Failed to recalculate summary after member added:', err);
  });

  // If member was transferred from another team, recalculate old team's summary too
  if (user.teamId && user.teamId !== id) {
    recalculateTodaySummary(user.teamId, timezone).catch(err => {
      console.error('Failed to recalculate old team summary after member transfer:', err);
    });
  }

  return c.json({ success: true });
});

// GET /teams/members/:userId/profile - Get comprehensive member profile
teamsRoutes.get('/members/:userId/profile', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  // Get the member with team info
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      phone: true,
      isActive: true,
      currentStreak: true,
      longestStreak: true,
      lastCheckinDate: true,
      teamId: true,
      teamJoinedAt: true,
      createdAt: true,
      // Pre-computed stats
      totalCheckins: true,
      avgReadinessScore: true,
      lastReadinessStatus: true,
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
        },
      },
    },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  // Get company timezone and today's date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // OPTIMIZED: Parallel fetch all member stats
  const { start: thirtyDaysAgo, end: endDate } = getLastNDaysRange(30, timezone);

  // Check if member is currently on leave
  // IMPORTANT: If exemption ends today, worker should check in (return date), so exclude them
  const [
    activeExemption,
    recentCheckins,
    exemptionsCount,
    absencesCount,
    incidentsCount,
    performance,
  ] = await Promise.all([
    // Active exemption
    prisma.exception.findFirst({
      where: {
        userId: memberId,
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today }, // End date = last day of exemption (includes end date)
      },
      select: {
        id: true,
        type: true,
        endDate: true,
      },
    }),
    // Recent check-ins (last 10)
    prisma.checkin.findMany({
      where: { userId: memberId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        readinessStatus: true,
        readinessScore: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        notes: true,
        lowScoreReason: true,
        lowScoreDetails: true,
        createdAt: true,
      },
    }),
    // Exemptions count
    prisma.exception.count({
      where: { userId: memberId },
    }),
    // Absences count (unplanned)
    prisma.absence.count({
      where: { userId: memberId },
    }),
    // Incidents count
    prisma.incident.count({
      where: { reportedBy: memberId },
    }),
    // Performance score (last 30 days)
    calculatePerformanceScore(memberId, thirtyDaysAgo, endDate),
  ]);

  const attendanceScore = Math.round(performance.score);

  return c.json({
    ...member,
    isOnLeave: !!activeExemption,
    activeExemption,
    stats: {
      totalCheckins: member.totalCheckins, // Use pre-computed value from User model
      attendanceScore,
      exemptionsCount,
      absencesCount,
      incidentsCount,
    },
    recentCheckins,
  });
});

// GET /teams/members/:userId/checkins - Get paginated check-ins for member
teamsRoutes.get('/members/:userId/checkins', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const status = c.req.query('status'); // GREEN, YELLOW, RED

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  const where: any = { userId: memberId };
  if (status) {
    where.readinessStatus = status;
  }

  const [checkins, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        readinessStatus: true,
        readinessScore: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        notes: true,
        lowScoreReason: true,
        lowScoreDetails: true,
        createdAt: true,
      },
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

// GET /teams/members/:userId/exemptions - Get exemptions/exceptions for member
// Has pagination to prevent large result sets
teamsRoutes.get('/members/:userId/exemptions', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  const where = { userId: memberId };

  // Parallel fetch: data + count
  const [exemptions, total] = await Promise.all([
    prisma.exception.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        reason: true,
        startDate: true,
        endDate: true,
        status: true,
        isExemption: true,
        reviewNote: true,
        createdAt: true,
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exception.count({ where }),
  ]);

  return c.json({
    data: exemptions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /teams/members/:userId/incidents - Get incidents reported by member
// Has pagination to prevent large result sets
teamsRoutes.get('/members/:userId/incidents', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  const where = { reportedBy: memberId };

  // Parallel fetch: data + count
  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        location: true,
        createdAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.incident.count({ where }),
  ]);

  return c.json({
    data: incidents,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /teams/members/:userId/absences - Get absences for member (unplanned absences)
// Shows days when worker didn't check in and the review status (EXCUSED/UNEXCUSED)
teamsRoutes.get('/members/:userId/absences', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const status = c.req.query('status'); // Optional: EXCUSED, UNEXCUSED, PENDING_REVIEW, PENDING_JUSTIFICATION

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  const where: any = { userId: memberId };
  if (status) {
    where.status = status;
  }

  // Parallel fetch: data + count
  const [absences, total] = await Promise.all([
    prisma.absence.findMany({
      where,
      orderBy: { absenceDate: 'desc' },
      select: {
        id: true,
        absenceDate: true,
        reasonCategory: true,
        explanation: true,
        justifiedAt: true,
        status: true,
        reviewedAt: true,
        reviewNotes: true,
        createdAt: true,
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.absence.count({ where }),
  ]);

  return c.json({
    data: absences,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// DELETE /teams/:id/members/:userId - Remove member from team
teamsRoutes.delete('/:id/members/:userId', async (c) => {
  const id = c.req.param('id');
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  const team = await prisma.team.findFirst({
    where: { id, companyId },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Allow EXECUTIVE, ADMIN, SUPERVISOR for any team
  // Allow TEAM_LEAD only for their own team
  const isTeamLeader = currentUser.role === 'TEAM_LEAD' && team.leaderId === currentUser.id;
  const hasPermission = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role) || isTeamLeader;

  if (!hasPermission) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, companyId, teamId: id },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  if (!user) {
    return c.json({ error: 'User not found in this team' }, 404);
  }

  // Use transaction to update user and team memberCount atomically
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: memberId },
      data: { teamId: null, teamJoinedAt: null },
    });

    // Decrement team memberCount (only for WORKER/MEMBER roles)
    if (['WORKER', 'MEMBER'].includes(user.role)) {
      await tx.team.update({
        where: { id },
        data: { memberCount: { decrement: 1 } },
      });
    }
  });

  // Log member removed
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_MEMBER_REMOVED',
    entityType: 'team',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} removed ${user.firstName} ${user.lastName} from team "${team.name}"`,
    metadata: { teamName: team.name, memberId, memberName: `${user.firstName} ${user.lastName}` },
  });

  // Recalculate daily team summary (member count changed)
  const timezone = await getCompanyTimezone(companyId);
  recalculateTodaySummary(id, timezone).catch(err => {
    console.error('Failed to recalculate summary after member removed:', err);
  });

  return c.json({ success: true });
});

// GET /teams/members/:userId/analytics - Get analytics data for member charts
teamsRoutes.get('/members/:userId/analytics', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const days = parseInt(c.req.query('days') || '14');

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true, firstName: true, lastName: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  // Get company timezone and date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: startDate, end: endDate } = getLastNDaysRange(days, timezone);

  // Get all check-ins in date range
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: memberId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      readinessStatus: true,
      readinessScore: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      createdAt: true,
    },
  });

  // Build trend data (daily check-ins for chart)
  const trendData = checkins.map((checkin) => ({
    date: checkin.createdAt.toISOString(),
    score: checkin.readinessScore,
    status: checkin.readinessStatus,
  }));

  // Calculate status distribution
  const statusCounts = {
    green: checkins.filter((c) => c.readinessStatus === 'GREEN').length,
    yellow: checkins.filter((c) => c.readinessStatus === 'YELLOW').length,
    red: checkins.filter((c) => c.readinessStatus === 'RED').length,
  };

  // Calculate average metrics
  const totalCheckins = checkins.length;
  const avgMetrics = {
    mood: totalCheckins > 0
      ? checkins.reduce((sum, c) => sum + c.mood, 0) / totalCheckins
      : 0,
    stress: totalCheckins > 0
      ? checkins.reduce((sum, c) => sum + c.stress, 0) / totalCheckins
      : 0,
    sleep: totalCheckins > 0
      ? checkins.reduce((sum, c) => sum + c.sleep, 0) / totalCheckins
      : 0,
    physicalHealth: totalCheckins > 0
      ? checkins.reduce((sum, c) => sum + c.physicalHealth, 0) / totalCheckins
      : 0,
  };

  // Calculate average readiness score
  const avgReadinessScore = totalCheckins > 0
    ? Math.round(checkins.reduce((sum, c) => sum + c.readinessScore, 0) / totalCheckins)
    : 0;

  return c.json({
    trendData,
    statusCounts,
    avgMetrics,
    avgReadinessScore,
  });
});

// ===========================================
// TEAM ANALYTICS (Team Leader Dashboard)
// ===========================================

// Helper: Get grade color and label with letter grade
function getGradeInfo(score: number): { color: string; label: string; letter: string } {
  if (score >= 97) return { color: 'GREEN', label: 'Outstanding', letter: 'A+' };
  if (score >= 93) return { color: 'GREEN', label: 'Excellent', letter: 'A' };
  if (score >= 90) return { color: 'GREEN', label: 'Excellent', letter: 'A-' };
  if (score >= 87) return { color: 'GREEN', label: 'Very Good', letter: 'B+' };
  if (score >= 83) return { color: 'YELLOW', label: 'Good', letter: 'B' };
  if (score >= 80) return { color: 'YELLOW', label: 'Good', letter: 'B-' };
  if (score >= 77) return { color: 'YELLOW', label: 'Satisfactory', letter: 'C+' };
  if (score >= 73) return { color: 'ORANGE', label: 'Satisfactory', letter: 'C' };
  if (score >= 70) return { color: 'ORANGE', label: 'Needs Improvement', letter: 'C-' };
  if (score >= 67) return { color: 'ORANGE', label: 'Poor', letter: 'D+' };
  if (score >= 63) return { color: 'RED', label: 'Poor', letter: 'D' };
  if (score >= 60) return { color: 'RED', label: 'At Risk', letter: 'D-' };
  return { color: 'RED', label: 'Critical', letter: 'F' };
}

// Manual low score reason labels (for Members Needing Attention)
const REASON_LABELS: Record<string, string> = {
  PHYSICAL_INJURY: 'Physical Injury',
  ILLNESS_SICKNESS: 'Illness/Sickness',
  POOR_SLEEP: 'Poor Sleep',
  HIGH_STRESS: 'High Stress',
  PERSONAL_ISSUES: 'Personal Issues',
  FAMILY_EMERGENCY: 'Family Emergency',
  WORK_RELATED: 'Work Related',
  OTHER: 'Other',
};

// Metric issue labels for automatic analysis
const METRIC_ISSUE_LABELS: Record<string, string> = {
  HIGH_STRESS: 'High Stress',
  POOR_SLEEP: 'Poor Sleep',
  LOW_MOOD: 'Low Mood',
  LOW_PHYSICAL: 'Low Physical Health',
};

// Metric thresholds for issue detection
const METRIC_THRESHOLDS = {
  STRESS_HIGH: 6,      // stress > 6 is problematic
  SLEEP_LOW: 5,        // sleep < 5 is problematic
  MOOD_LOW: 5,         // mood < 5 is problematic
  PHYSICAL_LOW: 5,     // physicalHealth < 5 is problematic
} as const;

// GET /teams/my/analytics - Team analytics dashboard data
teamsRoutes.get('/my/analytics', async (c) => {
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const period = c.req.query('period') || 'today'; // today, 7days, 14days, 30days
  const customStart = c.req.query('startDate');
  const customEnd = c.req.query('endDate');

  // TEAM_LEAD: Can only view analytics for the team they lead
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  let team;

  if (isTeamLead) {
    // For TEAM_LEAD, only return the team they lead
    team = await prisma.team.findFirst({
      where: {
        companyId,
        isActive: true,
        leaderId: currentUser.id,
      },
      include: {
        members: {
          // IMPORTANT: Only count WORKER/MEMBER roles for consistency with Teams Overview
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, teamJoinedAt: true, createdAt: true, totalCheckins: true, avgReadinessScore: true, lastReadinessStatus: true },
        },
        leader: {
          select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, isActive: true },
        },
      },
    });

    if (!team) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }
  } else {
    // Higher roles can view any team they're associated with
    team = await prisma.team.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { leaderId: currentUser.id },
          { members: { some: { id: currentUser.id } } },
        ],
      },
      include: {
        members: {
          // IMPORTANT: Only count WORKER/MEMBER roles for consistency with Teams Overview
          // Team leaders supervise but don't check in as workers
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, teamJoinedAt: true, createdAt: true, totalCheckins: true, avgReadinessScore: true, lastReadinessStatus: true },
        },
        leader: {
          select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, isActive: true },
        },
      },
    });

    if (!team) {
      return c.json({ error: 'No team found' }, 404);
    }
  }

  // Get company timezone (centralized)
  const timezone = await getCompanyTimezone(companyId);

  // Calculate date range based on period (timezone-aware)
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const today = todayStart;
  let startDate: Date;
  let endDate: Date = todayEnd;

  switch (period) {
    case 'alltime': {
      // All time: Use team creation date or very old date
      // The analytics will include all data from team creation
      startDate = team.createdAt ? new Date(team.createdAt) : new Date(2020, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case '7days': {
      const range = getLastNDaysRange(6, timezone);
      startDate = range.start;
      endDate = range.end; // IMPORTANT: Use range.end to ensure today is included
      break;
    }
    case '14days': {
      const range = getLastNDaysRange(13, timezone);
      startDate = range.start;
      endDate = range.end; // IMPORTANT: Use range.end to ensure today is included
      break;
    }
    case '30days': {
      const range = getLastNDaysRange(29, timezone);
      startDate = range.start;
      endDate = range.end; // IMPORTANT: Use range.end to ensure today is included
      break;
    }
    case 'custom':
      if (customStart && customEnd) {
        startDate = getStartOfDay(new Date(customStart), timezone);
        endDate = getEndOfDay(new Date(customEnd), timezone);
      } else {
        startDate = today;
      }
      break;
    default: // today
      startDate = today;
  }

  // IMPORTANT: Period should not start before team creation date
  // If team was created after the calculated start date, use team creation date instead
  if (team.createdAt) {
    const teamCreatedAt = getStartOfDay(team.createdAt, timezone);
    if (teamCreatedAt > startDate) {
      startDate = teamCreatedAt;
    }
  }

  // Team members = only workers assigned to the team (NOT the leader)
  // Team leaders supervise but don't check in as workers
  const memberIds = team.members.map((m) => m.id);
  const totalMembers = memberIds.length;

  // Build map of userId -> totalCheckins (for onboarding threshold check)
  const memberTotalCheckinsMap = new Map<string, number>();
  for (const member of team.members) {
    memberTotalCheckinsMap.set(member.id, member.totalCheckins);
  }

  if (totalMembers === 0) {
    return c.json({
      team: { id: team.id, name: team.name, totalMembers: 0 },
      teamGrade: null,
      message: 'No active members in team',
    });
  }

  // Get members on approved leave TODAY (exemption is currently active)
  // IMPORTANT: Exemption must have STARTED (startDate <= todayEnd) AND not ended (endDate >= todayStart)
  // This ensures exemptions that start tomorrow are NOT counted as active today
  // End date = LAST DAY of exemption (not return date)
  // If exemption ends today → today is still exempted → tomorrow is first required check-in
  // Note: Check-ins that happened BEFORE the exemption started should still count
  const membersOnLeave = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: todayEnd }, // Exemption has already started (use todayEnd to include today)
      endDate: { gte: todayStart },   // Exemption hasn't ended yet (includes end date as last day)
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  });

  const onLeaveUserIds = membersOnLeave.map((e) => e.userId);
  const activeMembers = totalMembers - onLeaveUserIds.length;

  // Create a map of exemption start dates to check if check-in was before exemption
  const exemptionStartDates = new Map<string, Date>();
  for (const exemption of membersOnLeave) {
    if (exemption.startDate) {
      const existing = exemptionStartDates.get(exemption.userId);
      if (!existing || exemption.startDate < existing) {
        exemptionStartDates.set(exemption.userId, exemption.startDate);
      }
    }
  }

  // Get EACH MEMBER'S AVERAGE readiness score WITHIN THE SELECTED PERIOD
  // Filter by checkin.createdAt to get accurate period-based averages
  const memberAvgScores = await prisma.checkin.groupBy({
    by: ['userId'],
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _avg: {
      readinessScore: true,
    },
    _count: {
      id: true,
    },
  });

  // Calculate team average from individual member averages
  // NOTE: Include ALL members with check-ins, even those currently on leave
  // Their historical check-ins still count toward team readiness average
  // (Only compliance calculation excludes members on leave)
  const allMemberAverages = memberAvgScores
    .filter((m) => m._avg.readinessScore !== null)
    .map((m) => ({
      userId: m.userId,
      avgScore: m._avg.readinessScore!,
      checkinCount: m._count.id,
    }));

  // IMPORTANT: Filter out members with < MIN_CHECKIN_DAYS_THRESHOLD TOTAL check-ins EVER
  // Uses pre-computed user.totalCheckins field instead of period count
  // This ensures workers with 5+ historical check-ins are included even if
  // the current filter only shows 1-2 check-ins
  const memberAverages = allMemberAverages.filter(m => {
    const totalCheckins = memberTotalCheckinsMap.get(m.userId) || 0;
    return totalCheckins >= MIN_CHECKIN_DAYS_THRESHOLD;
  });
  const onboardingCount = allMemberAverages.length - memberAverages.length;
  const includedMemberCount = memberAverages.length;

  // Calculate team average: sum of all member averages / number of members with check-ins
  // This gives equal weight to each member's average, regardless of how many check-ins they have
  const teamAvgReadiness = memberAverages.length > 0
    ? memberAverages.reduce((sum, m) => sum + m.avgScore, 0) / memberAverages.length
    : 0;

  // Get all check-ins in period for team members (for trend data, metrics, etc.)
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      readinessScore: true,
      readinessStatus: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  });

  // Get TODAY's check-ins specifically (for compliance and current status)
  // Query separately to ensure we get all today's check-ins regardless of period filter
  // This ensures today's data is always accurate even if period doesn't include today
  const todayCheckinsFromDB = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      readinessScore: true,
      readinessStatus: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  });

  // Also filter from period check-ins as fallback (in case of timezone edge cases)
  const todayCheckinsFromPeriod = checkins.filter((c) => {
    const checkinDate = new Date(c.createdAt);
    return isSameDay(checkinDate, todayStart, timezone);
  });

  // Combine both sources and deduplicate by check-in ID
  const todayCheckinsMap = new Map();
  for (const checkin of todayCheckinsFromDB) {
    todayCheckinsMap.set(checkin.id, checkin);
  }
  for (const checkin of todayCheckinsFromPeriod) {
    todayCheckinsMap.set(checkin.id, checkin);
  }
  const todayCheckins = Array.from(todayCheckinsMap.values());

  // Get unique users who checked in today (latest check-in per user)
  const todayCheckinsByUser = new Map<string, typeof todayCheckins[0]>();
  for (const checkin of todayCheckins) {
    if (!todayCheckinsByUser.has(checkin.userId) ||
        new Date(checkin.createdAt) > new Date(todayCheckinsByUser.get(checkin.userId)!.createdAt)) {
      todayCheckinsByUser.set(checkin.userId, checkin);
    }
  }

  const uniqueTodayCheckins = Array.from(todayCheckinsByUser.values());
  // Count all check-ins today - if someone checked in, it counts regardless of exemption status
  const checkedInToday = uniqueTodayCheckins.length;

  // IMPORTANT: Any check-in that happened today ALWAYS counts
  // If someone checked in before their exemption started (even same day), that check-in is valid
  // The exemption doesn't retroactively invalidate an already-completed check-in

  // Get IDs of members who checked in today (for compliance calculation)
  const checkedInUserIds = new Set(uniqueTodayCheckins.map((c) => c.userId));

  // Members on leave who also checked in today - they fulfilled their duty before leave
  const onLeaveButCheckedIn = onLeaveUserIds.filter((id) => checkedInUserIds.has(id));

  // Calculate who was EXPECTED to check in today:
  // - All active members (not on leave)
  // - PLUS members on leave who checked in (they were active when they checked in)
  const expectedToCheckin = activeMembers + onLeaveButCheckedIn.length;

  // Compliance: everyone who checked in / everyone expected to check in
  // Cap at 100% in case of edge cases
  // If nobody expected (all on leave), compliance is 100% (everyone met expectations)
  const compliance = expectedToCheckin > 0
    ? Math.min(100, Math.round((checkedInToday / expectedToCheckin) * 100))
    : 100; // Nobody expected = 100% compliance (all on leave, no violations)

  // Calculate average readiness for TODAY - use ALL check-ins (not filtered)
  const todayScores = uniqueTodayCheckins.map((c) => c.readinessScore);
  const todayAvgReadiness = todayScores.length > 0
    ? todayScores.reduce((sum, s) => sum + s, 0) / todayScores.length
    : 0;

  // Team grade will be calculated AFTER trendData is built (to get period compliance)
  // See below after trendData generation

  // Status distribution - use period check-ins for non-today periods, today's for 'today'
  const distributionCheckins = period === 'today' ? uniqueTodayCheckins : checkins;
  const statusDistribution = {
    green: distributionCheckins.filter((c) => c.readinessStatus === 'GREEN').length,
    yellow: distributionCheckins.filter((c) => c.readinessStatus === 'YELLOW').length,
    red: distributionCheckins.filter((c) => c.readinessStatus === 'RED').length,
    total: distributionCheckins.length,
  };

  // Get ALL holidays for the period (for holidayName lookup in trendData)
  const holidaysInPeriod = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Build holiday map by date string for quick lookup
  const holidayMap = new Map<string, typeof holidaysInPeriod[0]>();
  for (const holiday of holidaysInPeriod) {
    const dateKey = formatLocalDate(holiday.date, timezone);
    holidayMap.set(dateKey, holiday);
  }

  // Trend data from DailyTeamSummary (pre-computed for data consistency with Team Summary page)
  // This ensures Team Analytics and Team Summary show the same numbers
  const trendData: { date: string; score: number | null; compliance: number | null; checkedIn: number; expected: number; onExemption: number; isHoliday: boolean; holidayName?: string; hasData: boolean }[] = [];

  if (period !== 'today') {
    // Convert date range to DB format for DailyTeamSummary query
    const dbStartDate = toDbDate(startDate, timezone);
    const dbEndDate = toDbDate(endDate, timezone);

    // Fetch pre-computed daily summaries from DailyTeamSummary
    const dailySummaries = await prisma.dailyTeamSummary.findMany({
      where: {
        teamId: team.id,
        date: { gte: dbStartDate, lte: dbEndDate },
      },
      orderBy: { date: 'asc' },
    });

    // Build trendData from DailyTeamSummary records
    for (const summary of dailySummaries) {
      const dateKey = formatLocalDate(summary.date, timezone);
      const dayHoliday = holidayMap.get(dateKey);

      // Skip non-work days (weekends)
      if (!summary.isWorkDay) {
        continue;
      }

      // Holiday handling
      if (summary.isHoliday) {
        trendData.push({
          date: dateKey,
          score: null,
          compliance: null,
          checkedIn: 0,
          expected: 0,
          onExemption: 0,
          isHoliday: true,
          holidayName: dayHoliday?.name,
          hasData: false,
        });
        continue;
      }

      // Regular work day - use pre-computed values from DailyTeamSummary
      // complianceRate is null when expectedToCheckIn is 0 (all on exemption)
      const dayCompliance = summary.complianceRate !== null
        ? Math.round(summary.complianceRate)
        : null;

      trendData.push({
        date: dateKey,
        score: summary.avgReadinessScore !== null ? Math.round(summary.avgReadinessScore) : null,
        compliance: dayCompliance,
        checkedIn: summary.checkedInCount,
        expected: summary.expectedToCheckIn,
        onExemption: summary.onLeaveCount, // Includes approved exceptions + EXCUSED absences
        isHoliday: false,
        hasData: summary.checkedInCount > 0,
      });
    }
  }

  // Calculate PERIOD averages from trendData (average of all work days with data)
  // For 'today' period, use today's values
  const trendDataWithScores = trendData.filter(d => d.score !== null);

  const periodAvgReadiness = period !== 'today' && trendDataWithScores.length > 0
    ? Math.round(trendDataWithScores.reduce((sum, d) => sum + d.score!, 0) / trendDataWithScores.length)
    : Math.round(todayAvgReadiness);

  // Period Compliance = TOTAL SUM method (totalCheckedIn / totalExpected)
  // This is consistent with Team Summary / DailyTeamSummary calculation
  // OLD (incorrect): Average of daily rates = avg(day1%, day2%...)
  // NEW (correct): Total sum = totalCheckins / totalExpected
  const trendDataWithCompliance = trendData.filter(d => d.compliance !== null);

  // Calculate total check-ins and total expected across all work days
  let periodTotalCheckins = 0;
  let periodTotalExpected = 0;
  for (const d of trendDataWithCompliance) {
    periodTotalCheckins += d.checkedIn;
    periodTotalExpected += d.expected;
  }

  const periodCompliance = period !== 'today' && periodTotalExpected > 0
    ? Math.round((periodTotalCheckins / periodTotalExpected) * 100)
    : compliance;

  // Calculate Team Grade using MEMBER AVERAGES and PERIOD COMPLIANCE
  // Formula: Team Score = (Team Avg Readiness × 0.60) + (Period Compliance × 0.40)
  let teamGradeScore: number | null = null;
  let teamGradeInfo: { color: string; label: string; letter: string } | null = null;

  // Use member averages if available, otherwise use period average as fallback
  const readinessForGrade = memberAverages.length > 0
    ? teamAvgReadiness
    : periodAvgReadiness;

  // Calculate grade if we have any check-ins in period OR member averages
  if (trendDataWithScores.length > 0 || memberAverages.length > 0 || checkedInToday > 0) {
    teamGradeScore = Math.round((readinessForGrade * 0.60) + (periodCompliance * 0.40));
    teamGradeInfo = getGradeInfo(teamGradeScore);
  }

  // Top reasons - Automatic metric analysis from check-in data
  // Count how many times each metric was "problematic" in the period
  const metricIssues = { HIGH_STRESS: 0, POOR_SLEEP: 0, LOW_MOOD: 0, LOW_PHYSICAL: 0 };

  for (const checkin of checkins) {
    if (checkin.stress > METRIC_THRESHOLDS.STRESS_HIGH) metricIssues.HIGH_STRESS++;
    if (checkin.sleep < METRIC_THRESHOLDS.SLEEP_LOW) metricIssues.POOR_SLEEP++;
    if (checkin.mood < METRIC_THRESHOLDS.MOOD_LOW) metricIssues.LOW_MOOD++;
    if (checkin.physicalHealth < METRIC_THRESHOLDS.PHYSICAL_LOW) metricIssues.LOW_PHYSICAL++;
  }

  const topReasons = Object.entries(metricIssues)
    .filter(([_, count]) => count > 0)
    .map(([reason, count]) => ({
      reason,
      label: METRIC_ISSUE_LABELS[reason],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Average metrics (from period) - use LATEST check-in per user per day for accuracy
  // This ensures each member's daily status counts equally (no double-counting)
  const latestCheckinsByUserDay = new Map<string, typeof checkins[0]>();
  for (const checkin of checkins) {
    const dateKey = formatLocalDate(checkin.createdAt, timezone);
    const userDayKey = `${checkin.userId}_${dateKey}`;
    const existing = latestCheckinsByUserDay.get(userDayKey);
    // Keep the latest check-in (checkins are ordered DESC, so first one is latest)
    if (!existing) {
      latestCheckinsByUserDay.set(userDayKey, checkin);
    }
  }

  const latestScores = Array.from(latestCheckinsByUserDay.values()).map((c) => ({
    mood: c.mood,
    stress: c.stress,
    sleep: c.sleep,
    physicalHealth: c.physicalHealth,
  }));

  const avgMetrics = latestScores.length > 0
    ? {
        mood: Number((latestScores.reduce((sum, s) => sum + s.mood, 0) / latestScores.length).toFixed(1)),
        stress: Number((latestScores.reduce((sum, s) => sum + s.stress, 0) / latestScores.length).toFixed(1)),
        sleep: Number((latestScores.reduce((sum, s) => sum + s.sleep, 0) / latestScores.length).toFixed(1)),
        physicalHealth: Number((latestScores.reduce((sum, s) => sum + s.physicalHealth, 0) / latestScores.length).toFixed(1)),
      }
    : { mood: 0, stress: 0, sleep: 0, physicalHealth: 0 };

  // Members needing attention
  const membersNeedingAttention: {
    id: string;
    name: string;
    avatar: string | null;
    issue: 'RED_STATUS' | 'NO_CHECKIN';
    details: string;
  }[] = [];

  // RED status today
  for (const checkin of uniqueTodayCheckins) {
    if (checkin.readinessStatus === 'RED') {
      membersNeedingAttention.push({
        id: checkin.userId,
        name: `${checkin.user.firstName} ${checkin.user.lastName}`,
        avatar: checkin.user.avatar,
        issue: 'RED_STATUS',
        details: `Score: ${Math.round(checkin.readinessScore)}%${checkin.lowScoreReason ? `, ${REASON_LABELS[checkin.lowScoreReason] || checkin.lowScoreReason}` : ''}`,
      });
    }
  }

  // No check-in today (active members not on leave)
  for (const member of team.members) {
    if (!checkedInUserIds.has(member.id) && !onLeaveUserIds.includes(member.id)) {
      const lastCheckin = member.lastCheckinDate
        ? `Last: ${formatDisplayDate(new Date(member.lastCheckinDate), timezone)}`
        : 'Never checked in';
      membersNeedingAttention.push({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        avatar: member.avatar,
        issue: 'NO_CHECKIN',
        details: lastCheckin,
      });
    }
  }

  // Format members CURRENTLY on leave for response
  // Always show TODAY's active exemptions, regardless of selected period
  // "Currently On Leave" means TODAY, not during the historical period
  const membersOnLeaveFormatted = membersOnLeave.map((e) => ({
    id: e.userId,
    name: `${e.user.firstName} ${e.user.lastName}`,
    avatar: e.user.avatar,
    leaveType: e.type,
    startDate: e.startDate?.toISOString().split('T')[0],
    endDate: e.endDate?.toISOString().split('T')[0],
  }));

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      totalMembers,
      timezone,
      createdAt: team.createdAt.toISOString().split('T')[0],
    },
    period: {
      type: period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    teamGrade: teamGradeScore !== null
      ? {
          score: teamGradeScore,
          letter: teamGradeInfo!.letter,
          color: teamGradeInfo!.color,
          label: teamGradeInfo!.label,
          avgReadiness: Math.round(readinessForGrade),
          periodAvgReadiness,           // Period average readiness (from trendData)
          todayAvgReadiness: Math.round(todayAvgReadiness),
          compliance: periodCompliance, // Period compliance (used for grade calculation)
          todayCompliance: compliance,  // Today's compliance (for display)
          onboardingCount,              // Members with < 3 check-ins (not included in grade)
          includedMemberCount,          // Members included in grade calculation
        }
      : null,
    complianceDetails: period === 'today'
      ? {
          checkedIn: checkedInToday,
          activeMembers: activeMembers,
          onLeave: onLeaveUserIds.length,
          notCheckedIn: Math.max(0, activeMembers - (checkedInToday - onLeaveButCheckedIn.length)),
        }
      : {
          // For period views, show unique members who checked in during the period
          checkedIn: new Set(checkins.map((c) => c.userId)).size,
          activeMembers: totalMembers,
          onLeave: membersOnLeaveFormatted.length, // Members CURRENTLY on leave (today)
          notCheckedIn: Math.max(0, totalMembers - new Set(checkins.map((c) => c.userId)).size),
        },
    statusDistribution,
    trendData,
    topReasons,
    avgMetrics,
    membersNeedingAttention,
    membersOnLeave: membersOnLeaveFormatted,
  });
});

// ===========================================
// WORKER HEALTH REPORT (For Claim Validation)
// ===========================================

// GET /teams/members/:userId/health-report - Generate comprehensive health report for claim validation
// Accessible to: TEAM_LEAD (own team), SUPERVISOR, EXECUTIVE, ADMIN
teamsRoutes.get('/members/:userId/health-report', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const claimDateParam = c.req.query('claimDate'); // Optional: date of claim/incident
  const periodDays = parseInt(c.req.query('days') || '30'); // Baseline calculation period

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true, firstName: true, lastName: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view health reports for your own team members' }, 403);
    }
  }

  try {
    // Parse claim date if provided
    const claimDate = claimDateParam ? new Date(claimDateParam) : undefined;

    // Generate full health report
    const report = await generateWorkerHealthReport(memberId, claimDate, periodDays);

    // Log the report generation for audit
    await createSystemLog({
      companyId,
      userId: currentUser.id,
      action: 'VIEW_WORKER_HEALTH_REPORT',
      entityType: 'user',
      entityId: memberId,
      description: `${currentUser.firstName} ${currentUser.lastName} generated health report for ${member.firstName} ${member.lastName}${claimDate ? ` (claim date: ${claimDateParam})` : ''}`,
      metadata: {
        memberName: `${member.firstName} ${member.lastName}`,
        claimDate: claimDateParam || null,
        periodDays,
      },
    });

    return c.json(report);
  } catch (error) {
    console.error('Failed to generate health report:', error);
    return c.json({ error: 'Failed to generate health report' }, 500);
  }
});

// GET /teams/members/:userId/health-history - Get check-in history around a specific date
// Useful for validating claims by showing data before and after an incident
teamsRoutes.get('/members/:userId/health-history', async (c) => {
  const memberId = c.req.param('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const targetDateParam = c.req.query('targetDate'); // Required: date to center the history around
  const daysBefore = parseInt(c.req.query('daysBefore') || '7');
  const daysAfter = parseInt(c.req.query('daysAfter') || '3');

  if (!targetDateParam) {
    return c.json({ error: 'targetDate query parameter is required' }, 400);
  }

  // Verify member exists and belongs to company
  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId },
    select: { id: true, teamId: true, firstName: true, lastName: true },
  });

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Check permission: TL can only view own team members
  if (currentUser.role === 'TEAM_LEAD') {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUser.id, companyId, isActive: true },
    });
    if (!leaderTeam || member.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view health history for your own team members' }, 403);
    }
  }

  try {
    const targetDate = new Date(targetDateParam);
    const history = await getWorkerHistoryAroundDate(memberId, targetDate, daysBefore, daysAfter);

    return c.json({
      worker: {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
      },
      ...history,
    });
  } catch (error) {
    console.error('Failed to get health history:', error);
    return c.json({ error: 'Failed to get health history' }, 500);
  }
});

export { teamsRoutes };
