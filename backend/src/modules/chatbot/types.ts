// Chatbot module types

export interface QuickAction {
  id: string;
  label: string;
  command: string;
  icon?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  links?: ChatLink[];
  summaryPreview?: SummaryPreview;
  quickActions?: QuickAction[];
}

export interface ChatLink {
  label: string;
  url: string;
  icon?: string;
}

export interface SummaryPreview {
  id: string;
  status: 'healthy' | 'attention' | 'critical';
  highlightsCount: number;
  concernsCount: number;
  recommendationsCount: number;
}

export interface ChatRequest {
  message: string;
  context?: {
    teamId?: string;
    dateRange?: {
      startDate: string;
      endDate: string;
    };
  };
}

export interface ChatResponse {
  message: ChatMessage;
  action?: ChatAction;
}

export interface ChatAction {
  type: 'generate_summary' | 'view_reports' | 'help' | 'at_risk' | 'none';
  status: 'success' | 'error' | 'pending';
  data?: Record<string, unknown>;
}

export interface ChatSuggestion {
  id: string;
  label: string;
  command: string;
  description: string;
  icon?: string;
}

// Command definitions for Team Leader (English + Tagalog keywords)
export const TEAM_LEAD_COMMANDS = {
  GENERATE_SUMMARY: [
    // English
    'generate summary', 'create summary', 'summary please', 'create report', 'generate report',
    'new summary', 'make summary', 'analyze team', 'team analysis', 'performance report',
    // Tagalog
    'gawa report', 'gawa summary', 'gawan report', 'gawan summary', 'i-generate', 'mag-generate',
    'paki-gawa', 'pakigawa', 'report please', 'summary ng team',
  ],
  VIEW_REPORTS: [
    // English
    'view reports', 'show reports', 'my reports', 'ai insights', 'show insights',
    'past reports', 'history', 'previous reports', 'old reports',
    // Tagalog
    'tignan reports', 'tingnan reports', 'mga report', 'dati reports', 'lumang reports',
  ],
  TEAM_STATUS: [
    // English
    'team status', 'status', 'team overview', 'how is my team', 'team today',
    'today status', 'current status', 'team now',
    // Tagalog
    'kamusta team', 'kumusta team', 'status ng team', 'ano status', 'anong status',
    'paano team', 'team ko', 'ngayon', 'today',
  ],
  AT_RISK: [
    // English
    'at risk', 'risk', 'attendance issues', 'low attendance', 'poor attendance',
    'missed checkins', 'who needs attention', 'problems', 'issues', 'concerns', 'struggling',
    'who is absent', 'absent', 'not checking in',
    // Tagalog
    'sino absent', 'sino wala', 'may problema', 'sino may issue', 'hindi nag-checkin',
    'hindi nagcheckin', 'kulang attendance', 'sino kulang',
  ],
  HELP: [
    // English
    'help', 'commands', 'what can you do', 'options', 'menu', 'how to use',
    // Tagalog
    'tulong', 'paano', 'ano pwede', 'anong pwede', 'pano gamitin',
  ],
} as const;

// Intent types for AI detection
export type ChatIntent = 'GENERATE_SUMMARY' | 'VIEW_REPORTS' | 'TEAM_STATUS' | 'AT_RISK' | 'HELP' | 'GREETING' | 'OUT_OF_SCOPE' | 'UNKNOWN';

// Suggestions shown to user
export const TEAM_LEAD_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: 'generate-summary',
    label: 'Generate Summary',
    command: 'generate summary',
    description: 'Create an AI-powered summary of your team analytics',
    icon: 'sparkles',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    command: 'view reports',
    description: 'See your previously generated AI insights',
    icon: 'file-text',
  },
  {
    id: 'team-status',
    label: 'Team Status',
    command: 'team status',
    description: 'Quick overview of your team today',
    icon: 'users',
  },
  {
    id: 'at-risk',
    label: 'At Risk',
    command: 'at risk',
    description: 'Workers with attendance issues or concerns',
    icon: 'alert-triangle',
  },
  {
    id: 'help',
    label: 'Help',
    command: 'help',
    description: 'Show available commands',
    icon: 'help-circle',
  },
];
