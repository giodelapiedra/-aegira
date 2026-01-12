import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exceptionService } from '../../services/exception.service';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { formatDisplayDate } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  StopCircle,
  Trash2,
  X,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import type { Exception } from '../../types/user';

type FilterStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'all';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { company } = useAuthStore();
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [approveException, setApproveException] = useState<Exception | null>(null);
  const [rejectException, setRejectException] = useState<Exception | null>(null);
  const [endEarlyException, setEndEarlyException] = useState<Exception | null>(null);
  const [cancelException, setCancelException] = useState<Exception | null>(null);
  const limit = 10;

  const { data: exceptions, isLoading } = useQuery({
    queryKey: ['exceptions', filter, page],
    queryFn: () =>
      exceptionService.getAll({
        status: filter === 'all' ? undefined : filter,
        page,
        limit,
      }),
  });

  // Get counts for tabs
  const { data: allExceptions } = useQuery({
    queryKey: ['exceptions', 'counts'],
    queryFn: () => exceptionService.getAll({ page: 1, limit: 500 }),
  });

  const counts = {
    PENDING: allExceptions?.data?.filter((e) => e.status === 'PENDING').length || 0,
    APPROVED: allExceptions?.data?.filter((e) => e.status === 'APPROVED').length || 0,
    REJECTED: allExceptions?.data?.filter((e) => e.status === 'REJECTED').length || 0,
    all: allExceptions?.data?.length || 0,
  };

  const handleFilterChange = (value: FilterStatus) => {
    setFilter(value);
    setPage(1);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => exceptionService.approve(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setSelectedException(null);
      setApproveException(null);
      toast.success('Request approved successfully');
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
    mutationFn: (id: string) => exceptionService.endEarly(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      invalidateRelatedQueries(queryClient, 'leave-status');
      invalidateRelatedQueries(queryClient, 'approved-leave-today');
      setSelectedException(null);
      setEndEarlyException(null);
      toast.success('Exception ended early');
    },
    onError: (error: any) => {
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
      toast.success('Exception cancelled');
    },
    onError: (error: any) => {
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

  const filteredExceptions = exceptions?.data?.filter((e) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      e.user?.firstName?.toLowerCase().includes(search) ||
      e.user?.lastName?.toLowerCase().includes(search) ||
      e.reason?.toLowerCase().includes(search)
    );
  });

  const getDurationText = (exception: Exception) => {
    const start = formatDisplayDate(exception.startDate);
    if (!exception.endDate) return `${start} - Ongoing`;
    const end = formatDisplayDate(exception.endDate);
    if (start === end) return start;
    return `${start} - ${end}`;
  };

  const tabs = [
    { value: 'PENDING' as FilterStatus, label: 'Pending', count: counts.PENDING },
    { value: 'APPROVED' as FilterStatus, label: 'Approved', count: counts.APPROVED },
    { value: 'REJECTED' as FilterStatus, label: 'Rejected', count: counts.REJECTED },
    { value: 'all' as FilterStatus, label: 'All', count: counts.all },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
        <p className="text-gray-500 mt-1">Review and manage leave requests</p>
      </div>

      {/* Main Card */}
      <Card>
        {/* Tabs & Search */}
        <div className="border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleFilterChange(tab.value)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-all',
                    filter === tab.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                      filter === tab.value
                        ? tab.value === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        : 'bg-gray-200 text-gray-600'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredExceptions?.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? 'No results found' : 'No requests'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredExceptions?.map((exception) => (
              <div
                key={exception.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedException(exception)}
              >
                {/* Avatar */}
                <Avatar
                  src={exception.user?.avatar}
                  firstName={exception.user?.firstName}
                  lastName={exception.user?.lastName}
                  size="md"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {exception.user?.firstName} {exception.user?.lastName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {getTypeLabel(exception.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {getDurationText(exception)}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3">
                  {exception.status === 'PENDING' ? (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <Clock className="h-4 w-4" />
                      <span className="hidden sm:inline">Pending</span>
                    </span>
                  ) : exception.status === 'APPROVED' ? (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Approved</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Rejected</span>
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {exceptions?.pagination && exceptions.pagination.totalPages > 1 && (
          <div className="border-t border-gray-100 p-4">
            <Pagination
              currentPage={page}
              totalPages={exceptions.pagination.totalPages}
              totalItems={exceptions.pagination.total}
              pageSize={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedException(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar
                  src={selectedException.user?.avatar}
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
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-900">{getTypeLabel(selectedException.type)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className={cn(
                    'text-sm font-medium',
                    selectedException.status === 'PENDING' && 'text-amber-600',
                    selectedException.status === 'APPROVED' && 'text-emerald-600',
                    selectedException.status === 'REJECTED' && 'text-red-600'
                  )}>
                    {selectedException.status}
                  </p>
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
            <div className="p-4 border-t border-gray-100">
              {selectedException.status === 'PENDING' ? (
                <div className="flex gap-2">
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
                <div className="flex gap-2">
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
      <ConfirmModal
        isOpen={!!endEarlyException}
        onClose={() => setEndEarlyException(null)}
        onConfirm={() => endEarlyException && endEarlyMutation.mutate(endEarlyException.id)}
        title="End Exception Early?"
        message={
          <p className="text-gray-600">
            {endEarlyException && toDateStr(endEarlyException.startDate) === todayStr
              ? 'This will make it a single-day record. They will be expected to check in tomorrow.'
              : 'The record will end yesterday. They will be expected to check in today.'}
          </p>
        }
        confirmText="End Early"
        cancelText="Cancel"
        type="warning"
        action="custom"
        isLoading={endEarlyMutation.isPending}
      />

      {/* Cancel Modal */}
      <ConfirmModal
        isOpen={!!cancelException}
        onClose={() => setCancelException(null)}
        onConfirm={() => cancelException && cancelMutation.mutate(cancelException.id)}
        title="Cancel Exception?"
        message={
          <p className="text-gray-600">
            This will delete the exception. They will be expected to check in immediately.
          </p>
        }
        confirmText="Cancel Exception"
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
          <div className="space-y-2">
            <p className="text-gray-600">
              Are you sure you want to approve the leave request for{' '}
              <strong>{approveException?.user?.firstName} {approveException?.user?.lastName}</strong>?
            </p>
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
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
          <div className="space-y-2">
            <p className="text-gray-600">
              Are you sure you want to reject the leave request for{' '}
              <strong>{rejectException?.user?.firstName} {rejectException?.user?.lastName}</strong>?
            </p>
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
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
