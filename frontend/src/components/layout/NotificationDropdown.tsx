import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { notificationService, type Notification } from '../../services/notification.service';
import { cn } from '../../lib/utils';
import { formatRelativeTime } from '../../lib/date-utils';
import { useUser } from '../../hooks/useUser';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company } = useUser();

  // Get unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getAll({ limit: 20 }),
    enabled: isOpen, // Only fetch when dropdown is open
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
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to relevant page
    const link = notificationService.getNotificationLink(notification);
    if (link) {
      navigate(link);
      setIsOpen(false);
    }
  };

  // Get icon based on notification type
  const getIcon = (type: string) => {
    const notifType = notificationService.getNotificationType(type);
    switch (notifType) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success-500" />;
      case 'danger':
        return <AlertCircle className="h-5 w-5 text-danger-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning-500" />;
      default:
        return <Info className="h-5 w-5 text-primary-500" />;
    }
  };

  // Timezone from company settings - UTC fallback for edge cases
  const timezone = company?.timezone || 'UTC';
  const unreadCount = unreadData?.count || 0;
  const notifications = notificationsData?.data || [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          isOpen ? 'bg-gray-100' : 'hover:bg-gray-100'
        )}
        aria-label="Notifications"
      >
        <Bell className={cn('h-5 w-5', isOpen ? 'text-primary-600' : 'text-gray-600')} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-danger-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900">No notifications</p>
                <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'relative group',
                      !notification.isRead && 'bg-primary-50/50'
                    )}
                  >
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm',
                            notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(notification.createdAt, { timezone, short: true })}
                            </span>
                          </div>
                        </div>

                        {/* Unread indicator */}
                        {!notification.isRead && (
                          <div className="flex-shrink-0">
                            <div className="h-2 w-2 rounded-full bg-primary-500" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Action buttons (show on hover) */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                          }}
                          className="p-1.5 rounded-lg bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notification.id);
                        }}
                        className="p-1.5 rounded-lg bg-white shadow-sm border border-gray-200 hover:bg-danger-50 hover:border-danger-200 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-danger-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
              className="w-full text-center text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
