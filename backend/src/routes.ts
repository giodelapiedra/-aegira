import { Hono } from 'hono';
import { authMiddleware } from './middlewares/auth.middleware.js';

// Import module routes
import { authRoutes } from './modules/auth/index.js';
import { usersRoutes } from './modules/users/index.js';
import { teamsRoutes } from './modules/teams/index.js';
import { checkinsRoutes } from './modules/checkins/index.js';
import { incidentsRoutes } from './modules/incidents/index.js';
import { exceptionsRoutes } from './modules/exceptions/index.js';
import { exemptionsRoutes } from './modules/exemptions/index.js';
import { schedulesRoutes } from './modules/schedules/index.js';
import { rehabilitationRoutes } from './modules/rehabilitation/index.js';
import { analyticsRoutes } from './modules/analytics/index.js';
import { notificationsRoutes } from './modules/notifications/index.js';
import { systemLogsRoutes } from './modules/system-logs/index.js';
import { companiesRoutes } from './modules/companies/index.js';
import { whsRoutes } from './modules/whs/index.js';
import { chatbotRoutes } from './modules/chatbot/index.js';
import { holidaysRoutes } from './modules/holidays/index.js';
import { calendarRoutes } from './modules/calendar/index.js';
import { workerRoutes } from './modules/worker/index.js';
import { supervisorRoutes } from './modules/supervisor/index.js';
import { formsRoutes } from './modules/forms/index.js';

// Dev routes (only in development)
import { devRoutes } from './modules/dev/index.js';

const api = new Hono();

// Public routes
api.route('/auth', authRoutes);

// Protected routes (require authentication)
api.use('/*', authMiddleware);

api.route('/users', usersRoutes);
api.route('/teams', teamsRoutes);
api.route('/companies', companiesRoutes);
api.route('/checkins', checkinsRoutes);
api.route('/incidents', incidentsRoutes);
api.route('/exceptions', exceptionsRoutes);
api.route('/exemptions', exemptionsRoutes);
api.route('/schedules', schedulesRoutes);
api.route('/rehabilitation', rehabilitationRoutes);
api.route('/analytics', analyticsRoutes);
api.route('/notifications', notificationsRoutes);
api.route('/system-logs', systemLogsRoutes);
api.route('/whs', whsRoutes);
api.route('/chatbot', chatbotRoutes);
api.route('/holidays', holidaysRoutes);
api.route('/calendar', calendarRoutes);
api.route('/worker', workerRoutes);
api.route('/supervisor', supervisorRoutes);
api.route('/forms', formsRoutes);

// Dev routes - only in development
if (process.env.NODE_ENV !== 'production') {
  api.route('/dev', devRoutes);
}

export { api };
