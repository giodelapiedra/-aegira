import { Hono } from 'hono';
import * as authController from './auth.controller.js';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
} from '../../middlewares/rate-limit.middleware.js';

const authRoutes = new Hono();

// Apply rate limiting to sensitive auth endpoints
authRoutes.post('/register', registerRateLimiter, authController.register);
authRoutes.post('/login', loginRateLimiter, authController.login);
authRoutes.post('/refresh', authController.refreshToken);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', passwordResetRateLimiter, authController.forgotPassword);
authRoutes.post('/reset-password', passwordResetRateLimiter, authController.resetPassword);

export { authRoutes };
