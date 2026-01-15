import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Bot, Sparkles, History, Calendar, X, Send, FileText, Users, BarChart3, HelpCircle, Plus, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatMessage } from '../../components/ai-chat';
import { chatbotService } from '../../services/chatbot.service';
import type { ChatMessage as ChatMessageType, ChatRequest } from '../../types/chatbot';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

// =============================================================================
// CONSTANTS
// =============================================================================

const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 Days', description: 'Quick weekly overview' },
  { value: 14, label: 'Last 14 Days', description: 'Two-week analysis', recommended: true },
  { value: 30, label: 'Last 30 Days', description: 'Monthly comprehensive report' },
] as const;

const QUICK_ACTIONS = [
  {
    id: 'generate-summary',
    icon: BarChart3,
    title: 'Generate Summary',
    description: 'AI analysis of your team performance',
    command: 'Generate Summary',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'team-status',
    icon: Users,
    title: 'Team Status',
    description: 'Quick overview of attendance today',
    command: 'Team Status',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'view-reports',
    icon: FileText,
    title: 'View Reports',
    description: 'Browse your past AI insights',
    command: 'View Reports',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'help',
    icon: HelpCircle,
    title: 'Help',
    description: 'Show all available commands',
    command: 'Help',
    gradient: 'from-orange-500 to-amber-600',
  },
] as const;

const SUMMARY_KEYWORDS = [
  // English
  'generate summary',
  'create summary',
  'summary please',
  'create report',
  'generate report',
  'new summary',
  'make summary',
  'analyze team',
  'team analysis',
  'performance report',
  // Tagalog
  'gawa report',
  'gawa summary',
  'gawan report',
  'gawan summary',
  'i-generate',
  'mag-generate',
  'paki-gawa',
  'pakigawa',
  'summary ng team',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isGenerateSummaryCommand(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return SUMMARY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function formatDisplayName(firstName?: string, lastName?: string): string {
  if (!firstName) return '';
  return `${firstName}${lastName ? ` ${lastName.charAt(0)}.` : ''}`;
}

function createWelcomeMessage(firstName?: string, lastName?: string): ChatMessageType {
  const name = formatDisplayName(firstName, lastName);
  const greeting = name ? `Hello, **${name}**!` : 'Hello!';

  return {
    id: 'welcome',
    role: 'assistant',
    content: `${greeting} I'm **AegiraAI**, your assistant for team management.

How can I help you today?

- **Generate Summary** - Create an AI analysis of your team
- **View Reports** - View your past AI insights
- **Team Status** - Quick overview of your team today
- **Help** - Show all available commands`,
    timestamp: new Date(),
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Background gradient glow effect
const GradientBackground = memo(function GradientBackground() {
  return (
    <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none -z-10">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-400/30 via-purple-400/30 via-pink-400/20 to-orange-400/20 blur-3xl rounded-full" />
    </div>
  );
});

// Branding header with logo
interface BrandingProps {
  size?: 'sm' | 'lg';
}

const Branding = memo(function Branding({ size = 'lg' }: BrandingProps) {
  const isLarge = size === 'lg';
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-primary-600 flex items-center justify-center shadow-lg shadow-purple-500/25',
          isLarge ? 'h-14 w-14' : 'h-10 w-10 rounded-xl shadow-md'
        )}
      >
        <Bot className={cn('text-white', isLarge ? 'h-7 w-7' : 'h-5 w-5')} />
      </div>
      <div>
        <h1 className={cn('font-bold text-gray-900', isLarge ? 'text-3xl' : 'text-xl')}>
          Aegira<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-purple-600">AI</span>
        </h1>
        {!isLarge && (
          <p className="text-xs text-gray-500">Your AI assistant for team insights</p>
        )}
      </div>
    </div>
  );
});

// Quick action card
interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
}

const QuickActionCard = memo(function QuickActionCard({
  icon: Icon,
  title,
  description,
  gradient,
  onClick,
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 text-left"
    >
      <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3', gradient)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <h3 className="font-medium text-gray-900 text-sm mb-0.5 group-hover:text-purple-600 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-gray-500 line-clamp-2">{description}</p>
    </button>
  );
});

// Chat input component
interface ChatInputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  variant?: 'landing' | 'chat';
}

const ChatInputBox = memo(function ChatInputBox({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Type your message...',
  variant = 'chat',
}: ChatInputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLanding = variant === 'landing';

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit();
    }
  };

  const canSubmit = value.trim() && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={cn(
          'relative rounded-2xl border transition-all',
          isLanding
            ? 'bg-white border-gray-200 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:border-gray-300'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300 rounded-xl'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className={cn(
            'w-full resize-none text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:opacity-50',
            isLanding
              ? 'px-5 py-4 pr-24 rounded-2xl text-base'
              : 'px-4 py-3 pr-20 bg-transparent rounded-xl text-sm'
          )}
          style={{ maxHeight: '120px' }}
        />
        <div className={cn('absolute flex items-center gap-1', isLanding ? 'right-3 bottom-3 gap-2' : 'right-2 bottom-2')}>
          <button
            type="button"
            className={cn(
              'rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors',
              isLanding ? 'h-9 w-9' : 'h-8 w-8 rounded-lg hover:bg-gray-200'
            )}
            title="Attach file (coming soon)"
          >
            <Plus className={cn(isLanding ? 'h-5 w-5' : 'h-4 w-4')} />
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'rounded-xl flex items-center justify-center transition-all duration-200',
              isLanding ? 'h-9 w-9' : 'h-8 w-8 rounded-lg',
              canSubmit
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400'
            )}
          >
            <Send className={cn(isLanding ? 'h-4 w-4' : 'h-4 w-4')} />
          </button>
        </div>
      </div>
    </form>
  );
});

// Loading indicator for AI response
const ThinkingIndicator = memo(function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">Thinking...</span>
        </div>
      </div>
    </div>
  );
});

// Period selection modal
interface PeriodModalProps {
  selectedPeriod: number;
  onSelectPeriod: (period: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const PeriodModal = memo(function PeriodModal({
  selectedPeriod,
  onSelectPeriod,
  onConfirm,
  onCancel,
}: PeriodModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select Report Period</h3>
              <p className="text-sm text-gray-500">Choose the date range for analysis</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {PERIOD_OPTIONS.map((option) => {
            const isSelected = selectedPeriod === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onSelectPeriod(option.value)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 text-left transition-all',
                  isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{option.label}</span>
                      {('recommended' in option) && option.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                    )}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} leftIcon={<Sparkles className="h-4 w-4" />}>
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AIChatPage() {
  const { user } = useUser();

  // Memoized values
  const welcomeMessage = useMemo(
    () => createWelcomeMessage(user?.firstName, user?.lastName),
    [user?.firstName, user?.lastName]
  );

  const displayName = useMemo(
    () => formatDisplayName(user?.firstName, user?.lastName),
    [user?.firstName, user?.lastName]
  );

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(14);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (hasStartedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, hasStartedChat]);

  // Send message with context
  const sendMessage = useCallback(
    async (message: string, context?: ChatRequest['context']) => {
      // Initialize chat if needed
      if (!hasStartedChat) {
        setHasStartedChat(true);
        setMessages([welcomeMessage]);
      }

      // Add user message
      const userMessage: ChatMessageType = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setInputValue('');

      try {
        const response = await chatbotService.sendMessage({ message, context });
        setMessages((prev) => [...prev, response.message]);
      } catch (error) {
        console.error('Failed to send message:', error);
        const errorMessage: ChatMessageType = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, there was a connection problem. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [hasStartedChat, welcomeMessage]
  );

  // Handle message submission
  const handleSubmit = useCallback(
    (message: string) => {
      if (isGenerateSummaryCommand(message)) {
        setPendingMessage(message);
        setShowPeriodModal(true);
        return;
      }
      sendMessage(message);
    },
    [sendMessage]
  );

  // Handle input submit
  const handleInputSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      handleSubmit(trimmed);
    }
  }, [inputValue, handleSubmit]);

  // Handle quick action click
  const handleQuickAction = useCallback(
    (command: string) => {
      handleSubmit(command);
    },
    [handleSubmit]
  );

  // Handle period modal confirm
  const handlePeriodConfirm = useCallback(() => {
    if (!pendingMessage) return;

    const endDate = new Date();
    const startDate = new Date();
    // Match Member History date range: go back exactly selectedPeriod days
    // e.g., for 7 days on Jan 15: Jan 15 - 7 = Jan 8, so range is Jan 8-15
    startDate.setDate(startDate.getDate() - selectedPeriod);

    setShowPeriodModal(false);
    const message = pendingMessage;
    setPendingMessage(null);

    sendMessage(message, {
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  }, [pendingMessage, selectedPeriod, sendMessage]);

  // Handle period modal cancel
  const handlePeriodCancel = useCallback(() => {
    setShowPeriodModal(false);
    setPendingMessage(null);
  }, []);

  // Handle start fresh
  const handleStartFresh = useCallback(() => {
    setHasStartedChat(false);
    setMessages([]);
    setInputValue('');
  }, []);

  // ==========================================================================
  // LANDING VIEW
  // ==========================================================================
  if (!hasStartedChat) {
    return (
      <div className="relative flex flex-col min-h-[calc(100vh-120px)]">
        <GradientBackground />

        {/* Top Actions */}
        <div className="flex justify-end mb-8">
          <Link to="/team/ai-insights">
            <Button variant="ghost" size="sm" leftIcon={<History className="h-4 w-4" />}>
              View History
            </Button>
          </Link>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-4">
          <Branding size="lg" />

          {displayName && (
            <p className="text-gray-500 mt-4 mb-8">
              Hello, <span className="font-medium text-gray-700">{displayName}</span>
            </p>
          )}

          <div className="w-full mb-8">
            <ChatInputBox
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              isLoading={isLoading}
              placeholder="What would you like to know about your team?"
              variant="landing"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard
                key={action.id}
                icon={action.icon}
                title={action.title}
                description={action.description}
                gradient={action.gradient}
                onClick={() => handleQuickAction(action.command)}
              />
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mt-auto pt-8 text-center">
          <p className="text-xs text-gray-400">
            <Sparkles className="inline h-3 w-3 mr-1" />
            Your conversations are private. Only you can see your AI insights.
          </p>
        </div>

        {showPeriodModal && (
          <PeriodModal
            selectedPeriod={selectedPeriod}
            onSelectPeriod={setSelectedPeriod}
            onConfirm={handlePeriodConfirm}
            onCancel={handlePeriodCancel}
          />
        )}
      </div>
    );
  }

  // ==========================================================================
  // CHAT VIEW
  // ==========================================================================
  return (
    <div className="relative flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      <GradientBackground />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Branding size="sm" />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleStartFresh}>
            Start fresh
          </Button>
          <Link to="/team/ai-insights">
            <Button variant="secondary" size="sm" leftIcon={<History className="h-4 w-4" />}>
              History
            </Button>
          </Link>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onQuickAction={handleSubmit} />
          ))}
          {isLoading && <ThinkingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-4">
          <ChatInputBox
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleInputSubmit}
            isLoading={isLoading}
            placeholder="Type your message..."
            variant="chat"
          />
        </div>
      </div>

      {showPeriodModal && (
        <PeriodModal
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
          onConfirm={handlePeriodConfirm}
          onCancel={handlePeriodCancel}
        />
      )}
    </div>
  );
}

export default AIChatPage;
