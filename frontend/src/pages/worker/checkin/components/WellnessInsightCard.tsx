/**
 * WellnessInsightCard Component
 *
 * Displays supportive wellness insights based on check-in scores.
 * Identifies areas needing attention and provides motivational messages.
 * Only shown for YELLOW/RED status check-ins.
 */

import { Lightbulb, Smile, Brain, Moon, Heart } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';

// Thresholds for identifying concerning scores
const THRESHOLDS = {
  mood: { min: 5, type: 'low' }, // Mood ≤ 5 is concerning
  stress: { max: 7, type: 'high' }, // Stress ≥ 7 is concerning (inverse scale)
  sleep: { min: 5, type: 'low' }, // Sleep ≤ 5 is concerning
  physical: { min: 5, type: 'low' }, // Physical ≤ 5 is concerning
} as const;

// Motivational messages for each factor
const WELLNESS_MESSAGES: Record<
  string,
  {
    icon: typeof Smile;
    title: string;
    messages: string[];
    color: string;
    bgColor: string;
  }
> = {
  stress: {
    icon: Brain,
    title: 'High Stress Detected',
    messages: [
      'Take short breaks when you can. Small pauses help reset your focus.',
      'Try some deep breathing exercises. Even 2 minutes can make a difference.',
      'Remember: one task at a time. You can only do your best.',
      'Step outside for fresh air if possible. A change of scenery helps.',
    ],
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-100',
  },
  mood: {
    icon: Smile,
    title: 'Mood Support',
    messages: [
      "It's okay to have off days. You showed up, and that matters.",
      'Small wins count. Celebrate completing even simple tasks today.',
      'Reach out to a colleague or friend. Connection helps.',
      "Be kind to yourself today. Tomorrow is a fresh start.",
    ],
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-100',
  },
  sleep: {
    icon: Moon,
    title: 'Rest Reminder',
    messages: [
      "Sleep wasn't great, but you're here. Take it easy when you can.",
      'Stay hydrated and have a healthy snack. It helps with energy.',
      'Avoid heavy tasks if possible. Prioritize what truly matters today.',
      'Consider an earlier bedtime tonight. Your body will thank you.',
    ],
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-100',
  },
  physical: {
    icon: Heart,
    title: 'Physical Wellness',
    messages: [
      'Listen to your body today. Rest if you need to.',
      'Stay hydrated and take stretch breaks throughout the day.',
      "Don't push too hard. Your health comes first.",
      'Consider some light movement when you can. It boosts energy.',
    ],
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 border-rose-100',
  },
};

interface WellnessInsightCardProps {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
}

interface ConcerningFactor {
  factor: string;
  score: number;
  severity: number; // Higher = more severe
}

/**
 * Analyzes scores and identifies concerning factors
 */
function analyzeConcerningFactors(
  mood: number,
  stress: number,
  sleep: number,
  physical: number
): ConcerningFactor[] {
  const factors: ConcerningFactor[] = [];

  // Check mood (low is bad)
  if (mood <= THRESHOLDS.mood.min) {
    factors.push({
      factor: 'mood',
      score: mood,
      severity: THRESHOLDS.mood.min - mood + 1,
    });
  }

  // Check stress (high is bad - inverse scale)
  if (stress >= THRESHOLDS.stress.max) {
    factors.push({
      factor: 'stress',
      score: stress,
      severity: stress - THRESHOLDS.stress.max + 1,
    });
  }

  // Check sleep (low is bad)
  if (sleep <= THRESHOLDS.sleep.min) {
    factors.push({
      factor: 'sleep',
      score: sleep,
      severity: THRESHOLDS.sleep.min - sleep + 1,
    });
  }

  // Check physical (low is bad)
  if (physical <= THRESHOLDS.physical.min) {
    factors.push({
      factor: 'physical',
      score: physical,
      severity: THRESHOLDS.physical.min - physical + 1,
    });
  }

  // Sort by severity (highest first)
  return factors.sort((a, b) => b.severity - a.severity);
}

/**
 * Gets a random message for a factor (consistent per session using date seed)
 */
function getMessageForFactor(factor: string): string {
  const config = WELLNESS_MESSAGES[factor];
  if (!config) return '';

  // Use today's date as seed for consistent message throughout the day
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % config.messages.length;

  return config.messages[index];
}

export function WellnessInsightCard({
  mood,
  stress,
  sleep,
  physicalHealth,
  readinessStatus: _readinessStatus,
}: WellnessInsightCardProps) {
  const concerningFactors = analyzeConcerningFactors(mood, stress, sleep, physicalHealth);

  // If no concerning factors, show a positive message for GREEN status
  if (concerningFactors.length === 0) {
    return (
      <Card className="overflow-hidden border bg-green-50 border-green-100">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Smile className="h-6 w-6 text-green-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Wellness Insight
                </span>
              </div>

              <h3 className="font-semibold text-green-600 mb-2">Great Job Today!</h3>

              <p className="text-gray-700 text-sm leading-relaxed">
                Your wellness check-in shows you're in good shape. Keep up the great work and remember to take breaks when needed.
              </p>
            </div>
          </div>

          {/* Encouragement footer */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Remember: checking in shows self-awareness. You've got this!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the most concerning factor
  const primaryFactor = concerningFactors[0];
  const config = WELLNESS_MESSAGES[primaryFactor.factor];

  if (!config) {
    return null;
  }

  const IconComponent = config.icon;
  const message = getMessageForFactor(primaryFactor.factor);

  // Build secondary factors text if there are multiple concerns
  const secondaryFactors = concerningFactors.slice(1);
  const hasSecondary = secondaryFactors.length > 0;

  return (
    <Card className={`overflow-hidden border ${config.bgColor}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`h-12 w-12 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}
          >
            <IconComponent className={`h-6 w-6 ${config.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Wellness Insight
              </span>
            </div>

            <h3 className={`font-semibold ${config.color} mb-2`}>{config.title}</h3>

            <p className="text-gray-700 text-sm leading-relaxed">{message}</p>

            {/* Secondary factors */}
            {hasSecondary && (
              <p className="text-xs text-gray-500 mt-3">
                Also noted:{' '}
                {secondaryFactors
                  .map((f) => {
                    const name = f.factor === 'physical' ? 'physical health' : f.factor;
                    return f.factor === 'stress' ? `high ${name}` : `low ${name}`;
                  })
                  .join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Encouragement footer */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Remember: checking in shows self-awareness. You've got this!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
