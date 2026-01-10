import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { getTodayStart, getLastNDaysRange, DEFAULT_TIMEZONE } from '../../utils/date-helpers.js';
import type { AppContext } from '../../types/context.js';

const systemLogsRoutes = new Hono<AppContext>();

// Helper function to create system log
export async function createSystemLog(data: {
  companyId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    return await prisma.systemLog.create({
      data: {
        companyId: data.companyId,
        userId: data.userId || null,
        action: data.action as any,
        entityType: data.entityType,
        entityId: data.entityId || null,
        description: data.description,
        metadata: data.metadata || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error: any) {
    console.error('Failed to create system log:', error?.message || error);
    return null;
  }
}

// GET /system-logs - List all system logs (Admin/Executive/Supervisor only)
// ADMIN: Super admin - sees all logs across all companies
// EXECUTIVE/SUPERVISOR: See only their own company's logs
systemLogsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');

  // Only ADMIN, EXECUTIVE, and SUPERVISOR can view system logs
  if (!['ADMIN', 'EXECUTIVE', 'SUPERVISOR'].includes(user.role)) {
    return c.json({ error: 'Unauthorized: Admin/Executive/Supervisor access required' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const action = c.req.query('action');
  const entityType = c.req.query('entityType');
  const userId = c.req.query('userId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const search = c.req.query('search');

  const skip = (page - 1) * limit;

  // ADMIN: Super admin - sees all logs across all companies
  // EXECUTIVE/SUPERVISOR: Only see their own company's logs
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = {};

  // Only filter by companyId for non-admin roles (EXECUTIVE, SUPERVISOR)
  if (!isAdmin) {
    where.companyId = companyId;
  }

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.description = { contains: search, mode: 'insensitive' };
  }

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.systemLog.count({ where }),
  ]);

  // Get user info for each log
  const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId as string))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      role: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  const logsWithUsers = logs.map(log => ({
    ...log,
    user: log.userId ? userMap.get(log.userId) || null : null,
  }));

  return c.json({
    data: logsWithUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /system-logs/stats - Get log statistics (Admin/Executive/Supervisor only)
// ADMIN: Super admin - sees all stats across all companies
// EXECUTIVE/SUPERVISOR: See only their own company's stats
systemLogsRoutes.get('/stats', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');

  if (!['ADMIN', 'EXECUTIVE', 'SUPERVISOR'].includes(user.role)) {
    return c.json({ error: 'Unauthorized: Admin/Executive/Supervisor access required' }, 403);
  }

  // Get company timezone for date calculations
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

  // Use timezone-aware date helpers
  const today = getTodayStart(timezone);
  const { start: weekAgo } = getLastNDaysRange(7, timezone);

  // ADMIN: Super admin - sees all logs across all companies
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const baseWhere: any = {};
  const weekWhere: any = { createdAt: { gte: weekAgo } };
  const todayWhere: any = { createdAt: { gte: today } };
  
  // Only filter by companyId for non-admin roles
  if (!isAdmin) {
    baseWhere.companyId = companyId;
    weekWhere.companyId = companyId;
    todayWhere.companyId = companyId;
  }

  const [
    totalLogs,
    todayLogs,
    weekLogs,
    actionCounts,
    entityTypeCounts,
    recentUsers,
  ] = await Promise.all([
    // Total logs
    prisma.systemLog.count({ where: baseWhere }),
    // Today's logs
    prisma.systemLog.count({ where: todayWhere }),
    // This week's logs
    prisma.systemLog.count({ where: weekWhere }),
    // Logs by action type
    prisma.systemLog.groupBy({
      by: ['action'],
      where: weekWhere,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
    // Logs by entity type
    prisma.systemLog.groupBy({
      by: ['entityType'],
      where: weekWhere,
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } },
    }),
    // Most active users this week
    prisma.systemLog.groupBy({
      by: ['userId'],
      where: { ...weekWhere, userId: { not: null } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    }),
  ]);

  // Get user details for active users
  const activeUserIds = recentUsers.map(u => u.userId as string);
  const activeUsers = await prisma.user.findMany({
    where: { id: { in: activeUserIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
    },
  });

  const userMap = new Map(activeUsers.map(u => [u.id, u]));

  return c.json({
    totalLogs,
    todayLogs,
    weekLogs,
    actionCounts: actionCounts.map(a => ({
      action: a.action,
      count: a._count.action,
    })),
    entityTypeCounts: entityTypeCounts.map(e => ({
      entityType: e.entityType,
      count: e._count.entityType,
    })),
    mostActiveUsers: recentUsers.map(u => ({
      user: userMap.get(u.userId as string),
      activityCount: u._count.userId,
    })),
  });
});

// GET /system-logs/actions - Get available action types
systemLogsRoutes.get('/actions', async (c) => {
  const user = c.get('user');

  if (!['ADMIN', 'EXECUTIVE', 'SUPERVISOR'].includes(user.role)) {
    return c.json({ error: 'Unauthorized: Admin/Executive/Supervisor access required' }, 403);
  }

  const actions = [
    // Auth
    { value: 'USER_LOGIN', label: 'User Login', category: 'Auth' },
    { value: 'USER_LOGOUT', label: 'User Logout', category: 'Auth' },
    // Users
    { value: 'USER_CREATED', label: 'User Created', category: 'Users' },
    { value: 'USER_UPDATED', label: 'User Updated', category: 'Users' },
    { value: 'USER_DELETED', label: 'User Deleted', category: 'Users' },
    { value: 'USER_ROLE_CHANGED', label: 'Role Changed', category: 'Users' },
    { value: 'USER_DEACTIVATED', label: 'User Deactivated', category: 'Users' },
    { value: 'USER_REACTIVATED', label: 'User Reactivated', category: 'Users' },
    // Teams
    { value: 'TEAM_CREATED', label: 'Team Created', category: 'Teams' },
    { value: 'TEAM_UPDATED', label: 'Team Updated', category: 'Teams' },
    { value: 'TEAM_DELETED', label: 'Team Deleted', category: 'Teams' },
    { value: 'TEAM_MEMBER_ADDED', label: 'Member Added', category: 'Teams' },
    { value: 'TEAM_MEMBER_REMOVED', label: 'Member Removed', category: 'Teams' },
    // Incidents
    { value: 'INCIDENT_CREATED', label: 'Incident Created', category: 'Incidents' },
    { value: 'INCIDENT_UPDATED', label: 'Incident Updated', category: 'Incidents' },
    { value: 'INCIDENT_STATUS_CHANGED', label: 'Status Changed', category: 'Incidents' },
    { value: 'INCIDENT_ASSIGNED', label: 'Incident Assigned', category: 'Incidents' },
    // Exceptions
    { value: 'EXCEPTION_CREATED', label: 'Exception Created', category: 'Exceptions' },
    { value: 'EXCEPTION_APPROVED', label: 'Exception Approved', category: 'Exceptions' },
    { value: 'EXCEPTION_REJECTED', label: 'Exception Rejected', category: 'Exceptions' },
    // Check-ins
    { value: 'CHECKIN_SUBMITTED', label: 'Check-in Submitted', category: 'Check-ins' },
    // Settings
    { value: 'SETTINGS_UPDATED', label: 'Settings Updated', category: 'Settings' },
    // AI Insights
    { value: 'AI_SUMMARY_GENERATED', label: 'AI Summary Generated', category: 'AI Insights' },
  ];

  return c.json(actions);
});

// GET /system-logs/entity-types - Get available entity types
systemLogsRoutes.get('/entity-types', async (c) => {
  const user = c.get('user');

  if (!['ADMIN', 'EXECUTIVE', 'SUPERVISOR'].includes(user.role)) {
    return c.json({ error: 'Unauthorized: Admin/Executive/Supervisor access required' }, 403);
  }

  const entityTypes = [
    { value: 'user', label: 'Users' },
    { value: 'team', label: 'Teams' },
    { value: 'incident', label: 'Incidents' },
    { value: 'exception', label: 'Exceptions' },
    { value: 'checkin', label: 'Check-ins' },
    { value: 'settings', label: 'Settings' },
    { value: 'ai_summary', label: 'AI Summaries' },
  ];

  return c.json(entityTypes);
});

// GET /system-logs/:id - Get single log detail
// ADMIN: Super admin - can access any log across all companies
// EXECUTIVE/SUPERVISOR: Can only access logs from their own company
systemLogsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');
  const id = c.req.param('id');

  if (!['ADMIN', 'EXECUTIVE', 'SUPERVISOR'].includes(user.role)) {
    return c.json({ error: 'Unauthorized: Admin/Executive/Supervisor access required' }, 403);
  }

  // ADMIN: Super admin - can access any log
  // EXECUTIVE/SUPERVISOR: Only their company's logs
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  const log = await prisma.systemLog.findFirst({
    where,
  });

  if (!log) {
    return c.json({ error: 'Log not found' }, 404);
  }

  // Get user info if available
  let logUser = null;
  if (log.userId) {
    logUser = await prisma.user.findUnique({
      where: { id: log.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
      },
    });
  }

  return c.json({
    ...log,
    user: logUser,
  });
});

export { systemLogsRoutes };
