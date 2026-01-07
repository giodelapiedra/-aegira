import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { isTokenBlacklisted } from '../utils/token-blacklist.js';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  teamId: string | null;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    userId: string;
    companyId: string;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }

  const token = authHeader.substring(7);

  // Check if token is blacklisted (logged out)
  if (isTokenBlacklisted(token)) {
    return c.json({ error: 'Unauthorized: Token has been revoked' }, 401);
  }

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        teamId: true,
        isActive: true,
      },
    });

    if (!user) {
      return c.json({ error: 'Unauthorized: User not found' }, 401);
    }

    if (!user.isActive) {
      return c.json({ error: 'Unauthorized: Account is deactivated' }, 401);
    }

    c.set('user', user);
    c.set('userId', user.id);
    c.set('companyId', user.companyId);
    await next();
  } catch (error) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
}
