/**
 * Create Exemption Modal
 * Modal for Team Leader to create an exemption for a worker with low score
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Avatar } from '../../../../components/ui/Avatar';
import { EXCEPTION_TYPE_OPTIONS, type ExceptionType } from '../../../../services/exemption.service';
import { getNowInTimezone } from '../../../../lib/date-utils';
import type { CreateExemptionModalProps } from '../types';

export function CreateExemptionModal({
  checkin,
  onClose,
  onConfirm,
  isLoading,
  timezone,
}: CreateExemptionModalProps) {
  const [type, setType] = useState<ExceptionType>('SICK_LEAVE');
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const nowInTz = getNowInTimezone(timezone);
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = dateFormatter.formatToParts(nowInTz.date);
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);

  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));
  const in7Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 7, 12, 0, 0));

  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    return `${parts.find((p) => p.type === 'year')!.value}-${
      parts.find((p) => p.type === 'month')!.value
    }-${parts.find((p) => p.type === 'day')!.value}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Create Exemption</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-danger-50 rounded-lg p-4 mb-6 border border-danger-100">
          <div className="flex items-center gap-3">
            <Avatar
              firstName={checkin.user.firstName}
              lastName={checkin.user.lastName}
              size="md"
            />
            <div>
              <p className="font-medium text-gray-900">
                {checkin.user.firstName} {checkin.user.lastName}
              </p>
              <p className="text-sm text-danger-600">Score: {checkin.readinessScore}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exemption Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExceptionType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {EXCEPTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for exemption..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last day of exemption *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={formatDateForInput(tomorrow)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Tomorrow', date: tomorrow },
              { label: '3 days', date: in3Days },
              { label: '1 week', date: in7Days },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setEndDate(formatDateForInput(opt.date))}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm({ type, reason, endDate, notes: notes || undefined })}
            disabled={!reason.trim() || !endDate || isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Exemption'}
          </Button>
        </div>
      </div>
    </div>
  );
}
