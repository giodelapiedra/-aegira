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
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Icon with animated ring */}
        <div className="relative mb-8">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 w-28 h-28 -m-4">
            <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                strokeDasharray="70 200"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Inner pulsing ring */}
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary-400/30 animate-ping-slow" />

          {/* Logo container */}
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/30">
            {/* Shield icon */}
            <svg
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" className="animate-draw" />
            </svg>
          </div>
        </div>

        {/* Brand name with letter animation */}
        <div className="flex items-center gap-1 mb-4">
          {'AEGIRA'.split('').map((letter, index) => (
            <span
              key={index}
              className="text-4xl md:text-5xl font-bold text-white animate-letter-bounce"
              style={{
                animationDelay: `${index * 0.1}s`,
                textShadow: '0 0 40px rgba(59, 130, 246, 0.5)'
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <p className="text-primary-300 text-sm font-medium tracking-[0.3em] uppercase mb-8 animate-fade-in">
          Readiness System
        </p>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-400 rounded-full animate-loading-bar" />
        </div>

        {/* Message */}
        <p className="mt-4 text-white/60 text-sm animate-pulse">
          {message}
        </p>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/30 text-xs">
        <div className="w-8 h-px bg-white/20" />
        <span>Powered by Innovation</span>
        <div className="w-8 h-px bg-white/20" />
      </div>

      {/* Custom styles */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }

        @keyframes letter-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes draw {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }

        .animate-ping-slow {
          animation: ping-slow 2s ease-out infinite;
        }

        .animate-letter-bounce {
          animation: letter-bounce 1.5s ease-in-out infinite;
        }

        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          animation-delay: 0.5s;
          opacity: 0;
        }

        .animate-draw {
          stroke-dasharray: 20;
          animation: draw 1s ease-out forwards;
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  );
}
