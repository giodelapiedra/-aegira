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
    // Safety-related incidents (INJURY, EQUIPMENT, HIGH/CRITICAL)
    prisma.incident.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        OR: [
          { type: { in: ['INJURY', 'EQUIPMENT'] } },
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
      { type: { in: ['INJURY', 'EQUIPMENT', 'ENVIRONMENTAL'] } },
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

export { whsRoutes };
