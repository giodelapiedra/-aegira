import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createSystemLog } from '../system-logs/index.js';
import { randomBytes } from 'crypto';
import type { AppContext } from '../../types/context.js';
import { getAssignableRoles, type Role } from '../../types/roles.js';
import { passwordSchema, parsePagination, isValidUUID, parseOptionalUUID } from '../../utils/validator.js';
import { logger } from '../../utils/logger.js';

const usersRoutes = new Hono<AppContext>();

// POST /users - Create user directly (Executive only)
// Executive creates all users with same company - no invitation needed
usersRoutes.post('/', async (c) => {
  const currentUser = c.get('user');
  const companyId = c.get('companyId');
  const body = await c.req.json();

  // Only EXECUTIVE can create users directly
  if (currentUser.role !== 'EXECUTIVE') {
    return c.json(
      { error: 'Forbidden: Only Executive can create user accounts' },
      403
    );
  }

  // Validate required fields
  const { email, firstName, lastName, role, password, teamId, birthDate, gender } = body;

  if (!email || !firstName || !lastName || !role || !password) {
    return c.json(
      { error: 'Missing required fields: email, firstName, lastName, role, password' },
      400
    );
  }

  // Validate gender if provided
  const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
  if (gender && !validGenders.includes(gender)) {
    return c.json({ error: 'Invalid gender value' }, 400);
  }

  // Validate role - Executive can assign any role except EXECUTIVE
  const assignableRoles = getAssignableRoles(currentUser.role as Role);
  if (!assignableRoles.includes(role)) {
    return c.json(
      { error: `Cannot assign role: ${role}. Assignable roles: ${assignableRoles.join(', ')}` },
      400
    );
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return c.json({ error: 'Email already in use' }, 400);
  }

  // Validate team belongs to company if provided
  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, companyId },
    });
    if (!team) {
      return c.json({ error: 'Team not found in your company' }, 400);
    }
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return c.json({ error: authError.message }, 400);
  }

  // Create user in Prisma with same company as Executive
  const user = await prisma.user.create({
    data: {
      id: authData.user.id,
      email,
      firstName,
      lastName,
      role,
      companyId, // Automatically inherits Executive's company
      teamId: teamId || null,
      teamJoinedAt: teamId ? new Date() : null, // Set when assigned to team
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      teamId: true,
      birthDate: true,
      gender: true,
      isActive: true,
      createdAt: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Log user creation
  await createSystemLog({
    companyId,
    userId: currentUser.id,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: user.id,
    description: `${currentUser.firstName} ${currentUser.lastName} created user ${firstName} ${lastName} (${role})`,
    metadata: { email, role, teamId },
  });

  return c.json(user, 201);
});

// GET /users/me - Get current user with company
usersRoutes.get('/me', async (c) => {
  const userId = c.get('userId');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
      phone: true,
      birthDate: true,
      gender: true,
      companyId: true,
      teamId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          timezone: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(user);
});

// PATCH /users/me - Update own profile
usersRoutes.patch('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const { firstName, lastName, phone, birthDate, gender } = body;

  // Validate required fields
  if (!firstName || !lastName) {
    return c.json({ error: 'First name and last name are required' }, 400);
  }

  // Validate gender if provided
  const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
  if (gender && !validGenders.includes(gender)) {
    return c.json({ error: 'Invalid gender value' }, 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      phone: phone || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
      phone: true,
      birthDate: true,
      gender: true,
      companyId: true,
      teamId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return c.json(user);
});

// PATCH /users/me/password - Change own password
usersRoutes.patch('/me/password', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current password and new password are required' }, 400);
  }

  // Validate new password using the same schema as registration
  const passwordValidation = passwordSchema.safeParse(newPassword);
  if (!passwordValidation.success) {
    const errors = passwordValidation.error.issues.map((e) => e.message).join(', ');
    return c.json({ error: errors }, 400);
  }

  // Get user email for re-authentication
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }

  // Update password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return c.json({ error: 'Failed to update password' }, 500);
  }

  return c.json({ success: true, message: 'Password updated successfully' });
});

// GET /users - List users (company-scoped, except for ADMIN - super admin sees all)
usersRoutes.get('/', async (c) => {
  try {
    const companyId = c.get('companyId');
    const user = c.get('user');

    // Use validated pagination helper
    const { page, limit, skip } = parsePagination(c);

    const role = c.req.query('role');
    const teamIdParam = c.req.query('teamId');
    const search = c.req.query('search');
    const includeInactive = c.req.query('includeInactive') === 'true';

    // Validate teamId if provided
    const teamId = parseOptionalUUID(teamIdParam);

    // ADMIN: Super admin - can see ALL users across ALL companies
    const isAdmin = user.role?.toUpperCase() === 'ADMIN';
    const where: any = {};
    
    // Only filter by companyId for non-admin roles
    if (!isAdmin) {
      where.companyId = companyId;
    }
    
    if (!includeInactive) {
      where.isActive = true;
    }
    if (role) where.role = role;
    if (teamId) where.teamId = teamId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
          teamId: true,
          isActive: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return c.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Error fetching users');
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /users/:id - Get user by ID (company-scoped, except for ADMIN)
usersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  // Validate UUID format
  if (!isValidUUID(id)) {
    return c.json({ error: 'Invalid user ID format' }, 400);
  }

  const companyId = c.get('companyId');
  const user = c.get('user');

  // ADMIN: Super admin - can access any user
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  const foundUser = await prisma.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
      phone: true,
      teamId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!foundUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(foundUser);
});

// PUT /users/:id - Update user (company-scoped, except for ADMIN)
usersRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // ADMIN: Super admin - can update any user
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if team is being changed
  const isTeamChanging = body.teamId !== undefined && body.teamId !== existing.teamId;

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      avatar: body.avatar,
      teamId: body.teamId,
      // Update teamJoinedAt when team changes
      ...(isTeamChanging && { teamJoinedAt: body.teamId ? new Date() : null }),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatar: true,
      phone: true,
      teamId: true,
      isActive: true,
    },
  });

  // Log user update - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUser.id,
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} updated user ${user.firstName} ${user.lastName}`,
    metadata: { updatedFields: Object.keys(body) },
  });

  return c.json(user);
});

// PATCH /users/:id/role - Update user role (Executive/Admin only, company-scoped except for ADMIN)
usersRoutes.patch('/:id/role', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const body = await c.req.json();

  // Only EXECUTIVE and ADMIN can change roles
  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Validate role assignment based on current user's role
  const assignableRoles = getAssignableRoles(currentUser.role as Role);
  if (!assignableRoles.includes(body.role)) {
    return c.json(
      { error: `Cannot assign role: ${body.role}. Assignable roles: ${assignableRoles.join(', ')}` },
      403
    );
  }

  // ADMIN: Super admin - can change role of any user
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot change EXECUTIVE role
  if (existing.role === 'EXECUTIVE') {
    return c.json({ error: 'Cannot modify EXECUTIVE role' }, 403);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  // Log role change - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUser.id,
    action: 'USER_ROLE_CHANGED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} changed ${user.firstName} ${user.lastName}'s role from ${existing.role} to ${body.role}`,
    metadata: { oldRole: existing.role, newRole: body.role },
  });

  return c.json(user);
});

// DELETE /users/:id - Soft delete user (company-scoped, except for ADMIN)
usersRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  // Only EXECUTIVE and ADMIN can delete users
  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // ADMIN: Super admin - can delete any user
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot delete EXECUTIVE
  if (existing.role === 'EXECUTIVE') {
    return c.json({ error: 'Cannot delete EXECUTIVE user' }, 403);
  }

  // Cannot delete self
  if (id === currentUser.id) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  // Log user deactivation - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUser.id,
    action: 'USER_DEACTIVATED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} deactivated user ${existing.firstName} ${existing.lastName}`,
    metadata: { email: existing.email, role: existing.role },
  });

  return c.json({ success: true });
});

// POST /users/:id/reactivate - Reactivate user (company-scoped, except for ADMIN)
usersRoutes.post('/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');

  // Only EXECUTIVE and ADMIN can reactivate users
  if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // ADMIN: Super admin - can reactivate any user
  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  // Log user reactivation - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUser.id,
    action: 'USER_REACTIVATED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} reactivated user ${existing.firstName} ${existing.lastName}`,
    metadata: { email: existing.email, role: existing.role },
  });

  return c.json({ success: true });
});

export { usersRoutes };
