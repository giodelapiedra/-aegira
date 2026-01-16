/**
 * Absences Module
 * Handles absence justification system
 *
 * Flow:
 * 1. Cron job runs at 5 AM (per company timezone)
 * 2. Creates DailyAttendance (ABSENT) + Absence records for workers who didn't check in
 * 3. Worker opens app, sees pending absences (blocking popup)
 * 4. Worker submits justification for each absence
 * 5. Team Leader reviews and marks as EXCUSED or UNEXCUSED
 *
 * Rules:
 * - Cron creates absence records (not on-demand)
 * - TL reviews one-by-one (no bulk actions)
 * - EXCUSED = no penalty (not counted)
 * - UNEXCUSED = 0 points (counted)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import {
  getPendingJustifications,
  getPendingReviews,
  getAbsenceHistory,
} from '../../utils/absence.js';
import { DEFAULT_TIMEZONE, formatDisplayDate, toDbDate } from '../../utils/date-helpers.js';
import { recalculateDailyTeamSummary } from '../../utils/daily-summary.js';
import type { AppContext } from '../../types/context.js';

const absencesRoutes = new Hono<AppContext>();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const justifyAbsenceSchema = z.object({
  justifications: z.array(
    z.object({
      absenceId: z.string().uuid(),
      reasonCategory: z.enum(['SICK', 'EMERGENCY', 'PERSONAL', 'FORGOT_CHECKIN', 'TECHNICAL_ISSUE', 'OTHER']),
      explanation: z.string().min(1).max(1000),
    })
  ).min(1),
});

const reviewAbsenceSchema = z.object({
  action: z.enum(['EXCUSED', 'UNEXCUSED']),
  notes: z.string().max(500).optional(),
});

// ============================================
// WORKER ROUTES
// ============================================

/**
 * GET /absences/my-pending - Get worker's pending justifications
 * Returns absences created by the daily cron job (5 AM)
 * Read-only - cron handles absence creation
 */
absencesRoutes.get('/my-pending', async (c) => {
  const userId = c.get('userId');

  // Get pending (not yet justified) - created by cron
  const absences = await getPendingJustifications(userId);

  return c.json({
    data: absences,
    count: absences.length,
    hasBlocking: absences.length > 0,
  });
});

/**
 * POST /absences/justify - Worker submits justification for absences
 * Validates all absences belong to this user and updates them
 */
absencesRoutes.post('/justify', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const body = justifyAbsenceSchema.parse(await c.req.json());

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, teamId: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Batch fetch all absences for validation (single query instead of N queries)
  const absenceIds = body.justifications.map((j) => j.absenceId);
  const absences = await prisma.absence.findMany({
    where: { id: { in: absenceIds } },
  });

  // Create lookup map for validation
  const absenceMap = new Map(absences.map((a) => [a.id, a]));

  // Validate all absences
  for (const item of body.justifications) {
    const absence = absenceMap.get(item.absenceId);

    if (!absence) {
      return c.json({ error: `Absence not found: ${item.absenceId}` }, 400);
    }

    if (absence.userId !== userId) {
      return c.json({ error: 'Invalid absence ID - not your absence' }, 403);
    }

    if (absence.justifiedAt) {
      return c.json({ error: `Absence already justified: ${item.absenceId}` }, 400);
    }

    if (absence.status !== 'PENDING_JUSTIFICATION') {
      return c.json({ error: `Absence already reviewed: ${item.absenceId}` }, 400);
    }
  }

  // Batch update all absences in a transaction (single transaction instead of N queries)
  const now = new Date();
  const updatedAbsences = await prisma.$transaction(
    body.justifications.map((item) =>
      prisma.absence.update({
        where: { id: item.absenceId },
        data: {
          reasonCategory: item.reasonCategory,
          explanation: item.explanation,
          justifiedAt: now,
        },
      })
    )
  );

  // Notify team leader if user has a team
  if (user.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      select: { leaderId: true, name: true },
    });

    if (team?.leaderId) {
      await prisma.notification.create({
        data: {
          userId: team.leaderId,
          companyId,
          title: 'Absence Justification Submitted',
          message: `${user.firstName} ${user.lastName} has submitted ${body.justifications.length} absence justification(s) for review.`,
          type: 'ABSENCE_JUSTIFIED',
          data: {
            workerId: userId,
            count: body.justifications.length,
            absenceIds: body.justifications.map((j) => j.absenceId),
          },
        },
      });
    }
  }

  // Log justification
  await createSystemLog({
    companyId,
    userId,
    action: 'ABSENCE_JUSTIFIED' as any, // Will need to add to enum
    entityType: 'absence',
    entityId: updatedAbsences[0]?.id || '',
    description: `${user.firstName} ${user.lastName} submitted justification for ${body.justifications.length} absence(s)`,
    metadata: {
      count: body.justifications.length,
      absenceIds: body.justifications.map((j) => j.absenceId),
    },
  });

  return c.json({
    success: true,
    count: body.justifications.length,
    absences: updatedAbsences,
  });
});

/**
 * GET /absences/my-history - Get worker's absence history
 */
absencesRoutes.get('/my-history', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const absences = await getAbsenceHistory(userId, limit);

  return c.json({
    data: absences,
    count: absences.length,
  });
});

// ============================================
// TEAM LEADER ROUTES
// ============================================

/**
 * GET /absences/team-pending - Get pending reviews for TL's team
 * Returns absences that have been justified but not yet reviewed
 */
absencesRoutes.get('/team-pending', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  // Check role
  const allowedRoles = ['TEAM_LEAD', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN'];
  if (!allowedRoles.includes(currentUser.role)) {
    return c.json({ error: 'You do not have permission to view team absences' }, 403);
  }

  // Get team ID for filtering
  let teamId: string | null = null;

  if (currentUser.role === 'TEAM_LEAD') {
    // Get team where user is leader
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { leaderId: userId },
          { id: currentUser.teamId || undefined },
        ],
        companyId,
        isActive: true,
      },
    });

    if (!team) {
      return c.json({ error: 'You are not leading any team' }, 400);
    }

    teamId = team.id;
  }

  // Build query
  const where: any = {
    justifiedAt: { not: null }, // Already justified by worker
    status: 'PENDING_JUSTIFICATION', // Waiting for TL review
    companyId,
  };

  if (teamId) {
    where.teamId = teamId;
  }

  const absences = await prisma.absence.findMany({
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
    orderBy: { justifiedAt: 'asc' }, // Oldest first
    take: 100, // Limit to prevent huge result sets
  });

  return c.json({
    data: absences,
    count: absences.length,
  });
});

/**
 * POST /absences/:id/review - Team Leader reviews an absence
 * Action: EXCUSED (no penalty) or UNEXCUSED (0 points)
 */
absencesRoutes.post('/:id/review', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  const body = reviewAbsenceSchema.parse(await c.req.json());

  // Check role
  const allowedRoles = ['TEAM_LEAD', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN'];
  if (!allowedRoles.includes(currentUser.role)) {
    return c.json({ error: 'You do not have permission to review absences' }, 403);
  }

  // Get the absence
  const absence = await prisma.absence.findFirst({
    where: { id, companyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamId: true,
        },
      },
      team: {
        select: {
          id: true,
          leaderId: true,
        },
      },
    },
  });

  if (!absence) {
    return c.json({ error: 'Absence not found' }, 404);
  }

  // TEAM_LEAD: Can only review their own team members
  if (currentUser.role === 'TEAM_LEAD') {
    if (absence.team?.leaderId !== userId) {
      return c.json({ error: 'You can only review absences for your team members' }, 403);
    }
  }

  // Must be justified first
  if (!absence.justifiedAt) {
    return c.json({ error: 'Worker has not justified this absence yet' }, 400);
  }

  // Must be pending
  if (absence.status !== 'PENDING_JUSTIFICATION') {
    return c.json({ error: 'This absence has already been reviewed' }, 400);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Update the absence AND DailyAttendance in a transaction
  const updatedAbsence = await prisma.$transaction(async (tx) => {
    // Update absence record
    const updated = await tx.absence.update({
      where: { id },
      data: {
        status: body.action,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: body.notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // If EXCUSED, also update DailyAttendance to EXCUSED status
    if (body.action === 'EXCUSED') {
      await tx.dailyAttendance.updateMany({
        where: {
          userId: absence.userId,
          date: absence.absenceDate,
        },
        data: {
          status: 'EXCUSED',
          score: null,
          isCounted: false,
        },
      });
    }
    // If UNEXCUSED, DailyAttendance stays ABSENT (already set by cron)

    return updated;
  });

  // Notify worker
  const dateDisplay = formatDisplayDate(absence.absenceDate, timezone);
  const statusText = body.action === 'EXCUSED' ? 'excused (no penalty)' : 'marked as unexcused';

  await prisma.notification.create({
    data: {
      userId: absence.userId,
      companyId,
      title: `Absence ${body.action === 'EXCUSED' ? 'Excused' : 'Unexcused'}`,
      message: `Your absence on ${dateDisplay} has been ${statusText} by ${reviewer?.firstName} ${reviewer?.lastName}.${body.notes ? ` Note: ${body.notes}` : ''}`,
      type: body.action === 'EXCUSED' ? 'ABSENCE_EXCUSED' : 'ABSENCE_UNEXCUSED',
      data: {
        absenceId: id,
        date: absence.absenceDate.toISOString(),
        status: body.action,
      },
    },
  });

  // Log review
  await createSystemLog({
    companyId,
    userId,
    action: body.action === 'EXCUSED' ? 'ABSENCE_EXCUSED' as any : 'ABSENCE_UNEXCUSED' as any,
    entityType: 'absence',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} marked absence for ${absence.user.firstName} ${absence.user.lastName} (${dateDisplay}) as ${body.action}`,
    metadata: {
      workerId: absence.userId,
      date: absence.absenceDate.toISOString(),
      reasonCategory: absence.reasonCategory,
      status: body.action,
      notes: body.notes,
    },
  });

  // Recalculate DailyTeamSummary for the absence date
  // This ensures the teams-overview breakdown (Absent vs Excused) is updated
  if (absence.teamId) {
    recalculateDailyTeamSummary(absence.teamId, absence.absenceDate, timezone).catch(err => {
      console.error('Failed to recalculate daily team summary after absence review:', err);
    });
  }

  return c.json(updatedAbsence);
});

/**
 * GET /absences/team-history - Get absence history for TL's team
 */
absencesRoutes.get('/team-history', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const status = c.req.query('status');

  // Check role
  const allowedRoles = ['TEAM_LEAD', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN'];
  if (!allowedRoles.includes(currentUser.role)) {
    return c.json({ error: 'You do not have permission to view team absences' }, 403);
  }

  // Get team ID for filtering
  let teamId: string | null = null;

  if (currentUser.role === 'TEAM_LEAD') {
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { leaderId: userId },
          { id: currentUser.teamId || undefined },
        ],
        companyId,
        isActive: true,
      },
    });

    if (!team) {
      return c.json({ error: 'You are not leading any team' }, 400);
    }

    teamId = team.id;
  }

  // Build query
  const where: any = { companyId };

  if (teamId) {
    where.teamId = teamId;
  }

  if (status) {
    where.status = status;
  }

  const [absences, total] = await Promise.all([
    prisma.absence.findMany({
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
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { absenceDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.absence.count({ where }),
  ]);

  return c.json({
    data: absences,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /absences/stats - Get absence statistics for dashboard
 */
absencesRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  // Get team ID for filtering (TL only sees their team)
  let teamId: string | null = null;

  if (currentUser.role === 'TEAM_LEAD') {
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { leaderId: userId },
          { id: currentUser.teamId || undefined },
        ],
        companyId,
        isActive: true,
      },
    });

    if (team) {
      teamId = team.id;
    }
  }

  // Build where clause
  const where: any = { companyId };
  if (teamId) {
    where.teamId = teamId;
  }

  // For workers, only get their own stats
  if (currentUser.role === 'WORKER' || currentUser.role === 'MEMBER') {
    where.userId = userId;
  }

  // Get counts
  const [
    pendingJustification,
    pendingReview,
    excused,
    unexcused,
  ] = await Promise.all([
    prisma.absence.count({
      where: { ...where, status: 'PENDING_JUSTIFICATION', justifiedAt: null },
    }),
    prisma.absence.count({
      where: { ...where, status: 'PENDING_JUSTIFICATION', justifiedAt: { not: null } },
    }),
    prisma.absence.count({
      where: { ...where, status: 'EXCUSED' },
    }),
    prisma.absence.count({
      where: { ...where, status: 'UNEXCUSED' },
    }),
  ]);

  return c.json({
    pendingJustification,
    pendingReview,
    excused,
    unexcused,
    total: pendingJustification + pendingReview + excused + unexcused,
  });
});

/**
 * GET /absences/:id - Get absence by ID
 * NOTE: This route MUST be after all specific routes to avoid conflicts
 */
absencesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  const absence = await prisma.absence.findFirst({
    where: { id, companyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          teamId: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!absence) {
    return c.json({ error: 'Absence not found' }, 404);
  }

  // Workers can only view their own absences
  if (currentUser.role === 'WORKER' || currentUser.role === 'MEMBER') {
    if (absence.userId !== userId) {
      return c.json({ error: 'You can only view your own absences' }, 403);
    }
  }

  // Team leads can only view their team's absences
  if (currentUser.role === 'TEAM_LEAD') {
    if (absence.team?.leaderId !== userId && absence.userId !== userId) {
      return c.json({ error: 'You can only view absences for your team' }, 403);
    }
  }

  return c.json(absence);
});

export { absencesRoutes };
