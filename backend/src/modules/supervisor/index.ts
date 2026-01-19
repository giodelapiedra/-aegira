import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireSupervisor } from '../../middlewares/role.middleware.js';
import { createSystemLog } from '../system-logs/index.js';
import { isValidUUID, parsePagination } from '../../utils/validator.js';
import { getTodayRange, DEFAULT_TIMEZONE } from '../../utils/date-helpers.js';
import type { AppContext } from '../../types/context.js';

// Validation schema for assign-whs
const assignWHSSchema = z.object({
  whsOfficerId: z.string().uuid('Invalid WHS officer ID format'),
  note: z.string().max(500).optional(),
});

const supervisorRoutes = new Hono<AppContext>();

// Select fields for incident list (reusable)
const incidentListSelect = {
  id: true,
  caseNumber: true,
  type: true,
  severity: true,
  status: true,
  title: true,
  createdAt: true,
  whsAssignedAt: true,
  whsAssignedNote: true,
  reporter: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  exception: {
    select: {
      id: true,
      status: true,
      approvedAt: true,
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
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
};

// ===========================================
// GET /supervisor/incidents/stats
// Get counts for dashboard stats
// ===========================================
supervisorRoutes.get('/incidents/stats', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');

    // Base condition for pending incidents
    const pendingWhere = {
      companyId,
      whsAssignedTo: null,
      exception: { status: 'APPROVED' as const },
    };

    // Get all counts in parallel
    const [pendingTotal, criticalCount, highCount, assignedTotal] = await Promise.all([
      prisma.incident.count({ where: pendingWhere }),
      prisma.incident.count({ where: { ...pendingWhere, severity: 'CRITICAL' } }),
      prisma.incident.count({ where: { ...pendingWhere, severity: 'HIGH' } }),
      prisma.incident.count({
        where: {
          companyId,
          whsAssignedTo: { not: null },
        },
      }),
    ]);

    return c.json({
      pending: pendingTotal,
      critical: criticalCount,
      high: highCount,
      urgent: criticalCount + highCount,
      assigned: assignedTotal,
    });
  } catch (error) {
    console.error('Error fetching incident stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// ===========================================
// GET /supervisor/incidents/pending
// Incidents TL-approved, not yet assigned to WHS
// ===========================================
supervisorRoutes.get('/incidents/pending', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { page, limit, skip } = parsePagination(c);

    // Get query params for filtering
    const search = c.req.query('search')?.trim() || '';
    const severity = c.req.query('severity') || '';

    // Validate severity if provided
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (severity && !validSeverities.includes(severity)) {
      return c.json({ error: 'Invalid severity filter' }, 400);
    }

    // Build where clause
    const where: any = {
      companyId,
      whsAssignedTo: null,
      exception: {
        status: 'APPROVED' as const,
      },
    };

    // Add severity filter
    if (severity) {
      where.severity = severity;
    }

    // Add search filter (case number, worker name, team name)
    if (search) {
      where.OR = [
        { caseNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { reporter: { firstName: { contains: search, mode: 'insensitive' } } },
        { reporter: { lastName: { contains: search, mode: 'insensitive' } } },
        { reporter: { team: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        select: incidentListSelect,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
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
  } catch (error) {
    console.error('Error fetching pending incidents:', error);
    return c.json({ error: 'Failed to fetch pending incidents' }, 500);
  }
});

// ===========================================
// GET /supervisor/incidents/assigned
// Incidents already assigned to WHS
// ===========================================
supervisorRoutes.get('/incidents/assigned', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { page, limit, skip } = parsePagination(c);

    // Get query params
    const whsOfficerId = c.req.query('whsOfficerId');
    const search = c.req.query('search')?.trim() || '';
    const severity = c.req.query('severity') || '';

    // Validate optional whsOfficerId if provided
    if (whsOfficerId && !isValidUUID(whsOfficerId)) {
      return c.json({ error: 'Invalid WHS officer ID format' }, 400);
    }

    // Validate severity if provided
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (severity && !validSeverities.includes(severity)) {
      return c.json({ error: 'Invalid severity filter' }, 400);
    }

    const where: any = {
      companyId,
      whsAssignedTo: { not: null },
    };

    if (whsOfficerId) {
      where.whsAssignedTo = whsOfficerId;
    }

    if (severity) {
      where.severity = severity;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { caseNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { reporter: { firstName: { contains: search, mode: 'insensitive' } } },
        { reporter: { lastName: { contains: search, mode: 'insensitive' } } },
        { reporter: { team: { name: { contains: search, mode: 'insensitive' } } } },
        { whsOfficer: { firstName: { contains: search, mode: 'insensitive' } } },
        { whsOfficer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        select: incidentListSelect,
        orderBy: { whsAssignedAt: 'desc' },
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
  } catch (error) {
    console.error('Error fetching assigned incidents:', error);
    return c.json({ error: 'Failed to fetch assigned incidents' }, 500);
  }
});

// ===========================================
// PATCH /supervisor/incidents/:id/assign-whs
// Assign incident to a WHS officer
// ===========================================
supervisorRoutes.patch('/incidents/:id/assign-whs', requireSupervisor(), async (c) => {
  try {
    const id = c.req.param('id');
    const companyId = c.get('companyId');
    const supervisorId = c.get('userId');

    // Validate incident ID format
    if (!isValidUUID(id)) {
      return c.json({ error: 'Invalid incident ID format' }, 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const parsed = assignWHSSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const { whsOfficerId, note } = parsed.data;

    // Verify incident exists and belongs to company
    const incident = await prisma.incident.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        caseNumber: true,
        whsAssignedTo: true,
        reporter: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    // Verify WHS officer exists and has correct role in same company
    const whsOfficer = await prisma.user.findFirst({
      where: {
        id: whsOfficerId,
        companyId,
        role: 'WHS_CONTROL',
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!whsOfficer) {
      return c.json({ error: 'Invalid WHS officer' }, 400);
    }

    // Get supervisor info
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { firstName: true, lastName: true },
    });

    // Update incident with WHS assignment
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        whsAssignedTo: whsOfficerId,
        whsAssignedAt: new Date(),
        whsAssignedBy: supervisorId,
        whsAssignedNote: note || null,
        status: incident.whsAssignedTo ? undefined : 'IN_PROGRESS', // Only change status if first assignment
      },
      select: incidentListSelect,
    });

    // Create activity log
    await prisma.incidentActivity.create({
      data: {
        incidentId: id,
        userId: supervisorId,
        type: 'ASSIGNED',
        newValue: `${whsOfficer.firstName} ${whsOfficer.lastName} (WHS)`,
        comment: note || `Assigned to WHS officer by ${supervisor?.firstName} ${supervisor?.lastName}`,
      },
    });

    // Notify WHS officer
    const reporterName = incident.reporter
      ? `${incident.reporter.firstName} ${incident.reporter.lastName}`
      : 'Unknown';

    await prisma.notification.create({
      data: {
        userId: whsOfficerId,
        companyId,
        title: 'New Incident Assigned',
        message: `You have been assigned to handle incident ${incident.caseNumber} (${reporterName})`,
        type: 'INCIDENT_ASSIGNED',
        data: { incidentId: id },
      },
    });

    // System log
    await createSystemLog({
      companyId,
      userId: supervisorId,
      action: 'INCIDENT_UPDATED',
      entityType: 'incident',
      entityId: id,
      description: `Assigned incident ${incident.caseNumber} to WHS officer ${whsOfficer.firstName} ${whsOfficer.lastName}`,
      metadata: { whsOfficerId, caseNumber: incident.caseNumber },
    });

    return c.json(updated);
  } catch (error) {
    console.error('Error assigning incident to WHS:', error);
    return c.json({ error: 'Failed to assign incident' }, 500);
  }
});

// ===========================================
// GET /supervisor/whs-officers
// List WHS officers for dropdown (max 50)
// ===========================================
supervisorRoutes.get('/whs-officers', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');

    const officers = await prisma.user.findMany({
      where: {
        companyId,
        role: 'WHS_CONTROL',
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
      orderBy: { firstName: 'asc' },
      take: 50, // Safety limit for dropdown
    });

    return c.json(officers);
  } catch (error) {
    console.error('Error fetching WHS officers:', error);
    return c.json({ error: 'Failed to fetch WHS officers' }, 500);
  }
});

// ===========================================
// GET /supervisor/personnel/stats
// Get counts for personnel status
// ===========================================
supervisorRoutes.get('/personnel/stats', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');

    // Get company timezone
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const timezone = company?.timezone || DEFAULT_TIMEZONE;
    const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

    // Get all workers/members with teams
    const allWorkers = await prisma.user.findMany({
      where: {
        companyId,
        role: { in: ['MEMBER', 'WORKER'] },
        teamId: { not: null },
        isActive: true,
      },
      select: { id: true },
    });

    const workerIds = allWorkers.map(w => w.id);

    // Get today's check-ins for these workers
    const checkins = await prisma.checkin.findMany({
      where: {
        userId: { in: workerIds },
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        userId: true,
        readinessStatus: true,
      },
    });

    // Get approved leaves active today
    const leaves = await prisma.exception.findMany({
      where: {
        userId: { in: workerIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: { userId: true },
    });

    // Create maps
    const checkinMap = new Map(checkins.map(c => [c.userId, c.readinessStatus]));
    const leaveSet = new Set(leaves.map(l => l.userId));

    // Calculate stats
    let green = 0, red = 0, onLeave = 0, notCheckedIn = 0;
    for (const worker of allWorkers) {
      if (leaveSet.has(worker.id)) {
        onLeave++;
      } else if (checkinMap.has(worker.id)) {
        const status = checkinMap.get(worker.id);
        if (status === 'GREEN') green++;
        else if (status === 'RED') red++;
      } else {
        notCheckedIn++;
      }
    }

    return c.json({
      total: allWorkers.length,
      green,
      red,
      onLeave,
      notCheckedIn,
    });
  } catch (error) {
    console.error('Error fetching personnel stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// ===========================================
// GET /supervisor/personnel
// Get personnel with check-in status (server-side filtered)
// ===========================================
supervisorRoutes.get('/personnel', requireSupervisor(), async (c) => {
  try {
    const companyId = c.get('companyId');
    const { page, limit, skip } = parsePagination(c);
    const search = c.req.query('search')?.trim() || '';
    const status = c.req.query('status') || ''; // GREEN, RED, ON_LEAVE, NOT_CHECKED_IN

    // Get company timezone
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const timezone = company?.timezone || DEFAULT_TIMEZONE;
    const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

    // Build where clause for users
    const userWhere: any = {
      companyId,
      role: { in: ['MEMBER', 'WORKER'] },
      teamId: { not: null },
      isActive: true,
    };

    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { team: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // First get all matching users (for status filtering we need to check checkins/leaves)
    const allMatchingUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const userIds = allMatchingUsers.map(u => u.id);

    // Get today's check-ins
    const checkins = await prisma.checkin.findMany({
      where: {
        userId: { in: userIds },
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        userId: true,
        readinessStatus: true,
        readinessScore: true,
        createdAt: true,
      },
    });

    // Get approved leaves active today
    const leaves = await prisma.exception.findMany({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: {
        userId: true,
        type: true,
        startDate: true,
        endDate: true,
      },
    });

    // Create maps
    const checkinMap = new Map(checkins.map(c => [c.userId, c]));
    const leaveMap = new Map(leaves.map(l => [l.userId, l]));

    // Combine user data with status
    let usersWithStatus = allMatchingUsers.map(user => {
      const checkin = checkinMap.get(user.id);
      const leave = leaveMap.get(user.id);

      let currentStatus: string;
      if (leave) {
        currentStatus = 'ON_LEAVE';
      } else if (checkin) {
        currentStatus = checkin.readinessStatus;
      } else {
        currentStatus = 'NOT_CHECKED_IN';
      }

      return {
        ...user,
        checkin: checkin ? {
          readinessStatus: checkin.readinessStatus,
          readinessScore: checkin.readinessScore,
          createdAt: checkin.createdAt,
        } : null,
        leave: leave ? {
          type: leave.type,
          startDate: leave.startDate,
          endDate: leave.endDate,
        } : null,
        currentStatus,
      };
    });

    // Apply status filter
    if (status) {
      usersWithStatus = usersWithStatus.filter(u => u.currentStatus === status);
    }

    // Paginate
    const total = usersWithStatus.length;
    const paginatedUsers = usersWithStatus.slice(skip, skip + limit);

    return c.json({
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return c.json({ error: 'Failed to fetch personnel' }, 500);
  }
});

export { supervisorRoutes };
