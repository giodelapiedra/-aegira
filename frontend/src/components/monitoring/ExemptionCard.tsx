/**
 * ExemptionCard Components
 * Cards for displaying pending and active exemptions
 */

import { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { MetricsRow } from './MetricsBadge';
import type { Exemption } from '../../services/exemption.service';
import { getExceptionTypeLabel, getDaysRemaining } from '../../services/exemption.service';
import { formatTimeAgo } from '../../services/daily-monitoring.service';

// ============================================
// PENDING EXEMPTION CARD
// ============================================

interface PendingExemptionCardProps {
  exemption: Exemption;
  onApprove: (exemption: Exemption) => void;
  onReject: (exemption: Exemption) => void;
  onViewDetails?: (exemption: Exemption) => void;
  isLoading?: boolean;
  className?: string;
}

export function PendingExemptionCard({
  exemption,
  onApprove,
  onReject,
  onViewDetails,
  isLoading = false,
  className,
}: PendingExemptionCardProps) {
  const checkin = exemption.triggeredByCheckin;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-warning-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="bg-warning-50 px-4 py-3 border-b border-warning-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning-600" />
            <span className="text-sm font-medium text-warning-700">Pending Request</span>
          </div>
          <span className="text-xs text-warning-600">
            {formatTimeAgo(exemption.createdAt)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            firstName={exemption.user.firstName}
            lastName={exemption.user.lastName}
            size="lg"
          />
          <div>
            <h4 className="font-semibold text-gray-900">
              {exemption.user.firstName} {exemption.user.lastName}
            </h4>
            <p className="text-sm text-gray-500">{exemption.user.email}</p>
          </div>
        </div>

        {/* Check-in Score */}
        {checkin && (
          <div className="bg-danger-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-danger-700">Check-in Score</span>
              <span className="text-lg font-bold text-danger-700">
                {Math.round(checkin.readinessScore)}%
              </span>
            </div>
            <MetricsRow
              mood={checkin.mood}
              stress={checkin.stress}
              sleep={checkin.sleep}
              physicalHealth={checkin.physicalHealth}
              size="sm"
            />
          </div>
        )}

        {/* Exemption Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Type:</span>
            <span className="font-medium text-gray-700">
              {getExceptionTypeLabel(exemption.type)}
            </span>
          </div>
          <div className="text-sm">
            <p className="text-gray-500 mb-1">Reason:</p>
            <p className="text-gray-700 bg-gray-50 rounded-lg p-2">{exemption.reason}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onReject(exemption)}
            disabled={isLoading}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onApprove(exemption)}
            disabled={isLoading}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACTIVE EXEMPTION CARD
// ============================================

interface ActiveExemptionCardProps {
  exemption: Exemption;
  onEndEarly?: (exemption: Exemption) => void;
  onViewDetails?: (exemption: Exemption) => void;
  className?: string;
  timezone?: string;
}

export function ActiveExemptionCard({
  exemption,
  onEndEarly,
  onViewDetails,
  className,
  timezone = 'Asia/Manila',
}: ActiveExemptionCardProps) {
  const daysRemaining = getDaysRemaining(exemption.endDate, timezone);
  const endDate = exemption.endDate ? new Date(exemption.endDate) : null;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-success-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="bg-success-50 px-4 py-3 border-b border-success-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-600" />
            <span className="text-sm font-medium text-success-700">Active Exemption</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-success-600">
            <Timer className="h-3.5 w-3.5" />
            <span>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            firstName={exemption.user.firstName}
            lastName={exemption.user.lastName}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">
              {exemption.user.firstName} {exemption.user.lastName}
            </h4>
            <p className="text-sm text-gray-500">{getExceptionTypeLabel(exemption.type)}</p>
          </div>
        </div>

        {/* Return Date */}
        <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg p-3 mb-4">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">Returns:</span>
          <span className="font-medium text-gray-700">
            {endDate?.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              timeZone: timezone,
            })}
          </span>
        </div>

        {/* Approved By */}
        {exemption.reviewedBy && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <User className="h-4 w-4 text-gray-400" />
            <span>Approved by {exemption.reviewedBy.firstName} {exemption.reviewedBy.lastName}</span>
          </div>
        )}

        {/* Actions */}
        {onEndEarly && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => onEndEarly(exemption)}
          >
            <XCircle className="h-4 w-4 mr-1" />
            End Early
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPACT ROW VERSIONS
// ============================================

interface ExemptionRowProps {
  exemption: Exemption;
  variant: 'pending' | 'active';
  onClick?: () => void;
  className?: string;
}

export function ExemptionRow({
  exemption,
  variant,
  onClick,
  className,
}: ExemptionRowProps) {
  const isPending = variant === 'pending';
  const daysRemaining = getDaysRemaining(exemption.endDate);

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow',
        isPending
          ? 'bg-warning-50 border-warning-200'
          : 'bg-success-50 border-success-200',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {isPending ? (
          <Clock className="h-4 w-4 text-warning-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-success-600" />
        )}
        <div>
          <span className="font-medium text-gray-900">
            {exemption.user.firstName} {exemption.user.lastName}
          </span>
          <span className="text-sm text-gray-500 ml-2">
            {getExceptionTypeLabel(exemption.type)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPending ? (
          <span className="text-sm text-warning-600">
            {formatTimeAgo(exemption.createdAt)}
          </span>
        ) : (
          <span className="text-sm text-success-600">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
          </span>
        )}
      </div>
    </div>
  );
}
