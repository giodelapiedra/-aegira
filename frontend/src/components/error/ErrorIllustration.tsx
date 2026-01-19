import { cn } from '../../lib/utils';

interface ErrorIllustrationProps {
  type: '404' | '403' | '500' | 'error';
  className?: string;
}

export function ErrorIllustration({ type, className }: ErrorIllustrationProps) {
  const configs = {
    '404': {
      bg: 'from-gray-100 to-gray-50',
      iconBg: 'bg-gray-200',
      iconColor: 'text-gray-400',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M8 8l6 6" />
          <path d="M14 8l-6 6" />
        </svg>
      ),
    },
    '403': {
      bg: 'from-danger-100 to-danger-50',
      iconBg: 'bg-danger-200',
      iconColor: 'text-danger-500',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" />
        </svg>
      ),
    },
    '500': {
      bg: 'from-warning-100 to-warning-50',
      iconBg: 'bg-warning-200',
      iconColor: 'text-warning-600',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    error: {
      bg: 'from-danger-100 to-danger-50',
      iconBg: 'bg-danger-200',
      iconColor: 'text-danger-500',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
  };

  const config = configs[type];

  return (
    <div className={cn('relative', className)}>
      {/* Background glow */}
      <div className={cn(
        'absolute inset-0 rounded-full bg-gradient-to-br blur-2xl opacity-60',
        config.bg
      )} />

      {/* Icon container */}
      <div className={cn(
        'relative h-32 w-32 rounded-full flex items-center justify-center',
        config.iconBg
      )}>
        <div className={cn('h-16 w-16', config.iconColor)}>
          {config.icon}
        </div>
      </div>
    </div>
  );
}
