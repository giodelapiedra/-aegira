import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { createSystemLog } from '../system-logs/index.js';
import { blacklistToken } from '../../utils/token-blacklist.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

// Helper to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).substring(2, 8);
}

// Register as Executive (creates company)
export async function register(data: RegisterInput) {
  // Check if email already exists (select only id for existence check)
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(400, 'Email already in use');
  }

  // Create user in Supabase Auth
  const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (error) {
    throw new AppError(400, error.message);
  }

  // Create company first
  // Timezone is validated in schema, so it's guaranteed to be valid
  const company = await prisma.company.create({
    data: {
      name: data.companyName,
      slug: generateSlug(data.companyName),
      timezone: data.timezone, // Already validated as valid IANA timezone in schema
    },
  });

  // Create user as EXECUTIVE
  const user = await prisma.user.create({
    data: {
      id: authData.user.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'EXECUTIVE',
      companyId: company.id,
    },
  });

  const tokens = await generateTokens(user.id);

  // Log user registration
  await createSystemLog({
    companyId: company.id,
    userId: user.id,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: user.id,
    description: `${user.firstName} ${user.lastName} registered as Executive and created company ${company.name}`,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      companyId: user.companyId,
      teamId: user.teamId,
      team: null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logo: company.logo,
      industry: company.industry,
      size: company.size,
      timezone: company.timezone,
      isActive: company.isActive,
    },
    ...tokens,
  };
}

export async function login(data: LoginInput) {
  // Use regular supabase client for signInWithPassword
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    throw new AppError(401, 'Invalid credentials');
  }

  const user = await prisma.user.findUnique({
    where: { id: authData.user.id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          industry: true,
          size: true,
          timezone: true,
          isActive: true,
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
    throw new AppError(401, 'User not found in system');
  }

  if (!user.isActive) {
    throw new AppError(401, 'Account is deactivated');
  }

  // Check if user has a company (required for new multi-tenant system)
  if (!user.companyId) {
    throw new AppError(400, 'User is not associated with a company. Please contact support.');
  }

  const tokens = await generateTokens(user.id);

  // Log successful login
  await createSystemLog({
    companyId: user.companyId,
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'user',
    entityId: user.id,
    description: `${user.firstName} ${user.lastName} logged in`,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      companyId: user.companyId,
      teamId: user.teamId,
      team: user.team,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    company: user.company,
    ...tokens,
  };
}

export async function refreshToken(token: string) {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    // Verify the refresh token JWT
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub) {
      throw new AppError(401, 'Invalid refresh token');
    }

    const userId = payload.sub;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'User not found or inactive');
    }

    // Generate new tokens (refresh token stays the same to allow multiple sessions)
    const tokens = await generateTokens(userId);
    return tokens;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, 'Invalid or expired refresh token');
  }
}

export async function logout(token: string) {
  // Add token to blacklist to prevent reuse
  // Token will auto-expire from blacklist after 7 days
  if (token) {
    blacklistToken(token);
  }
}

export async function forgotPassword(email: string) {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);
  if (error) {
    throw new AppError(400, error.message);
  }
}

export async function resetPassword(token: string, password: string) {
  // Verify the reset token and update password
  // The token is the access_token from Supabase's password reset email
  const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

  if (verifyError || !user) {
    throw new AppError(401, 'Invalid or expired reset token');
  }

  // Update the user's password using their ID
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
  });

  if (updateError) {
    throw new AppError(400, updateError.message);
  }

  // Verify user exists in our database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, companyId: true, firstName: true, lastName: true },
  });

  if (dbUser?.companyId) {
    // Log password reset
    await createSystemLog({
      companyId: dbUser.companyId,
      userId: dbUser.id,
      action: 'USER_PASSWORD_RESET',
      entityType: 'user',
      entityId: dbUser.id,
      description: `${dbUser.firstName} ${dbUser.lastName} reset their password`,
    });
  }
}

async function generateTokens(userId: string) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const accessToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secret);

  const refreshToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(secret);

  return { accessToken, refreshToken };
}
