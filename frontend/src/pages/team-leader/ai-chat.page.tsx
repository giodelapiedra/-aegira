import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, History, Calendar, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatMessage, ChatInput, ChatSuggestions } from '../../components/ai-chat';
import { chatbotService } from '../../services/chatbot.service';
import type { ChatMessage as ChatMessageType, ChatSuggestion, ChatRequest } from '../../types/chatbot';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';

// Period options for generating summary
const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 Days', description: 'Quick weekly overview' },
  { value: 14, label: 'Last 14 Days', description: 'Two-week analysis (Recommended)', recommended: true },
  { value: 30, label: 'Last 30 Days', description: 'Monthly comprehensive report' },
] as const;

// Helper to detect generate summary command
function isGenerateSummaryCommand(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  const keywords = ['generate summary', 'create summary', 'summary please', 'create report', 'generate report', 'new summary', 'make summary'];
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

// Generate personalized welcome message
function createWelcomeMessage(firstName?: string, lastName?: string): ChatMessageType {
  // Format name as "Gio H." style
  const displayName = firstName
    ? `${firstName}${lastName ? ` ${lastName.charAt(0)}.` : ''}`
    : '';

  const greeting = displayName ? `Hello, **${displayName}**!` : 'Hello!';

  return {
    id: 'welcome',
    role: 'assistant',
    content: `${greeting} I'm **AEGIRA CHAT BOT**, your AI assistant for team management.

How can I help you today?

- **"Generate Summary"** - Create an AI analysis of your team
- **"View Reports"** - View your past AI insights
- **"Team Status"** - Quick overview of your team today
- **"Help"** - Show all available commands`,
    timestamp: new Date(),
  };
}

export function AIChatPage() {
  const { user } = useUser();

  // Create personalized welcome message
  const welcomeMessage = useMemo(
    () => createWelcomeMessage(user?.firstName, user?.lastName),
    [user?.firstName, user?.lastName]
  );

  const [messages, setMessages] = useState<ChatMessageType[]>([]);

  // Initialize messages with welcome message when component mounts or user changes
  useEffect(() => {
    setMessages([welcomeMessage]);
  }, [welcomeMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Period selection modal state
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(14); // Default 14 days
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Fetch suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['chatbot-suggestions'],
    queryFn: () => chatbotService.getSuggestions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const suggestions: ChatSuggestion[] = suggestionsData?.suggestions || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message with optional context
  const sendMessageWithContext = useCallback(async (message: string, context?: ChatRequest['context']) => {
    // Add user message immediately
    const userMessage: ChatMessageType = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatbotService.sendMessage({ message, context });

      // Add assistant response
      setMessages((prev) => [...prev, response.message]);
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
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
  }, []);

  // Handle sending a message - intercepts Generate Summary to show period modal
  const handleSendMessage = useCallback(async (message: string) => {
    // Check if this is a Generate Summary command
    if (isGenerateSummaryCommand(message)) {
      setPendingMessage(message);
      setShowPeriodModal(true);
      return;
    }

    // For other messages, send directly
    await sendMessageWithContext(message);
  }, [sendMessageWithContext]);

  // Handle period selection and generate summary
  const handlePeriodConfirm = useCallback(async () => {
    if (!pendingMessage) return;

    // Calculate date range based on selected period
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - selectedPeriod);

    // Close modal and reset state
    setShowPeriodModal(false);
    const message = pendingMessage;
    setPendingMessage(null);

    // Send message with date range context
    await sendMessageWithContext(message, {
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  }, [pendingMessage, selectedPeriod, sendMessageWithContext]);

  // Handle modal cancel
  const handlePeriodCancel = useCallback(() => {
    setShowPeriodModal(false);
    setPendingMessage(null);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((command: string) => {
    handleSendMessage(command);
  }, [handleSendMessage]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-primary-600 flex items-center justify-center shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AEGIRA CHAT BOT</h1>
            <p className="text-sm text-gray-500">Your AI assistant for team insights</p>
          </div>
        </div>

        <Link
          to="/team/ai-insights"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <History className="h-4 w-4" />
          View History
        </Link>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-primary-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions & Input Area */}
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-4">
          {/* Quick Suggestions */}
          {suggestions.length > 0 && !isLoading && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
              <ChatSuggestions
                suggestions={suggestions}
                onSelect={handleSuggestionClick}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Input */}
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            placeholder="Type a message or click a quick action..."
          />
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Your AI-generated summaries are private. Only you can see them.
        </p>
      </div>

      {/* Period Selection Modal */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Select Report Period</h3>
                  <p className="text-sm text-gray-500">Choose the date range for your AI analysis</p>
                </div>
              </div>
              <button
                onClick={handlePeriodCancel}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPeriod(option.value)}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedPeriod === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{option.label}</span>
                        {option.recommended && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                    </div>
                    <div className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      selectedPeriod === option.value
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    )}>
                      {selectedPeriod === option.value && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handlePeriodCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePeriodConfirm}
                className="px-6 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIChatPage;
