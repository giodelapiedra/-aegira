import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './protected-route';
import { RoleGuard } from './role-guard';

// Auth Pages
import { LoginPage } from '../pages/login/login.page';
import { RegisterPage } from '../pages/register/register.page';

// Worker Pages
import { HomePage } from '../pages/worker/home.page';
import { CheckinPage } from '../pages/worker/checkin.page';
import { ReportIncidentPage } from '../pages/worker/report-incident.page';
import { RequestExceptionPage } from '../pages/worker/request-exception.page';
import { MyHistoryPage } from '../pages/worker/my-history.page';
import { MyIncidentsPage } from '../pages/worker/my-incidents.page';

// Shared Pages
import { NotificationsPage } from '../pages/notifications/notifications.page';
import { ProfilePage } from '../pages/settings/profile.page';

// Team Lead Pages
import { ApprovalsPage } from '../pages/team-leader/approvals.page';
import { TeamOverviewPage } from '../pages/team-leader/team-overview.page';
import { TeamIncidentsPage } from '../pages/team-leader/team-incidents.page';
import { TeamMemberHistoryPage } from '../pages/team-leader/team-member-history.page';
import { AIInsightsHistoryPage } from '../pages/team-leader/ai-insights-history.page';
import { AIInsightsDetailPage } from '../pages/team-leader/ai-insights-detail.page';
import { AIChatPage } from '../pages/team-leader/ai-chat.page';
import { DailyMonitoringPage } from '../pages/team-leader/daily-monitoring.page';
import { TeamMembersPage } from '../pages/team-leader/team-members.page';
import { MemberProfilePage } from '../pages/team-leader/member-profile.page';
import { TeamAnalyticsPage } from '../pages/team-leader/team-analytics.page';

// Incident Pages
import { IncidentDetailPage } from '../pages/incidents/incident-detail.page';

// Supervisor Pages
import { SupervisorDashboard } from '../pages/supervisor/dashboard.page';
import { PersonnelPage } from '../pages/supervisor/personnel.page';
import { AnalyticsPage } from '../pages/supervisor/analytics.page';

// Executive Pages
import { ExecutiveDashboard } from '../pages/executive/dashboard.page';
import { UsersPage } from '../pages/executive/users.page';
import { CreateAccountPage } from '../pages/executive/create-account.page';
import { TeamsPage } from '../pages/executive/teams.page';
import { CompanySettingsPage } from '../pages/executive/company-settings.page';

// Admin Pages
import { AdminDashboard } from '../pages/admin/dashboard.page';
import { TemplatesPage } from '../pages/admin/templates.page';

// Shared Pages (accessible by multiple roles)
import { SystemLogsPage } from '../pages/shared/system-logs.page';
import { TemplateBuilderPage } from '../pages/admin/template-builder.page';

// WHS Pages
import { WHSDashboard } from '../pages/whs/dashboard.page';
import { FillFormsPage } from '../pages/whs/fill-forms.page';
import { VisualPDFFillPage } from '../pages/whs/visual-pdf-fill.page';

export const router = createBrowserRouter([
  // Public Routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },

  // Protected Routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      // Home/Dashboard
      {
        index: true,
        element: <HomePage />,
      },

      // Notifications (all users)
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },

      // Profile Settings (all users)
      {
        path: 'settings/profile',
        element: <ProfilePage />,
      },

      // Incident Detail (all users)
      {
        path: 'incidents/:id',
        element: <IncidentDetailPage />,
      },

      // ==========================================
      // WORKER ROUTES (WORKER/MEMBER role)
      // ==========================================
      {
        path: 'checkin',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <CheckinPage />
          </RoleGuard>
        ),
      },
      {
        path: 'report-incident',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <ReportIncidentPage />
          </RoleGuard>
        ),
      },
      {
        path: 'request-exception',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <RequestExceptionPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-history',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <MyHistoryPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-incidents',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <MyIncidentsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-schedule',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <ComingSoon title="My Schedule" description="View your work schedule and shifts" />
          </RoleGuard>
        ),
      },

      // ==========================================
      // TEAM LEAD ROUTES
      // ==========================================
      {
        path: 'team/overview',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <TeamOverviewPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/daily-monitoring',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <DailyMonitoringPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/approvals',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <ApprovalsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/incidents',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <TeamIncidentsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-chat',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <AIChatPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-insights',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <AIInsightsHistoryPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-insights/:id',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <AIInsightsDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/member-history',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <TeamMemberHistoryPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/members',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <TeamMembersPage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/members/:userId',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <MemberProfilePage />
          </RoleGuard>
        ),
      },
      {
        path: 'team/analytics',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <TeamAnalyticsPage />
          </RoleGuard>
        ),
      },

      // ==========================================
      // SUPERVISOR ROUTES
      // ==========================================
      {
        path: 'dashboard',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <SupervisorDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'personnel',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <PersonnelPage />
          </RoleGuard>
        ),
      },
      {
        path: 'rehabilitation',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <ComingSoon title="Rehabilitation" description="Track personnel rehabilitation progress" />
          </RoleGuard>
        ),
      },
      {
        path: 'analytics',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <AnalyticsPage />
          </RoleGuard>
        ),
      },

      // ==========================================
      // ADMIN ROUTES
      // ==========================================
      {
        path: 'admin',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </RoleGuard>
        ),
      },
      // ==========================================
      // SHARED ROUTES (accessible by multiple roles)
      // ==========================================
      {
        path: 'system-logs',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <SystemLogsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/templates',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <TemplatesPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/template-builder',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <TemplateBuilderPage />
          </RoleGuard>
        ),
      },

      // ==========================================
      // EXECUTIVE ROUTES
      // ==========================================
      {
        path: 'executive',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <ExecutiveDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'executive/users',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <UsersPage />
          </RoleGuard>
        ),
      },
      {
        path: 'executive/create-account',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <CreateAccountPage />
          </RoleGuard>
        ),
      },
      {
        path: 'executive/teams',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <TeamsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'executive/settings',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <CompanySettingsPage />
          </RoleGuard>
        ),
      },

      // ==========================================
      // WHS CONTROL ROUTES
      // ==========================================
      {
        path: 'whs',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL']}>
            <WHSDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'whs/fill-forms',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR', 'TEAM_LEAD']}>
            <FillFormsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'whs/fill-forms/:id',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR', 'TEAM_LEAD']}>
            <VisualPDFFillPage />
          </RoleGuard>
        ),
      },
      {
        path: 'whs/incidents',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR']}>
            <ComingSoon title="Safety Incidents" description="View and manage safety-related incidents" />
          </RoleGuard>
        ),
      },
      {
        path: 'whs/compliance',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL']}>
            <ComingSoon title="Compliance Report" description="View team compliance metrics" />
          </RoleGuard>
        ),
      },

      // ==========================================
      // LEGACY ADMIN ROUTES (redirect to executive)
      // ==========================================
      {
        path: 'admin/users',
        element: <Navigate to="/executive/users" replace />,
      },
      {
        path: 'admin/settings',
        element: <Navigate to="/executive/settings" replace />,
      },
    ],
  },

  // Catch all - redirect to home
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

// Coming Soon Component
function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-4">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mb-6">
        <svg
          className="h-10 w-10 text-primary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && (
        <p className="text-gray-500 max-w-md mb-6">{description}</p>
      )}
      <div className="flex items-center gap-2 text-sm text-primary-600 bg-primary-50 px-4 py-2 rounded-full">
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Coming Soon
      </div>
    </div>
  );
}
