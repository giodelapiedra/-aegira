/**
 * ScheduleCard Component
 *
 * Shows user's work schedule and team info.
 */

import { Calendar } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';

interface ScheduleCardProps {
  teamName: string;
  formattedWorkDays: string;
  formattedShiftHours: string;
}

export function ScheduleCard({
  teamName,
  formattedWorkDays,
  formattedShiftHours,
}: ScheduleCardProps) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              My Schedule
            </h3>
            <p className="text-sm text-gray-600">{teamName}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Work Days</span>
            <span className="text-sm font-medium text-gray-900">{formattedWorkDays}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Shift Hours</span>
            <span className="text-sm font-medium text-gray-900">{formattedShiftHours}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
