import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Inbox,
  Archive,
  ArchiveRestore,
  Circle,
} from 'lucide-react';
import { notificationService, type Notification, type NotificationFilter } from '../../services/notification.service';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { SkeletonList } from '../../components/ui/Skeleton';
import { cn } from '../../lib/utils';
import { formatRelativeTime, formatDisplayDateTime } from '../../lib/date-utils';
import { useUser } from '../../hooks/useUser';

const FILTER_TABS: { value: NotificationFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Bell className="h-4 w-4" /> },
  { value: 'unread', label: 'Unread', icon: <Circle className="h-4 w-4" /> },
  { value: 'read', label: 'Read', icon: <CheckCircle2 className="h-4 w-4" /> },
  { value: 'archived', label: 'Archived', icon: <Archive className="h-4 w-4" /> },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { company } = useUser();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [page, setPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const limit = 15;

  // Get notifications
  // Note: page is not in queryKey since we do client-side pagination
  // The query only needs to refetch when filter changes
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'all', filter],
    queryFn: () => notificationService.getAll({ limit: 100, filter }),
  });

  // Get unread count for badge
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationService.getUnreadCount(),
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All Read', 'All notifications have been marked as read.');
    },
  });

  // Archive notification mutation
  const archiveMutation = useMutation({
    mutationFn: (id: string) => notificationService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Archived', 'Notification has been archived.');
    },
    onError: () => {
      toast.error('Error', 'Failed to archive notification.');
    },
  });

  // Unarchive notification mutation
  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => notificationService.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Restored', 'Notification has been restored.');
    },
    onError: () => {
      toast.error('Error', 'Failed to restore notification.');
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setShowDeleteConfirm(false);
      setSelectedNotification(null);
      toast.success('Deleted', 'Notification has been deleted.');
    },
    onError: () => {
      toast.error('Error', 'Failed to delete notification.');
    },
  });

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    const link = notificationService.getNotificationLink(notification);
    if (link) {
      navigate(link);
    }
  };

  // Get icon based on notification type
  const getIcon = (type: string) => {
    const notifType = notificationService.getNotificationType(type);
    switch (notifType) {
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-success-500" />;
      case 'danger':
        return <AlertCircle className="h-6 w-6 text-danger-500" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-warning-500" />;
      default:
        return <Info className="h-6 w-6 text-primary-500" />;
    }
  };

  // Timezone from company settings (fallback to UTC if not set)
  const timezone = company?.timezone || 'UTC';

  const allNotifications = notificationsData?.data || [];
  const unreadCount = unreadData?.count || 0;

  // Client-side pagination
  const totalPages = Math.ceil(allNotifications.length / limit);
  const paginatedNotifications = allNotifications.slice((page - 1) * limit, page * limit);

  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  // Get empty state message based on filter
  const getEmptyStateMessage = () => {
    switch (filter) {
      case 'unread':
        return {
          title: 'All Caught Up!',
          message: "No new notifications at the moment. Time to focus on your tasks!",
        };
      case 'read':
        return {
          title: 'No Read Notifications',
          message: "You haven't read any notifications yet.",
        };
      case 'archived':
        return {
          title: 'No Archived Notifications',
          message: "You haven't archived any notifications yet.",
        };
      default:
        return {
          title: 'All Caught Up!',
          message: "No notifications at the moment. Time to focus on your tasks!",
        };
    }
  };

  const emptyState = getEmptyStateMessage();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-600">Notifications</h1>
          <p className="text-gray-500 mt-1">Stay updated with the latest activities in your company.</p>
        </div>
        {unreadCount > 0 && filter !== 'archived' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            isLoading={markAllAsReadMutation.isPending}
            leftIcon={<CheckCheck className="h-4 w-4" />}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filter === tab.value
                ? 'bg-primary-50 text-primary-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.value === 'unread' && unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-danger-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <SkeletonList items={5} />
      ) : paginatedNotifications.length === 0 ? (
        /* Empty State - Yellow Card like reference image */
        <div className="flex justify-center py-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{emptyState.title}</h3>
            <p className="text-gray-600">{emptyState.message}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedNotifications.map((notification) => (
            <Card
              key={notification.id}
              hover
              className={cn(
                'cursor-pointer transition-all',
                !notification.isRead && !notification.isArchived && 'border-l-4 border-l-primary-500 bg-primary-50/30'
              )}
            >
              <CardContent className="py-4">
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={cn(
                      'h-12 w-12 rounded-xl flex items-center justify-center',
                      notification.isRead || notification.isArchived ? 'bg-gray-100' : 'bg-white shadow-sm'
                    )}>
                      {getIcon(notification.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={cn(
                          'text-base',
                          notification.isRead || notification.isArchived ? 'text-gray-700' : 'text-gray-900 font-semibold'
                        )}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500" title={formatDisplayDateTime(notification.createdAt, timezone)}>
                            {formatRelativeTime(notification.createdAt, { timezone })}
                          </span>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {!notification.isRead && !notification.isArchived && (
                        <div className="flex-shrink-0">
                          <div className="h-3 w-3 rounded-full bg-primary-500" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {/* Mark as read - only for unread, non-archived */}
                    {!notification.isRead && !notification.isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsReadMutation.mutate(notification.id);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-primary-600"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {/* Archived tab: Restore + Delete */}
                    {notification.isArchived ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchiveMutation.mutate(notification.id);
                          }}
                          className="p-2 rounded-lg hover:bg-primary-50 transition-colors text-gray-400 hover:text-primary-600"
                          title="Restore"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNotification(notification);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 rounded-lg hover:bg-danger-50 transition-colors text-gray-400 hover:text-danger-600"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      /* Non-archived: Archive only */
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveMutation.mutate(notification.id);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={allNotifications.length}
              pageSize={limit}
              onPageChange={setPage}
              className="mt-6"
            />
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm && !!selectedNotification}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedNotification(null);
        }}
        onConfirm={() => selectedNotification && deleteMutation.mutate(selectedNotification.id)}
        title="Delete Notification?"
        message={
          <>
            Are you sure you want to delete this notification?
            {selectedNotification && (
              <span className="block mt-2 text-sm text-gray-500 font-normal">
                "{selectedNotification.title}"
              </span>
            )}
          </>
        }
        confirmText="Delete"
        type="danger"
        action="delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
