import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createSystemLog } from '../system-logs/index.js';
import { randomBytes } from 'crypto';
import type { AppContext } from '../../types/context.js';
import { getAssignableRoles, type Role } from '../../types/roles.js';
import { passwordSchema, parsePagination, isValidUUID, parseOptionalUUID } from '../../utils/validator.js';
import { logger } from '../../utils/logger.js';
import { uploadToR2, deleteFromR2, isValidImageType, FILE_SIZE_LIMITS } from '../../utils/upload.js';

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

// POST /users/me/avatar - Upload profile avatar
usersRoutes.post('/me/avatar', async (c) => {
  const userId = c.get('userId');

  try {
    const formData = await c.req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Validate file type
    if (!isValidImageType(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }, 400);
    }

    // Validate file size (2MB limit for images)
    if (file.size > FILE_SIZE_LIMITS.IMAGE) {
      const limitMB = FILE_SIZE_LIMITS.IMAGE / (1024 * 1024);
      return c.json({ error: `File size exceeds ${limitMB}MB limit` }, 400);
    }

    // Get current user to check for existing avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    // Delete old avatar from R2 if exists
    if (currentUser?.avatar) {
      try {
        // Extract key from URL (e.g., "https://upload.aegira.health/avatars/uuid.jpg" -> "avatars/uuid.jpg")
        const urlParts = currentUser.avatar.split('/');
        const key = urlParts.slice(-2).join('/'); // Get last 2 parts: folder/filename
        await deleteFromR2(key);
      } catch (deleteError) {
        // Log but don't fail if old avatar deletion fails
        logger.warn({ error: deleteError }, 'Failed to delete old avatar');
      }
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const result = await uploadToR2(buffer, file.name, file.type, 'avatars');

    // Update user avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: result.url },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    return c.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    logger.error({ error }, 'Avatar upload failed');
    return c.json({ error: 'Failed to upload avatar' }, 500);
  }
});

// DELETE /users/me/avatar - Remove profile avatar
usersRoutes.delete('/me/avatar', async (c) => {
  const userId = c.get('userId');

  try {
    // Get current user avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!currentUser?.avatar) {
      return c.json({ error: 'No avatar to remove' }, 400);
    }

    // Delete from R2
    try {
      const urlParts = currentUser.avatar.split('/');
      const key = urlParts.slice(-2).join('/');
      await deleteFromR2(key);
    } catch (deleteError) {
      logger.warn({ error: deleteError }, 'Failed to delete avatar from R2');
    }

    // Update user to remove avatar
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    return c.json({ success: true, message: 'Avatar removed successfully' });
  } catch (error) {
    logger.error({ error }, 'Avatar deletion failed');
    return c.json({ error: 'Failed to remove avatar' }, 500);
  }
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
// EXECUTIVE/ADMIN can update any user in company
// TEAM_LEAD can only transfer their own team members
usersRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');
  const body = await c.req.json();

  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isTeamLead = currentUser.role === 'TEAM_LEAD';

  // Build query based on role
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists with team info
  const existing = await prisma.user.findFirst({
    where,
    include: {
      team: {
        select: { id: true, leaderId: true },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if team is being changed (transfer)
  const isTeamChanging = body.teamId !== undefined && body.teamId !== existing.teamId;

  // TEAM_LEAD: Can only transfer members of their own team
  if (isTeamLead && isTeamChanging) {
    if (!existing.team || existing.team.leaderId !== currentUserId) {
      return c.json({ error: 'You can only transfer members from your own team' }, 403);
    }
    // Team leads cannot transfer other team leads or higher roles
    if (existing.role !== 'MEMBER' && existing.role !== 'WORKER') {
      return c.json({ error: 'You can only transfer workers/members' }, 403);
    }
  }

  // Build update data - only include fields that are actually provided
  const updateData: any = {};
  if (body.firstName !== undefined) updateData.firstName = body.firstName;
  if (body.lastName !== undefined) updateData.lastName = body.lastName;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.avatar !== undefined) updateData.avatar = body.avatar;
  if (body.teamId !== undefined) updateData.teamId = body.teamId;

  // Update teamJoinedAt when team changes
  if (isTeamChanging) {
    updateData.teamJoinedAt = body.teamId ? new Date() : null;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
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
// EXECUTIVE/ADMIN can deactivate any user in company
// TEAM_LEAD can only deactivate their own team members
usersRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');

  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isTeamLead = currentUser.role === 'TEAM_LEAD';

  // Only EXECUTIVE, ADMIN, or TEAM_LEAD can deactivate users
  if (!isAdmin && !isExecutive && !isTeamLead) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Build query based on role
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
    include: {
      team: {
        select: { id: true, leaderId: true },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TEAM_LEAD: Can only deactivate members of their own team
  if (isTeamLead) {
    if (!existing.team || existing.team.leaderId !== currentUserId) {
      return c.json({ error: 'You can only deactivate members of your own team' }, 403);
    }
    // Team leads cannot deactivate other team leads or higher roles
    if (existing.role !== 'MEMBER' && existing.role !== 'WORKER') {
      return c.json({ error: 'You can only deactivate workers/members' }, 403);
    }
  }

  // Cannot delete EXECUTIVE
  if (existing.role === 'EXECUTIVE') {
    return c.json({ error: 'Cannot deactivate EXECUTIVE user' }, 403);
  }

  // Cannot delete self
  if (id === currentUserId) {
    return c.json({ error: 'Cannot deactivate yourself' }, 400);
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  // Log user deactivation - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUserId,
    action: 'USER_DEACTIVATED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} deactivated user ${existing.firstName} ${existing.lastName}`,
    metadata: { email: existing.email, role: existing.role },
  });

  return c.json({ success: true });
});

// POST /users/:id/reactivate - Reactivate user (company-scoped, except for ADMIN)
// EXECUTIVE/ADMIN can reactivate any user in company
// TEAM_LEAD can only reactivate their own team members
usersRoutes.post('/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const currentUser = c.get('user');
  const currentUserId = c.get('userId');

  const isAdmin = currentUser.role?.toUpperCase() === 'ADMIN';
  const isExecutive = currentUser.role === 'EXECUTIVE';
  const isTeamLead = currentUser.role === 'TEAM_LEAD';

  // Only EXECUTIVE, ADMIN, or TEAM_LEAD can reactivate users
  if (!isAdmin && !isExecutive && !isTeamLead) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Build query based on role
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  // Verify user exists
  const existing = await prisma.user.findFirst({
    where,
    include: {
      team: {
        select: { id: true, leaderId: true },
      },
    },
  });

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TEAM_LEAD: Can only reactivate members of their own team
  if (isTeamLead) {
    if (!existing.team || existing.team.leaderId !== currentUserId) {
      return c.json({ error: 'You can only reactivate members of your own team' }, 403);
    }
    // Team leads cannot reactivate other team leads or higher roles
    if (existing.role !== 'MEMBER' && existing.role !== 'WORKER') {
      return c.json({ error: 'You can only reactivate workers/members' }, 403);
    }
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  // Log user reactivation - use existing user's companyId for logging
  await createSystemLog({
    companyId: existing.companyId,
    userId: currentUserId,
    action: 'USER_REACTIVATED',
    entityType: 'user',
    entityId: id,
    description: `${currentUser.firstName} ${currentUser.lastName} reactivated user ${existing.firstName} ${existing.lastName}`,
    metadata: { email: existing.email, role: existing.role },
  });

  return c.json({ success: true });
});

export { usersRoutes };
