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
  countWorkDaysInRange,
  isSameDay,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import { calculatePerformanceScore } from '../../utils/attendance.js';

const teamsRoutes = new Hono<AppContext>();

// Helper: Get company timezone from context or default
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// GET /teams - List teams (company-scoped)
teamsRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');

  const teams = await prisma.team.findMany({
    where: { companyId, isActive: true },
    include: {
      _count: {
        select: { members: true },
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
    orderBy: { name: 'asc' },
  });

  return c.json({
    data: teams.map((team) => ({
      ...team,
      memberCount: team._count.members,
      _count: undefined,
    })),
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

  // Get member IDs to fetch additional stats
  const memberIds = team.members.map(m => m.id);

  // Get today's date range for leave check (timezone-aware)
  const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Run all queries in parallel for performance
  const [checkinCounts, membersWithStreaks, membersOnLeave] = await Promise.all([
    // Get check-in counts for each member
    prisma.checkin.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
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
        startDate: { lte: tomorrow },
        endDate: { gte: today }, // End date = last day of exemption (includes end date)
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
  const membersWithStats = team.members.map(member => {
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

  return c.json(team);
});

// GET /teams/:id/stats - Get team statistics
teamsRoutes.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');

  // Verify team exists
  const team = await prisma.team.findFirst({
    where: { id, companyId },
    include: {
      members: { where: { isActive: true }, select: { id: true } },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  const memberIds = team.members.map((m) => m.id);
  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';

  // Get company timezone (centralized)
  const timezone = await getCompanyTimezone(companyId);

  // Get today's date range (timezone-aware)
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  // Check if today is a work day for this team (timezone-aware)
  const isTodayWorkDay = isWorkDay(new Date(), teamWorkDays, timezone);

  // Get today's check-ins for team members
  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: today, lt: tomorrow },
    },
  });

  // Get members on approved leave TODAY (exemption is currently active)
  // End date = LAST DAY of exemption (not return date)
  // If exemption ends today → today is still exempted → tomorrow is first required check-in
  const membersOnLeave = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: today }, // Exemption has already started
      endDate: { gte: today },   // Exemption hasn't ended yet (includes end date as last day)
    },
    select: { userId: true },
  });
  const membersOnLeaveIds = new Set(membersOnLeave.map(e => e.userId));

  // Calculate expected members to check in (only if today is a work day, exclude those on leave)
  const expectedToCheckIn = isTodayWorkDay
    ? memberIds.length - membersOnLeaveIds.size
    : 0;

  // Count by status
  const greenCount = todayCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
  const yellowCount = todayCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
  const redCount = todayCheckins.filter((c) => c.readinessStatus === 'RED').length;

  // Get pending exceptions
  const pendingExceptions = await prisma.exception.count({
    where: {
      userId: { in: memberIds },
      status: 'PENDING',
    },
  });

  // Get open incidents
  const openIncidents = await prisma.incident.count({
    where: {
      teamId: id,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });

  return c.json({
    totalMembers: memberIds.length,
    checkedIn: todayCheckins.length,
    notCheckedIn: isTodayWorkDay ? Math.max(0, expectedToCheckIn - todayCheckins.length) : 0,
    isWorkDay: isTodayWorkDay,
    greenCount,
    yellowCount,
    redCount,
    pendingExceptions,
    openIncidents,
    checkinRate: expectedToCheckIn > 0
      ? Math.round((todayCheckins.length / expectedToCheckIn) * 100)
      : 0,
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

  // Validate leader exists and has appropriate role
  const leader = await prisma.user.findFirst({
    where: { id: body.leaderId, companyId, isActive: true },
  });

  if (!leader) {
    return c.json({ error: 'Invalid team leader' }, 400);
  }

  // Leader should be TEAM_LEAD, SUPERVISOR, or higher role
  if (!['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'EXECUTIVE'].includes(leader.role)) {
    return c.json({ error: 'Team leader must have Team Lead role or higher' }, 400);
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
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'TEAM_CREATED',
    entityType: 'team',
    entityId: team.id,
    description: `${currentUser.firstName} ${currentUser.lastName} created team "${body.name}" with leader ${leader.firstName} ${leader.lastName}`,
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
    const leader = await prisma.user.findFirst({
      where: { id: body.leaderId, companyId, isActive: true },
    });

    if (!leader) {
      return c.json({ error: 'Invalid team leader' }, 400);
    }

    // Leader should be TEAM_LEAD, SUPERVISOR, or higher role
    if (!['TEAM_LEAD', 'SUPERVISOR', 'ADMIN', 'EXECUTIVE'].includes(leader.role)) {
      return c.json({ error: 'Team leader must have Team Lead role or higher' }, 400);
    }
  }

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

  return c.json(team);
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

  // Allow EXECUTIVE, ADMIN, SUPERVISOR for any team
  // Allow TEAM_LEAD only for their own team
  const isTeamLeader = currentUser.role === 'TEAM_LEAD' && team.leaderId === currentUser.id;
  const hasPermission = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role) || isTeamLeader;

  if (!hasPermission) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: body.userId, companyId, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
  });

  if (!user) {
    return c.json({ error: 'User not found or not a worker/member role' }, 404);
  }

  await prisma.user.update({
    where: { id: body.userId },
    data: { teamId: id, teamJoinedAt: new Date() },
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
    totalCheckins,
    recentCheckins,
    exemptionsCount,
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
    // Total check-in count
    prisma.checkin.count({
      where: { userId: memberId },
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
      totalCheckins,
      attendanceScore,
      exemptionsCount,
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
  });

  if (!user) {
    return c.json({ error: 'User not found in this team' }, 404);
  }

  await prisma.user.update({
    where: { id: memberId },
    data: { teamId: null, teamJoinedAt: null },
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

// Helper: Get reason label
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

// GET /teams/my/analytics - Team analytics dashboard data
teamsRoutes.get('/my/analytics', async (c) => {
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const period = c.req.query('period') || 'today'; // today, 7days, 14days, 30days
  const customStart = c.req.query('startDate');
  const customEnd = c.req.query('endDate');

  // Get the team (for team leaders, get their team)
  const team = await prisma.team.findFirst({
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
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, teamJoinedAt: true, createdAt: true },
      },
      leader: {
        select: { id: true, firstName: true, lastName: true, avatar: true, lastCheckinDate: true, isActive: true },
      },
    },
  });

  if (!team) {
    return c.json({ error: 'No team found' }, 404);
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

  if (totalMembers === 0) {
    return c.json({
      team: { id: team.id, name: team.name, totalMembers: 0 },
      teamGrade: null,
      message: 'No active members in team',
    });
  }

  // Get members on approved leave TODAY (exemption is currently active)
  // End date = LAST DAY of exemption (not return date)
  // If exemption ends today → today is still exempted → tomorrow is first required check-in
  // Note: Check-ins that happened BEFORE the exemption started should still count
  const membersOnLeave = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: today }, // Exemption has already started
      endDate: { gte: today },   // Exemption hasn't ended yet (includes end date as last day)
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
  const memberAverages = memberAvgScores
    .filter((m) => m._avg.readinessScore !== null)
    .map((m) => ({ userId: m.userId, avgScore: m._avg.readinessScore!, checkinCount: m._count.id }));

  const teamAvgReadiness = memberAverages.length > 0
    ? memberAverages.reduce((sum, m) => sum + m.avgScore, 0) / memberAverages.length
    : 0;

  // Get all check-ins in period for team members (for trend data, reasons, etc.)
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
    include: {
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
    include: {
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

  // Get ALL exemptions for the period (to check per-day exemption status)
  const allExemptionsInPeriod = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      // Exemption overlaps with our period
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      userId: true,
      startDate: true,
      endDate: true,
    },
  });

  // Get last check-in before exemption started for each member
  // This will be used to include readiness scores for exempted members in the trend
  // For members with multiple exemptions, use the earliest exemption start date
  const exemptionStartDatesByUser = new Map<string, Date>();
  for (const exemption of allExemptionsInPeriod) {
    if (exemption.startDate) {
      const existing = exemptionStartDatesByUser.get(exemption.userId);
      if (!existing || exemption.startDate < existing) {
        exemptionStartDatesByUser.set(exemption.userId, exemption.startDate);
      }
    }
  }
  
  // Get last check-in before earliest exemption for each member (batch query)
  const lastCheckinsBeforeExemption = new Map<string, { readinessScore: number; createdAt: Date }>();
  for (const [userId, earliestExemptionStart] of exemptionStartDatesByUser.entries()) {
    const lastCheckin = await prisma.checkin.findFirst({
      where: {
        userId,
        companyId,
        createdAt: {
          lt: earliestExemptionStart, // Before earliest exemption started
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        readinessScore: true,
        createdAt: true,
      },
    });
    if (lastCheckin && lastCheckin.readinessScore !== null) {
      lastCheckinsBeforeExemption.set(userId, {
        readinessScore: lastCheckin.readinessScore,
        createdAt: lastCheckin.createdAt,
      });
    }
  }

  // Helper function to check if a user was on exemption on a specific date (timezone-aware)
  // IMPORTANT: End date = LAST DAY of exemption (not return date)
  // - If exemption ends Jan 6 → Jan 6 is still exempted → Jan 7 is first required check-in
  // - This is more intuitive and forgiving for workers returning from leave
  const wasOnExemptionOnDate = (userId: string, date: Date): boolean => {
    const dateOnly = getStartOfDay(date, timezone);

    return allExemptionsInPeriod.some((exemption) => {
      if (exemption.userId !== userId) return false;
      const exemptStart = exemption.startDate ? getStartOfDay(exemption.startDate, timezone) : null;
      const exemptEnd = exemption.endDate ? getStartOfDay(exemption.endDate, timezone) : null;

      // Check if date falls within exemption period (INCLUSIVE of both start and end dates)
      const afterStart = !exemptStart || dateOnly >= exemptStart;
      const beforeEnd = !exemptEnd || dateOnly <= exemptEnd; // Include end date

      return afterStart && beforeEnd;
    });
  };

  // Helper function to check if a user was on exemption on a specific date FOR DISPLAY/COUNTING PURPOSES
  // Note: Now same as wasOnExemptionOnDate since end date = last day of exemption
  const wasOnExemptionOnDateForDisplay = (userId: string, date: Date): boolean => {
    const dateOnly = getStartOfDay(date, timezone);

    return allExemptionsInPeriod.some((exemption) => {
      if (exemption.userId !== userId) return false;
      const exemptStart = exemption.startDate ? getStartOfDay(exemption.startDate, timezone) : null;
      const exemptEnd = exemption.endDate ? getStartOfDay(exemption.endDate, timezone) : null;

      // Check if date falls within exemption period (INCLUSIVE of both start and end dates)
      const afterStart = !exemptStart || dateOnly >= exemptStart;
      const beforeEnd = !exemptEnd || dateOnly <= exemptEnd;
      
      return afterStart && beforeEnd;
    });
  };

  // Trend data (daily averages for period)
  // compliance is null when all members are on exemption (no one expected to check in)
  const trendData: { date: string; score: number | null; compliance: number | null; checkedIn: number; onExemption: number; hasData: boolean }[] = [];

  if (period !== 'today') {
    const dayMs = 24 * 60 * 60 * 1000;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Use timezone-aware start/end of day
      const dayStart = getStartOfDay(currentDate, timezone);
      const dayEnd = getEndOfDay(currentDate, timezone);

      // Check if it's a work day
      const dayOfWeek = currentDate.getDay();
      const dayMap: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };
      const isWorkDay = team.workDays.includes(dayMap[dayOfWeek]);

      if (isWorkDay) {
        const dayCheckins = checkins.filter((c) => {
          const d = new Date(c.createdAt);
          return d >= dayStart && d <= dayEnd;
        });

        // Get LATEST check-in per user (not just first one)
        // IMPORTANT: Even if user is on exemption, their latest check-in on that day should count
        const dayCheckinsByUser = new Map<string, typeof dayCheckins[0]>();
        for (const checkin of dayCheckins) {
          const existing = dayCheckinsByUser.get(checkin.userId);
          if (!existing || new Date(checkin.createdAt) > new Date(existing.createdAt)) {
            dayCheckinsByUser.set(checkin.userId, checkin);
          }
        }
        const uniqueDayCheckins = Array.from(dayCheckinsByUser.values());
        const dayCheckedInUserIds = new Set(uniqueDayCheckins.map((c) => c.userId));

        // Calculate who was EXPECTED to check in on this specific day:
        // Expected = members who:
        //   1. Were in the team on that day (not joined later)
        //   2. Were NOT on exemption that day (exemptions are completely excluded from expected)
        //   3. Should have checked in (whether they did or not)
        const expectedMembers = memberIds.filter((memberId) => {
          // Get member info to check teamJoinedAt
          const member = team.members.find(m => m.id === memberId);
          if (!member) return false;
          
          // Check if member was in team on this date (use teamJoinedAt or createdAt)
          const memberJoinDate = member.teamJoinedAt 
            ? getStartOfDay(member.teamJoinedAt, timezone)
            : getStartOfDay(new Date(member.createdAt || team.createdAt), timezone);
          const dayStart = getStartOfDay(currentDate, timezone);
          
          // If member joined after this day, they're not expected
          if (memberJoinDate > dayStart) return false;
          
          // IMPORTANT: If member is on exemption on this day, exclude them from expected
          // BUT their check-in (if they checked in) should still count (see below)
          if (wasOnExemptionOnDate(memberId, currentDate)) return false;
          
          // Member was in team and not on exemption - they're expected to check in
          return true;
        });
        
        // Find members on exemption who ALSO checked in on this day
        // They fulfilled their duty before/during exemption, so they should be counted
        const exemptedButCheckedIn = memberIds.filter((memberId) => {
          // Must be on exemption AND have checked in
          if (!wasOnExemptionOnDate(memberId, currentDate)) return false;
          if (!dayCheckedInUserIds.has(memberId)) return false;

          // Check if member was in team on this date
          const member = team.members.find(m => m.id === memberId);
          if (!member) return false;

          const memberJoinDate = member.teamJoinedAt
            ? getStartOfDay(member.teamJoinedAt, timezone)
            : getStartOfDay(new Date(member.createdAt || team.createdAt), timezone);
          const dayStart = getStartOfDay(currentDate, timezone);

          if (memberJoinDate > dayStart) return false;

          return true;
        });

        // Count who actually checked in
        // Include check-ins from expected members + exempted members who checked in
        const expectedCheckedIn = expectedMembers.filter(memberId =>
          dayCheckedInUserIds.has(memberId)
        ).length;
        const checkedInCount = expectedCheckedIn + exemptedButCheckedIn.length;

        // For valid check-ins: Include ALL check-ins from the day (even from exempted members)
        // This ensures we get the latest check-in data for readiness scores
        // But for compliance calculation, we only count expected members who checked in
        const validDayCheckins = uniqueDayCheckins; // Include all check-ins (even from exempted members)

        // Build readiness scores array:
        // 1. Include actual check-ins from the day
        // 2. For members on exemption who didn't check in, use their last known readiness score
        const dayScores: number[] = [];
        
        // Add scores from actual check-ins
        for (const checkin of validDayCheckins) {
          if (checkin.readinessScore !== null) {
            dayScores.push(checkin.readinessScore);
          }
        }
        
        // For members on exemption who didn't check in, use their last known readiness score
        // Use display version to include end date in exemption period
        for (const memberId of memberIds) {
          // Check if member was in team on this date
          const member = team.members.find(m => m.id === memberId);
          if (!member) continue;
          
          const memberJoinDate = member.teamJoinedAt 
            ? getStartOfDay(member.teamJoinedAt, timezone)
            : getStartOfDay(new Date(member.createdAt || team.createdAt), timezone);
          const dayStart = getStartOfDay(currentDate, timezone);
          
          // If member joined after this day, skip
          if (memberJoinDate > dayStart) continue;
          
          // If member is on exemption and didn't check in, use last known score
          // Use display version to include end date (Jan 6 should show exemption)
          if (wasOnExemptionOnDateForDisplay(memberId, currentDate) && !dayCheckedInUserIds.has(memberId)) {
            const lastScore = lastCheckinsBeforeExemption.get(memberId);
            if (lastScore) {
              dayScores.push(lastScore.readinessScore);
            }
          }
        }
        
        const dayAvg = dayScores.length > 0
          ? dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length
          : null;

        // Count members on exemption for this day (FOR DISPLAY - includes end date)
        const exemptedCount = memberIds.filter((memberId) => {
          // Get member info to check teamJoinedAt
          const member = team.members.find(m => m.id === memberId);
          if (!member) return false;
          
          // Check if member was in team on this date
          const memberJoinDate = member.teamJoinedAt 
            ? getStartOfDay(member.teamJoinedAt, timezone)
            : getStartOfDay(new Date(member.createdAt || team.createdAt), timezone);
          const dayStart = getStartOfDay(currentDate, timezone);
          
          // If member joined after this day, they're not counted
          if (memberJoinDate > dayStart) return false;
          
          // Count if they're on exemption (use display function to include end date)
          return wasOnExemptionOnDateForDisplay(memberId, currentDate);
        }).length;

        // Compliance: checked in / expected, cap at 100%
        // Expected = regular expected members + exempted members who checked in
        // This ensures exempted workers who check in are counted in both numerator and denominator
        const dayExpected = expectedMembers.length + exemptedButCheckedIn.length;
        // If no one expected (all on exemption), compliance is null - skip this day in average
        const dayCompliance = dayExpected > 0
          ? Math.min(100, Math.round((checkedInCount / dayExpected) * 100))
          : null;

        trendData.push({
          date: formatLocalDate(currentDate, timezone),
          score: dayAvg !== null ? Math.round(dayAvg) : null,
          compliance: dayCompliance,
          checkedIn: checkedInCount, // Includes exempted members who checked in
          onExemption: exemptedCount, // Count of members on exemption for this day
          hasData: validDayCheckins.length > 0,
        });
      }

      currentDate.setTime(currentDate.getTime() + dayMs);
    }
  }

  // Calculate PERIOD averages from trendData (average of all work days with data)
  // For 'today' period, use today's values
  const trendDataWithScores = trendData.filter(d => d.score !== null);

  const periodAvgReadiness = period !== 'today' && trendDataWithScores.length > 0
    ? Math.round(trendDataWithScores.reduce((sum, d) => sum + d.score!, 0) / trendDataWithScores.length)
    : Math.round(todayAvgReadiness);

  // Filter out days where compliance is null (all members on exemption)
  const trendDataWithCompliance = trendData.filter(d => d.compliance !== null);
  const periodCompliance = period !== 'today' && trendDataWithCompliance.length > 0
    ? Math.round(trendDataWithCompliance.reduce((sum, d) => sum + d.compliance!, 0) / trendDataWithCompliance.length)
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

  // Top reasons (from period, where lowScoreReason is not null)
  const reasonCounts = new Map<string, number>();
  for (const checkin of checkins) {
    if (checkin.lowScoreReason) {
      reasonCounts.set(checkin.lowScoreReason, (reasonCounts.get(checkin.lowScoreReason) || 0) + 1);
    }
  }

  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({
      reason,
      label: REASON_LABELS[reason] || reason,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Average metrics (from period)
  const allScores = checkins.map((c) => ({
    mood: c.mood,
    stress: c.stress,
    sleep: c.sleep,
    physicalHealth: c.physicalHealth,
  }));

  const avgMetrics = allScores.length > 0
    ? {
        mood: Number((allScores.reduce((sum, s) => sum + s.mood, 0) / allScores.length).toFixed(1)),
        stress: Number((allScores.reduce((sum, s) => sum + s.stress, 0) / allScores.length).toFixed(1)),
        sleep: Number((allScores.reduce((sum, s) => sum + s.sleep, 0) / allScores.length).toFixed(1)),
        physicalHealth: Number((allScores.reduce((sum, s) => sum + s.physicalHealth, 0) / allScores.length).toFixed(1)),
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

  // Format members on leave for response
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
          onLeave: onLeaveUserIds.length, // Currently on leave
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

export { teamsRoutes };
