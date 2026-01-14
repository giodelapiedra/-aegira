/**
 * Exemptions Tab Component
 * Displays pending and active exemptions for review
 *
 * IMPORTANT: Only APPROVED exemptions affect "on leave" calculations.
 * PENDING exemptions are just requests awaiting TL review.
 */

import { Clock, CheckCircle2, Timer } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { PendingExemptionCard, ActiveExemptionCard } from '../../../../components/monitoring';
import { useExemptions } from '../hooks/useExemptions';
import type { Exemption } from '../../../../services/exemption.service';

interface ExemptionsTabProps {
  teamId?: string;
  timezone: string;
  onApprove: (exemption: Exemption) => void;
  onReject: (exemption: Exemption) => void;
  onEndEarly: (exemption: Exemption) => void;
  isLoading?: boolean;
}

export function ExemptionsTab({
  teamId,
  timezone,
  onApprove,
  onReject,
  onEndEarly,
  isLoading: mutationLoading,
}: ExemptionsTabProps) {
  // Fetch all exemptions (default filter shows PENDING + APPROVED)
  const { data, isLoading } = useExemptions({ teamId });

  const exemptions = data?.data || [];
  const summary = data?.summary;

  // Split into pending and active
  const pendingExemptions = exemptions.filter((e) => e.status === 'PENDING');
  const activeExemptions = exemptions.filter((e) => e.status === 'APPROVED' && e.isActiveToday);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Convert to Exemption type for existing components
  // Using type assertion since display components only need subset of Exemption properties
  const toExemption = (e: typeof exemptions[0]): Exemption =>
    ({
      id: e.id,
      type: e.type,
      reason: e.reason,
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
      reviewNote: e.reviewNotes,
      createdAt: e.createdAt,
      user: e.user,
      reviewedBy: e.reviewedBy,
      triggeredByCheckin: e.triggeredByCheckin,
      userId: e.user?.id || '',
      companyId: '',
      isExemption: true,
      updatedAt: e.createdAt,
    }) as Exemption;

  return (
    <div className="space-y-6">
      {/* Pending Exemptions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning-500" />
          Pending ({summary?.pendingCount || pendingExemptions.length})
        </h3>
        {pendingExemptions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <EmptyState icon={Clock} title="No pending requests" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingExemptions.map((exemption) => (
              <PendingExemptionCard
                key={exemption.id}
                exemption={toExemption(exemption)}
                onApprove={onApprove}
                onReject={onReject}
                isLoading={mutationLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Exemptions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success-500" />
          Active ({summary?.activeCount || activeExemptions.length})
        </h3>
        {activeExemptions.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <EmptyState icon={Timer} title="No active exemptions" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeExemptions.map((exemption) => (
              <ActiveExemptionCard
                key={exemption.id}
                exemption={toExemption(exemption)}
                onEndEarly={onEndEarly}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
