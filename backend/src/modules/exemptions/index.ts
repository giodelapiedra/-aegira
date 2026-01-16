/**
 * Exemptions Module
 * Handles exemption requests triggered by CRITICAL check-in scores
 *
 * Flow:
 * 1. Worker checks in with CRITICAL score
 * 2. Worker requests exemption (reason only, no dates)
 * 3. TL reviews and approves with return date
 * 4. Worker is on leave until return date
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import { adjustToWorkDay, formatDisplayDate, getTodayStart, getTodayEnd, DEFAULT_TIMEZONE } from '../../utils/date-helpers.js';
import type { AppContext } from '../../types/context.js';

const exemptionsRoutes = new Hono<AppContext>();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createExemptionSchema = z.object({
  type: z.enum(['SICK_LEAVE', 'PERSONAL_LEAVE', 'MEDICAL_APPOINTMENT', 'FAMILY_EMERGENCY', 'OTHER']),
  reason: z.string().min(1).max(1000),
  checkinId: z.string().uuid(),
});

const createExemptionForWorkerSchema = z.object({
  userId: z.string().uuid(), // Worker to create exemption for
  type: z.enum(['SICK_LEAVE', 'PERSONAL_LEAVE', 'MEDICAL_APPOINTMENT', 'FAMILY_EMERGENCY', 'OTHER']),
  reason: z.string().min(1).max(1000),
  endDate: z.string(), // Return date (YYYY-MM-DD)
  checkinId: z.string().uuid().optional(), // Optional - link to a check-in
  notes: z.string().max(500).optional(),
});

const approveExemptionSchema = z.object({
  endDate: z.string(), // TL sets return date (YYYY-MM-DD)
  notes: z.string().max(500).optional(),
});

const rejectExemptionSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /exemptions - Create exemption request from CRITICAL check-in
 * Worker provides reason only, no dates
 */
exemptionsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const body = createExemptionSchema.parse(await c.req.json());

  // Get user with team info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Validate user has team and team leader
  if (!user.teamId || !user.team) {
    return c.json({
      error: 'You must be assigned to a team before requesting exemptions',
      code: 'NO_TEAM',
    }, 400);
  }

  if (!user.team.leaderId) {
    return c.json({
      error: 'Your team does not have a team leader assigned',
      code: 'NO_TEAM_LEADER',
    }, 400);
  }

  // Validate check-in exists and is CRITICAL
  const checkin = await prisma.checkin.findFirst({
    where: {
      id: body.checkinId,
      userId,
      companyId,
    },
  });

  if (!checkin) {
    return c.json({ error: 'Check-in not found' }, 404);
  }

  if (checkin.readinessStatus !== 'RED') {
    return c.json({
      error: 'Exemptions can only be requested for CRITICAL (RED) check-ins',
      code: 'NOT_CRITICAL',
    }, 400);
  }

  // Check if exemption already exists for this check-in
  const existingExemption = await prisma.exception.findFirst({
    where: {
      triggeredByCheckinId: body.checkinId,
    },
  });

  if (existingExemption) {
    return c.json({
      error: 'An exemption request already exists for this check-in',
      code: 'ALREADY_EXISTS',
      exemptionId: existingExemption.id,
    }, 400);
  }

  // Create exemption (no dates - TL will set)
  const exemption = await prisma.exception.create({
    data: {
      userId,
      companyId,
      type: body.type,
      reason: body.reason,
      status: 'PENDING',
      isExemption: true,
      triggeredByCheckinId: body.checkinId,
      scoreAtRequest: checkin.readinessScore,
      // startDate and endDate are null - TL will set on approval
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
  });

  // Notify team leader
  await prisma.notification.create({
    data: {
      userId: user.team.leaderId,
      companyId,
      title: 'New Exemption Request',
      message: `${user.firstName} ${user.lastName} has requested an exemption due to a CRITICAL check-in (Score: ${checkin.readinessScore.toFixed(0)}%).`,
      type: 'EXEMPTION_REQUESTED',
      data: {
        exemptionId: exemption.id,
        requesterId: userId,
        checkinId: body.checkinId,
        score: checkin.readinessScore,
      },
    },
  });

  // Log exemption creation
  await createSystemLog({
    companyId,
    userId,
    action: 'EXCEPTION_CREATED',
    entityType: 'exemption',
    entityId: exemption.id,
    description: `${user.firstName} ${user.lastName} requested exemption (${body.type}) due to CRITICAL check-in`,
    metadata: {
      type: body.type,
      checkinId: body.checkinId,
      score: checkin.readinessScore,
      isExemption: true,
    },
  });

  return c.json(exemption, 201);
});

/**
 * POST /exemptions/create-for-worker - TL creates exemption for a worker (auto-approved)
 * Used when TL manually puts a worker on leave
 */
exemptionsRoutes.post('/create-for-worker', async (c) => {
  const creatorId = c.get('userId');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = createExemptionForWorkerSchema.parse(await c.req.json());

  // Only TL, Supervisor, Executive, Admin can create exemptions for workers
  const allowedRoles = ['TEAM_LEAD', 'SUPERVISOR', 'EXECUTIVE', 'ADMIN'];
  if (!allowedRoles.includes(currentUser.role)) {
    return c.json({ error: 'You do not have permission to create exemptions for workers' }, 403);
  }

  // Get the worker with team workDays for date adjustment
  const worker = await prisma.user.findFirst({
    where: { id: body.userId, companyId, isActive: true },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
          workDays: true,
        },
      },
    },
  });

  if (!worker) {
    return c.json({ error: 'Worker not found' }, 404);
  }

  // Team leads can only create exemptions for their team members
  if (currentUser.role === 'TEAM_LEAD') {
    // Build OR conditions - only include teamId if it exists
    const orConditions: any[] = [{ leaderId: creatorId }];
    if (currentUser.teamId) {
      orConditions.push({ id: currentUser.teamId });
    }

    const leaderTeam = await prisma.team.findFirst({
      where: {
        OR: orConditions,
        companyId,
        isActive: true,
      },
    });

    if (!leaderTeam || worker.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only create exemptions for your team members' }, 403);
    }
  }

  // Get creator info
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { firstName: true, lastName: true },
  });

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Set dates (timezone-aware)
  const today = getTodayStart(timezone);
  // Tomorrow is the earliest valid start/end date - exemptions cannot start today
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let endDate = new Date(body.endDate);
  endDate.setHours(0, 0, 0, 0);

  if (endDate < tomorrow) {
    return c.json({ error: 'Return date must be at least tomorrow' }, 400);
  }

  // Auto-adjust endDate to next work day if it falls on a non-work day
  let returnDateAdjusted = false;
  let originalReturnDate = endDate.toISOString();
  const workDays = worker.team?.workDays || 'MON,TUE,WED,THU,FRI';

  const adjustment = adjustToWorkDay(endDate, workDays, timezone);
  if (adjustment.wasAdjusted) {
    returnDateAdjusted = true;
    endDate = adjustment.adjustedDate;
  }
  endDate.setHours(23, 59, 59, 999);

  // Get check-in if provided
  let checkin = null;
  let scoreAtRequest = null;
  if (body.checkinId) {
    checkin = await prisma.checkin.findFirst({
      where: {
        id: body.checkinId,
        userId: body.userId,
        companyId,
      },
    });
    if (checkin) {
      scoreAtRequest = checkin.readinessScore;
    }
  }

  // Create exemption (auto-approved) - starts tomorrow
  const exemption = await prisma.exception.create({
    data: {
      userId: body.userId,
      companyId,
      type: body.type,
      reason: body.reason,
      status: 'APPROVED',
      isExemption: true,
      triggeredByCheckinId: body.checkinId || null,
      scoreAtRequest,
      startDate: tomorrow,
      endDate: endDate,
      reviewedById: creatorId,
      reviewNote: body.notes || `Created by ${creator?.firstName} ${creator?.lastName}`,
      approvedBy: creatorId,
      approvedAt: new Date(),
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
  });

  // IMPORTANT: Clean up any existing absence records within the exemption period
  // This prevents the blocking popup from showing for exempted dates
  const cleanedAbsences = await prisma.absence.updateMany({
    where: {
      userId: body.userId,
      absenceDate: {
        gte: tomorrow,
        lte: endDate,
      },
      status: 'PENDING_JUSTIFICATION', // Only clean up pending ones
    },
    data: {
      status: 'EXCUSED',
      reviewedBy: creatorId,
      reviewedAt: new Date(),
      reviewNotes: `Auto-excused: Covered by exemption created by TL (${body.type})`,
    },
  });

  if (cleanedAbsences.count > 0) {
    console.log(`[Exemption Created] Cleaned up ${cleanedAbsences.count} absence record(s) for user ${body.userId}`);
  }

  // Notify the worker with exemption end date
  const endDateDisplay = formatDisplayDate(endDate, timezone);
  const adjustmentNote = returnDateAdjusted
    ? ' (adjusted to next work day)'
    : '';

  await prisma.notification.create({
    data: {
      userId: body.userId,
      companyId,
      title: 'Exemption Created',
      message: `${creator?.firstName} ${creator?.lastName} has put you on ${body.type.toLowerCase().replace('_', ' ')}. Exemption ends: ${endDateDisplay}${adjustmentNote}.`,
      type: 'EXEMPTION_APPROVED',
      data: {
        exemptionId: exemption.id,
        endDate: endDate.toISOString(),
        returnDateAdjusted,
        originalReturnDate: returnDateAdjusted ? originalReturnDate : undefined,
      },
    },
  });

  // Log exemption creation with adjustment info
  await createSystemLog({
    companyId,
    userId: creatorId,
    action: 'EXCEPTION_CREATED',
    entityType: 'exemption',
    entityId: exemption.id,
    description: `${creator?.firstName} ${creator?.lastName} created exemption for ${worker.firstName} ${worker.lastName} (${body.type}, ends: ${endDateDisplay}${adjustmentNote})`,
    metadata: {
      type: body.type,
      workerId: body.userId,
      endDate: endDate.toISOString(),
      checkinId: body.checkinId,
      scoreAtRequest,
      isExemption: true,
      createdByTL: true,
      returnDateAdjusted,
      originalReturnDate: returnDateAdjusted ? originalReturnDate : undefined,
    },
  });

  return c.json(exemption, 201);
});

/**
 * GET /exemptions/pending - Get pending exemption requests for TL
 */
exemptionsRoutes.get('/pending', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get user to check their role and team
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  let where: any = {
    status: 'PENDING',
    companyId,
    isExemption: true,
  };

  // Team leads can only see their team's pending exemptions
  if (user.role === 'TEAM_LEAD' && user.teamId) {
    where.user = { teamId: user.teamId };
  }

  const exemptions = await prisma.exception.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
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
    take: 100, // Limit to prevent huge result sets
  });

  return c.json(exemptions);
});

/**
 * GET /exemptions/active - Get active & upcoming leave for dashboard and week calendar
 * Includes both:
 * - Exemptions (isExemption: true) - triggered by CRITICAL check-ins or incident reports
 * - Exceptions (isExemption: false) - regular leave requests
 * Both types represent "on leave" status for the worker dashboard
 * Returns approved exceptions that haven't ended yet (including future scheduled ones)
 * Has limit to prevent large result sets
 */
exemptionsRoutes.get('/active', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 200);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');
  const todayStart = getTodayStart(timezone);

  // Include ALL approved exceptions/exemptions that haven't ended yet
  // No startDate filter - this allows future scheduled exceptions to show in week calendar
  // The frontend isDateExempted() function handles checking specific dates
  let where: any = {
    status: 'APPROVED',
    companyId,
    endDate: { gte: todayStart }, // End date is today or later (hasn't ended yet)
  };

  // Filter by user role
  if (user.role === 'TEAM_LEAD' && user.teamId) {
    // Team leads see exemptions for their team members
    where.user = { teamId: user.teamId };
  } else if (user.role === 'WORKER' || user.role === 'MEMBER') {
    // Workers only see their own exemptions
    where.userId = userId;
  }
  // For other roles (SUPERVISOR, EXECUTIVE, ADMIN), they see all company exemptions

  const exemptions = await prisma.exception.findMany({
    where,
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
      triggeredByCheckin: {
        select: {
          id: true,
          readinessScore: true,
          readinessStatus: true,
          createdAt: true,
        },
      },
    },
    orderBy: { endDate: 'asc' },
    take: limit,
  });

  return c.json(exemptions);
});

/**
 * GET /exemptions - List all exemptions with filters
 */
exemptionsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const status = c.req.query('status');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, teamId: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  let where: any = {
    companyId,
    isExemption: true,
  };

  if (status) {
    where.status = status;
  }

  if (user.role === 'TEAM_LEAD' && user.teamId) {
    where.user = { teamId: user.teamId };
  }

  const [exemptions, total] = await Promise.all([
    prisma.exception.findMany({
      where,
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
        triggeredByCheckin: {
          select: {
            id: true,
            readinessScore: true,
            readinessStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exception.count({ where }),
  ]);

  return c.json({
    data: exemptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /exemptions/my-pending - Get current user's pending exemption
 */
exemptionsRoutes.get('/my-pending', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const exemption = await prisma.exception.findFirst({
    where: {
      userId,
      companyId,
      isExemption: true,
      status: 'PENDING',
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
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!exemption) {
    return c.json(null);
  }

  return c.json(exemption);
});

/**
 * GET /exemptions/check/:checkinId - Check if exemption exists for a check-in
 */
exemptionsRoutes.get('/check/:checkinId', async (c) => {
  const checkinId = c.req.param('checkinId');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const exemption = await prisma.exception.findFirst({
    where: {
      triggeredByCheckinId: checkinId,
      userId,
      companyId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return c.json({
    hasExemption: !!exemption,
    exemptionId: exemption?.id || null,
    status: exemption?.status || null,
  });
});

/**
 * GET /exemptions/:id - Get exemption by ID
 */
exemptionsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');

  const exemption = await prisma.exception.findFirst({
    where: { id, companyId, isExemption: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              leaderId: true,
            },
          },
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
  });

  if (!exemption) {
    return c.json({ error: 'Exemption not found' }, 404);
  }

  // TEAM_LEAD: Can only view exemptions for their own team members
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && exemption.user.team?.leaderId !== currentUserId) {
    return c.json({ error: 'You can only view exemptions for your own team members' }, 403);
  }

  return c.json(exemption);
});

/**
 * PATCH /exemptions/:id/approve - Approve exemption with dates
 * TL sets the return date (auto-adjusted to next work day if needed)
 */
exemptionsRoutes.patch('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = approveExemptionSchema.parse(await c.req.json());

  // Get existing exemption with user's team info for work days
  const existing = await prisma.exception.findFirst({
    where: { id, companyId, isExemption: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          team: {
            select: {
              id: true,
              workDays: true,
              leaderId: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exemption not found' }, 404);
  }

  // TEAM_LEAD: Can only approve exemptions for their own team members
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only approve exemptions for your own team members' }, 403);
  }

  if (existing.status !== 'PENDING') {
    return c.json({ error: 'This exemption has already been reviewed' }, 400);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Set dates (timezone-aware)
  const today = getTodayStart(timezone);
  // Tomorrow is the earliest valid start/end date - exemptions cannot start today
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let endDate = new Date(body.endDate);
  endDate.setHours(0, 0, 0, 0);

  if (endDate < tomorrow) {
    return c.json({ error: 'Return date must be at least tomorrow' }, 400);
  }

  // Auto-adjust endDate to next work day if it falls on a non-work day
  let returnDateAdjusted = false;
  let originalReturnDate = endDate.toISOString();
  const workDays = existing.user.team?.workDays || 'MON,TUE,WED,THU,FRI';

  const adjustment = adjustToWorkDay(endDate, workDays, timezone);
  if (adjustment.wasAdjusted) {
    returnDateAdjusted = true;
    endDate = adjustment.adjustedDate;
  }
  endDate.setHours(23, 59, 59, 999);

  const exemption = await prisma.exception.update({
    where: { id },
    data: {
      status: 'APPROVED',
      startDate: tomorrow,
      endDate: endDate,
      reviewedById: reviewerId,
      reviewNote: body.notes || null,
      approvedBy: reviewerId,
      approvedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
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
  });

  // IMPORTANT: Clean up any existing absence records within the exemption period
  // This prevents the blocking popup from showing for exempted dates
  const cleanedAbsences = await prisma.absence.updateMany({
    where: {
      userId: exemption.userId,
      absenceDate: {
        gte: tomorrow,
        lte: endDate,
      },
      status: 'PENDING_JUSTIFICATION', // Only clean up pending ones
    },
    data: {
      status: 'EXCUSED',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: `Auto-excused: Covered by approved exemption (${exemption.type})`,
    },
  });

  if (cleanedAbsences.count > 0) {
    console.log(`[Exemption Approved] Cleaned up ${cleanedAbsences.count} absence record(s) for user ${exemption.userId}`);
  }

  // Notify worker with exemption end date
  const endDateDisplay = formatDisplayDate(endDate, timezone);
  const adjustmentNote = returnDateAdjusted
    ? ' (adjusted to next work day)'
    : '';

  await prisma.notification.create({
    data: {
      userId: exemption.userId,
      companyId,
      title: 'Exemption Approved',
      message: `Your exemption request has been approved by ${reviewer?.firstName} ${reviewer?.lastName}. Exemption ends: ${endDateDisplay}${adjustmentNote}.`,
      type: 'EXEMPTION_APPROVED',
      data: {
        exemptionId: exemption.id,
        endDate: endDate.toISOString(),
        returnDateAdjusted,
        originalReturnDate: returnDateAdjusted ? originalReturnDate : undefined,
      },
    },
  });

  // Log approval with adjustment info
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_APPROVED',
    entityType: 'exemption',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} approved exemption for ${existing.user.firstName} ${existing.user.lastName} (ends: ${endDateDisplay}${adjustmentNote})`,
    metadata: {
      type: exemption.type,
      userId: exemption.userId,
      endDate: endDate.toISOString(),
      isExemption: true,
      returnDateAdjusted,
      originalReturnDate: returnDateAdjusted ? originalReturnDate : undefined,
    },
  });

  return c.json(exemption);
});

/**
 * PATCH /exemptions/:id/reject - Reject exemption
 */
exemptionsRoutes.patch('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = rejectExemptionSchema.parse(await c.req.json());

  const existing = await prisma.exception.findFirst({
    where: { id, companyId, isExemption: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          team: {
            select: {
              leaderId: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exemption not found' }, 404);
  }

  // TEAM_LEAD: Can only reject exemptions for their own team members
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only reject exemptions for your own team members' }, 403);
  }

  if (existing.status !== 'PENDING') {
    return c.json({ error: 'This exemption has already been reviewed' }, 400);
  }

  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  const exemption = await prisma.exception.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewNote: body.notes || null,
      rejectedBy: reviewerId,
      rejectedAt: new Date(),
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
  await prisma.notification.create({
    data: {
      userId: exemption.userId,
      companyId,
      title: 'Exemption Rejected',
      message: `Your exemption request has been rejected by ${reviewer?.firstName} ${reviewer?.lastName}.${body.notes ? ` Reason: ${body.notes}` : ''}`,
      type: 'EXEMPTION_REJECTED',
      data: { exemptionId: exemption.id },
    },
  });

  // Log rejection
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_REJECTED',
    entityType: 'exemption',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} rejected exemption for ${existing.user.firstName} ${existing.user.lastName}`,
    metadata: {
      type: exemption.type,
      userId: exemption.userId,
      reason: body.notes,
      isExemption: true,
    },
  });

  return c.json(exemption);
});

/**
 * PATCH /exemptions/:id/end-early - End exemption early
 */
exemptionsRoutes.patch('/:id/end-early', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  const existing = await prisma.exception.findFirst({
    where: { id, companyId, isExemption: true },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          team: {
            select: {
              leaderId: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exemption not found' }, 404);
  }

  // TEAM_LEAD: Can only end exemptions for their own team members
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only end exemptions for your own team members' }, 403);
  }

  if (existing.status !== 'APPROVED') {
    return c.json({ error: 'Only approved exemptions can be ended early' }, 400);
  }

  if (!existing.endDate) {
    return c.json({ error: 'Exemption has no end date set' }, 400);
  }

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');
  const todayStart = getTodayStart(timezone);
  const todayEnd = getTodayEnd(timezone);

  const existingEndDate = new Date(existing.endDate);
  existingEndDate.setHours(0, 0, 0, 0);

  if (existingEndDate <= todayStart) {
    return c.json({ error: 'This exemption has already ended or ends today' }, 400);
  }

  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  // New end date is end of today in company timezone
  // Using getTodayEnd ensures correct timezone handling
  const newEndDate = todayEnd;

  const exemption = await prisma.exception.update({
    where: { id },
    data: {
      endDate: newEndDate,
      reviewNote: body.notes
        ? `${existing.reviewNote ? existing.reviewNote + ' | ' : ''}Ended early: ${body.notes}`
        : existing.reviewNote,
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
  await prisma.notification.create({
    data: {
      userId: exemption.userId,
      companyId,
      title: 'Exemption Ended Early',
      message: `Your exemption has been ended early by ${reviewer?.firstName} ${reviewer?.lastName}. You are expected to check in on your next work day.`,
      type: 'EXEMPTION_ENDED',
      data: { exemptionId: exemption.id },
    },
  });

  // Log end early
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_ENDED_EARLY',
    entityType: 'exemption',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} ended exemption early for ${existing.user.firstName} ${existing.user.lastName}`,
    metadata: {
      originalEndDate: existing.endDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
      reason: body.notes,
      isExemption: true,
    },
  });

  return c.json(exemption);
});

export { exemptionsRoutes };
