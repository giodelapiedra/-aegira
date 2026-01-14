/**
 * Daily Monitoring Module
 * Provides comprehensive data for Team Leader's daily monitoring dashboard
 *
 * Includes:
 * - Today's check-ins with metrics
 * - Sudden change detection (comparison with 7-day average)
 * - Pending exemption requests
 * - Active exemptions
 */

import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import {
  getTodayRange,
  getLastNDaysRange,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import { parsePagination } from '../../utils/validator.js';

const dailyMonitoringRoutes = new Hono<AppContext>();

// Helper: Get company timezone
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// ============================================
// TYPES
// ============================================

interface SuddenChange {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  todayScore: number;
  todayStatus: string;
  averageScore: number;
  change: number; // Negative = drop
  severity: 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE' | 'MINOR';
  checkinId: string;
  checkinTime: Date;
}

/** Team data with active members */
interface TeamWithMembers {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  members: { id: string }[];
}

/** Result of team lookup - either success with team or error */
type TeamLookupResult =
  | { success: true; team: TeamWithMembers; memberIds: string[] }
  | { success: false; error: string; code?: string; status: number };

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate sudden change severity based on score drop
 */
function getSeverity(change: number): SuddenChange['severity'] {
  if (change <= -30) return 'CRITICAL';
  if (change <= -20) return 'SIGNIFICANT';
  if (change <= -10) return 'NOTABLE';
  return 'MINOR';
}

/** Team select fields - reused across queries */
const TEAM_SELECT = {
  id: true,
  name: true,
  workDays: true,
  shiftStart: true,
  shiftEnd: true,
  members: {
    where: { isActive: true },
    select: { id: true },
  },
} as const;

/**
 * Get team for a user based on their role.
 *
 * Role-based access:
 * - EXECUTIVE/ADMIN/SUPERVISOR: Can view any team (use requestedTeamId or first available)
 * - TEAM_LEAD: Their assigned team or team they lead
 * - Other roles: Their assigned team only
 *
 * @param userId - Current user ID
 * @param companyId - Company ID for scoping
 * @param requestedTeamId - Optional team ID for higher roles
 * @returns TeamLookupResult - Success with team data or error details
 */
async function getTeamForUser(
  userId: string,
  companyId: string,
  requestedTeamId?: string
): Promise<TeamLookupResult> {
  // Get user with role and team assignment
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      teamId: true,
      team: { select: TEAM_SELECT },
    },
  });

  if (!user) {
    return { success: false, error: 'User not found', status: 404 };
  }

  const higherRoles = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'];
  let team: TeamWithMembers | null = null;

  if (higherRoles.includes(user.role)) {
    // Higher roles can view any team
    if (requestedTeamId) {
      team = await prisma.team.findFirst({
        where: { id: requestedTeamId, companyId },
        select: TEAM_SELECT,
      });
    } else {
      // Get first available team
      team = await prisma.team.findFirst({
        where: { companyId, isActive: true },
        select: TEAM_SELECT,
        orderBy: { name: 'asc' },
      });
    }

    if (!team) {
      return { success: false, error: 'No teams found in your company', status: 400 };
    }
  } else if (user.role === 'TEAM_LEAD') {
    // Team leads: check assigned team first, then team they lead
    if (user.team) {
      team = user.team;
    } else {
      team = await prisma.team.findFirst({
        where: { leaderId: userId, companyId, isActive: true },
        select: TEAM_SELECT,
      });
    }

    if (!team) {
      return {
        success: false,
        error: 'You are not assigned to lead any team',
        code: 'NO_TEAM_ASSIGNMENT',
        status: 400,
      };
    }
  } else {
    // Other roles: must have assigned team
    if (!user.team) {
      return { success: false, error: 'You are not assigned to a team', status: 400 };
    }
    team = user.team;
  }

  return {
    success: true,
    team,
    memberIds: team.members.map((m) => m.id),
  };
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /daily-monitoring - Get complete daily monitoring data
 * Query params:
 *   - teamId: Optional team ID for EXECUTIVE/ADMIN/SUPERVISOR roles
 */
dailyMonitoringRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          workDays: true,
          shiftStart: true,
          shiftEnd: true,
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Determine which team to use based on role
  let team;
  const higherRoles = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'];

  if (higherRoles.includes(user.role)) {
    // Higher roles can view any team (or use teamId query param)
    if (requestedTeamId) {
      team = await prisma.team.findFirst({
        where: { id: requestedTeamId, companyId },
        select: {
          id: true,
          name: true,
          workDays: true,
          shiftStart: true,
          shiftEnd: true,
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      });
    } else {
      // Get first available team for the company
      team = await prisma.team.findFirst({
        where: { companyId, isActive: true },
        select: {
          id: true,
          name: true,
          workDays: true,
          shiftStart: true,
          shiftEnd: true,
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    if (!team) {
      return c.json({ error: 'No teams found in your company' }, 400);
    }
  } else if (user.role === 'TEAM_LEAD') {
    // Team leads - first check if they have a team assignment
    if (user.team) {
      team = user.team;
    } else {
      // Try to find a team where this user is the leader
      team = await prisma.team.findFirst({
        where: { leaderId: userId, companyId, isActive: true },
        select: {
          id: true,
          name: true,
          workDays: true,
          shiftStart: true,
          shiftEnd: true,
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      });
    }

    if (!team) {
      return c.json({
        error: 'You are not assigned to lead any team',
        code: 'NO_TEAM_ASSIGNMENT'
      }, 400);
    }
  } else {
    // Other roles must have their own team
    if (!user.team) {
      return c.json({ error: 'You are not assigned to a team' }, 400);
    }
    team = user.team;
  }

  const teamId = team.id;
  const memberIds = team.members.map(m => m.id);

  // Get company timezone (centralized)
  const timezone = await getCompanyTimezone(companyId);

  // Get date ranges (timezone-aware)
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const { start: sevenDaysAgo } = getLastNDaysRange(7, timezone);

  // Check if today is a company holiday
  const todayHoliday = await prisma.holiday.findFirst({
    where: {
      companyId,
      date: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    select: { name: true },
  });

  // Fetch all data in parallel
  const [
    todayCheckins,
    historicalCheckins,
    pendingExemptions,
    activeExemptions,
  ] = await Promise.all([
    // Today's check-ins for team members
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            currentStreak: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Historical check-ins (last 7 days, excluding today)
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: {
          gte: sevenDaysAgo,
          lt: todayStart,
        },
      },
      select: {
        userId: true,
        readinessScore: true,
      },
    }),

    // Pending exemptions for team
    prisma.exception.findMany({
      where: {
        companyId,
        isExemption: true,
        status: 'PENDING',
        user: { teamId },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        triggeredByCheckin: {
          select: {
            id: true,
            mood: true,
            stress: true,
            sleep: true,
            physicalHealth: true,
            readinessScore: true,
            readinessStatus: true,
            notes: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Active exemptions for team (currently active today)
    // End date = LAST DAY of exemption (not return date)
    // If exemption ends today → today is still exempted → tomorrow is first required check-in
    prisma.exception.findMany({
      where: {
        companyId,
        isExemption: true,
        status: 'APPROVED',
        user: { teamId },
        startDate: { lte: todayStart }, // Exemption has already started
        endDate: { gte: todayStart },   // Exemption hasn't ended yet (includes end date)
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
  ]);

  // Fetch exemptions linked to today's check-ins
  const checkinIds = todayCheckins.map(c => c.id);
  const exemptionsForCheckins = checkinIds.length > 0
    ? await prisma.exception.findMany({
        where: {
          companyId,
          triggeredByCheckinId: { in: checkinIds },
        },
        select: {
          id: true,
          status: true,
          triggeredByCheckinId: true,
        },
      })
    : [];

  // Create a map of checkinId -> exemption
  const exemptionMap = new Map<string, typeof exemptionsForCheckins[0]>();
  for (const exemption of exemptionsForCheckins) {
    if (exemption.triggeredByCheckinId) {
      exemptionMap.set(exemption.triggeredByCheckinId, exemption);
    }
  }

  // Calculate user averages from historical data
  const userAverages = new Map<string, { sum: number; count: number }>();
  for (const checkin of historicalCheckins) {
    const existing = userAverages.get(checkin.userId) || { sum: 0, count: 0 };
    existing.sum += checkin.readinessScore;
    existing.count += 1;
    userAverages.set(checkin.userId, existing);
  }

  // Detect sudden changes
  const suddenChanges: SuddenChange[] = [];
  for (const checkin of todayCheckins) {
    const avgData = userAverages.get(checkin.userId);
    if (!avgData || avgData.count < 3) continue; // Need at least 3 days of data

    const average = avgData.sum / avgData.count;
    const change = checkin.readinessScore - average;

    // Only track drops of 10+ points
    if (change <= -10) {
      suddenChanges.push({
        userId: checkin.userId,
        firstName: checkin.user.firstName,
        lastName: checkin.user.lastName,
        email: checkin.user.email,
        todayScore: Math.round(checkin.readinessScore),
        todayStatus: checkin.readinessStatus,
        averageScore: Math.round(average),
        change: Math.round(change),
        severity: getSeverity(change),
        checkinId: checkin.id,
        checkinTime: checkin.createdAt,
      });
    }
  }

  // Sort sudden changes by severity (CRITICAL first)
  const severityOrder = { CRITICAL: 0, SIGNIFICANT: 1, NOTABLE: 2, MINOR: 3 };
  suddenChanges.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate stats
  const checkedInUserIds = new Set(todayCheckins.map(c => c.userId));
  const onLeaveUserIds = new Set(activeExemptions.map(e => e.user.id));

  // Active members = total - on leave
  const activeMembers = memberIds.length - onLeaveUserIds.size;

  // Not checked in = active members who haven't checked in (exclude those on leave)
  // If today is a holiday, nobody is required to check in
  const notCheckedInCount = todayHoliday ? 0 : memberIds.filter(
    id => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)
  ).length;

  const stats = {
    totalMembers: memberIds.length,
    activeMembers: todayHoliday ? 0 : activeMembers, // No active members on holiday
    onLeave: onLeaveUserIds.size,
    checkedIn: checkedInUserIds.size,
    notCheckedIn: notCheckedInCount,
    greenCount: todayCheckins.filter(c => c.readinessStatus === 'GREEN').length,
    yellowCount: todayCheckins.filter(c => c.readinessStatus === 'YELLOW').length,
    redCount: todayCheckins.filter(c => c.readinessStatus === 'RED').length,
    pendingExemptions: pendingExemptions.length,
    activeExemptions: activeExemptions.length,
    suddenChanges: suddenChanges.length,
    criticalChanges: suddenChanges.filter(c => c.severity === 'CRITICAL').length,
    isHoliday: !!todayHoliday,
    holidayName: todayHoliday?.name || null,
  };

  // Format today's check-ins with additional data
  const formattedCheckins = todayCheckins.map(checkin => {
    const avgData = userAverages.get(checkin.userId);
    const average = avgData ? avgData.sum / avgData.count : null;
    const change = average ? checkin.readinessScore - average : null;

    return {
      id: checkin.id,
      userId: checkin.userId,
      user: checkin.user,
      mood: checkin.mood,
      stress: checkin.stress,
      sleep: checkin.sleep,
      physicalHealth: checkin.physicalHealth,
      readinessScore: Math.round(checkin.readinessScore),
      readinessStatus: checkin.readinessStatus,
      createdAt: checkin.createdAt,
      // Low score reason (for RED status)
      lowScoreReason: checkin.lowScoreReason,
      lowScoreDetails: checkin.lowScoreDetails,
      // Additional analytics
      averageScore: average ? Math.round(average) : null,
      changeFromAverage: change ? Math.round(change) : null,
      hasExemptionRequest: exemptionMap.has(checkin.id),
      exemptionStatus: exemptionMap.get(checkin.id)?.status || null,
    };
  });

  // Get members who haven't checked in (exclude those on leave)
  // On holidays, no one is considered "not checked in"
  let notCheckedInMembers: { id: string; firstName: string; lastName: string; email: string; avatar: string | null }[] = [];

  if (!todayHoliday) {
    const notCheckedInMemberIds = memberIds.filter(
      id => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)
    );
    notCheckedInMembers = await prisma.user.findMany({
      where: {
        id: { in: notCheckedInMemberIds },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    });
  }

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      workDays: team.workDays,
      shiftStart: team.shiftStart,
      shiftEnd: team.shiftEnd,
      timezone,
    },
    stats,
    todayCheckins: formattedCheckins,
    notCheckedInMembers,
    suddenChanges,
    pendingExemptions,
    activeExemptions,
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /daily-monitoring/stats - Get lightweight stats only (no full data arrays)
 *
 * This is the fast endpoint for initial page load.
 * Returns counts only, not full records.
 *
 * Query params:
 *   - teamId: Optional team ID for EXECUTIVE/ADMIN/SUPERVISOR roles
 */
dailyMonitoringRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');

  // Get team using helper
  const teamResult = await getTeamForUser(userId, companyId, requestedTeamId);
  if (!teamResult.success) {
    return c.json(
      { error: teamResult.error, code: teamResult.code },
      teamResult.status as 400 | 404
    );
  }

  const { team, memberIds } = teamResult;
  const teamId = team.id;

  // Get timezone and date range
  const timezone = await getCompanyTimezone(companyId);
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const { start: sevenDaysAgo } = getLastNDaysRange(7, timezone);

  // Efficient parallel COUNT queries (not fetching full records)
  const [
    todayHoliday,
    checkedInCount,
    greenCount,
    yellowCount,
    redCount,
    pendingExemptionsCount,
    activeExemptions,
    historicalCheckins,
    todayCheckins,
  ] = await Promise.all([
    // Check if today is a holiday
    prisma.holiday.findFirst({
      where: {
        companyId,
        date: { gte: todayStart, lt: todayEnd },
      },
      select: { name: true },
    }),

    // Total checked in today
    prisma.checkin.count({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
      },
    }),

    // GREEN count
    prisma.checkin.count({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
        readinessStatus: 'GREEN',
      },
    }),

    // YELLOW count
    prisma.checkin.count({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
        readinessStatus: 'YELLOW',
      },
    }),

    // RED count
    prisma.checkin.count({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
        readinessStatus: 'RED',
      },
    }),

    // Pending exemptions count
    prisma.exception.count({
      where: {
        companyId,
        isExemption: true,
        status: 'PENDING',
        user: { teamId },
      },
    }),

    // Active exemptions (need user IDs for on-leave calculation)
    prisma.exception.findMany({
      where: {
        companyId,
        isExemption: true,
        status: 'APPROVED',
        user: { teamId },
        startDate: { lte: todayStart },
        endDate: { gte: todayStart },
      },
      select: { userId: true },
    }),

    // Historical check-ins for sudden change detection (last 7 days)
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: sevenDaysAgo, lt: todayStart },
      },
      select: { userId: true, readinessScore: true },
    }),

    // Today's check-ins for sudden change detection
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
      },
      select: { userId: true, readinessScore: true },
    }),
  ]);

  // Calculate on-leave users
  const onLeaveUserIds = new Set(activeExemptions.map((e) => e.userId));

  // Calculate user averages for sudden change detection
  const userAverages = new Map<string, { sum: number; count: number }>();
  for (const checkin of historicalCheckins) {
    const existing = userAverages.get(checkin.userId) || { sum: 0, count: 0 };
    existing.sum += checkin.readinessScore;
    existing.count += 1;
    userAverages.set(checkin.userId, existing);
  }

  // Count sudden changes
  let suddenChangesCount = 0;
  let criticalChangesCount = 0;
  for (const checkin of todayCheckins) {
    const avgData = userAverages.get(checkin.userId);
    if (!avgData || avgData.count < 3) continue;

    const average = avgData.sum / avgData.count;
    const change = checkin.readinessScore - average;

    if (change <= -10) {
      suddenChangesCount++;
      if (change <= -30) criticalChangesCount++;
    }
  }

  // Calculate active members and not checked in
  const activeMembers = memberIds.length - onLeaveUserIds.size;
  const checkedInUserIds = new Set(todayCheckins.map((c) => c.userId));
  const notCheckedInCount = todayHoliday
    ? 0
    : memberIds.filter((id) => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)).length;

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      workDays: team.workDays,
      shiftStart: team.shiftStart,
      shiftEnd: team.shiftEnd,
      timezone,
    },
    stats: {
      totalMembers: memberIds.length,
      activeMembers: todayHoliday ? 0 : activeMembers,
      onLeave: onLeaveUserIds.size,
      checkedIn: checkedInCount,
      notCheckedIn: notCheckedInCount,
      greenCount,
      yellowCount,
      redCount,
      pendingExemptions: pendingExemptionsCount,
      activeExemptions: activeExemptions.length,
      suddenChanges: suddenChangesCount,
      criticalChanges: criticalChangesCount,
      isHoliday: !!todayHoliday,
      holidayName: todayHoliday?.name || null,
    },
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /daily-monitoring/checkins - Get paginated today's check-ins
 *
 * Query params:
 *   - teamId: Optional team ID for higher roles
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 100)
 *   - search: Search by name or email
 *   - status: Filter by readiness status (GREEN, YELLOW, RED)
 */
dailyMonitoringRoutes.get('/checkins', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');
  const { page, limit, skip } = parsePagination(c);
  const search = c.req.query('search')?.toLowerCase();
  const statusFilter = c.req.query('status') as 'GREEN' | 'YELLOW' | 'RED' | undefined;

  // Get team using helper
  const teamResult = await getTeamForUser(userId, companyId, requestedTeamId);
  if (!teamResult.success) {
    return c.json(
      { error: teamResult.error, code: teamResult.code },
      teamResult.status as 400 | 404
    );
  }

  const { team, memberIds } = teamResult;

  // Get timezone and date ranges
  const timezone = await getCompanyTimezone(companyId);
  const { start: todayStart } = getTodayRange(timezone);
  const { start: sevenDaysAgo } = getLastNDaysRange(7, timezone);

  // Build where clause
  const baseWhere = {
    companyId,
    userId: { in: memberIds },
    createdAt: { gte: todayStart },
  };

  // Add status filter if provided
  const whereWithStatus = statusFilter
    ? { ...baseWhere, readinessStatus: statusFilter }
    : baseWhere;

  // Get historical data for averages (needed for analytics)
  const historicalCheckins = await prisma.checkin.findMany({
    where: {
      companyId,
      userId: { in: memberIds },
      createdAt: { gte: sevenDaysAgo, lt: todayStart },
    },
    select: { userId: true, readinessScore: true },
  });

  // Calculate user averages
  const userAverages = new Map<string, { sum: number; count: number }>();
  for (const checkin of historicalCheckins) {
    const existing = userAverages.get(checkin.userId) || { sum: 0, count: 0 };
    existing.sum += checkin.readinessScore;
    existing.count += 1;
    userAverages.set(checkin.userId, existing);
  }

  // Fetch check-ins with user data
  let allCheckins = await prisma.checkin.findMany({
    where: whereWithStatus,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          currentStreak: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Apply search filter (in-memory for name/email search)
  if (search) {
    allCheckins = allCheckins.filter(
      (c) =>
        c.user.firstName.toLowerCase().includes(search) ||
        c.user.lastName.toLowerCase().includes(search) ||
        c.user.email.toLowerCase().includes(search)
    );
  }

  // Get exemptions linked to check-ins
  const checkinIds = allCheckins.map((c) => c.id);
  const exemptionsForCheckins =
    checkinIds.length > 0
      ? await prisma.exception.findMany({
          where: {
            companyId,
            triggeredByCheckinId: { in: checkinIds },
          },
          select: {
            id: true,
            status: true,
            triggeredByCheckinId: true,
          },
        })
      : [];

  const exemptionMap = new Map<string, (typeof exemptionsForCheckins)[0]>();
  for (const ex of exemptionsForCheckins) {
    if (ex.triggeredByCheckinId) {
      exemptionMap.set(ex.triggeredByCheckinId, ex);
    }
  }

  // Calculate total and apply pagination
  const total = allCheckins.length;
  const paginatedCheckins = allCheckins.slice(skip, skip + limit);

  // Format check-ins with analytics
  const data = paginatedCheckins.map((checkin) => {
    const avgData = userAverages.get(checkin.userId);
    const average = avgData && avgData.count >= 3 ? avgData.sum / avgData.count : null;
    const change = average !== null ? checkin.readinessScore - average : null;

    return {
      id: checkin.id,
      userId: checkin.userId,
      user: checkin.user,
      mood: checkin.mood,
      stress: checkin.stress,
      sleep: checkin.sleep,
      physicalHealth: checkin.physicalHealth,
      readinessScore: Math.round(checkin.readinessScore),
      readinessStatus: checkin.readinessStatus,
      createdAt: checkin.createdAt,
      lowScoreReason: checkin.lowScoreReason,
      lowScoreDetails: checkin.lowScoreDetails,
      // Analytics
      averageScore: average !== null ? Math.round(average) : null,
      changeFromAverage: change !== null ? Math.round(change) : null,
      hasExemptionRequest: exemptionMap.has(checkin.id),
      exemptionStatus: exemptionMap.get(checkin.id)?.status || null,
    };
  });

  return c.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /daily-monitoring/not-checked-in - Get paginated members who haven't checked in
 *
 * Excludes:
 * - Members who have already checked in today
 * - Members on approved leave (active exemption)
 * - On holidays, returns empty (nobody required to check in)
 *
 * Query params:
 *   - teamId: Optional team ID for higher roles
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 100)
 *   - search: Search by name or email
 */
dailyMonitoringRoutes.get('/not-checked-in', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');
  const { page, limit, skip } = parsePagination(c);
  const search = c.req.query('search')?.toLowerCase();

  // Get team using helper
  const teamResult = await getTeamForUser(userId, companyId, requestedTeamId);
  if (!teamResult.success) {
    return c.json(
      { error: teamResult.error, code: teamResult.code },
      teamResult.status as 400 | 404
    );
  }

  const { team, memberIds } = teamResult;
  const teamId = team.id;

  // Get timezone and date range
  const timezone = await getCompanyTimezone(companyId);
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

  // Check if today is a holiday
  const todayHoliday = await prisma.holiday.findFirst({
    where: {
      companyId,
      date: { gte: todayStart, lt: todayEnd },
    },
    select: { name: true },
  });

  // On holidays, nobody is required to check in
  if (todayHoliday) {
    return c.json({
      data: [],
      pagination: { page: 1, limit, total: 0, totalPages: 0 },
      isHoliday: true,
      holidayName: todayHoliday.name,
    });
  }

  // Get checked-in user IDs and on-leave user IDs in parallel
  const [todayCheckins, activeExemptions] = await Promise.all([
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
      },
      select: { userId: true },
    }),
    prisma.exception.findMany({
      where: {
        companyId,
        isExemption: true,
        status: 'APPROVED', // Only APPROVED exemptions = on leave
        user: { teamId },
        startDate: { lte: todayStart },
        endDate: { gte: todayStart },
      },
      select: { userId: true },
    }),
  ]);

  const checkedInUserIds = new Set(todayCheckins.map((c) => c.userId));
  const onLeaveUserIds = new Set(activeExemptions.map((e) => e.userId));

  // Filter members who haven't checked in and are not on leave
  const notCheckedInMemberIds = memberIds.filter(
    (id) => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)
  );

  // Fetch member details
  let members = await prisma.user.findMany({
    where: {
      id: { in: notCheckedInMemberIds },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  // Apply search filter
  if (search) {
    members = members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(search) ||
        m.lastName.toLowerCase().includes(search) ||
        m.email.toLowerCase().includes(search)
    );
  }

  // Apply pagination
  const total = members.length;
  const paginatedMembers = members.slice(skip, skip + limit);

  return c.json({
    data: paginatedMembers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    isHoliday: false,
  });
});

/**
 * GET /daily-monitoring/teams - Get available teams for selection
 * Only for EXECUTIVE/ADMIN/SUPERVISOR roles
 */
dailyMonitoringRoutes.get('/teams', async (c) => {
  const companyId = c.get('companyId');

  const teams = await prisma.team.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      memberCount: true, // Use pre-computed field
    },
    orderBy: { name: 'asc' },
  });

  return c.json(teams);
});

/**
 * GET /daily-monitoring/sudden-changes - Get paginated sudden changes
 *
 * Query params:
 *   - teamId: Optional team ID for higher roles
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20, max: 100)
 *   - minDrop: Minimum score drop to include (default: 10)
 *   - severity: Filter by severity (CRITICAL, SIGNIFICANT, NOTABLE, MINOR)
 */
dailyMonitoringRoutes.get('/sudden-changes', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');
  const { page, limit, skip } = parsePagination(c);
  const minDrop = parseInt(c.req.query('minDrop') || '10');
  const severityFilter = c.req.query('severity') as SuddenChange['severity'] | undefined;

  // Get team using helper
  const teamResult = await getTeamForUser(userId, companyId, requestedTeamId);
  if (!teamResult.success) {
    return c.json(
      { error: teamResult.error, code: teamResult.code },
      teamResult.status as 400 | 404
    );
  }

  const { memberIds } = teamResult;

  // Get company timezone and date ranges
  const timezone = await getCompanyTimezone(companyId);
  const { start: todayStart } = getTodayRange(timezone);
  const { start: sevenDaysAgo } = getLastNDaysRange(7, timezone);

  // Get today's and historical check-ins
  const [todayCheckins, historicalCheckins] = await Promise.all([
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: { gte: todayStart },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    }),
    prisma.checkin.findMany({
      where: {
        companyId,
        userId: { in: memberIds },
        createdAt: {
          gte: sevenDaysAgo,
          lt: todayStart,
        },
      },
      select: {
        userId: true,
        readinessScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Calculate averages
  const userAverages = new Map<string, { sum: number; count: number; history: number[] }>();
  for (const checkin of historicalCheckins) {
    const existing = userAverages.get(checkin.userId) || { sum: 0, count: 0, history: [] };
    existing.sum += checkin.readinessScore;
    existing.count += 1;
    existing.history.push(Math.round(checkin.readinessScore));
    userAverages.set(checkin.userId, existing);
  }

  // Detect all changes (filter by minDrop)
  const allChanges: Array<{
    userId: string;
    user: { id: string; firstName: string; lastName: string; email: string; avatar: string | null };
    todayScore: number;
    todayStatus: string;
    averageScore: number;
    change: number;
    severity: SuddenChange['severity'];
    checkinId: string;
    checkinTime: Date;
    metrics: { mood: number; stress: number; sleep: number; physicalHealth: number };
    history: number[];
  }> = [];

  for (const checkin of todayCheckins) {
    const avgData = userAverages.get(checkin.userId);
    if (!avgData || avgData.count < 2) continue;

    const average = avgData.sum / avgData.count;
    const change = checkin.readinessScore - average;

    if (change <= -minDrop) {
      allChanges.push({
        userId: checkin.userId,
        user: checkin.user,
        todayScore: Math.round(checkin.readinessScore),
        todayStatus: checkin.readinessStatus,
        averageScore: Math.round(average),
        change: Math.round(change),
        severity: getSeverity(change),
        checkinId: checkin.id,
        checkinTime: checkin.createdAt,
        metrics: {
          mood: checkin.mood,
          stress: checkin.stress,
          sleep: checkin.sleep,
          physicalHealth: checkin.physicalHealth,
        },
        history: avgData.history.slice(0, 7),
      });
    }
  }

  // Sort by severity (CRITICAL first)
  const severityOrder: Record<string, number> = { CRITICAL: 0, SIGNIFICANT: 1, NOTABLE: 2, MINOR: 3 };
  allChanges.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Apply severity filter if provided
  let filteredChanges = severityFilter
    ? allChanges.filter((c) => c.severity === severityFilter)
    : allChanges;

  // Calculate summary before pagination (for full dataset)
  const summary = {
    total: allChanges.length,
    criticalCount: allChanges.filter((c) => c.severity === 'CRITICAL').length,
    significantCount: allChanges.filter((c) => c.severity === 'SIGNIFICANT').length,
    notableCount: allChanges.filter((c) => c.severity === 'NOTABLE').length,
    minorCount: allChanges.filter((c) => c.severity === 'MINOR').length,
  };

  // Apply pagination
  const total = filteredChanges.length;
  const paginatedChanges = filteredChanges.slice(skip, skip + limit);

  return c.json({
    data: paginatedChanges,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary,
  });
});

/**
 * GET /daily-monitoring/exemptions - Get paginated exemptions (pending + active)
 *
 * Returns both pending exemptions for TL to review and active (approved) exemptions.
 * IMPORTANT: Only APPROVED exemptions affect "on leave" calculations.
 * PENDING exemptions are just requests awaiting review.
 *
 * Query params:
 *   - teamId: Optional team ID for higher roles
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20, max: 100)
 *   - status: Filter by status (PENDING, APPROVED, REJECTED, or "active" for currently active)
 *   - search: Search by name or email
 */
dailyMonitoringRoutes.get('/exemptions', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const requestedTeamId = c.req.query('teamId');
  const { page, limit, skip } = parsePagination(c);
  const statusFilter = c.req.query('status');
  const search = c.req.query('search')?.toLowerCase();

  // Get team using helper
  const teamResult = await getTeamForUser(userId, companyId, requestedTeamId);
  if (!teamResult.success) {
    return c.json(
      { error: teamResult.error, code: teamResult.code },
      teamResult.status as 400 | 404
    );
  }

  const { team } = teamResult;
  const teamId = team.id;

  // Get timezone and date range
  const timezone = await getCompanyTimezone(companyId);
  const { start: todayStart } = getTodayRange(timezone);

  // Build base where clause
  const baseWhere = {
    companyId,
    isExemption: true,
    user: { teamId },
  };

  // Determine status filter
  let whereClause: any;
  if (statusFilter === 'active') {
    // Active = APPROVED and currently in effect today
    whereClause = {
      ...baseWhere,
      status: 'APPROVED',
      startDate: { lte: todayStart },
      endDate: { gte: todayStart },
    };
  } else if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
    whereClause = {
      ...baseWhere,
      status: statusFilter,
    };
  } else {
    // Default: show all (PENDING and APPROVED mainly)
    whereClause = {
      ...baseWhere,
      status: { in: ['PENDING', 'APPROVED'] },
    };
  }

  // Fetch exemptions with user and reviewer data
  let exemptions = await prisma.exception.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      triggeredByCheckin: {
        select: {
          id: true,
          mood: true,
          stress: true,
          sleep: true,
          physicalHealth: true,
          readinessScore: true,
          readinessStatus: true,
          notes: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  // Apply search filter (in-memory for name/email search)
  if (search) {
    exemptions = exemptions.filter(
      (e) =>
        e.user.firstName.toLowerCase().includes(search) ||
        e.user.lastName.toLowerCase().includes(search) ||
        e.user.email.toLowerCase().includes(search)
    );
  }

  // Get summary counts (before pagination)
  const pendingCount = exemptions.filter((e) => e.status === 'PENDING').length;
  const approvedCount = exemptions.filter((e) => e.status === 'APPROVED').length;
  const activeCount = exemptions.filter(
    (e) =>
      e.status === 'APPROVED' &&
      e.startDate &&
      e.endDate &&
      new Date(e.startDate) <= todayStart &&
      new Date(e.endDate) >= todayStart
  ).length;

  // Apply pagination
  const total = exemptions.length;
  const paginatedExemptions = exemptions.slice(skip, skip + limit);

  // Format response
  const data = paginatedExemptions.map((e) => ({
    id: e.id,
    type: e.type,
    reason: e.reason,
    status: e.status,
    startDate: e.startDate,
    endDate: e.endDate,
    notes: e.notes,
    reviewNote: e.reviewNote,
    createdAt: e.createdAt,
    approvedAt: e.approvedAt,
    user: e.user,
    reviewedBy: e.reviewedBy,
    triggeredByCheckin: e.triggeredByCheckin,
    // Flag if currently active today
    isActiveToday:
      e.status === 'APPROVED' &&
      e.startDate &&
      e.endDate &&
      new Date(e.startDate) <= todayStart &&
      new Date(e.endDate) >= todayStart,
  }));

  return c.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      pendingCount,
      approvedCount,
      activeCount,
    },
  });
});

/**
 * GET /daily-monitoring/member/:userId - Get detailed history for a member
 */
dailyMonitoringRoutes.get('/member/:memberId', async (c) => {
  const memberId = c.req.param('memberId');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');
  const days = parseInt(c.req.query('days') || '30');

  // Get current user for role check
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });

  if (!currentUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TEAM_LEAD: Can only view members of their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }

    // Check if member belongs to the team leader's team
    const memberTeam = await prisma.user.findFirst({
      where: { id: memberId, teamId: leaderTeam.id, isActive: true },
      select: { id: true },
    });

    if (!memberTeam) {
      return c.json({ error: 'You can only view members of your own team' }, 403);
    }
  }

  // Get company timezone and date range (timezone-aware)
  const timezone = await getCompanyTimezone(companyId);
  const { start: startDate } = getLastNDaysRange(days, timezone);

  const [member, checkins, exemptions] = await Promise.all([
    prisma.user.findFirst({
      where: { id: memberId, companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        currentStreak: true,
        longestStreak: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.checkin.findMany({
      where: {
        userId: memberId,
        companyId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exception.findMany({
      where: {
        userId: memberId,
        companyId,
        isExemption: true,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // Calculate averages
  const scores = checkins.map(c => c.readinessScore);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const avgMood = checkins.length ? checkins.reduce((a, c) => a + c.mood, 0) / checkins.length : 0;
  const avgStress = checkins.length ? checkins.reduce((a, c) => a + c.stress, 0) / checkins.length : 0;
  const avgSleep = checkins.length ? checkins.reduce((a, c) => a + c.sleep, 0) / checkins.length : 0;
  const avgPhysical = checkins.length ? checkins.reduce((a, c) => a + c.physicalHealth, 0) / checkins.length : 0;

  return c.json({
    member,
    stats: {
      totalCheckins: checkins.length,
      averageScore: Math.round(avgScore),
      averageMood: Math.round(avgMood * 10) / 10,
      averageStress: Math.round(avgStress * 10) / 10,
      averageSleep: Math.round(avgSleep * 10) / 10,
      averagePhysical: Math.round(avgPhysical * 10) / 10,
      greenDays: checkins.filter(c => c.readinessStatus === 'GREEN').length,
      yellowDays: checkins.filter(c => c.readinessStatus === 'YELLOW').length,
      redDays: checkins.filter(c => c.readinessStatus === 'RED').length,
    },
    checkins: checkins.map(c => ({
      id: c.id,
      date: c.createdAt,
      score: Math.round(c.readinessScore),
      status: c.readinessStatus,
      mood: c.mood,
      stress: c.stress,
      sleep: c.sleep,
      physicalHealth: c.physicalHealth,
      notes: c.notes,
      lowScoreReason: c.lowScoreReason,
      lowScoreDetails: c.lowScoreDetails,
    })),
    exemptions,
  });
});

export { dailyMonitoringRoutes };
