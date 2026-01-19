import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireWHSControl, requireSafetyAccess, requireSupervisor } from '../../middlewares/role.middleware.js';
import { parsePagination } from '../../utils/validator.js';
import type { AppContext } from '../../types/context.js';

const whsRoutes = new Hono<AppContext>();

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

  // Optimized: Single query with groupBy instead of 5 separate COUNT queries
  const statusCounts = await prisma.incident.groupBy({
    by: ['status'],
    where: { companyId, whsAssignedTo: userId },
    _count: { status: true },
  });

  // Map results to status counts
  const byStatus = {
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  };

  let total = 0;
  for (const item of statusCounts) {
    const count = item._count.status;
    total += count;
    switch (item.status) {
      case 'OPEN': byStatus.open = count; break;
      case 'IN_PROGRESS': byStatus.inProgress = count; break;
      case 'RESOLVED': byStatus.resolved = count; break;
      case 'CLOSED': byStatus.closed = count; break;
    }
  }

  return c.json({
    total,
    active: byStatus.open + byStatus.inProgress,
    resolved: byStatus.resolved + byStatus.closed,
    byStatus,
  });
});

// GET /whs/my-incidents - Get incidents assigned to current WHS officer
whsRoutes.get('/my-incidents', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;
  const { status, search } = c.req.query();

  // Use parsePagination for validated pagination with limit cap (max 100)
  const { page, limit, skip } = parsePagination(c);

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

// ===========================================
// WHS ANALYTICS (Phase 1 - MVP)
// ===========================================

// GET /whs/analytics/summary - Summary cards with KPIs
whsRoutes.get('/analytics/summary', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;
  const role = user.role;

  // WHS officer sees own cases, Supervisor/Executive/Admin sees all WHS cases
  const baseWhere = role === 'WHS_CONTROL'
    ? { companyId, whsAssignedTo: userId }
    : { companyId, whsAssignedTo: { not: null } };

  // For overdue count, we need user filter for raw SQL
  const whereUser = role === 'WHS_CONTROL' ? userId : null;

  const [statusCounts, critical, pendingRTW, resolvedCases, overdueResult] = await Promise.all([
    // Status breakdown - single groupBy instead of multiple counts
    prisma.incident.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    }),

    // Critical/High severity cases
    prisma.incident.count({
      where: { ...baseWhere, severity: { in: ['HIGH', 'CRITICAL'] } }
    }),

    // Pending RTW (resolved/closed but no certificate)
    prisma.incident.count({
      where: {
        ...baseWhere,
        status: { in: ['RESOLVED', 'CLOSED'] },
        rtwCertificateUrl: null
      }
    }),

    // Get resolved cases for avg calculation
    prisma.incident.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { not: null },
        whsAssignedAt: { not: null }
      },
      select: { whsAssignedAt: true, resolvedAt: true }
    }),

    // Overdue count - severity-based SLA thresholds
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM incidents
      WHERE "companyId" = ${companyId}
        AND (${whereUser}::text IS NULL OR "whsAssignedTo" = ${whereUser})
        AND "whsAssignedTo" IS NOT NULL
        AND status IN ('OPEN', 'IN_PROGRESS')
        AND (
          (severity = 'CRITICAL' AND "whsAssignedAt" < NOW() - INTERVAL '1 day') OR
          (severity = 'HIGH' AND "whsAssignedAt" < NOW() - INTERVAL '3 days') OR
          (severity = 'MEDIUM' AND "whsAssignedAt" < NOW() - INTERVAL '7 days') OR
          (severity = 'LOW' AND "whsAssignedAt" < NOW() - INTERVAL '14 days')
        )
    `,
  ]);

  // Map status counts
  const byStatus = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
  let total = 0;
  for (const item of statusCounts) {
    const count = item._count.status;
    total += count;
    switch (item.status) {
      case 'OPEN': byStatus.open = count; break;
      case 'IN_PROGRESS': byStatus.inProgress = count; break;
      case 'RESOLVED': byStatus.resolved = count; break;
      case 'CLOSED': byStatus.closed = count; break;
    }
  }
  const active = byStatus.open + byStatus.inProgress;

  // Calculate average resolution time
  let avgResolutionDays = null;
  if (resolvedCases.length > 0) {
    const totalDays = resolvedCases.reduce((sum, inc) => {
      const diffMs = new Date(inc.resolvedAt!).getTime() - new Date(inc.whsAssignedAt!).getTime();
      const days = diffMs / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgResolutionDays = Math.round((totalDays / resolvedCases.length) * 10) / 10; // 1 decimal
  }

  return c.json({
    total,
    active,
    resolved: total - active,
    critical,
    pendingRTW,
    overdue: Number(overdueResult[0]?.count || 0),
    avgResolutionDays,
    byStatus,
  });
});

// GET /whs/analytics/breakdown - Breakdown charts data (by type, severity, status)
whsRoutes.get('/analytics/breakdown', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const baseWhere = user.role === 'WHS_CONTROL'
    ? { companyId: user.companyId, whsAssignedTo: user.id }
    : { companyId: user.companyId, whsAssignedTo: { not: null } };

  const [byType, bySeverity, byStatus] = await Promise.all([
    prisma.incident.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: { type: true },
    }),
    prisma.incident.groupBy({
      by: ['severity'],
      where: baseWhere,
      _count: { severity: true },
    }),
    prisma.incident.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    }),
  ]);

  return c.json({ byType, bySeverity, byStatus });
});

// GET /whs/analytics/overdue-cases - Cases exceeding SLA targets
whsRoutes.get('/analytics/overdue-cases', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;

  const whereUser = user.role === 'WHS_CONTROL'
    ? userId
    : null; // null means all WHS officers

  const overdue = await prisma.$queryRaw<Array<{
    id: string;
    caseNumber: string;
    type: string;
    severity: string;
    status: string;
    title: string;
    whsAssignedAt: Date;
    days_open: number;
    reporter_first_name: string | null;
    reporter_last_name: string | null;
    team_name: string | null;
  }>>`
    SELECT
      i.id,
      i."caseNumber",
      i.type,
      i.severity,
      i.status,
      i.title,
      i."whsAssignedAt",
      EXTRACT(DAY FROM NOW() - i."whsAssignedAt")::integer as days_open,
      u."firstName" as reporter_first_name,
      u."lastName" as reporter_last_name,
      t.name as team_name
    FROM incidents i
    LEFT JOIN users u ON i."reportedBy" = u.id
    LEFT JOIN teams t ON i."teamId" = t.id
    WHERE i."companyId" = ${companyId}
      AND (${whereUser}::text IS NULL OR i."whsAssignedTo" = ${whereUser})
      AND i."whsAssignedTo" IS NOT NULL
      AND i.status IN ('OPEN', 'IN_PROGRESS')
      AND (
        (i.severity = 'CRITICAL' AND i."whsAssignedAt" < NOW() - INTERVAL '1 day') OR
        (i.severity = 'HIGH' AND i."whsAssignedAt" < NOW() - INTERVAL '3 days') OR
        (i.severity = 'MEDIUM' AND i."whsAssignedAt" < NOW() - INTERVAL '7 days') OR
        (i.severity = 'LOW' AND i."whsAssignedAt" < NOW() - INTERVAL '14 days')
      )
    ORDER BY
      CASE i.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      i."whsAssignedAt" ASC
  `;

  return c.json({ data: overdue });
});

// GET /whs/analytics/rtw-pending - Pending Return to Work cases
whsRoutes.get('/analytics/rtw-pending', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const baseWhere = user.role === 'WHS_CONTROL'
    ? { companyId: user.companyId, whsAssignedTo: user.id }
    : { companyId: user.companyId, whsAssignedTo: { not: null } };

  const pendingRTW = await prisma.incident.findMany({
    where: {
      ...baseWhere,
      status: { in: ['RESOLVED', 'CLOSED'] },
      rtwCertificateUrl: null,
    },
    select: {
      id: true,
      caseNumber: true,
      type: true,
      resolvedAt: true,
      reporter: {
        select: { firstName: true, lastName: true }
      },
      team: {
        select: { name: true }
      },
    },
    orderBy: { resolvedAt: 'asc' }, // Oldest first (longest waiting)
  });

  // Calculate days since resolved
  const data = pendingRTW.map(inc => ({
    ...inc,
    daysSinceResolved: inc.resolvedAt
      ? Math.floor((Date.now() - new Date(inc.resolvedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
  }));

  return c.json({ data });
});

export { whsRoutes };
