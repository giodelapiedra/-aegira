import {
  Home,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  History,
  Users,
  LayoutDashboard,
  Heart,
  BarChart3,
  UserCog,
  Settings,
  Building2,
  UserPlus,
  UsersRound,
  FolderOpen,
  ScrollText,
  ShieldCheck,
  Brain,
  ClipboardList,
  Shield,
  Activity,
  MessageSquare,
} from 'lucide-react';
import type { Role } from '../types/user';

// Re-export for backward compatibility
export type { Role };

// Type for Lucide icon components
export type LucideIcon = typeof ClipboardCheck;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  roles?: Role[];
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
  roles?: Role[];
}

// ============================================
// HOME - Always visible at top for all roles
// ============================================
export const homeNav: NavItem = {
  id: 'home',
  label: 'Home',
  href: '/',
  icon: Home,
  description: 'Go to homepage',
};

// ============================================
// MEMBER Navigation
// ============================================
export const memberSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        icon: Home,
      },
    ],
  },
  {
    id: 'actions',
    title: 'Quick Actions',
    items: [
      {
        id: 'report-incident',
        label: 'Report Incident',
        href: '/report-incident',
        icon: AlertTriangle,
      },
      {
        id: 'request-exception',
        label: 'Request Exception',
        href: '/request-exception',
        icon: FileText,
      },
    ],
  },
  {
    id: 'records',
    title: 'My Records',
    items: [
      {
        id: 'my-incidents',
        label: 'My Incidents',
        href: '/my-incidents',
        icon: FolderOpen,
      },
      {
        id: 'my-history',
        label: 'Check-in History',
        href: '/my-history',
        icon: History,
      },
    ],
  },
];

// ============================================
// TEAM LEAD Navigation
// ============================================
export const teamLeadSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'team-overview',
        label: 'Team Overview',
        href: '/team/overview',
        icon: LayoutDashboard,
      },
      {
        id: 'daily-monitoring',
        label: 'Daily Monitoring',
        href: '/team/daily-monitoring',
        icon: Activity,
      },
    ],
  },
  {
    id: 'ai-assistant',
    title: 'AEGIRA AI',
    items: [
      {
        id: 'ai-chat',
        label: 'Chat Bot',
        href: '/team/ai-chat',
        icon: MessageSquare,
      },
      {
        id: 'ai-insights-history',
        label: 'AI Insights',
        href: '/team/ai-insights',
        icon: Brain,
      },
    ],
  },
  {
    id: 'team-management',
    title: 'Team Management',
    items: [
      {
        id: 'team-members',
        label: 'Team Members',
        href: '/team/members',
        icon: Users,
      },
      {
        id: 'team-member-history',
        label: 'Check-in History',
        href: '/team/member-history',
        icon: History,
      },
      {
        id: 'team-analytics',
        label: 'Team Analytics',
        href: '/team/analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'approvals',
    title: 'Approvals & Incidents',
    items: [
      {
        id: 'team-approvals',
        label: 'Exception Requests',
        href: '/team/approvals',
        icon: FileText,
      },
      {
        id: 'team-incidents',
        label: 'Team Incidents',
        href: '/team/incidents',
        icon: AlertTriangle,
      },
    ],
  },
];

// ============================================
// SUPERVISOR Navigation
// ============================================
export const supervisorSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        icon: Home,
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      {
        id: 'personnel',
        label: 'All Personnel',
        href: '/personnel',
        icon: Users,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'health',
    title: 'Health & Safety',
    items: [
      {
        id: 'rehabilitation',
        label: 'Rehabilitation',
        href: '/rehabilitation',
        icon: Heart,
      },
      {
        id: 'incidents',
        label: 'All Incidents',
        href: '/incidents',
        icon: AlertTriangle,
      },
    ],
  },
];

// ============================================
// ADMIN Navigation
// ============================================
export const adminSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        icon: Home,
      },
      {
        id: 'admin-dashboard',
        label: 'Admin Dashboard',
        href: '/admin',
        icon: ShieldCheck,
      },
      {
        id: 'dashboard',
        label: 'Operations Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      {
        id: 'personnel',
        label: 'All Personnel',
        href: '/personnel',
        icon: Users,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
      },
      {
        id: 'incidents',
        label: 'All Incidents',
        href: '/team/incidents',
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: 'templates',
    title: 'PDF Templates',
    items: [
      {
        id: 'all-templates',
        label: 'All Templates',
        href: '/admin/templates',
        icon: FileText,
      },
      {
        id: 'template-builder',
        label: 'Template Builder',
        href: '/admin/template-builder',
        icon: ClipboardList,
      },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      {
        id: 'system-logs',
        label: 'System Logs',
        href: '/system-logs',
        icon: ScrollText,
      },
    ],
  },
];

// ============================================
// EXECUTIVE Navigation
// ============================================
export const executiveSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'executive-dashboard',
        label: 'Executive Dashboard',
        href: '/executive',
        icon: Building2,
      },
    ],
  },
  {
    id: 'management',
    title: 'Management',
    items: [
      {
        id: 'create-account',
        label: 'Create Account',
        href: '/executive/create-account',
        icon: UserPlus,
      },
      {
        id: 'user-management',
        label: 'User Management',
        href: '/executive/users',
        icon: UserCog,
      },
      {
        id: 'team-management',
        label: 'Team Management',
        href: '/executive/teams',
        icon: UsersRound,
      },
      {
        id: 'company-settings',
        label: 'Company Settings',
        href: '/executive/settings',
        icon: Settings,
      },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      {
        id: 'system-logs',
        label: 'System Logs',
        href: '/system-logs',
        icon: ScrollText,
      },
    ],
  },
];

// ============================================
// WHS CONTROL Navigation
// ============================================
export const whsControlSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'whs-dashboard',
        label: 'WHS Dashboard',
        href: '/whs',
        icon: Shield,
      },
    ],
  },
  {
    id: 'forms',
    title: 'Forms',
    items: [
      {
        id: 'fill-forms',
        label: 'Fill Forms',
        href: '/whs/fill-forms',
        icon: FileText,
      },
    ],
  },
];

// ============================================
// CLINICIAN Navigation
// ============================================
export const clinicianSections: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      {
        id: 'clinician-dashboard',
        label: 'Clinician Dashboard',
        href: '/rehabilitation',
        icon: Heart,
      },
    ],
  },
  {
    id: 'rehabilitation',
    title: 'Rehabilitation',
    items: [
      {
        id: 'active-cases',
        label: 'Active Cases',
        href: '/rehabilitation/cases',
        icon: Activity,
      },
      {
        id: 'assessments',
        label: 'Assessments',
        href: '/rehabilitation/assessments',
        icon: ClipboardCheck,
      },
    ],
  },
];

// ============================================
// Quick actions for worker dashboard
// ============================================
export const quickActions: NavItem[] = [
  {
    id: 'checkin',
    label: 'Check-in Now',
    href: '/checkin',
    icon: ClipboardCheck,
    description: 'Complete your daily check-in',
  },
  {
    id: 'my-history',
    label: 'View History',
    href: '/my-history',
    icon: History,
    description: 'See your check-in records',
  },
  {
    id: 'report-incident',
    label: 'Report Issue',
    href: '/report-incident',
    icon: AlertTriangle,
    description: 'Report an incident',
  },
  {
    id: 'request-exception',
    label: 'Request Leave',
    href: '/request-exception',
    icon: FileText,
    description: 'Submit a leave request',
  },
];

// Legacy exports for backwards compatibility
export const workerNav: NavItem[] = memberSections.flatMap(s => s.items);
export const teamLeadNav: NavItem[] = teamLeadSections.flatMap(s => s.items);
export const supervisorNav: NavItem[] = supervisorSections.flatMap(s => s.items);
export const executiveNav: NavItem[] = executiveSections.flatMap(s => s.items);
export const adminNav: NavItem[] = adminSections.flatMap(s => s.items);
export const whsControlNav: NavItem[] = whsControlSections.flatMap(s => s.items);
export const clinicianNav: NavItem[] = clinicianSections.flatMap(s => s.items);

// Helper to check if user has access to an item
export function hasAccess(userRole: Role, allowedRoles?: Role[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
}

// Get filtered navigation for a user - returns role-specific sections
export function getNavigationForRole(userRole: Role): NavSection[] {
  switch (userRole) {
    case 'EXECUTIVE':
      return executiveSections;
    case 'ADMIN':
      return adminSections;
    case 'SUPERVISOR':
      return supervisorSections;
    case 'WHS_CONTROL':
      return whsControlSections;
    case 'CLINICIAN':
      return clinicianSections;
    case 'TEAM_LEAD':
      return teamLeadSections;
    case 'WORKER':
    case 'MEMBER':
    default:
      return memberSections;
  }
}
