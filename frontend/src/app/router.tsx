import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './protected-route';
import { RoleGuard } from './role-guard';
import { SkeletonDashboard } from '../components/ui/Skeleton';

// ============================================
// LAZY PAGE WRAPPER
// ============================================
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-6 px-4">
          <SkeletonDashboard />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// ============================================
// EAGER IMPORTS (Public pages - load immediately)
// ============================================
import { LoginPage } from '../pages/login/login.page';
import { RegisterPage } from '../pages/register/register.page';

// ============================================
// LAZY IMPORTS - Worker Pages
// ============================================
const HomePage = lazy(() => import('../pages/worker/home').then(m => ({ default: m.HomePage })));
const CheckinPage = lazy(() => import('../pages/worker/checkin').then(m => ({ default: m.CheckinPage })));
const ReportIncidentPage = lazy(() => import('../pages/worker/report-incident.page').then(m => ({ default: m.ReportIncidentPage })));
const RequestExceptionPage = lazy(() => import('../pages/worker/request-exception.page').then(m => ({ default: m.RequestExceptionPage })));
const MyHistoryPage = lazy(() => import('../pages/worker/my-history.page').then(m => ({ default: m.MyHistoryPage })));
const MyIncidentsPage = lazy(() => import('../pages/worker/my-incidents.page').then(m => ({ default: m.MyIncidentsPage })));
const WorkerCalendarPage = lazy(() => import('../pages/worker/calendar.page'));

// ============================================
// LAZY IMPORTS - Shared Pages
// ============================================
const NotificationsPage = lazy(() => import('../pages/notifications/notifications.page').then(m => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('../pages/settings/profile.page').then(m => ({ default: m.ProfilePage })));

// ============================================
// LAZY IMPORTS - Team Lead Pages
// ============================================
const ApprovalsPage = lazy(() => import('../pages/team-leader/approvals.page').then(m => ({ default: m.ApprovalsPage })));
const TeamOverviewPage = lazy(() => import('../pages/team-leader/team-overview.page').then(m => ({ default: m.TeamOverviewPage })));
const TeamIncidentsPage = lazy(() => import('../pages/team-leader/team-incidents.page').then(m => ({ default: m.TeamIncidentsPage })));
const TeamMemberHistoryPage = lazy(() => import('../pages/team-leader/team-member-history.page').then(m => ({ default: m.TeamMemberHistoryPage })));
const AIInsightsHistoryPage = lazy(() => import('../pages/team-leader/ai-insights-history.page').then(m => ({ default: m.AIInsightsHistoryPage })));
const AIInsightsDetailPage = lazy(() => import('../pages/team-leader/ai-insights-detail.page').then(m => ({ default: m.AIInsightsDetailPage })));
const AIChatPage = lazy(() => import('../pages/team-leader/ai-chat.page').then(m => ({ default: m.AIChatPage })));
const DailyMonitoringPage = lazy(() => import('../pages/team-leader/daily-monitoring').then(m => ({ default: m.DailyMonitoringPage })));
const TeamMembersPage = lazy(() => import('../pages/team-leader/team-members').then(m => ({ default: m.TeamMembersPage })));
const MemberProfilePage = lazy(() => import('../pages/team-leader/member-profile.page').then(m => ({ default: m.MemberProfilePage })));
const TeamAnalyticsPage = lazy(() => import('../pages/team-leader/team-analytics.page').then(m => ({ default: m.TeamAnalyticsPage })));
const TeamCalendarPage = lazy(() => import('../pages/team-leader/team-calendar.page'));
const TeamSummaryPage = lazy(() => import('../pages/team-leader/team-summary.page').then(m => ({ default: m.TeamSummaryPage })));

// ============================================
// LAZY IMPORTS - Incident Pages
// ============================================
const IncidentDetailPage = lazy(() => import('../pages/incidents/incident-detail.page').then(m => ({ default: m.IncidentDetailPage })));
const IncidentPrintPreview = lazy(() => import('../pages/incidents/incident-print-preview.page').then(m => ({ default: m.IncidentPrintPreview })));

// ============================================
// LAZY IMPORTS - Supervisor Pages
// ============================================
const SupervisorDashboard = lazy(() => import('../pages/supervisor/dashboard.page').then(m => ({ default: m.SupervisorDashboard })));
const PersonnelPage = lazy(() => import('../pages/supervisor/personnel.page').then(m => ({ default: m.PersonnelPage })));
const AnalyticsPage = lazy(() => import('../pages/supervisor/analytics.page').then(m => ({ default: m.AnalyticsPage })));
const IncidentsAssignmentPage = lazy(() => import('../pages/supervisor/incidents-assignment.page').then(m => ({ default: m.IncidentsAssignmentPage })));

// ============================================
// LAZY IMPORTS - Executive Pages
// ============================================
const ExecutiveDashboard = lazy(() => import('../pages/executive/dashboard.page').then(m => ({ default: m.ExecutiveDashboard })));
const UsersPage = lazy(() => import('../pages/executive/users.page').then(m => ({ default: m.UsersPage })));
const CreateAccountPage = lazy(() => import('../pages/executive/create-account.page').then(m => ({ default: m.CreateAccountPage })));
const TeamsPage = lazy(() => import('../pages/executive/teams.page').then(m => ({ default: m.TeamsPage })));
const CompanySettingsPage = lazy(() => import('../pages/executive/company-settings.page').then(m => ({ default: m.CompanySettingsPage })));
const CompanyCalendarPage = lazy(() => import('../pages/executive/company-calendar.page'));
const TeamsOverviewPage = lazy(() => import('../pages/executive/teams-overview.page').then(m => ({ default: m.TeamsOverviewPage })));

// ============================================
// LAZY IMPORTS - Admin Pages
// ============================================
const AdminDashboard = lazy(() => import('../pages/admin/dashboard.page').then(m => ({ default: m.AdminDashboard })));
const TemplatesPage = lazy(() => import('../pages/admin/templates.page').then(m => ({ default: m.TemplatesPage })));
const TemplateBuilderPage = lazy(() => import('../pages/admin/template-builder.page').then(m => ({ default: m.TemplateBuilderPage })));

// ============================================
// LAZY IMPORTS - Shared Pages
// ============================================
const SystemLogsPage = lazy(() => import('../pages/shared/system-logs.page').then(m => ({ default: m.SystemLogsPage })));

// ============================================
// LAZY IMPORTS - WHS Pages
// ============================================
const WHSDashboard = lazy(() => import('../pages/whs/dashboard.page').then(m => ({ default: m.WHSDashboard })));
const FillFormsPage = lazy(() => import('../pages/whs/fill-forms.page').then(m => ({ default: m.FillFormsPage })));
const VisualPDFFillPage = lazy(() => import('../pages/whs/visual-pdf-fill.page').then(m => ({ default: m.VisualPDFFillPage })));
const WHSMyIncidentsPage = lazy(() => import('../pages/whs/my-incidents.page').then(m => ({ default: m.WHSMyIncidentsPage })));

// ============================================
// ROUTER CONFIGURATION
// ============================================
export const router = createBrowserRouter([
  // Public Routes (No lazy loading - need fast access)
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
        element: <LazyPage><HomePage /></LazyPage>,
      },

      // Notifications (all users)
      {
        path: 'notifications',
        element: <LazyPage><NotificationsPage /></LazyPage>,
      },

      // Profile Settings (all users)
      {
        path: 'settings/profile',
        element: <LazyPage><ProfilePage /></LazyPage>,
      },

      // Incident Detail (all users)
      {
        path: 'incidents/:id',
        element: <LazyPage><IncidentDetailPage /></LazyPage>,
      },

      // Incident Print Preview (all users)
      {
        path: 'incidents/:id/print',
        element: <LazyPage><IncidentPrintPreview /></LazyPage>,
      },

      // ==========================================
      // WORKER ROUTES (WORKER/MEMBER role)
      // ==========================================
      {
        path: 'checkin',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><CheckinPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'report-incident',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><ReportIncidentPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'request-exception',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><RequestExceptionPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'my-history',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><MyHistoryPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'my-incidents',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><MyIncidentsPage /></LazyPage>
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
      {
        path: 'calendar',
        element: (
          <RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
            <LazyPage><WorkerCalendarPage /></LazyPage>
          </RoleGuard>
        ),
      },

      // ==========================================
      // TEAM LEAD ROUTES (All lazy loaded)
      // ==========================================
      {
        path: 'team/overview',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamOverviewPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/daily-monitoring',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><DailyMonitoringPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/approvals',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><ApprovalsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/incidents',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamIncidentsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-chat',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <LazyPage><AIChatPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-insights',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <LazyPage><AIInsightsHistoryPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/ai-insights/:id',
        element: (
          <RoleGuard allowedRoles={['TEAM_LEAD']}>
            <LazyPage><AIInsightsDetailPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/member-history',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamMemberHistoryPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/members',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamMembersPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/members/:userId',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><MemberProfilePage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/analytics',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamAnalyticsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/summary',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamSummaryPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'team/calendar',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><TeamCalendarPage /></LazyPage>
          </RoleGuard>
        ),
      },

      // ==========================================
      // SUPERVISOR ROUTES (All lazy loaded)
      // ==========================================
      {
        path: 'supervisor/incidents-assignment',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <LazyPage><IncidentsAssignmentPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <LazyPage><SupervisorDashboard /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'personnel',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN', 'SUPERVISOR']}>
            <LazyPage><PersonnelPage /></LazyPage>
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
            <LazyPage><AnalyticsPage /></LazyPage>
          </RoleGuard>
        ),
      },

      // ==========================================
      // ADMIN ROUTES (All lazy loaded)
      // ==========================================
      {
        path: 'admin',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <LazyPage><AdminDashboard /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'system-logs',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <LazyPage><SystemLogsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'admin/templates',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <LazyPage><TemplatesPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'admin/template-builder',
        element: (
          <RoleGuard allowedRoles={['ADMIN']}>
            <LazyPage><TemplateBuilderPage /></LazyPage>
          </RoleGuard>
        ),
      },

      // ==========================================
      // EXECUTIVE ROUTES (All lazy loaded)
      // ==========================================
      {
        path: 'executive',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <LazyPage><ExecutiveDashboard /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/users',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <LazyPage><UsersPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/create-account',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <LazyPage><CreateAccountPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/teams',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN']}>
            <LazyPage><TeamsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/settings',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <LazyPage><CompanySettingsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/calendar',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE']}>
            <LazyPage><CompanyCalendarPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'executive/teams-overview',
        element: (
          <RoleGuard allowedRoles={['EXECUTIVE', 'SUPERVISOR']}>
            <LazyPage><TeamsOverviewPage /></LazyPage>
          </RoleGuard>
        ),
      },

      // ==========================================
      // WHS CONTROL ROUTES (All lazy loaded)
      // ==========================================
      {
        path: 'whs',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL']}>
            <LazyPage><WHSDashboard /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'whs/my-incidents',
        element: (
          <RoleGuard allowedRoles={['WHS_CONTROL']}>
            <LazyPage><WHSMyIncidentsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'whs/fill-forms',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><FillFormsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'whs/fill-forms/:id',
        element: (
          <RoleGuard allowedRoles={['ADMIN', 'EXECUTIVE', 'WHS_CONTROL', 'SUPERVISOR', 'TEAM_LEAD']}>
            <LazyPage><VisualPDFFillPage /></LazyPage>
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

// ============================================
// COMING SOON COMPONENT
// ============================================
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
