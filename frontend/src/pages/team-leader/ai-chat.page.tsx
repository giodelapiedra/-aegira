import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatMessage, ChatInput, ChatSuggestions } from '../../components/ai-chat';
import { chatbotService } from '../../services/chatbot.service';
import type { ChatMessage as ChatMessageType, ChatSuggestion } from '../../types/chatbot';
import { useUser } from '../../hooks/useUser';

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

  // Handle sending a message
  const handleSendMessage = useCallback(async (message: string) => {
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
      const response = await chatbotService.sendMessage({ message });

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
    </div>
  );
}

export default AIChatPage;
