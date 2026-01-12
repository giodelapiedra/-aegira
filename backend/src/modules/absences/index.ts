/**
 * Absences Module
 * Handles absence justification system
 *
 * Flow:
 * 1. Worker opens app / attempts check-in
 * 2. System detects missing days and creates absence records
 * 3. Worker submits justification for each absence (blocking popup)
 * 4. Team Leader reviews and marks as EXCUSED or UNEXCUSED
 *
 * Rules:
 * - No auto actions - all manual review
 * - TL reviews one-by-one (no bulk actions)
 * - EXCUSED = no penalty (not counted)
 * - UNEXCUSED = 0 points (counted)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import {
  detectAndCreateAbsences,
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
 * First detects and creates any new absences, then returns pending ones
 * This is called on app load to check if worker has blocking absences
 */
absencesRoutes.get('/my-pending', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

  // First, detect and create any new absences
  await detectAndCreateAbsences(userId, companyId, timezone);

  // Then get pending (not yet justified)
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

  // Validate all absences belong to this user and are not yet justified
  for (const item of body.justifications) {
    const absence = await prisma.absence.findUnique({
      where: { id: item.absenceId },
    });

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

  // Update all absences with justification
  const now = new Date();
  const updatedAbsences = [];

  for (const item of body.justifications) {
    const absence = await prisma.absence.update({
      where: { id: item.absenceId },
      data: {
        reasonCategory: item.reasonCategory,
        explanation: item.explanation,
        justifiedAt: now, // Mark as justified NOW
      },
    });
    updatedAbsences.push(absence);
  }

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

  // Get company timezone for display
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

  // Update the absence
  const updatedAbsence = await prisma.absence.update({
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
 * GET /absences/:id - Get absence by ID
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

export { absencesRoutes };
