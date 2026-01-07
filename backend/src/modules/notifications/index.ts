import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';

const notificationsRoutes = new Hono<AppContext>();

// GET /notifications - List notifications for current user
// Supports filter: 'all' | 'unread' | 'read' | 'archived'
notificationsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const limit = parseInt(c.req.query('limit') || '100');
  const filter = c.req.query('filter') || 'all'; // all, unread, read, archived

  // Build where clause based on filter
  const where: any = { userId, companyId };

  switch (filter) {
    case 'unread':
      where.isRead = false;
      where.isArchived = { not: true }; // false or null
      break;
    case 'read':
      where.isRead = true;
      where.isArchived = { not: true }; // false or null
      break;
    case 'archived':
      where.isArchived = true;
      break;
    case 'all':
    default:
      where.isArchived = { not: true }; // false or null (non-archived)
      break;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      isRead: true,
      isArchived: true,
      data: true,
      createdAt: true,
    },
  });

  return c.json({ data: notifications });
});

// GET /notifications/unread - Get unread count (excludes archived)
notificationsRoutes.get('/unread', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const count = await prisma.notification.count({
    where: {
      userId,
      companyId,
      isRead: false,
      isArchived: { not: true }, // Exclude archived
    },
  });

  return c.json({ count });
});

// PATCH /notifications/:id/read - Mark as read
notificationsRoutes.patch('/:id/read', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // SECURITY: Verify notification belongs to user AND company
  const notification = await prisma.notification.updateMany({
    where: { id, userId, companyId },
    data: { isRead: true },
  });

  if (notification.count === 0) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  return c.json({ success: true });
});

// PATCH /notifications/read-all - Mark all as read
notificationsRoutes.patch('/read-all', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  await prisma.notification.updateMany({
    where: {
      userId,
      companyId,
      isRead: false,
      isArchived: { not: true }, // Only non-archived
    },
    data: { isRead: true },
  });

  return c.json({ success: true });
});

// PATCH /notifications/:id/archive - Archive notification
notificationsRoutes.patch('/:id/archive', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const notification = await prisma.notification.updateMany({
    where: { id, userId, companyId },
    data: { isArchived: true, isRead: true }, // Also mark as read when archiving
  });

  if (notification.count === 0) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  return c.json({ success: true });
});

// PATCH /notifications/:id/unarchive - Unarchive notification
notificationsRoutes.patch('/:id/unarchive', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const notification = await prisma.notification.updateMany({
    where: { id, userId, companyId },
    data: { isArchived: false },
  });

  if (notification.count === 0) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  return c.json({ success: true });
});

// DELETE /notifications/:id - Delete notification
notificationsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // SECURITY: Verify notification belongs to user AND company
  const notification = await prisma.notification.deleteMany({
    where: { id, userId, companyId },
  });

  if (notification.count === 0) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /notifications/send-reminder - Send check-in reminder to a team member
notificationsRoutes.post('/send-reminder', async (c) => {
  const currentUserId = c.get('userId');
  const companyId = c.get('companyId');

  const body = await c.req.json();
  const { userId } = body;

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  // Get the current user (sender) info
  const sender = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { firstName: true, lastName: true, role: true },
  });

  // Verify the target user exists and is in the same company
  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Create notification for the target user
  const notification = await prisma.notification.create({
    data: {
      userId: targetUser.id,
      companyId,
      title: 'Check-in Reminder',
      message: `${sender?.firstName} ${sender?.lastName} sent you a reminder to complete your daily check-in.`,
      type: 'CHECKIN_REMINDER',
      data: {
        senderId: currentUserId,
        senderName: `${sender?.firstName} ${sender?.lastName}`,
      },
    },
  });

  return c.json({
    success: true,
    message: `Reminder sent to ${targetUser.firstName} ${targetUser.lastName}`,
    notification,
  });
});

export { notificationsRoutes };
