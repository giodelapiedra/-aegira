import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getNowInTimezone, createDateWithTimeInTimezone } from '../../lib/date-utils';

// Simplified presets - fixed periods only for consistent KPIs
export type PeriodPreset = '7d' | '30d' | '90d' | '1y' | 'all';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: PeriodPreset;
  label: string;
}

interface PeriodSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  timezone?: string; // Company timezone
  className?: string;
}

const presets: { id: PeriodPreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y', label: 'Last year' },
];

/**
 * Get date range from preset using company timezone
 * @param preset - Period preset
 * @param timezone - Company timezone (IANA format, e.g., "Asia/Manila")
 */
export function getDateRangeFromPreset(preset: PeriodPreset, timezone: string = 'Asia/Manila'): DateRange {
  // Get current date in company timezone
  const nowInTz = getNowInTimezone(timezone);
  const todayDate = nowInTz.date;

  // Create end of today in company timezone
  const today = createDateWithTimeInTimezone('23:59', todayDate, timezone);

  // Helper to create start of day in timezone
  const getStartOfDay = (date: Date) => createDateWithTimeInTimezone('00:00', date, timezone);

  switch (preset) {
    case '7d': {
      const startDate = new Date(todayDate);
      startDate.setDate(startDate.getDate() - 6);
      return { startDate: getStartOfDay(startDate), endDate: today, preset, label: 'Last 7 days' };
    }
    case '30d': {
      const startDate = new Date(todayDate);
      startDate.setDate(startDate.getDate() - 29);
      return { startDate: getStartOfDay(startDate), endDate: today, preset, label: 'Last 30 days' };
    }
    case '90d': {
      const startDate = new Date(todayDate);
      startDate.setDate(startDate.getDate() - 89);
      return { startDate: getStartOfDay(startDate), endDate: today, preset, label: 'Last 90 days' };
    }
    case '1y': {
      const startDate = new Date(todayDate);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setDate(startDate.getDate() + 1);
      return { startDate: getStartOfDay(startDate), endDate: today, preset, label: 'Last year' };
    }
    case 'all': {
      const startDate = new Date(2020, 0, 1);
      return { startDate: getStartOfDay(startDate), endDate: today, preset, label: 'All time' };
    }
    default:
      const startDate = new Date(todayDate);
      startDate.setDate(startDate.getDate() - 29);
      return { startDate: getStartOfDay(startDate), endDate: today, preset: '30d', label: 'Last 30 days' };
  }
}

export function PeriodSelector({ value, onChange, timezone = 'Asia/Manila', className }: PeriodSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (presetId: PeriodPreset) => {
    onChange(getDateRangeFromPreset(presetId, timezone));
    setShowDropdown(false);
  };

  const selectedPreset = presets.find(p => p.id === value.preset);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Dropdown Button - Simple and consistent across all devices */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-700 transition-colors shadow-sm"
      >
        <span>{selectedPreset?.label || value.label}</span>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', showDropdown && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[180px] overflow-hidden z-[100]">
          <div className="py-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between',
                  value.preset === preset.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{preset.label}</span>
                {value.preset === preset.id && (
                  <Check className="h-4 w-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

