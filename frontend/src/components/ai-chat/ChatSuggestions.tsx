import { memo } from 'react';
import {
  Sparkles,
  FileText,
  Users,
  HelpCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatSuggestion } from '../../types/chatbot';

interface ChatSuggestionsProps {
  suggestions: ChatSuggestion[];
  onSelect: (command: string) => void;
  disabled?: boolean;
}

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  'file-text': FileText,
  users: Users,
  'help-circle': HelpCircle,
  'alert-triangle': AlertTriangle,
};

export const ChatSuggestions = memo(function ChatSuggestions({
  suggestions,
  onSelect,
  disabled = false,
}: ChatSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => {
        const Icon = iconMap[suggestion.icon || 'sparkles'] || Sparkles;
        return (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.command)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg',
              'bg-white border border-gray-200 shadow-sm',
              'text-sm font-medium text-gray-700',
              'hover:bg-gray-50 hover:border-gray-300',
              'active:bg-gray-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
            title={suggestion.description}
          >
            <Icon className="h-4 w-4 text-primary-500" />
            {suggestion.label}
          </button>
        );
      })}
    </div>
  );
});

export default ChatSuggestions;
