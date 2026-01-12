// Chatbot types for AI Chat feature

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
  timestamp: Date | string;
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

export interface SuggestionsResponse {
  suggestions: ChatSuggestion[];
}
