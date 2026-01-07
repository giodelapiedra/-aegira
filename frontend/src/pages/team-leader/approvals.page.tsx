import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exceptionService } from '../../services/exception.service';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { formatDisplayDate } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { useAuthStore } from '../../store/auth.store';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Filter,
  Search,
  StopCircle,
  Trash2,
} from 'lucide-react';
import type { Exception } from '../../types/user';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { company } = useAuthStore();
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');
  const [page, setPage] = useState(1);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
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

  // Reset page when filter changes
  const handleFilterChange = (value: 'PENDING' | 'APPROVED' | 'REJECTED' | 'all') => {
    setFilter(value);
    setPage(1);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => exceptionService.approve(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setSelectedException(null);
      toast.success('Exception approved successfully');
    },
    onError: () => {
      toast.error('Failed to approve exception');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => exceptionService.reject(id),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setSelectedException(null);
      toast.success('Exception rejected');
    },
    onError: () => {
      toast.error('Failed to reject exception');
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
      toast.success('Exception ended early successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to end exception early';
      toast.error(message);
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
      toast.success('Exception cancelled successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to cancel exception';
      toast.error(message);
      setCancelException(null);
    },
  });

  // Helper to get date string in YYYY-MM-DD format (uses company timezone)
  const toDateStr = (date: Date | string) => {
    const d = new Date(date);
    const timezone = company?.timezone || 'UTC';
    // Format date in company timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d); // Returns YYYY-MM-DD format
  };

  const todayStr = toDateStr(new Date());

  // Check if exception can be ended early (must have started and not ended)
  const canEndEarly = (exception: Exception) => {
    const startStr = toDateStr(exception.startDate);
    const endStr = toDateStr(exception.endDate);

    // Must have started (startDate <= today, includes today's leaves)
    // and have multiple days remaining (endDate > today) so we can shorten it
    // If it started today and ends later, we can make it a single-day record
    return startStr <= todayStr && endStr > todayStr;
  };

  // Check if exception is still active (can be cancelled)
  const isActive = (exception: Exception) => {
    const endStr = toDateStr(exception.endDate);
    return endStr >= todayStr;
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'primary' | 'warning' | 'danger'> = {
      MEDICAL: 'danger',
      PERSONAL: 'primary',
      TRAINING: 'warning',
      OTHER: 'default',
    };
    return <Badge variant={variants[type] || 'default'}>{type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const pendingCount = exceptions?.data?.filter((e) => e.status === 'PENDING').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exception Approvals</h1>
          <p className="text-gray-500 mt-1">
            Review and approve exception requests from team members
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning-50 rounded-lg">
            <Clock className="h-5 w-5 text-warning-600" />
            <span className="text-sm font-medium text-warning-700">
              {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search requests..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value as any)}
            className="rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Exception List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : exceptions?.data?.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No exceptions found</h3>
            <p className="text-gray-500 mt-1">
              {filter === 'PENDING'
                ? 'No pending requests at the moment'
                : 'No exception requests match your filter'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {exceptions?.data?.map((exception) => (
            <Card
              key={exception.id}
              hover
              className="cursor-pointer"
              onClick={() => setSelectedException(exception)}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <Avatar
                  firstName={exception.user?.firstName}
                  lastName={exception.user?.lastName}
                  size="lg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {exception.user?.firstName} {exception.user?.lastName}
                    </h3>
                    {getTypeBadge(exception.type)}
                    {getStatusBadge(exception.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{exception.reason}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDisplayDate(exception.startDate)} - {formatDisplayDate(exception.endDate)}
                    </span>
                  </div>
                </div>

                {exception.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMutation.mutate(exception.id);
                      }}
                      isLoading={approveMutation.isPending}
                      leftIcon={<CheckCircle className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectMutation.mutate(exception.id);
                      }}
                      isLoading={rejectMutation.isPending}
                      leftIcon={<XCircle className="h-4 w-4" />}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {exception.status === 'APPROVED' && isActive(exception) && (
                  <div className="flex items-center gap-2">
                    {canEndEarly(exception) && (
                      <Button
                        size="sm"
                        variant="warning"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEndEarlyException(exception);
                        }}
                        isLoading={endEarlyMutation.isPending && endEarlyException?.id === exception.id}
                        leftIcon={<StopCircle className="h-4 w-4" />}
                      >
                        End Early
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCancelException(exception);
                      }}
                      isLoading={cancelMutation.isPending && cancelException?.id === exception.id}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {exceptions?.pagination && (
            <Pagination
              currentPage={page}
              totalPages={exceptions.pagination.totalPages}
              totalItems={exceptions.pagination.total}
              pageSize={limit}
              onPageChange={setPage}
              className="mt-4"
            />
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedException && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedException(null)}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-xl shadow-xl z-50 animate-slide-up">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={selectedException.user?.firstName}
                    lastName={selectedException.user?.lastName}
                    size="lg"
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedException.user?.firstName} {selectedException.user?.lastName}
                    </h2>
                    <p className="text-sm text-gray-500">{selectedException.user?.email}</p>
                  </div>
                </div>
                {getStatusBadge(selectedException.status)}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <div className="mt-1">{getTypeBadge(selectedException.type)}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <p className="mt-1 text-gray-900">
                    {formatDisplayDate(selectedException.startDate)} - {formatDisplayDate(selectedException.endDate)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Reason</label>
                  <p className="mt-1 text-gray-900">{selectedException.reason}</p>
                </div>

                {selectedException.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="mt-1 text-gray-900">{selectedException.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                {selectedException.status === 'PENDING' ? (
                  <>
                    <Button
                      variant="success"
                      className="flex-1"
                      onClick={() => approveMutation.mutate(selectedException.id)}
                      isLoading={approveMutation.isPending}
                      leftIcon={<CheckCircle className="h-5 w-5" />}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => rejectMutation.mutate(selectedException.id)}
                      isLoading={rejectMutation.isPending}
                      leftIcon={<XCircle className="h-5 w-5" />}
                    >
                      Reject
                    </Button>
                  </>
                ) : selectedException.status === 'APPROVED' && isActive(selectedException) ? (
                  <div className="flex gap-2 w-full">
                    {canEndEarly(selectedException) && (
                      <Button
                        variant="warning"
                        className="flex-1"
                        onClick={() => setEndEarlyException(selectedException)}
                        isLoading={endEarlyMutation.isPending && endEarlyException?.id === selectedException.id}
                        leftIcon={<StopCircle className="h-5 w-5" />}
                      >
                        End Early
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => setCancelException(selectedException)}
                      isLoading={cancelMutation.isPending && cancelException?.id === selectedException.id}
                      leftIcon={<Trash2 className="h-5 w-5" />}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setSelectedException(null)}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* End Early Confirmation Modal */}
      <ConfirmModal
        isOpen={!!endEarlyException}
        onClose={() => setEndEarlyException(null)}
        onConfirm={() => {
          if (endEarlyException) {
            endEarlyMutation.mutate(endEarlyException.id);
          }
        }}
        title="End Exception Early?"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to end{' '}
              <strong>{endEarlyException?.user?.firstName} {endEarlyException?.user?.lastName}</strong>'s{' '}
              {endEarlyException?.type.toLowerCase().replace(/_/g, ' ')} early?
            </p>
            <p className="text-gray-500">
              {(() => {
                if (!endEarlyException) return '';
                const startStr = toDateStr(endEarlyException.startDate);
                const startedToday = startStr === todayStr;
                return startedToday
                  ? 'The leave will become a single-day record for today. They will be expected to check in tomorrow.'
                  : 'The leave record will be updated to end yesterday. They will be expected to check in today.';
              })()}
            </p>
          </div>
        }
        confirmText="End Early"
        cancelText="Go Back"
        type="warning"
        action="custom"
        isLoading={endEarlyMutation.isPending}
      />

      {/* Cancel Exception Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancelException}
        onClose={() => setCancelException(null)}
        onConfirm={() => {
          if (cancelException) {
            cancelMutation.mutate(cancelException.id);
          }
        }}
        title="Cancel Exception?"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to cancel{' '}
              <strong>{cancelException?.user?.firstName} {cancelException?.user?.lastName}</strong>'s{' '}
              {cancelException?.type.toLowerCase().replace(/_/g, ' ')}?
            </p>
            <p className="text-gray-500">
              This will delete the exception entirely. They will be expected to check in immediately.
            </p>
          </div>
        }
        confirmText="Cancel Exception"
        cancelText="Go Back"
        type="danger"
        action="delete"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
