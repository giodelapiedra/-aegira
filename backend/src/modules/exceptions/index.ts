import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import { createExceptionSchema, updateExceptionSchema } from '../../utils/validator.js';
import { getTodayStart, getTodayEnd, getNowDT, formatDisplayDate, DEFAULT_TIMEZONE } from '../../utils/date-helpers.js';
import { recalculateSummariesForDateRange } from '../../utils/daily-summary.js';
import { logger } from '../../utils/logger.js';
import type { AppContext } from '../../types/context.js';

const exceptionsRoutes = new Hono<AppContext>();

// GET /exceptions/my - Get current user's exceptions
exceptionsRoutes.get('/my', async (c) => {
  const userId = c.get('userId');

  const exceptions = await prisma.exception.findMany({
    where: { userId },
    include: {
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(exceptions);
});

// GET /exceptions/pending - Get pending exceptions (company-scoped, team-filtered for team leads)
exceptionsRoutes.get('/pending', async (c) => {
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

  let where: any = { status: 'PENDING', companyId };

  // Team leads can only see their team's pending exceptions
  if (user.role === 'TEAM_LEAD' && user.teamId) {
    where.user = { teamId: user.teamId };
  }
  // Executives, Admins, Supervisors can see all pending exceptions in their company

  const exceptions = await prisma.exception.findMany({
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
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(exceptions);
});

// GET /exceptions - List all exceptions (company-scoped, team-filtered for team leads)
exceptionsRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const status = c.req.query('status');
  const userIdParam = c.req.query('userId');
  const activeOn = c.req.query('activeOn'); // Filter exceptions active on this date (YYYY-MM-DD)

  const skip = (page - 1) * limit;

  // TEAM_LEAD: Only see exceptions from their team members
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
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

  const where: any = { companyId };
  if (status) where.status = status;
  if (userIdParam) where.userId = userIdParam;
  
  // TEAM_LEAD: Filter by team
  if (isTeamLead && teamIdFilter) {
    where.user = { teamId: teamIdFilter };
  }

  // Filter exceptions that are active on a specific date
  // An exception is active if: startDate <= activeDate <= endDate
  if (activeOn) {
    // Parse as UTC date to avoid timezone issues
    const [year, month, day] = activeOn.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    where.startDate = { lte: endOfDay };  // Leave started on or before this day
    where.endDate = { gte: startOfDay };   // Leave ends on or after this day
  }

  const [exceptions, total] = await Promise.all([
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
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.exception.count({ where }),
  ]);

  return c.json({
    data: exceptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /exceptions - Create exception request
exceptionsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const body = createExceptionSchema.parse(await c.req.json());

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

  // Only MEMBER/WORKER role requires team + team leader validation
  if (user?.role === 'MEMBER' || user?.role === 'WORKER') {
    // User must be assigned to a team to submit exception requests
    if (!user.teamId || !user.team) {
      return c.json({
        error: 'You must be assigned to a team before submitting exception requests',
        code: 'NO_TEAM',
      }, 400);
    }

    // Team must have a leader to receive and approve exception requests
    if (!user.team.leaderId) {
      return c.json({
        error: 'Your team does not have a team leader assigned. Please contact your administrator.',
        code: 'NO_TEAM_LEADER',
      }, 400);
    }
  }

  // If linkedIncidentId is provided, validate it belongs to the user
  let linkedIncident = null;
  if (body.linkedIncidentId) {
    linkedIncident = await prisma.incident.findFirst({
      where: {
        id: body.linkedIncidentId,
        reportedBy: userId,
        companyId,
      },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        type: true,
        severity: true,
      },
    });

    if (!linkedIncident) {
      return c.json({
        error: 'Incident not found or does not belong to you',
        code: 'INVALID_INCIDENT',
      }, 400);
    }
  }

  // Validate date range: startDate must be <= endDate
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (startDate > endDate) {
    return c.json({
      error: 'Start date cannot be after end date',
      code: 'INVALID_DATE_RANGE',
    }, 400);
  }

  const exception = await prisma.exception.create({
    data: {
      userId,
      companyId,
      type: body.type,
      reason: body.reason,
      startDate, // Use pre-validated dates
      endDate,   // Use pre-validated dates
      notes: body.notes || null,
      linkedIncidentId: body.linkedIncidentId || null,
    },
  });

  // Notify team leader if user has one
  if (user?.team?.leaderId) {
    const incidentInfo = linkedIncident
      ? ` This request is linked to incident ${linkedIncident.caseNumber}.`
      : '';

    await prisma.notification.create({
      data: {
        userId: user.team.leaderId,
        companyId,
        title: linkedIncident ? 'Exception Request (with Incident Report)' : 'New Exception Request',
        message: `${user.firstName} ${user.lastName} has submitted a ${body.type.toLowerCase().replace('_', ' ')} request for review.${incidentInfo}`,
        type: 'EXCEPTION_SUBMITTED',
        data: {
          exceptionId: exception.id,
          requesterId: userId,
          linkedIncidentId: body.linkedIncidentId || null,
        },
      },
    });
  }

  // Log exception creation
  await createSystemLog({
    companyId,
    userId,
    action: 'EXCEPTION_CREATED',
    entityType: 'exception',
    entityId: exception.id,
    description: `${user?.firstName} ${user?.lastName} submitted ${body.type.toLowerCase().replace('_', ' ')} exception request${linkedIncident ? ` (linked to ${linkedIncident.caseNumber})` : ''}`,
    metadata: {
      type: body.type,
      startDate: body.startDate,
      endDate: body.endDate,
      linkedIncidentId: body.linkedIncidentId || null,
    },
  });

  return c.json(exception, 201);
});

// GET /exceptions/:id - Get exception by ID (company-scoped, team-filtered for team leads)
exceptionsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');

  const exception = await prisma.exception.findFirst({
    where: { id, companyId },
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
    },
  });

  if (!exception) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  // TEAM_LEAD: Can only view exceptions from their team members
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && exception.user.team?.leaderId !== userId) {
    return c.json({ error: 'You can only view exceptions for your own team members' }, 403);
  }

  return c.json(exception);
});

// PUT /exceptions/:id - Update exception (company-scoped)
// Only owner (if still PENDING) or approver roles can update
exceptionsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify exception belongs to company
  const existing = await prisma.exception.findFirst({
    where: { id, companyId },
    include: {
      user: { select: { teamId: true } },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  // Authorization check
  const isOwner = existing.userId === userId;
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  // TEAM_LEAD: Can only update exceptions from their own team members
  if (isTeamLead) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.user.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only update exceptions from your own team members' }, 403);
    }
  }

  // Owner can only update if status is still PENDING
  if (isOwner && existing.status !== 'PENDING') {
    return c.json({ error: 'Forbidden: Cannot update an exception that has already been reviewed' }, 403);
  }

  // Must be owner (with PENDING status) or have approver role
  if (!isOwner && !hasElevatedRole && !isTeamLead) {
    return c.json({ error: 'Forbidden: You do not have permission to update this exception' }, 403);
  }

  // Validate input
  const validatedBody = updateExceptionSchema.parse(body);

  // FIX: Validate that existing exception has valid dates before updating
  if (!existing.startDate || !existing.endDate) {
    return c.json({
      error: 'Exception has invalid date range',
      code: 'INVALID_DATE_RANGE',
    }, 400);
  }

  const oldEndDate = existing.endDate;
  const newEndDate = validatedBody.endDate ? new Date(validatedBody.endDate) : existing.endDate;

  const exception = await prisma.exception.update({
    where: { id },
    data: {
      type: validatedBody.type ?? existing.type,
      reason: validatedBody.reason ?? existing.reason,
      startDate: validatedBody.startDate ? new Date(validatedBody.startDate) : existing.startDate,
      endDate: newEndDate,
      notes: validatedBody.notes ?? existing.notes,
    },
  });

  // If linked to an incident, create activity for the date change
  if (existing.linkedIncidentId && oldEndDate && newEndDate && oldEndDate.getTime() !== newEndDate.getTime()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    await prisma.incidentActivity.create({
      data: {
        incidentId: existing.linkedIncidentId,
        userId,
        type: 'COMMENT',
        comment: `${user?.firstName} ${user?.lastName} updated leave duration: ${formatDisplayDate(oldEndDate)} → ${formatDisplayDate(newEndDate)}`,
      },
    });
  }

  // If exception is APPROVED and dates changed, recalculate summaries
  // (PENDING exceptions don't affect summaries)
  if (existing.status === 'APPROVED' && existing.user.teamId) {
    const oldStart = existing.startDate;
    const oldEnd = existing.endDate;
    const newStart = validatedBody.startDate ? new Date(validatedBody.startDate) : existing.startDate;

    // Check if dates actually changed
    const startChanged = oldStart && newStart && oldStart.getTime() !== newStart.getTime();
    const endChanged = oldEndDate && newEndDate && oldEndDate.getTime() !== newEndDate.getTime();

    if (startChanged || endChanged) {
      // Get company timezone from context (no DB query needed!)
      const timezone = c.get('timezone');

      // Recalculate for the union of old and new date ranges
      const minStart = oldStart && newStart ? (oldStart < newStart ? oldStart : newStart) : (oldStart || newStart);
      const maxEnd = oldEnd && newEndDate ? (oldEnd > newEndDate ? oldEnd : newEndDate) : (oldEnd || newEndDate);

      if (minStart && maxEnd) {
        // Fire and forget
        recalculateSummariesForDateRange(
          existing.user.teamId,
          minStart,
          maxEnd,
          timezone
        ).catch(err => {
          logger.error(err, 'Failed to recalculate summaries after exception date update');
        });
      }
    }
  }

  return c.json(exception);
});

// PATCH /exceptions/:id/approve - Approve exception (company-scoped)
exceptionsRoutes.patch('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify exception belongs to company
  const existing = await prisma.exception.findFirst({
    where: { id, companyId },
    include: {
      user: {
        select: { 
          teamId: true,
          team: {
            select: { leaderId: true },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  // TEAM_LEAD: Can only approve exceptions from their own team members
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only approve exceptions from your own team members' }, 403);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  const exception = await prisma.exception.update({
    where: { id },
    data: {
      status: 'APPROVED',
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

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: exception.userId,
      companyId,
      title: 'Exception Request Approved',
      message: `Your ${exception.type.toLowerCase().replace('_', ' ')} request has been approved by ${reviewer?.firstName} ${reviewer?.lastName}.`,
      type: 'EXCEPTION_APPROVED',
      data: { exceptionId: exception.id },
    },
  });

  // Log exception approval
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_APPROVED',
    entityType: 'exception',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} approved ${exception.type.toLowerCase().replace('_', ' ')} request for ${exception.user.firstName} ${exception.user.lastName}`,
    metadata: { type: exception.type, userId: exception.userId },
  });

  // If linked to an incident, create activity
  if (existing.linkedIncidentId) {
    await prisma.incidentActivity.create({
      data: {
        incidentId: existing.linkedIncidentId,
        userId: reviewerId,
        type: 'COMMENT',
        comment: `${reviewer?.firstName} ${reviewer?.lastName} approved the linked leave request`,
      },
    });
  }

  // Recalculate daily team summaries for the leave period (affects expectedToCheckIn)
  if (existing.user.teamId && existing.startDate && existing.endDate) {
    // Get company timezone from context (no DB query needed!)
    const timezone = c.get('timezone');

    // Fire and forget - don't block response
    recalculateSummariesForDateRange(
      existing.user.teamId,
      existing.startDate,
      existing.endDate,
      timezone
    ).catch(err => {
      logger.error(err, 'Failed to recalculate summaries after exception approval');
    });
  }

  return c.json(exception);
});

// PATCH /exceptions/:id/reject - Reject exception (company-scoped, team-filtered for team leads)
exceptionsRoutes.patch('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify exception belongs to company
  const existing = await prisma.exception.findFirst({
    where: { id, companyId },
    include: {
      user: {
        select: { 
          teamId: true,
          team: {
            select: { leaderId: true },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  // TEAM_LEAD: Can only reject exceptions from their own team members
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only reject exceptions from your own team members' }, 403);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  const exception = await prisma.exception.update({
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
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: exception.userId,
      companyId,
      title: 'Exception Request Rejected',
      message: `Your ${exception.type.toLowerCase().replace('_', ' ')} request has been rejected by ${reviewer?.firstName} ${reviewer?.lastName}.${body.notes ? ` Reason: ${body.notes}` : ''}`,
      type: 'EXCEPTION_REJECTED',
      data: { exceptionId: exception.id },
    },
  });

  // Log exception rejection
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_REJECTED',
    entityType: 'exception',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} rejected ${exception.type.toLowerCase().replace('_', ' ')} request for ${exception.user.firstName} ${exception.user.lastName}`,
    metadata: { type: exception.type, userId: exception.userId, reason: body.notes },
  });

  // If linked to an incident, create activity
  if (existing.linkedIncidentId) {
    await prisma.incidentActivity.create({
      data: {
        incidentId: existing.linkedIncidentId,
        userId: reviewerId,
        type: 'COMMENT',
        comment: `${reviewer?.firstName} ${reviewer?.lastName} rejected the linked leave request${body.notes ? `: ${body.notes}` : ''}`,
      },
    });
  }

  return c.json(exception);
});

// PATCH /exceptions/:id/end-early - End an approved exception early (company-scoped)
exceptionsRoutes.patch('/:id/end-early', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify exception belongs to company and is approved
  const existing = await prisma.exception.findFirst({
    where: { id, companyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamId: true,
          team: {
            select: { leaderId: true },
          },
        },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  if (existing.status !== 'APPROVED') {
    return c.json({ error: 'Only approved exceptions can be ended early' }, 400);
  }

  // TEAM_LEAD: Can only end exceptions from their own team members
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
    return c.json({ error: 'You can only end exceptions from your own team members' }, 403);
  }

  if (!existing.startDate || !existing.endDate) {
    return c.json({ error: 'Exception has invalid date range' }, 400);
  }

  // Get company timezone for date comparison
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

  // Use timezone-aware date calculations
  const nowDT = getNowDT(timezone);
  const todayStart = getTodayStart(timezone);
  const todayEnd = getTodayEnd(timezone);

  const startDate = new Date(existing.startDate);
  startDate.setHours(0, 0, 0, 0);

  const existingEndDate = new Date(existing.endDate);
  existingEndDate.setHours(0, 0, 0, 0);

  // Check if exception can be ended early (must have days remaining after today)
  if (existingEndDate.getTime() === startDate.getTime()) {
    return c.json({ error: 'Cannot end early - this is already a single-day exception' }, 400);
  }

  if (existingEndDate <= todayStart) {
    return c.json({ error: 'Cannot end early - this exception has already ended or ends today' }, 400);
  }

  let newEndDate: Date;
  if (body.endDate) {
    // Use specified end date with proper timezone handling
    const specifiedDT = nowDT.set({
      year: new Date(body.endDate).getFullYear(),
      month: new Date(body.endDate).getMonth() + 1,
      day: new Date(body.endDate).getDate(),
    }).endOf('day');
    newEndDate = specifiedDT.toJSDate();
  } else {
    // If leave started today, make it a single-day record (end today)
    // Otherwise, end as of yesterday
    if (startDate.getTime() === todayStart.getTime()) {
      newEndDate = todayEnd;
    } else {
      // Yesterday end of day in company timezone
      newEndDate = nowDT.minus({ days: 1 }).endOf('day').toJSDate();
    }
  }

  // Validate new end date is before original end date
  if (newEndDate >= existing.endDate) {
    return c.json({ error: 'New end date must be before the original end date' }, 400);
  }

  // Validate new end date is not before start date
  if (newEndDate < existing.startDate) {
    return c.json({ error: 'New end date cannot be before the start date' }, 400);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  const originalEndDate = existing.endDate;

  const exception = await prisma.exception.update({
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
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: exception.userId,
      companyId,
      title: 'Exception Ended Early',
      message: `Your ${exception.type.toLowerCase().replace('_', ' ')} has been ended early by ${reviewer?.firstName} ${reviewer?.lastName}. You are expected to check in on your next work day.`,
      type: 'EXCEPTION_UPDATED',
      data: { exceptionId: exception.id },
    },
  });

  // Log exception end early
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_ENDED_EARLY',
    entityType: 'exception',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} ended ${exception.type.toLowerCase().replace('_', ' ')} early for ${exception.user.firstName} ${exception.user.lastName}`,
    metadata: {
      type: exception.type,
      userId: exception.userId,
      originalEndDate: originalEndDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
      reason: body.notes,
    },
  });

  // Recalculate daily team summaries for cancelled dates (worker no longer on leave)
  if (existing.user.teamId) {
    // Recalculate from day after new end date to original end date
    const recalcStartDate = new Date(newEndDate);
    recalcStartDate.setDate(recalcStartDate.getDate() + 1);

    // Fire and forget - don't block response
    recalculateSummariesForDateRange(
      existing.user.teamId,
      recalcStartDate,
      originalEndDate,
      timezone
    ).catch(err => {
      logger.error(err, 'Failed to recalculate summaries after exception end-early');
    });
  }

  return c.json(exception);
});

// DELETE /exceptions/:id - Cancel/delete an exception (company-scoped)
// Owner can cancel their own PENDING exception, approver roles can cancel any
exceptionsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const reviewerId = c.get('userId');
  const currentUser = c.get('user');

  // Verify exception belongs to company
  const existing = await prisma.exception.findFirst({
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
    },
  });

  if (!existing) {
    return c.json({ error: 'Exception not found' }, 404);
  }

  // Authorization check
  const isOwner = existing.userId === reviewerId;
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  // TEAM_LEAD: Can only delete exceptions from their own team members
  if (isTeamLead) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: reviewerId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.user.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only delete exceptions from your own team members' }, 403);
    }
  }

  // Owner can only cancel if status is still PENDING
  if (isOwner && !hasElevatedRole && !isTeamLead && existing.status !== 'PENDING') {
    return c.json({ error: 'Forbidden: Cannot cancel an exception that has already been reviewed' }, 403);
  }

  // Must be owner or have approver role
  if (!isOwner && !hasElevatedRole && !isTeamLead) {
    return c.json({ error: 'Forbidden: You do not have permission to cancel this exception' }, 403);
  }

  // Get reviewer info
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { firstName: true, lastName: true },
  });

  // Delete the exception
  await prisma.exception.delete({
    where: { id },
  });

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: existing.user.id,
      companyId,
      title: 'Exception Cancelled',
      message: `Your ${existing.type.toLowerCase().replace('_', ' ')} has been cancelled by ${reviewer?.firstName} ${reviewer?.lastName}.`,
      type: 'EXCEPTION_UPDATED',
      data: { exceptionId: id },
    },
  });

  // Log exception cancellation
  await createSystemLog({
    companyId,
    userId: reviewerId,
    action: 'EXCEPTION_CANCELLED',
    entityType: 'exception',
    entityId: id,
    description: `${reviewer?.firstName} ${reviewer?.lastName} cancelled ${existing.type.toLowerCase().replace('_', ' ')} for ${existing.user.firstName} ${existing.user.lastName}`,
    metadata: {
      type: existing.type,
      userId: existing.user.id,
      startDate: existing.startDate?.toISOString(),
      endDate: existing.endDate?.toISOString(),
    },
  });

  // Recalculate daily team summaries if the cancelled exception was APPROVED
  // (PENDING exceptions don't affect summaries)
  if (existing.status === 'APPROVED' && existing.user.teamId && existing.startDate && existing.endDate) {
    // Get company timezone from context (no DB query needed!)
    const timezone = c.get('timezone');

    // Fire and forget - don't block response
    recalculateSummariesForDateRange(
      existing.user.teamId,
      existing.startDate,
      existing.endDate,
      timezone
    ).catch(err => {
      logger.error(err, 'Failed to recalculate summaries after exception cancellation');
    });
  }

  return c.json({ message: 'Exception cancelled successfully' });
});

export { exceptionsRoutes };
