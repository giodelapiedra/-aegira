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
  const notCheckedInCount = memberIds.filter(
    id => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)
  ).length;

  const stats = {
    totalMembers: memberIds.length,
    activeMembers,
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
  const notCheckedInMemberIds = memberIds.filter(
    id => !checkedInUserIds.has(id) && !onLeaveUserIds.has(id)
  );
  const notCheckedInMembers = await prisma.user.findMany({
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
      _count: {
        select: {
          members: {
            where: { isActive: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return c.json(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: t._count.members,
    }))
  );
});

/**
 * GET /daily-monitoring/sudden-changes - Get detailed sudden changes
 */
dailyMonitoringRoutes.get('/sudden-changes', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const minDrop = parseInt(c.req.query('minDrop') || '10');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      teamId: true,
      team: {
        select: {
          members: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!user?.team) {
    return c.json({ error: 'Team not found' }, 400);
  }

  const memberIds = user.team.members.map(m => m.id);

  // Get company timezone and date ranges (timezone-aware)
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

  // Detect changes
  const changes: any[] = [];
  for (const checkin of todayCheckins) {
    const avgData = userAverages.get(checkin.userId);
    if (!avgData || avgData.count < 2) continue;

    const average = avgData.sum / avgData.count;
    const change = checkin.readinessScore - average;

    if (change <= -minDrop) {
      changes.push({
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
        history: avgData.history.slice(0, 7), // Last 7 scores
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { CRITICAL: 0, SIGNIFICANT: 1, NOTABLE: 2, MINOR: 3 };
  changes.sort((a, b) => severityOrder[a.severity as string] - severityOrder[b.severity as string]);

  return c.json({
    changes,
    total: changes.length,
    criticalCount: changes.filter(c => c.severity === 'CRITICAL').length,
    significantCount: changes.filter(c => c.severity === 'SIGNIFICANT').length,
  });
});

/**
 * GET /daily-monitoring/member/:userId - Get detailed history for a member
 */
dailyMonitoringRoutes.get('/member/:memberId', async (c) => {
  const memberId = c.req.param('memberId');
  const companyId = c.get('companyId');
  const days = parseInt(c.req.query('days') || '30');

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
