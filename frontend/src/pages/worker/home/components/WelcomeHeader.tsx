/**
 * WelcomeHeader Component
 *
 * Hero section with greeting and today's date.
 */

import { Sparkles } from 'lucide-react';

interface WelcomeHeaderProps {
  firstName?: string;
  todayDateDisplay: string;
  greetingText: string;
  hasCheckedIn: boolean;
}

export function WelcomeHeader({
  firstName,
  todayDateDisplay,
  greetingText,
  hasCheckedIn,
}: WelcomeHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-6 md:p-8 text-white">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary-200" />
          <span className="text-sm text-primary-200">{todayDateDisplay}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {greetingText}, {firstName}!
        </h1>
        <p className="text-primary-100 max-w-xl">
          {hasCheckedIn
            ? "You've completed your check-in today. Keep up the great work!"
            : 'Start your day right by completing your daily check-in.'}
        </p>
      </div>
    </div>
  );
}
