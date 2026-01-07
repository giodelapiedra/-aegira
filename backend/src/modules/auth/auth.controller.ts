import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import * as authService from './auth.service.js';
import { loginSchema, registerSchema } from './auth.schema.js';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setRefreshTokenCookie(c: Context, refreshToken: string) {
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict', // Security: 'Strict' prevents CSRF attacks
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

function clearRefreshTokenCookie(c: Context) {
  deleteCookie(c, REFRESH_TOKEN_COOKIE, {
    path: '/',
  });
}

export async function register(c: Context) {
  const body = await c.req.json();
  const data = registerSchema.parse(body);
  const result = await authService.register(data);

  // Set refresh token as httpOnly cookie
  setRefreshTokenCookie(c, result.refreshToken);

  // Return response without refreshToken (it's in the cookie)
  const { refreshToken: _, ...response } = result;
  return c.json(response, 201);
}

export async function login(c: Context) {
  const body = await c.req.json();
  const data = loginSchema.parse(body);
  const result = await authService.login(data);

  // Set refresh token as httpOnly cookie
  setRefreshTokenCookie(c, result.refreshToken);

  // Return response without refreshToken (it's in the cookie)
  const { refreshToken: _, ...response } = result;
  return c.json(response);
}

export async function refreshToken(c: Context) {
  // Read refresh token from cookie (preferred) or body (fallback)
  let token = getCookie(c, REFRESH_TOKEN_COOKIE);

  if (!token) {
    const body = await c.req.json().catch(() => ({}));
    token = body.refreshToken;
  }

  if (!token) {
    return c.json({ error: 'Refresh token required' }, 401);
  }

  const result = await authService.refreshToken(token);

  // Set new refresh token cookie
  setRefreshTokenCookie(c, result.refreshToken);

  // Return response without refreshToken
  const { refreshToken: _, ...response } = result;
  return c.json(response);
}

export async function logout(c: Context) {
  // Read refresh token from cookie (preferred) or body (fallback)
  let token = getCookie(c, REFRESH_TOKEN_COOKIE);

  if (!token) {
    const body = await c.req.json().catch(() => ({}));
    token = body.refreshToken;
  }

  if (token) {
    await authService.logout(token);
  }

  // Clear the cookie
  clearRefreshTokenCookie(c);

  return c.json({ message: 'Logged out successfully' });
}

export async function forgotPassword(c: Context) {
  const { email } = await c.req.json();
  await authService.forgotPassword(email);
  return c.json({ message: 'Password reset email sent' });
}

export async function resetPassword(c: Context) {
  const { token, password } = await c.req.json();
  await authService.resetPassword(token, password);
  return c.json({ message: 'Password reset successfully' });
}
