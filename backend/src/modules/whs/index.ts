import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireWHSControl, requireSafetyAccess } from '../../middlewares/role.middleware.js';

const whsRoutes = new Hono();

// Apply auth to all routes
whsRoutes.use('*', authMiddleware);

// ===========================================
// WHS DASHBOARD
// ===========================================

// GET /whs/dashboard - Main WHS dashboard data
whsRoutes.get('/dashboard', requireWHSControl(), async (c) => {
  const user = c.get('user');

  // Parallel queries for dashboard data
  const [
    // Safety incidents
    safetyIncidents,
    openIncidentsCount,

    // Member stats
    totalMembers,

    // Recent activity (from filled PDF forms)
    recentActivity,
  ] = await Promise.all([
    // Safety-related incidents (INJURY, HEALTH_SAFETY, HIGH/CRITICAL)
    prisma.incident.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        OR: [
          { type: { in: ['INJURY', 'HEALTH_SAFETY', 'MEDICAL_EMERGENCY'] } },
          { severity: { in: ['HIGH', 'CRITICAL'] } },
        ],
      },
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Open incidents count
    prisma.incident.count({
      where: {
        companyId: user.companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),

    // Total members (users with MEMBER or WORKER role in company)
    prisma.user.count({
      where: { companyId: user.companyId, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
    }),

    // Recent form activity
    prisma.systemLog.findMany({
      where: {
        companyId: user.companyId,
        action: { in: ['INCIDENT_UPDATED'] },
        entityType: 'filled_pdf_form',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  return c.json({
    // Overview stats
    stats: {
      totalMembers,
      openIncidents: openIncidentsCount,
    },

    // Safety incidents
    safetyIncidents: safetyIncidents.map((inc) => ({
      id: inc.id,
      caseNumber: inc.caseNumber,
      title: inc.title,
      type: inc.type,
      severity: inc.severity,
      status: inc.status,
      reporter: `${inc.reporter.firstName} ${inc.reporter.lastName}`,
      team: inc.team?.name || 'Unassigned',
      createdAt: inc.createdAt,
    })),

    // Recent activity
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      createdAt: log.createdAt,
    })),
  });
});

// ===========================================
// SAFETY INCIDENTS (WHS View)
// ===========================================

// GET /whs/incidents - Safety-related incidents for WHS
whsRoutes.get('/incidents', requireSafetyAccess(), async (c) => {
  const user = c.get('user');
  const { status, severity, page = '1', limit = '20' } = c.req.query();

  const where: any = {
    companyId: user.companyId,
    OR: [
      { type: { in: ['INJURY', 'HEALTH_SAFETY', 'MEDICAL_EMERGENCY'] } },
      { severity: { in: ['HIGH', 'CRITICAL'] } },
    ],
  };

  if (status) where.status = status;
  if (severity) where.severity = severity;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: parseInt(limit, 10),
    }),
    prisma.incident.count({ where }),
  ]);

  return c.json({
    data: incidents,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
});

// ===========================================
// MY ASSIGNED INCIDENTS (For WHS Officer)
// ===========================================

// GET /whs/my-incidents/stats - Stats for WHS officer's assigned incidents
whsRoutes.get('/my-incidents/stats', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;

  const baseWhere = { companyId, whsAssignedTo: userId };

  const [total, open, inProgress, resolved, closed] = await Promise.all([
    prisma.incident.count({ where: baseWhere }),
    prisma.incident.count({ where: { ...baseWhere, status: 'OPEN' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
    prisma.incident.count({ where: { ...baseWhere, status: 'CLOSED' } }),
  ]);

  return c.json({
    total,
    active: open + inProgress,
    resolved: resolved + closed,
    byStatus: { open, inProgress, resolved, closed },
  });
});

// GET /whs/my-incidents - Get incidents assigned to current WHS officer
whsRoutes.get('/my-incidents', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;
  const { status, search, page = '1', limit = '20' } = c.req.query();

  const where: any = {
    companyId,
    whsAssignedTo: userId,
  };

  if (status) where.status = status;

  // Add search filter
  if (search) {
    where.OR = [
      { caseNumber: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { reporter: { firstName: { contains: search, mode: 'insensitive' } } },
      { reporter: { lastName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        type: true,
        severity: true,
        status: true,
        title: true,
        description: true,
        createdAt: true,
        whsAssignedAt: true,
        whsAssignedNote: true,
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            team: { select: { name: true } },
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
      orderBy: [
        { status: 'asc' }, // OPEN/IN_PROGRESS first
        { severity: 'desc' },
        { whsAssignedAt: 'desc' },
      ],
      skip,
      take: parseInt(limit, 10),
    }),
    prisma.incident.count({ where }),
  ]);

  return c.json({
    data: incidents,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
});

export { whsRoutes };
