/**
 * CheckinDashboard Component
 *
 * Dashboard view shown after check-in is completed.
 * Displays today's status, metrics, week stats, streak, and recent check-ins.
 */

import { useState } from 'react';
import {
  Smile,
  Brain,
  Moon,
  Heart,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { formatDisplayDate, formatDisplayDateTime } from '../../../../lib/date-utils';
import { STATUS_CONFIG } from '../../../../components/worker/StatusConfig';
import { ExemptionRequestModal } from './ExemptionRequestModal';
import { LowScoreReasonModal } from './LowScoreReasonModal';
import { WeekStatsCard } from './WeekStatsCard';
import { StreakCard } from './StreakCard';
import { RecentCheckinsCard } from './RecentCheckinsCard';
import type { CheckinWithAttendance, WeekStats } from '../../../../services/checkin.service';

interface User {
  id: string;
  firstName: string;
  lastName?: string;
}

interface Team {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
}

interface RecentCheckin {
  id: string;
  readinessScore: number;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  createdAt: string;
}

interface CheckinDashboardProps {
  currentUser: User;
  team?: Team | null;
  todayCheckin: CheckinWithAttendance;
  weekStats?: WeekStats | null;
  recentCheckins?: { data: RecentCheckin[] } | null;
  exemptionStatus?: boolean;
  pendingExemption?: { id: string } | null;
  needsLowScoreReason?: boolean;
  onRefetchExemptionStatus: () => void;
  onRefetchPendingExemption: () => void;
  onRefetchTodayCheckin: () => void;
}

export function CheckinDashboard({
  currentUser,
  team,
  todayCheckin,
  weekStats,
  recentCheckins,
  exemptionStatus,
  pendingExemption,
  needsLowScoreReason,
  onRefetchExemptionStatus,
  onRefetchPendingExemption,
  onRefetchTodayCheckin,
}: CheckinDashboardProps) {
  const [showExemptionModal, setShowExemptionModal] = useState(false);

  const getStatusBgGradient = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return config ? `${config.gradientFrom} ${config.gradientTo}` : 'from-gray-500 to-gray-600';
  };

  const getStatusLabel = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return config?.label || 'Unknown';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getGreeting()}, {currentUser.firstName}!
          </h1>
          <p className="text-gray-500 mt-1">
            {team?.shiftStart} - {team?.shiftEnd} shift
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          {formatDisplayDate(new Date().toISOString())}
        </div>
      </div>

      {/* Main Grid - Today's Status + Week Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Status - Hero Card (2 columns) */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {/* Gradient Header based on status */}
            <div
              className={`bg-gradient-to-r ${getStatusBgGradient(todayCheckin.readinessStatus)} px-6 py-5`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {todayCheckin.readinessScore}%
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {getStatusLabel(todayCheckin.readinessStatus)}
                    </h2>
                    <p className="text-white/80 text-sm">Today's Status</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Checked in at{' '}
                      {formatDisplayDateTime(todayCheckin.createdAt).split(',')[1]?.trim() ||
                        formatDisplayDateTime(todayCheckin.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <Smile className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{todayCheckin.mood}</p>
                  <p className="text-xs text-gray-500 font-medium">Mood</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <Brain className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{todayCheckin.stress}</p>
                  <p className="text-xs text-gray-500 font-medium">Stress</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <Moon className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{todayCheckin.sleep}</p>
                  <p className="text-xs text-gray-500 font-medium">Sleep</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <Heart className="h-5 w-5 mx-auto text-primary-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {todayCheckin.physicalHealth}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">Physical</p>
                </div>
              </div>

              {todayCheckin.notes && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600">{todayCheckin.notes}</p>
                </div>
              )}

              {/* Exemption Request Option for RED status */}
              {todayCheckin.readinessStatus === 'RED' && (
                <div className="mt-4 p-4 bg-danger-50 rounded-xl border border-danger-100">
                  {exemptionStatus ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-warning-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Exemption Request Pending</p>
                        <p className="text-sm text-gray-600">
                          Your team leader will review your request.
                        </p>
                      </div>
                    </div>
                  ) : pendingExemption ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-warning-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Pending Exemption Request</p>
                        <p className="text-sm text-gray-600">
                          Your team leader will review it soon.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                          <ShieldAlert className="h-5 w-5 text-danger-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Not Fit for Duty?</p>
                          <p className="text-sm text-gray-600">
                            Request an exemption from your team leader.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowExemptionModal(true)}
                        leftIcon={<FileText className="h-4 w-4" />}
                      >
                        Request
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Week Stats - Sidebar */}
        <div className="space-y-4">
          <WeekStatsCard weekStats={weekStats} />
          <StreakCard
            currentStreak={weekStats?.currentStreak}
            longestStreak={weekStats?.longestStreak}
          />
        </div>
      </div>

      {/* Recent Check-ins */}
      <RecentCheckinsCard checkins={recentCheckins?.data} skipFirst={1} maxDisplay={4} />

      {/* Exemption Request Modal */}
      {todayCheckin.readinessStatus === 'RED' && (
        <ExemptionRequestModal
          checkinId={todayCheckin.id}
          score={todayCheckin.readinessScore}
          isOpen={showExemptionModal}
          onClose={() => setShowExemptionModal(false)}
          onSuccess={() => {
            onRefetchExemptionStatus();
            onRefetchPendingExemption();
          }}
        />
      )}

      {/* Low Score Reason Modal - persistent until submitted */}
      {needsLowScoreReason && (
        <LowScoreReasonModal
          checkinId={todayCheckin.id}
          score={todayCheckin.readinessScore}
          isOpen={true}
          onClose={() => {}} // Cannot close without submitting
          onSuccess={() => {
            onRefetchTodayCheckin();
          }}
        />
      )}
    </div>
  );
}
