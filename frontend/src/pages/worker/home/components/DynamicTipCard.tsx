/**
 * DynamicTipCard Component
 *
 * Shows personalized tips based on check-in data.
 */

import { Card, CardContent } from '../../../../components/ui/Card';
import type { DynamicTip } from '../types';

interface DynamicTipCardProps {
  tip: DynamicTip;
}

export function DynamicTipCard({ tip }: DynamicTipCardProps) {
  const TipIcon = tip.icon;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <TipIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{tip.title}</h3>
            <p className="text-sm text-gray-600">{tip.text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
