/**
 * Critical Alert Component
 * Banner showing critical score drops that need attention
 */

import { memo } from 'react';
import { TrendingDown, ChevronRight } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';

interface CriticalAlertProps {
  criticalCount: number;
  onViewChanges: () => void;
}

export const CriticalAlert = memo(({ criticalCount, onViewChanges }: CriticalAlertProps) => {
  if (criticalCount === 0) return null;

  return (
    <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
          <TrendingDown className="h-5 w-5 text-danger-600" />
        </div>
        <div>
          <p className="font-semibold text-danger-800 text-sm md:text-base">
            {criticalCount} Critical Score Drop{criticalCount > 1 ? 's' : ''}
          </p>
          <p className="text-xs md:text-sm text-danger-600">
            Workers showing significant wellness decline
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onViewChanges} className="w-full md:w-auto">
        View <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
});
CriticalAlert.displayName = 'CriticalAlert';
