/**
 * StatusCard Component
 *
 * Shows today's check-in status or prompts to check in.
 */

import { Link } from 'react-router-dom';
import { Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { formatDisplayDateTime } from '../../../../lib/date-utils';
import { STATUS_CONFIG } from '../../../../components/worker/StatusConfig';
import type { Checkin } from '../../../../types/user';

interface StatusCardProps {
  isLoading: boolean;
  todayCheckin: Checkin | null | undefined;
  timezone?: string;
}

export function StatusCard({ isLoading, todayCheckin, timezone }: StatusCardProps) {
  const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DEFAULT;

  if (isLoading) {
    return (
      <Card className="border-2 border-gray-200 bg-gray-50 min-h-[140px]">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gray-200 animate-pulse" />
              <div>
                <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
              </div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-24 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (todayCheckin) {
    const config = getStatusConfig(todayCheckin.readinessStatus);
    return (
      <Card
        className={`border-2 ${config.borderColor} ${config.bgColor} transition-all duration-300 hover:shadow-lg`}
      >
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`h-14 w-14 rounded-2xl ${config.color} flex items-center justify-center shadow-lg relative overflow-hidden`}
              >
                <span className="text-3xl animate-bounce-slow relative z-10">{config.emoji}</span>
                <div className={`absolute inset-0 ${config.color} opacity-20 animate-pulse`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      todayCheckin.readinessStatus === 'GREEN'
                        ? 'success'
                        : todayCheckin.readinessStatus === 'YELLOW'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {config.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-1 animate-fade-in">
                  <Clock className="h-4 w-4" />
                  Checked in: {formatDisplayDateTime(todayCheckin.createdAt, timezone)}
                </p>
              </div>
            </div>
            <Link
              to="/my-history"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View history
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-warning-200 bg-warning-50">
      <CardContent className="py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-warning-500 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Check-in Required</h3>
              <p className="text-sm text-gray-600">
                Complete your daily check-in to update your readiness status
              </p>
            </div>
          </div>
          <Link
            to="/checkin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
          >
            Check-in Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
