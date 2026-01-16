/**
 * Full Screen Loading Component
 * Used for app initialization and route transitions
 */

import { cn } from '../../lib/utils';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message = 'Loading...', className }: LoadingScreenProps) {
  return (
    <div className={cn(
      'fixed inset-0 z-[100] flex flex-col items-center justify-center',
      'bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900',
      className
    )}>
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with animated ring */}
        <div className="relative mb-8">
          {/* Spinning ring */}
          <div className="absolute -inset-4 w-24 h-24">
            <svg className="w-full h-full animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#loadingGradient)"
                strokeWidth="2"
                strokeDasharray="60 200"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Logo icon */}
          <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/40">
            <svg
              className="w-8 h-8 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
        </div>

        {/* Brand */}
        <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">AEGIRA</h1>
        <p className="text-primary-300 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Readiness System
        </p>

        {/* Loading indicator */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>

        {/* Message */}
        <p className="mt-4 text-white/50 text-sm">{message}</p>
      </div>
    </div>
  );
}
