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
import { dailyMonitoringRoutes } from './modules/daily-monitoring/index.js';
import { schedulesRoutes } from './modules/schedules/index.js';
import { rehabilitationRoutes } from './modules/rehabilitation/index.js';
import { analyticsRoutes } from './modules/analytics/index.js';
import { notificationsRoutes } from './modules/notifications/index.js';
import { systemLogsRoutes } from './modules/system-logs/index.js';
import { companiesRoutes } from './modules/companies/index.js';
import { whsRoutes } from './modules/whs/index.js';
import { pdfTemplatesRoutes } from './modules/pdf-templates/index.js';
import { chatbotRoutes } from './modules/chatbot/index.js';
import { holidaysRoutes } from './modules/holidays/index.js';
import { calendarRoutes } from './modules/calendar/index.js';
import { absencesRoutes } from './modules/absences/index.js';
import { workerRoutes } from './modules/worker/index.js';
import { supervisorRoutes } from './modules/supervisor/index.js';
import { cronRoutes } from './cron/index.js';

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
api.route('/daily-monitoring', dailyMonitoringRoutes);
api.route('/schedules', schedulesRoutes);
api.route('/rehabilitation', rehabilitationRoutes);
api.route('/analytics', analyticsRoutes);
api.route('/notifications', notificationsRoutes);
api.route('/system-logs', systemLogsRoutes);
api.route('/whs', whsRoutes);
api.route('/pdf-templates', pdfTemplatesRoutes);
api.route('/chatbot', chatbotRoutes);
api.route('/holidays', holidaysRoutes);
api.route('/calendar', calendarRoutes);
api.route('/absences', absencesRoutes);
api.route('/worker', workerRoutes);
api.route('/supervisor', supervisorRoutes);
api.route('/cron', cronRoutes);

// Dev routes - only in development
if (process.env.NODE_ENV !== 'production') {
  api.route('/dev', devRoutes);
}

export { api };
