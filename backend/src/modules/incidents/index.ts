import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { createSystemLog } from '../system-logs/index.js';
import { createIncidentSchema, updateIncidentSchema } from '../../utils/validator.js';
import type { AppContext } from '../../types/context.js';

const incidentsRoutes = new Hono<AppContext>();

// Helper function to generate case number: INC-YYYY-XXXX
// Includes retry logic to handle race conditions
async function generateCaseNumber(companyId: string, maxRetries: number = 10): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;

  // Find the last case number for this company this year
  const lastIncident = await prisma.incident.findFirst({
    where: {
      companyId,
      caseNumber: { startsWith: prefix },
    },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  });

  let startNumber = 1;
  if (lastIncident?.caseNumber) {
    const lastNumber = parseInt(lastIncident.caseNumber.split('-')[2], 10);
    if (!isNaN(lastNumber)) {
      startNumber = lastNumber + 1;
    }
  }

  // Try numbers starting from startNumber
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const nextNumber = startNumber + attempt;
    const caseNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

    // Check if this case number already exists (race condition check)
    const existing = await prisma.incident.findUnique({
      where: { caseNumber },
      select: { id: true },
    });

    // If it doesn't exist, we can use it
    if (!existing) {
      return caseNumber;
    }

    // If it exists, wait a bit and try next number
    // Add small random delay to reduce collision probability
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }

  // If all retries failed, throw error
  throw new Error('Failed to generate unique case number after multiple attempts');
}

// GET /incidents/my/stats - Get stats for current user's incidents
incidentsRoutes.get('/my/stats', async (c) => {
  const userId = c.get('userId');

  const [total, open, inProgress, resolved, closed] = await Promise.all([
    prisma.incident.count({ where: { reportedBy: userId } }),
    prisma.incident.count({ where: { reportedBy: userId, status: 'OPEN' } }),
    prisma.incident.count({ where: { reportedBy: userId, status: 'IN_PROGRESS' } }),
    prisma.incident.count({ where: { reportedBy: userId, status: 'RESOLVED' } }),
    prisma.incident.count({ where: { reportedBy: userId, status: 'CLOSED' } }),
  ]);

  return c.json({
    total,
    open,
    inProgress,
    resolved: resolved + closed, // Combined for UI
    byStatus: { open, inProgress, resolved, closed },
  });
});

// GET /incidents/my - Get current user's incidents with pagination
incidentsRoutes.get('/my', async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
  const status = c.req.query('status');
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = { reportedBy: userId };
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        caseNumber: true,
        title: true,
        description: true,
        type: true,
        severity: true,
        status: true,
        location: true,
        incidentDate: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        // Include linked exception with approval info
        exception: {
          select: {
            id: true,
            status: true,
            type: true,
            reviewedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            approvedAt: true,
            rejectedAt: true,
          },
        },
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return c.json({
    data: incidents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /incidents/stats - Stats for incidents (for team leader dashboard)
incidentsRoutes.get('/stats', async (c) => {
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');
  let teamId = c.req.query('teamId');

  // TEAM_LEAD: Can only see stats from their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }
    teamId = leaderTeam.id;
  }

  const baseWhere: any = { companyId };
  if (teamId) baseWhere.teamId = teamId;

  const [total, open, inProgress, resolved, closed, pendingLeave] = await Promise.all([
    prisma.incident.count({ where: baseWhere }),
    prisma.incident.count({ where: { ...baseWhere, status: 'OPEN' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'CLOSED' } }),
    prisma.incident.count({ where: { ...baseWhere, exception: { status: 'PENDING' } } }),
  ]);

  return c.json({
    total,
    open,
    inProgress,
    resolved: resolved + closed,
    pendingLeave,
    byStatus: { open, inProgress, resolved, closed },
  });
});

// GET /incidents - List all incidents (company-scoped)
incidentsRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);
  const status = c.req.query('status');
  const severity = c.req.query('severity');
  const search = c.req.query('search');
  const exceptionStatus = c.req.query('exceptionStatus');
  let teamId = c.req.query('teamId');

  const skip = (page - 1) * limit;

  // TEAM_LEAD: Can only see incidents from their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }

    // If teamId is provided, verify it matches their team
    if (teamId && teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view incidents for your own team' }, 403);
    }

    // Force teamId to their team
    teamId = leaderTeam.id;
  }

  const where: any = { companyId };
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (teamId) where.teamId = teamId;

  // Add exception status filter
  if (exceptionStatus) {
    where.exception = { status: exceptionStatus };
  }

  // Add search filter
  if (search) {
    where.OR = [
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { reporter: { firstName: { contains: search, mode: 'insensitive' } } },
      { reporter: { lastName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        // Include linked exception for approve/reject actions
        exception: {
          select: {
            id: true,
            status: true,
            type: true,
            reason: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.incident.count({ where }),
  ]);

  return c.json({
    data: incidents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /incidents - Create incident
incidentsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const body = createIncidentSchema.parse(await c.req.json());

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

  // User must exist
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Only MEMBER/WORKER role requires team + team leader validation
  if (user.role === 'MEMBER' || user.role === 'WORKER') {
    // User must be assigned to a team to report incidents
    if (!user.teamId || !user.team) {
      return c.json({
        error: 'You must be assigned to a team before reporting incidents',
        code: 'NO_TEAM',
      }, 400);
    }

    // Team must have a leader to receive incident reports
    if (!user.team.leaderId) {
      return c.json({
        error: 'Your team does not have a team leader assigned. Please contact your administrator.',
        code: 'NO_TEAM_LEADER',
      }, 400);
    }
  }

  // Generate case number with retry logic for race conditions
  let caseNumber: string = '';
  let incident;
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      caseNumber = await generateCaseNumber(companyId);

      incident = await prisma.incident.create({
        data: {
          companyId,
          caseNumber,
          type: body.type || 'OTHER',
          title: body.title,
          description: body.description,
          severity: body.severity,
          location: body.location || null,
          reportedBy: userId,
          teamId: user.teamId || undefined,
          incidentDate: body.incidentDate ? new Date(body.incidentDate) : new Date(),
          attachments: body.attachments || [],
          // Create initial activity for CREATED
          activities: {
            create: {
              userId,
              type: 'CREATED',
              newValue: body.severity,
              comment: `Incident reported: ${body.title}`,
            },
          },
        },
        include: {
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          activities: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Successfully created, break out of retry loop
      break;
    } catch (error: any) {
      // If it's a unique constraint error on caseNumber, retry with new number
      if (error.code === 'P2002' && error.meta?.target?.includes('caseNumber')) {
        retries++;
        if (retries >= maxRetries) {
          console.error('Failed to generate unique case number after retries:', error);
          return c.json({
            error: 'Failed to create incident: Unable to generate unique case number. Please try again.',
            code: 'CASE_NUMBER_GENERATION_FAILED',
          }, 500);
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      // For other errors, log and return error response
      console.error('Error creating incident:', error);
      return c.json({
        error: error.message || 'Failed to create incident',
        code: error.code || 'INCIDENT_CREATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }, 500);
    }
  }

  if (!incident) {
    return c.json({
      error: 'Failed to create incident',
      code: 'INCIDENT_CREATION_FAILED',
    }, 500);
  }

  // Log incident creation
  await createSystemLog({
    companyId,
    userId,
    action: 'INCIDENT_CREATED',
    entityType: 'incident',
    entityId: incident.id,
    description: `${user.firstName} ${user.lastName} reported incident: ${body.title} (${body.severity})`,
    metadata: { caseNumber, severity: body.severity, type: body.type },
  });

  // Create exception for ALL incident types - TL must review each report
  const incidentDate = body.incidentDate ? new Date(body.incidentDate) : new Date();
  incidentDate.setHours(0, 0, 0, 0);

  const exceptionTypeMap: Record<string, string> = {
    INJURY: 'SICK_LEAVE',
    ILLNESS: 'SICK_LEAVE',
    MENTAL_HEALTH: 'SICK_LEAVE',
    MEDICAL_EMERGENCY: 'SICK_LEAVE',
    HEALTH_SAFETY: 'SICK_LEAVE',
    OTHER: 'OTHER',
  };
  const exceptionType = exceptionTypeMap[body.type] || 'OTHER';

  const exception = await prisma.exception.create({
    data: {
      userId,
      companyId,
      type: exceptionType as any,
      reason: `Incident ${caseNumber}: ${body.title}`,
      startDate: incidentDate,
      endDate: incidentDate,
      status: 'PENDING',
      linkedIncidentId: incident.id,
      notes: `Type: ${body.type}. Severity: ${body.severity}. ${body.description}`,
      attachments: body.attachments || [],
      isExemption: true,
    },
  });

  // Notify team leader
  if (user.team?.leaderId) {
    await prisma.notification.create({
      data: {
        userId: user.team.leaderId,
        companyId,
        title: 'Incident Report - Action Required',
        message: `${user.firstName} ${user.lastName} reported an incident (${caseNumber}: ${body.title}). Please review and take action.`,
        type: 'EXCEPTION_SUBMITTED',
        data: { exceptionId: exception.id, incidentId: incident.id, requesterId: userId },
      },
    });
  }

  // Log exception creation
  await createSystemLog({
    companyId,
    userId,
    action: 'EXCEPTION_CREATED_FROM_INCIDENT',
    entityType: 'exception',
    entityId: exception.id,
    description: `Exception created from incident ${caseNumber} by ${user.firstName} ${user.lastName}`,
    metadata: {
      incidentId: incident.id,
      caseNumber,
      incidentType: body.type,
      severity: body.severity,
      exceptionType,
    },
  });

  return c.json(incident, 201);
});

// GET /incidents/:id - Get incident by ID (company-scoped, team-filtered for team leads)
incidentsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');
  const currentUser = c.get('user');

  const incident = await prisma.incident.findFirst({
    where: { id, companyId },
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          birthDate: true,
          gender: true,
          team: {
            select: {
              id: true,
              name: true,
              leader: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      team: {
        select: { id: true, name: true },
      },
      activities: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      // Include linked exception if auto-created from this incident
      exception: {
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
      },
      // WHS Assignment info
      whsOfficer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
      whsAssigner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!incident) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // TEAM_LEAD: Can only view incidents from their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && incident.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || incident.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view incidents from your own team' }, 403);
    }
  }

  return c.json(incident);
});

// PUT /incidents/:id - Update incident (company-scoped)
// Only reporter, assignee, or team lead+ can update
incidentsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // Authorization check: Only reporter, assignee, or team lead+ can update
  const isReporter = existing.reportedBy === userId;
  const isAssignee = existing.assignedTo === userId;
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  // TEAM_LEAD: Can only update incidents from their own team
  if (isTeamLead && existing.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only update incidents from your own team' }, 403);
    }
  }

  if (!isReporter && !isAssignee && !hasElevatedRole && !isTeamLead) {
    return c.json({ error: 'Forbidden: You do not have permission to update this incident' }, 403);
  }

  // Validate input
  const validatedBody = updateIncidentSchema.parse(body);

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      type: validatedBody.type,
      title: validatedBody.title,
      description: validatedBody.description,
      severity: validatedBody.severity,
      location: validatedBody.location,
    },
  });

  // Log incident update
  await createSystemLog({
    companyId,
    userId,
    action: 'INCIDENT_UPDATED',
    entityType: 'incident',
    entityId: id,
    description: `Incident ${existing.caseNumber} updated`,
    metadata: { caseNumber: existing.caseNumber },
  });

  return c.json(incident);
});

// PATCH /incidents/:id/status - Update incident status (company-scoped, team-filtered for team leads)
incidentsRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // Authorization check: Only reporter, assignee, or team lead+ can update status
  const isReporter = existing.reportedBy === userId;
  const isAssignee = existing.assignedTo === userId;
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  // TEAM_LEAD: Can only update incidents from their own team
  if (isTeamLead && existing.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only update incidents from your own team' }, 403);
    }
  }

  if (!isReporter && !isAssignee && !hasElevatedRole && !isTeamLead) {
    return c.json({ error: 'Forbidden: You do not have permission to update this incident' }, 403);
  }

  // Prevent reopening CLOSED incidents (CLOSED = FINAL)
  if (existing.status === 'CLOSED') {
    return c.json({ error: 'Cannot reopen a closed incident' }, 400);
  }

  const updateData: any = { status: body.status };
  if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
    updateData.resolvedAt = new Date();
  }

  // Update incident and create activity in a transaction
  const incident = await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id },
      data: updateData,
      include: {
        activities: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Create activity for status change
    await tx.incidentActivity.create({
      data: {
        incidentId: id,
        userId,
        type: body.status === 'RESOLVED' ? 'RESOLVED' : 'STATUS_CHANGED',
        oldValue: existing.status,
        newValue: body.status,
        comment: body.note || null,
      },
    });

    return updated;
  });

  // Log status change
  await createSystemLog({
    companyId,
    userId,
    action: 'INCIDENT_STATUS_CHANGED',
    entityType: 'incident',
    entityId: id,
    description: `Incident ${existing.caseNumber} status changed from ${existing.status} to ${body.status}`,
    metadata: { caseNumber: existing.caseNumber, oldStatus: existing.status, newStatus: body.status },
  });

  return c.json(incident);
});

// PATCH /incidents/:id/assign - Assign incident (company-scoped, team-filtered for team leads)
incidentsRoutes.patch('/:id/assign', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // Authorization check: Only reporter, assignee, or team lead+ can assign
  const isReporter = existing.reportedBy === userId;
  const isAssignee = existing.assignedTo === userId;
  const isTeamLead = currentUser.role === 'TEAM_LEAD';
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  // TEAM_LEAD: Can only assign incidents from their own team
  if (isTeamLead && existing.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only assign incidents from your own team' }, 403);
    }
  }

  if (!isReporter && !isAssignee && !hasElevatedRole && !isTeamLead) {
    return c.json({ error: 'Forbidden: You do not have permission to assign this incident' }, 403);
  }

  // Verify assignee belongs to same company
  const assignee = await prisma.user.findFirst({
    where: { id: body.assigneeId, companyId },
  });

  if (!assignee) {
    return c.json({ error: 'Invalid assignee' }, 400);
  }

  // Update and create activity in transaction
  const incident = await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id },
      data: {
        assignedTo: body.assigneeId,
        status: 'IN_PROGRESS',
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create activity for assignment
    await tx.incidentActivity.create({
      data: {
        incidentId: id,
        userId,
        type: 'ASSIGNED',
        newValue: `${assignee.firstName} ${assignee.lastName}`,
        comment: body.note || null,
      },
    });

    // Also create status change activity if status changed
    if (existing.status !== 'IN_PROGRESS') {
      await tx.incidentActivity.create({
        data: {
          incidentId: id,
          userId,
          type: 'STATUS_CHANGED',
          oldValue: existing.status,
          newValue: 'IN_PROGRESS',
        },
      });
    }

    return updated;
  });

  // Log incident assignment
  await createSystemLog({
    companyId,
    userId,
    action: 'INCIDENT_ASSIGNED',
    entityType: 'incident',
    entityId: id,
    description: `Incident ${existing.caseNumber} assigned to ${assignee.firstName} ${assignee.lastName}`,
    metadata: { caseNumber: existing.caseNumber, assigneeId: assignee.id, assigneeName: `${assignee.firstName} ${assignee.lastName}` },
  });

  return c.json(incident);
});

// POST /incidents/:id/comments - Add comment to incident (team-filtered for team leads)
incidentsRoutes.post('/:id/comments', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // TEAM_LEAD: Can only comment on incidents from their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && existing.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only comment on incidents from your own team' }, 403);
    }
  }

  if (!body.comment || body.comment.trim() === '') {
    return c.json({ error: 'Comment is required' }, 400);
  }

  const activity = await prisma.incidentActivity.create({
    data: {
      incidentId: id,
      userId,
      type: 'COMMENT',
      comment: body.comment.trim(),
    },
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
  });

  return c.json(activity, 201);
});

// GET /incidents/:id/activities - Get incident activities/timeline (team-filtered for team leads)
incidentsRoutes.get('/:id/activities', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUserId = c.get('userId');
  const currentUser = c.get('user');

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // TEAM_LEAD: Can only view activities from incidents in their own team
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  if (isTeamLead && existing.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || existing.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view activities from incidents in your own team' }, 403);
    }
  }

  const activities = await prisma.incidentActivity.findMany({
    where: { incidentId: id },
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
    orderBy: { createdAt: 'asc' },
  });

  return c.json(activities);
});

// PUT /incidents/:id/rtw-certificate - Upload Return to Work Certificate
incidentsRoutes.put('/:id/rtw-certificate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');
  const body = await c.req.json();

  // Only elevated roles can upload RTW certificates
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WHS_CONTROL', 'CLINICIAN'].includes(user.role);
  if (!hasElevatedRole) {
    return c.json({ error: 'Forbidden: You do not have permission to upload RTW certificates' }, 403);
  }

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
    include: { reporter: { select: { firstName: true, lastName: true } } },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  // Update incident with RTW certificate info
  const incident = await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id },
      data: {
        rtwCertificateUrl: body.certificateUrl,
        rtwCertDate: body.certDate ? new Date(body.certDate) : null,
        rtwUploadedAt: new Date(),
        rtwUploadedBy: userId,
        rtwNotes: body.notes || null,
      },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        rtwUploader: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Create activity for RTW upload
    await tx.incidentActivity.create({
      data: {
        incidentId: id,
        userId,
        type: 'COMMENT',
        comment: `Return to Work Certificate uploaded${body.notes ? `: ${body.notes}` : ''}`,
      },
    });

    return updated;
  });

  // Log RTW certificate upload
  await createSystemLog({
    companyId,
    userId,
    action: 'INCIDENT_UPDATED',
    entityType: 'incident',
    entityId: id,
    description: `Return to Work certificate uploaded for incident ${existing.caseNumber} (${existing.reporter?.firstName} ${existing.reporter?.lastName})`,
    metadata: { caseNumber: existing.caseNumber, rtwCertDate: body.certDate },
  });

  return c.json(incident);
});

// DELETE /incidents/:id/rtw-certificate - Remove Return to Work Certificate
incidentsRoutes.delete('/:id/rtw-certificate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');

  // Only elevated roles can remove RTW certificates
  const hasElevatedRole = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'WHS_CONTROL'].includes(user.role);
  if (!hasElevatedRole) {
    return c.json({ error: 'Forbidden: You do not have permission to remove RTW certificates' }, 403);
  }

  // Verify incident belongs to company
  const existing = await prisma.incident.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Incident not found' }, 404);
  }

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      rtwCertificateUrl: null,
      rtwCertDate: null,
      rtwUploadedAt: null,
      rtwUploadedBy: null,
      rtwNotes: null,
    },
  });

  return c.json(incident);
});

export { incidentsRoutes };
