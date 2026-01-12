import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  User,
  ExternalLink,
  FileText,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessage as ChatMessageType } from '../../types/chatbot';

interface ChatMessageProps {
  message: ChatMessageType;
  onQuickAction?: (command: string) => void;
}

function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Icon mapping for links and quick actions
function getIcon(iconName?: string): LucideIcon {
  switch (iconName) {
    case 'file-text':
      return FileText;
    case 'bar-chart':
      return BarChart3;
    case 'users':
      return Users;
    case 'alert-triangle':
      return AlertTriangle;
    default:
      return ExternalLink;
  }
}

// Status badge for summary preview
function StatusBadge({ status }: { status: 'healthy' | 'attention' | 'critical' }) {
  const config = {
    healthy: {
      icon: CheckCircle2,
      label: 'Healthy',
      className: 'bg-success-100 text-success-700',
    },
    attention: {
      icon: AlertTriangle,
      label: 'Needs Attention',
      className: 'bg-warning-100 text-warning-700',
    },
    critical: {
      icon: AlertCircle,
      label: 'Critical',
      className: 'bg-danger-100 text-danger-700',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Safe text formatter - parses **bold** without dangerouslySetInnerHTML
function formatTextWithBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the bold text
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export const ChatMessage = memo(function ChatMessage({ message, onQuickAction }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary-100' : 'bg-gradient-to-br from-purple-500 to-primary-600'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-600" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn('flex flex-col max-w-[80%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-primary-500 text-white rounded-tr-md'
              : 'bg-gray-100 text-gray-800 rounded-tl-md'
          )}
        >
          {/* Message text - safe rendering without dangerouslySetInnerHTML */}
          <div className="text-sm whitespace-pre-wrap">
            {message.content.split('\n').map((line, i) => (
              <span key={i} className="block">
                {isUser ? line : formatTextWithBold(line)}
              </span>
            ))}
          </div>

          {/* Summary Preview Card */}
          {message.summaryPreview && (
            <div className="mt-3 p-3 bg-white/10 rounded-lg border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={message.summaryPreview.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold">{message.summaryPreview.highlightsCount}</div>
                  <div className="text-gray-500">Highlights</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{message.summaryPreview.concernsCount}</div>
                  <div className="text-gray-500">Concerns</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{message.summaryPreview.recommendationsCount}</div>
                  <div className="text-gray-500">Recs</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions - Clickable buttons */}
          {message.quickActions && message.quickActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.quickActions.map((action) => {
                const Icon = getIcon(action.icon);
                return (
                  <button
                    key={action.id}
                    onClick={() => onQuickAction?.(action.command)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-white border border-gray-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 shadow-sm hover:shadow"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Links */}
          {message.links && message.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.links.map((link, index) => {
                const Icon = getIcon(link.icon);
                return (
                  <Link
                    key={index}
                    to={link.url}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      isUser
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-primary-50 hover:bg-primary-100 text-primary-700'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-400 mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
});

export default ChatMessage;
