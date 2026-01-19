import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exceptionService } from '../../services/exception.service';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EndLeaveEarlyModal } from '../../components/ui/EndLeaveEarlyModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { formatDisplayDate } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';
import { SkeletonTable } from '../../components/ui/Skeleton';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  StopCircle,
  Trash2,
  X,
  Inbox,
  MoreHorizontal,
  ChevronDown,
  Filter,
} from 'lucide-react';
import type { Exception } from '../../types/user';

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'all';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { company } = useAuthStore();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveRowMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [approveException, setApproveException] = useState<Exception | null>(null);
  const [rejectException, setRejectException] = useState<Exception | null>(null);
  const [endEarlyException, setEndEarlyException] = useState<Exception | null>(null);
  const [cancelException, setCancelException] = useState<Exception | null>(null);
  const limit = 10;

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['exceptions', filter, debouncedSearch, page],
    queryFn: () =>
      exceptionService.getAll({
        status: filter === 'all' ? undefined : filter,
        search: debouncedSearch || undefined,
        page,
        limit,
      }),
  });

  // Get stats for tabs (server-side counts)
  const { data: stats } = useQuery({
    queryKey: ['exceptions', 'stats'],
    queryFn: () => exceptionService.getStats(),
    refetchInterval: 30000,
  });

  const counts = {
    PENDING: stats?.pending || 0,
    APPROVED: stats?.approved || 0,
    REJECTED: stats?.rejected || 0,
    all: stats?.total || 0,
  };

  const handleFilterChange = (value: FilterStatus) => {
    setFilter(value);
    setPage(1);
    setShowFilterDropdown(false);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => exceptionService.approve(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setSelectedException(null);
      setApproveException(null);
      toast.success('Request approved');
    },
    onError: () => {
      toast.error('Failed to approve request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => exceptionService.reject(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setSelectedException(null);
      setRejectException(null);
      toast.success('Request rejected');
    },
    onError: () => {
      toast.error('Failed to reject request');
    },
  });

  const endEarlyMutation = useMutation({
    mutationFn: ({ id, returnDate, notes }: { id: string; returnDate: string; notes?: string }) =>
      exceptionService.endEarly(id, { returnDate, notes }),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      invalidateRelatedQueries(queryClient, 'leave-status');
      invalidateRelatedQueries(queryClient, 'approved-leave-today');
      setSelectedException(null);
      setEndEarlyException(null);
      toast.success('Leave ended early');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error?.response?.data?.error || 'Failed to end early');
      setEndEarlyException(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => exceptionService.cancel(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      invalidateRelatedQueries(queryClient, 'leave-status');
      invalidateRelatedQueries(queryClient, 'approved-leave-today');
      setSelectedException(null);
      setCancelException(null);
      toast.success('Leave cancelled');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error?.response?.data?.error || 'Failed to cancel');
      setCancelException(null);
    },
  });

  const toDateStr = (date: Date | string) => {
    const d = new Date(date);
    const timezone = company?.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  };

  const todayStr = toDateStr(new Date());

  const canEndEarly = (exception: Exception) => {
    const startStr = toDateStr(exception.startDate);
    const endStr = exception.endDate ? toDateStr(exception.endDate) : null;
    if (!endStr) return false;
    return startStr <= todayStr && endStr > todayStr;
  };

  const isActive = (exception: Exception) => {
    const endStr = exception.endDate ? toDateStr(exception.endDate) : null;
    if (!endStr) return true;
    return endStr >= todayStr;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MEDICAL: 'Medical',
      SICK_LEAVE: 'Sick Leave',
      PERSONAL: 'Personal',
      PERSONAL_LEAVE: 'Personal Leave',
      MEDICAL_APPOINTMENT: 'Medical Appt',
      FAMILY_EMERGENCY: 'Family Emergency',
      TRAINING: 'Training',
      TEAM_INACTIVE: 'Team Inactive',
      OTHER: 'Other',
    };
    return labels[type] || type;
  };

  const getDurationText = (exception: Exception) => {
    const start = formatDisplayDate(exception.startDate);
    if (!exception.endDate) return `${start} - Ongoing`;
    const end = formatDisplayDate(exception.endDate);
    if (start === end) return start;
    return `${start} - ${end}`;
  };

  const getFilterLabel = () => {
    if (filter === 'all') return 'All Status';
    if (filter === 'PENDING') return 'Pending';
    if (filter === 'APPROVED') return 'Approved';
    if (filter === 'REJECTED') return 'Rejected';
    return 'Status';
  };

  const filterOptions = [
    { value: 'all' as FilterStatus, label: 'All Status', count: counts.all },
    { value: 'PENDING' as FilterStatus, label: 'Pending', count: counts.PENDING },
    { value: 'APPROVED' as FilterStatus, label: 'Approved', count: counts.APPROVED },
    { value: 'REJECTED' as FilterStatus, label: 'Rejected', count: counts.REJECTED },
  ];

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Leave Requests</h1>

            {/* Right side: Filters and Search */}
            <div className="flex items-center gap-3">
              {/* Status Filter Dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                    filter !== 'all'
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {getFilterLabel()}
                  {filter !== 'all' && counts[filter] > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                      {counts[filter]}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showFilterDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.value)}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50',
                          filter === option.value && 'bg-primary-50 text-primary-700'
                        )}
                      >
                        <span>{option.label}</span>
                        {option.count > 0 && (
                          <span className="text-xs text-gray-400">{option.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-48 pl-9 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-gray-50 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <SkeletonTable rows={5} columns={5} />
        ) : exceptions?.data?.length === 0 ? (
          <div className="py-20 text-center">
            <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {searchQuery ? 'No results found' : 'No leave requests'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try a different search term' : 'Leave requests will appear here'}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Duration</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-50">
              {exceptions?.data?.map((exception) => (
                <div
                  key={exception.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50/50 transition-colors"
                >
                  {/* Name */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar
                      firstName={exception.user?.firstName}
                      lastName={exception.user?.lastName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {exception.user?.firstName} {exception.user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {exception.user?.email}
                      </p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">
                      {getTypeLabel(exception.type)}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="col-span-3">
                    <span className="text-sm text-gray-600">
                      {getDurationText(exception)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {exception.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    ) : exception.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                        <CheckCircle className="h-3 w-3" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="col-span-1 flex justify-end relative" ref={activeRowMenu === exception.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowMenu(activeRowMenu === exception.id ? null : exception.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {activeRowMenu === exception.id && (
                      <div className="absolute right-0 top-8 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                          onClick={() => {
                            setSelectedException(exception);
                            setActiveRowMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          View Details
                        </button>

                        {exception.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => {
                                setApproveException(exception);
                                setActiveRowMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle className="h-4 w-4 inline mr-2" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectException(exception);
                                setActiveRowMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 inline mr-2" />
                              Reject
                            </button>
                          </>
                        )}

                        {exception.status === 'APPROVED' && isActive(exception) && (
                          <>
                            {canEndEarly(exception) && (
                              <button
                                onClick={() => {
                                  setEndEarlyException(exception);
                                  setActiveRowMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50"
                              >
                                <StopCircle className="h-4 w-4 inline mr-2" />
                                End Early
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setCancelException(exception);
                                setActiveRowMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 inline mr-2" />
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {exceptions?.pagination && exceptions.pagination.totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <Pagination
              currentPage={page}
              totalPages={exceptions.pagination.totalPages}
              totalItems={exceptions.pagination.total}
              pageSize={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedException(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar
                  firstName={selectedException.user?.firstName}
                  lastName={selectedException.user?.lastName}
                  size="md"
                />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedException.user?.firstName} {selectedException.user?.lastName}
                  </h3>
                  <p className="text-xs text-gray-500">{selectedException.user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedException(null)}
                className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-900">{getTypeLabel(selectedException.type)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  {selectedException.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
                      <Clock className="h-4 w-4" />
                      Pending
                    </span>
                  ) : selectedException.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
                      <XCircle className="h-4 w-4" />
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Duration</p>
                <p className="text-sm font-medium text-gray-900">{getDurationText(selectedException)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Reason</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedException.reason}</p>
              </div>

              {selectedException.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{selectedException.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-100">
              {selectedException.status === 'PENDING' ? (
                <div className="flex gap-3">
                  <Button
                    variant="success"
                    className="flex-1"
                    onClick={() => setApproveException(selectedException)}
                    leftIcon={<CheckCircle className="h-4 w-4" />}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => setRejectException(selectedException)}
                    leftIcon={<XCircle className="h-4 w-4" />}
                  >
                    Reject
                  </Button>
                </div>
              ) : selectedException.status === 'APPROVED' && isActive(selectedException) ? (
                <div className="flex gap-3">
                  {canEndEarly(selectedException) && (
                    <Button
                      variant="warning"
                      className="flex-1"
                      onClick={() => setEndEarlyException(selectedException)}
                      leftIcon={<StopCircle className="h-4 w-4" />}
                    >
                      End Early
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setCancelException(selectedException)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => setSelectedException(null)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* End Early Modal */}
      <EndLeaveEarlyModal
        isOpen={!!endEarlyException}
        onClose={() => setEndEarlyException(null)}
        onConfirm={(returnDate, notes) => {
          if (endEarlyException) {
            endEarlyMutation.mutate({
              id: endEarlyException.id,
              returnDate,
              notes,
            });
          }
        }}
        isLoading={endEarlyMutation.isPending}
        timezone={company?.timezone || 'UTC'}
        user={{
          firstName: endEarlyException?.user?.firstName,
          lastName: endEarlyException?.user?.lastName,
        }}
        currentEndDate={endEarlyException?.endDate || null}
        leaveType={endEarlyException ? getTypeLabel(endEarlyException.type) : undefined}
      />

      {/* Cancel Modal */}
      <ConfirmModal
        isOpen={!!cancelException}
        onClose={() => setCancelException(null)}
        onConfirm={() => cancelException && cancelMutation.mutate(cancelException.id)}
        title="Cancel Leave?"
        message={
          <p className="text-gray-600">
            This will delete the leave record. The worker will be expected to check in immediately.
          </p>
        }
        confirmText="Cancel Leave"
        cancelText="Go Back"
        type="danger"
        action="delete"
        isLoading={cancelMutation.isPending}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={!!approveException}
        onClose={() => setApproveException(null)}
        onConfirm={() => approveException && approveMutation.mutate(approveException.id)}
        title="Approve Request?"
        message={
          <div className="space-y-3">
            <p className="text-gray-600">
              Approve leave request for{' '}
              <strong>{approveException?.user?.firstName} {approveException?.user?.lastName}</strong>?
            </p>
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              <p><span className="text-gray-500">Type:</span> {approveException && getTypeLabel(approveException.type)}</p>
              <p><span className="text-gray-500">Duration:</span> {approveException && getDurationText(approveException)}</p>
            </div>
          </div>
        }
        confirmText="Approve"
        cancelText="Cancel"
        type="success"
        action="approve"
        isLoading={approveMutation.isPending}
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={!!rejectException}
        onClose={() => setRejectException(null)}
        onConfirm={() => rejectException && rejectMutation.mutate(rejectException.id)}
        title="Reject Request?"
        message={
          <div className="space-y-3">
            <p className="text-gray-600">
              Reject leave request for{' '}
              <strong>{rejectException?.user?.firstName} {rejectException?.user?.lastName}</strong>?
            </p>
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              <p><span className="text-gray-500">Type:</span> {rejectException && getTypeLabel(rejectException.type)}</p>
              <p><span className="text-gray-500">Duration:</span> {rejectException && getDurationText(rejectException)}</p>
            </div>
          </div>
        }
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
        action="custom"
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
}
