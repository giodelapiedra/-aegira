import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { incidentService } from '../../services/incident.service';
import type { Incident, IncidentActivity } from '../../types/user';

interface IncidentDetailModalProps {
  incident: Incident;
  onClose: () => void;
  canUpdateStatus?: boolean;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-danger-100 text-danger-700 border-danger-200',
  IN_PROGRESS: 'bg-warning-100 text-warning-700 border-warning-200',
  RESOLVED: 'bg-success-100 text-success-700 border-success-200',
  CLOSED: 'bg-gray-100 text-gray-700 border-gray-200',
};

const severityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-warning-100 text-warning-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-danger-100 text-danger-700',
};

const typeLabels: Record<string, string> = {
  INJURY: 'Injury',
  ILLNESS: 'Illness',
  MENTAL_HEALTH: 'Mental Health',
  MEDICAL_EMERGENCY: 'Medical Emergency',
  HEALTH_SAFETY: 'Health & Safety',
  OTHER: 'Other',
};

const statusOrder = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const activityIcons: Record<string, typeof AlertTriangle> = {
  CREATED: FileText,
  STATUS_CHANGED: ArrowRight,
  ASSIGNED: User,
  COMMENT: MessageSquare,
  SEVERITY_CHANGED: AlertTriangle,
  RESOLVED: CheckCircle2,
};

const activityColors: Record<string, string> = {
  CREATED: 'bg-primary-100 text-primary-600',
  STATUS_CHANGED: 'bg-warning-100 text-warning-600',
  ASSIGNED: 'bg-purple-100 text-purple-600',
  COMMENT: 'bg-gray-100 text-gray-600',
  SEVERITY_CHANGED: 'bg-orange-100 text-orange-600',
  RESOLVED: 'bg-success-100 text-success-600',
};

function getActivityDescription(activity: IncidentActivity): string {
  const userName = `${activity.user.firstName} ${activity.user.lastName}`;
  switch (activity.type) {
    case 'CREATED':
      return `${userName} reported this incident`;
    case 'STATUS_CHANGED':
      return `${userName} changed status from ${activity.oldValue?.replace('_', ' ')} to ${activity.newValue?.replace('_', ' ')}`;
    case 'ASSIGNED':
      return `${userName} assigned this to ${activity.newValue}`;
    case 'COMMENT':
      return userName;
    case 'SEVERITY_CHANGED':
      return `${userName} changed severity from ${activity.oldValue} to ${activity.newValue}`;
    case 'RESOLVED':
      return `${userName} resolved this incident`;
    default:
      return userName;
  }
}

export function IncidentDetailModal({
  incident,
  onClose,
  canUpdateStatus = true,
}: IncidentDetailModalProps) {
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: Incident['status'] }) => {
      return incidentService.updateStatus(incident.id, status);
    },
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'incidents');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      return incidentService.addComment(incident.id, commentText);
    },
    onSuccess: () => {
      setComment('');
      invalidateRelatedQueries(queryClient, 'incidents');
    },
  });

  const handleAddComment = () => {
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const currentStatusIndex = statusOrder.indexOf(incident.status);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span className="font-mono font-medium text-primary-600">
                  {incident.caseNumber || 'N/A'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{incident.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Case Information */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CASE INFORMATION
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span
                  className={cn(
                    'ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    statusColors[incident.status]
                  )}
                >
                  {incident.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Severity:</span>
                <span
                  className={cn(
                    'ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    severityColors[incident.severity]
                  )}
                >
                  {incident.severity}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {typeLabels[incident.type] || incident.type}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Team:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {incident.team?.name || incident.reporter?.team?.name || '-'}
                </span>
              </div>
              {incident.assignee && (
                <div className="col-span-2">
                  <span className="text-gray-500">Assigned to:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {incident.assignee.firstName} {incident.assignee.lastName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Worker Information */}
          {incident.reporter && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-4 w-4" />
                WORKER INFORMATION
              </h3>
              <div className="flex items-start gap-4">
                <Avatar
                  src={incident.reporter.avatar}
                  firstName={incident.reporter.firstName}
                  lastName={incident.reporter.lastName}
                  size="lg"
                />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-gray-900">
                    {incident.reporter.firstName} {incident.reporter.lastName}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    {incident.reporter.email}
                  </div>
                  {incident.reporter.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Phone className="h-3.5 w-3.5" />
                      {incident.reporter.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    Team: {incident.reporter.team?.name || '-'} | Role:{' '}
                    {incident.reporter.role || 'Member'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Incident Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              INCIDENT DETAILS
            </h3>
            <div className="space-y-3 text-sm">
              {incident.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-500">Location:</span>
                    <span className="ml-2 text-gray-900">{incident.location}</span>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Incident Date:</span>
                  <span className="ml-2 text-gray-900">
                    {formatDisplayDateTime(incident.incidentDate || incident.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Reported:</span>
                  <span className="ml-2 text-gray-900">{formatDisplayDateTime(incident.createdAt)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 mb-1">Description:</p>
                <p className="text-gray-900 whitespace-pre-wrap">{incident.description}</p>
              </div>

              {/* AI Summary */}
              {incident.aiSummary && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <Sparkles className="h-4 w-4 text-primary-500" />
                    AI Summary:
                  </div>
                  <p className="text-gray-900 bg-primary-50 p-3 rounded-lg border border-primary-100">
                    {incident.aiSummary}
                  </p>
                </div>
              )}

              {/* Attachments */}
              {incident.attachments && incident.attachments.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1 text-gray-500 mb-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {incident.attachments.map((attachment, index) => {
                      const fileName = attachment.split('/').pop() || `File ${index + 1}`;
                      return (
                        <a
                          key={index}
                          href={attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {fileName}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Case Progress */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              CASE PROGRESS
            </h3>

            {/* Status Progress Bar */}
            <div className="flex items-center justify-between px-2">
              {statusOrder.map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                return (
                  <div key={status} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                          isCompleted
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-500',
                          isCurrent && 'ring-4 ring-primary-100'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs mt-1',
                          isCurrent ? 'font-medium text-primary-600' : 'text-gray-500'
                        )}
                      >
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    {index < statusOrder.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 w-12 mx-2',
                          index < currentStatusIndex ? 'bg-primary-500' : 'bg-gray-200'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Activity Timeline */}
            {incident.activities && incident.activities.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Timeline:</p>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {incident.activities.map((activity) => {
                    const Icon = activityIcons[activity.type] || MessageSquare;
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div
                          className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                            activityColors[activity.type] || 'bg-gray-100 text-gray-600'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {getActivityDescription(activity)}
                          </p>
                          {activity.type === 'COMMENT' && activity.comment && (
                            <p className="text-sm text-gray-600 mt-1 bg-white p-2 rounded-lg border border-gray-100">
                              "{activity.comment}"
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDisplayDateTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Comment */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!comment.trim() || addCommentMutation.isPending}
                  isLoading={addCommentMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Status Update Buttons */}
          {canUpdateStatus && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Update Status:</h3>
              <div className="grid grid-cols-4 gap-2">
                {statusOrder.map((status) => (
                  <button
                    key={status}
                    onClick={() =>
                      updateStatusMutation.mutate({ status: status as Incident['status'] })
                    }
                    disabled={updateStatusMutation.isPending || incident.status === status}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-colors',
                      incident.status === status
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50 text-gray-700',
                      updateStatusMutation.isPending && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
