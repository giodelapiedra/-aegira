import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkinService, LOW_SCORE_REASONS } from '../../services/checkin.service';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Calendar, FileText, X, ChevronDown } from 'lucide-react';
import type { LowScoreReason, Checkin } from '../../types/user';

// Constants
const PAGE_SIZE = 15;

// Utility functions
const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDay = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' });
};

const getReasonLabel = (reason: LowScoreReason): string => {
  return LOW_SCORE_REASONS.find(r => r.value === reason)?.label || reason;
};

const hasNote = (checkin: Pick<Checkin, 'notes' | 'lowScoreReason' | 'lowScoreDetails'>): boolean => {
  return !!(checkin.lowScoreReason || checkin.notes);
};

const formatNoteContent = (checkin: Pick<Checkin, 'notes' | 'lowScoreReason' | 'lowScoreDetails'>): string => {
  if (checkin.lowScoreReason) {
    const label = getReasonLabel(checkin.lowScoreReason);
    return checkin.lowScoreDetails ? `${label}: ${checkin.lowScoreDetails}` : label;
  }
  return checkin.notes || '';
};

// Calculate start date based on filter period
const getStartDateForPeriod = (period: FilterPeriod): string | undefined => {
  if (period === 'all') return undefined;

  const now = new Date();
  if (period === 'week') {
    now.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString().split('T')[0]; // YYYY-MM-DD format
};

type FilterPeriod = 'all' | 'week' | 'month';

export function MyHistoryPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);

  // Calculate date range for server-side filtering
  const startDate = useMemo(() => getStartDateForPeriod(filterPeriod), [filterPeriod]);

  // Handle period change - reset to page 1
  const handlePeriodChange = (period: FilterPeriod) => {
    setFilterPeriod(period);
    setPage(1);
  };

  // Query with server-side filtering
  const { data: checkinsData, isLoading } = useQuery({
    queryKey: ['checkins', 'my-history', page, PAGE_SIZE, startDate],
    queryFn: () => checkinService.getMyCheckins({
      page,
      limit: PAGE_SIZE,
      startDate,
    }),
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  // Calculations
  const { totalPages, totalCheckins, displayData } = useMemo(() => ({
    totalPages: checkinsData?.pagination?.totalPages || 1,
    totalCheckins: checkinsData?.pagination?.total || 0,
    displayData: checkinsData?.data || [],
  }), [checkinsData]);

  if (isLoading && !checkinsData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            src={user?.avatar}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Check-in History</h1>
            <p className="text-sm text-gray-500">
              View your submitted check-in records. No scores or evaluations are displayed.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{totalCheckins}</p>
          <p className="text-sm text-gray-500">Total Check-ins</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Filter by time period
          </p>

          {/* Period Filter */}
          <div className="relative">
            <select
              value={filterPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as FilterPeriod)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Date
          </div>
          <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Day
          </div>
          <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Time
          </div>
          <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </div>
          <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Note
          </div>
        </div>

        {/* Table Body */}
        {displayData.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">
              {filterPeriod !== 'all' ? 'No records found' : 'No check-ins yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {filterPeriod !== 'all'
                ? 'Try selecting a different time period'
                : 'Your check-in history will appear here'}
            </p>
            {filterPeriod !== 'all' && (
              <button
                onClick={() => handlePeriodChange('all')}
                className="text-sm text-primary-500 hover:text-primary-600 mt-3 font-medium"
              >
                Show all records
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayData.map((checkin) => (
              <div
                key={checkin.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors items-center"
              >
                <div className="col-span-3">
                  <p className="text-sm font-medium text-gray-900">
                    {formatFullDate(checkin.createdAt)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">
                    {formatDay(checkin.createdAt)}
                  </p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-600">
                    {formatTime(checkin.createdAt)}
                  </p>
                </div>
                <div className="col-span-2">
                  <Badge variant="default">Completed</Badge>
                </div>
                <div className="col-span-2">
                  {hasNote(checkin) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCheckin(checkin)}
                      leftIcon={<FileText className="w-3.5 h-3.5" />}
                    >
                      View
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table Footer - Pagination */}
        {displayData.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCheckins)} of {totalCheckins} records
                {filterPeriod !== 'all' && ' (filtered)'}
              </p>
              {totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalCheckins}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Note Modal */}
      {selectedCheckin && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedCheckin(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Note Details</h3>
                  <p className="text-sm text-gray-500">
                    {formatFullDate(selectedCheckin.createdAt)} at {formatTime(selectedCheckin.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCheckin(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="px-6 py-5">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed">
                    {formatNoteContent(selectedCheckin)}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  This note was added during check-in to provide context if support is needed.
                </p>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setSelectedCheckin(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
