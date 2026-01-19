/**
 * End Leave Early Modal
 * Modal for ending a leave/exception early with return date selection
 */

import { useState } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { getNowInTimezone } from '../../lib/date-utils';

interface EndLeaveEarlyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (returnDate: string, notes?: string) => void;
  isLoading: boolean;
  timezone: string;
  user: {
    firstName?: string;
    lastName?: string;
  };
  currentEndDate: string | Date | null;
  leaveType?: string;
}

export function EndLeaveEarlyModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  timezone,
  user,
  currentEndDate,
  leaveType,
}: EndLeaveEarlyModalProps) {
  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const nowInTz = getNowInTimezone(timezone);
  const today = nowInTz.date;

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const todayParts = dateFormatter.formatToParts(today);
  const todayYear = parseInt(todayParts.find((p) => p.type === 'year')!.value);
  const todayMonth = parseInt(todayParts.find((p) => p.type === 'month')!.value) - 1;
  const todayDay = parseInt(todayParts.find((p) => p.type === 'day')!.value);

  const tomorrow = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
  const in2Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 2, 12, 0, 0));
  const in3Days = new Date(Date.UTC(todayYear, todayMonth, todayDay + 3, 12, 0, 0));

  // Calculate max date (must be before current end date)
  const endDateObj = currentEndDate ? new Date(currentEndDate) : null;

  const formatDateForInput = (date: Date) => {
    const parts = dateFormatter.formatToParts(date);
    return `${parts.find((p) => p.type === 'year')!.value}-${
      parts.find((p) => p.type === 'month')!.value
    }-${parts.find((p) => p.type === 'day')!.value}`;
  };

  const formatDateForDisplay = (dateInput: string | Date | null) => {
    if (!dateInput) return 'Not set';
    const date = new Date(dateInput);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Check if a quick option date is valid (before current end date)
  const isQuickOptionValid = (date: Date) => {
    if (!endDateObj) return true;
    // Return date must result in new end date being earlier than current
    // newEndDate = returnDate - 1 day
    const newEndDate = new Date(date);
    newEndDate.setDate(newEndDate.getDate() - 1);
    return newEndDate < endDateObj;
  };

  const handleConfirm = () => {
    onConfirm(returnDate, notes || undefined);
    // Reset state on confirm
    setReturnDate('');
    setNotes('');
  };

  const handleClose = () => {
    setReturnDate('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">End Leave Early</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Worker Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Avatar
              firstName={user.firstName}
              lastName={user.lastName}
              size="md"
            />
            <div>
              <p className="font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {leaveType && <span className="mr-2">{leaveType}</span>}
                Current end: {formatDateForDisplay(currentEndDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Select the date when the worker should return to work and check in.
            The leave will end the day before.
          </p>
        </div>

        {/* Return Date Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Return to Work Date
          </label>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            min={formatDateForInput(tomorrow)}
            max={endDateObj ? formatDateForInput(endDateObj) : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Quick Options */}
        <div className="flex gap-2 mb-6">
          {[
            { label: 'Tomorrow', date: tomorrow },
            { label: 'In 2 days', date: in2Days },
            { label: 'In 3 days', date: in3Days },
          ].map((opt) => {
            const isValid = isQuickOptionValid(opt.date);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => isValid && setReturnDate(formatDateForInput(opt.date))}
                disabled={!isValid}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isValid
                    ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                    : 'text-gray-400 bg-gray-50 cursor-not-allowed'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for ending early..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="warning"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!returnDate || isLoading}
          >
            {isLoading ? 'Ending...' : 'End Leave'}
          </Button>
        </div>
      </div>
    </div>
  );
}
