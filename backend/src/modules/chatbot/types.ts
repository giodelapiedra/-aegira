// Chatbot module types

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  links?: ChatLink[];
  summaryPreview?: SummaryPreview;
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

// Command definitions for Team Leader
export const TEAM_LEAD_COMMANDS = {
  GENERATE_SUMMARY: ['generate summary', 'create summary', 'summary please', 'create report', 'generate report', 'new summary', 'make summary'],
  VIEW_REPORTS: ['view reports', 'show reports', 'my reports', 'ai insights', 'show insights', 'past reports', 'history'],
  TEAM_STATUS: ['team status', 'status', 'team overview', 'how is my team', 'team today'],
  AT_RISK: ['at risk', 'risk', 'attendance issues', 'low attendance', 'poor attendance', 'missed checkins', 'who needs attention', 'problems', 'issues', 'concerns', 'struggling'],
  HELP: ['help', 'commands', 'what can you do', 'options', 'menu'],
} as const;

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
