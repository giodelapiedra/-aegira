import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exceptionService } from '../../services/exception.service';
import type { CreateExceptionData } from '../../services/exception.service';
import { teamService } from '../../services/team.service';
import { incidentService } from '../../services/incident.service';
import { useUser } from '../../hooks/useUser';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { SkeletonForm } from '../../components/ui/Skeleton';
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  Calendar,
  XCircle,
  AlertCircle,
  HelpCircle,
  Users,
  UserX,
  Link2,
  AlertTriangle,
} from 'lucide-react';

type ExceptionType = 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'MEDICAL_APPOINTMENT' | 'FAMILY_EMERGENCY' | 'OTHER';

const exceptionTypes: { value: ExceptionType; label: string; description: string }[] = [
  { value: 'SICK_LEAVE', label: 'Sick Leave', description: 'I am unwell and unable to work' },
  { value: 'PERSONAL_LEAVE', label: 'Personal Leave', description: 'Personal matters requiring time off' },
  { value: 'MEDICAL_APPOINTMENT', label: 'Medical Appointment', description: 'Scheduled medical visit' },
  { value: 'FAMILY_EMERGENCY', label: 'Family Emergency', description: 'Urgent family situation' },
  { value: 'OTHER', label: 'Other', description: 'Other reason not listed above' },
];

export function RequestExceptionPage() {
  const queryClient = useQueryClient();
  const { user, company } = useUser();
  const toast = useToast();
  const timezone = company?.timezone || 'UTC';
  const [formData, setFormData] = useState<CreateExceptionData>({
    type: 'SICK_LEAVE',
    reason: '',
    startDate: '',
    endDate: '',
    linkedIncidentId: undefined,
  });

  const isMemberOrWorker = user?.role === 'MEMBER' || user?.role === 'WORKER';

  // Check if user has team and team leader (only required for MEMBER/WORKER role)
  // No auto-refetch - data only changes on page load
  const { data: myTeam, isLoading: isLoadingTeam, error: teamError } = useQuery({
    queryKey: ['team', 'my'],
    queryFn: () => teamService.getMyTeam(),
    retry: false,
    enabled: isMemberOrWorker,
    staleTime: Infinity, // Never stale - team data rarely changes
    refetchOnWindowFocus: false,
  });

  // My exceptions - refetch only after submit (via mutation invalidation)
  const { data: myExceptions } = useQuery({
    queryKey: ['exceptions', 'my'],
    queryFn: () => exceptionService.getMyExceptions(),
    staleTime: Infinity, // Never stale - only refetch after submit
    refetchOnWindowFocus: false,
  });

  // Get user's incidents for linking (optional feature)
  // No auto-refetch - incidents don't change frequently
  const { data: myIncidents } = useQuery({
    queryKey: ['incidents', 'my'],
    queryFn: () => incidentService.getMyIncidents(),
    staleTime: Infinity, // Never stale
    refetchOnWindowFocus: false,
  });

  // ALL HOOKS MUST BE CALLED BEFORE ANY RETURNS
  const createMutation = useMutation({
    mutationFn: (data: CreateExceptionData) => exceptionService.create(data),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'exceptions');
      setFormData({
        type: 'SICK_LEAVE',
        reason: '',
        startDate: '',
        endDate: '',
        linkedIncidentId: undefined,
      });
      toast.success('Request Submitted', 'Your exception request has been sent for approval.');
    },
    onError: () => {
      toast.error('Submission Failed', 'Failed to submit exception request.');
    },
  });

  const hasTeam = !!myTeam;
  const hasTeamLeader = !!myTeam?.leaderId;

  // Check for existing pending/active exemptions to prevent duplicates
  const hasPendingExemption = myExceptions?.some(e => e.status === 'PENDING');
  const hasActiveExemption = myExceptions?.some(e =>
    e.status === 'APPROVED' && e.endDate && new Date(e.endDate) >= new Date()
  );

  // Loading state (only for MEMBER)
  if (isMemberOrWorker && isLoadingTeam) {
    return (
      <div className="max-w-3xl mx-auto">
        <SkeletonForm />
      </div>
    );
  }

  // No team assigned (only for MEMBER)
  if (isMemberOrWorker && (teamError || !hasTeam)) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning-100 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-warning-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Team Assigned
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You need to be assigned to a team before you can submit exception requests.
                Please contact your supervisor or administrator to be added to a team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Team has no leader (only for MEMBER)
  if (isMemberOrWorker && !hasTeamLeader) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning-100 flex items-center justify-center mb-4">
                <UserX className="h-8 w-8 text-warning-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Team Leader Assigned
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Your team ({myTeam?.name}) does not have a team leader assigned yet.
                Exception requests need a team leader to receive and approve them.
                Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Block if user has pending exemption
  if (hasPendingExemption) {
    const pendingException = myExceptions?.find(e => e.status === 'PENDING');
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning-100 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-warning-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Pending Request Exists
              </h2>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                You already have a pending exception request waiting for approval.
                Please wait for your team leader to review it before submitting another request.
              </p>
              {pendingException && (
                <div className="inline-block p-4 rounded-lg bg-warning-50 border border-warning-200 text-left">
                  <p className="text-sm font-medium text-warning-800">
                    {exceptionTypes.find(t => t.value === pendingException.type)?.label || pendingException.type}
                  </p>
                  <p className="text-xs text-warning-600 mt-1">
                    {formatDisplayDate(pendingException.startDate, timezone)} - {formatDisplayDate(pendingException.endDate, timezone)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Block if user has active approved exemption
  if (hasActiveExemption) {
    const activeException = myExceptions?.find(e =>
      e.status === 'APPROVED' && e.endDate && new Date(e.endDate) >= new Date()
    );
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-success-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Already On Approved Leave
              </h2>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                You currently have an approved exception. You cannot submit a new request until your current leave period ends.
              </p>
              {activeException && (
                <div className="inline-block p-4 rounded-lg bg-success-50 border border-success-200 text-left">
                  <p className="text-sm font-medium text-success-800">
                    {exceptionTypes.find(t => t.value === activeException.type)?.label || activeException.type}
                  </p>
                  <p className="text-xs text-success-600 mt-1">
                    Until {formatDisplayDate(activeException.endDate, timezone)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          variant: 'warning' as const,
          label: 'Pending Review',
          icon: Clock,
          bgColor: 'bg-warning-50',
          borderColor: 'border-warning-200',
        };
      case 'APPROVED':
        return {
          variant: 'success' as const,
          label: 'Approved',
          icon: CheckCircle2,
          bgColor: 'bg-success-50',
          borderColor: 'border-success-200',
        };
      case 'REJECTED':
        return {
          variant: 'danger' as const,
          label: 'Rejected',
          icon: XCircle,
          bgColor: 'bg-danger-50',
          borderColor: 'border-danger-200',
        };
      default:
        return {
          variant: 'default' as const,
          label: 'Unknown',
          icon: HelpCircle,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
    }
  };

  const pendingCount = myExceptions?.filter(e => e.status === 'PENDING').length || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
          <FileText className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Exception</h1>
          <p className="text-gray-500">Submit a leave or exception request</p>
        </div>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-xl bg-warning-50 border border-warning-200 flex items-center gap-3">
          <Clock className="h-5 w-5 text-warning-600" />
          <p className="text-sm text-warning-700">
            You have <span className="font-semibold">{pendingCount}</span> pending request{pendingCount > 1 ? 's' : ''} awaiting approval.
          </p>
        </div>
      )}

      {/* Success Message */}
      {createMutation.isSuccess && (
        <div className="p-4 rounded-xl bg-success-50 border border-success-200 flex items-center gap-3 animate-slide-down">
          <CheckCircle2 className="h-5 w-5 text-success-600" />
          <p className="text-sm text-success-700 font-medium">
            Exception request submitted successfully. You'll be notified once it's reviewed.
          </p>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Exception Request</CardTitle>
          <CardDescription>
            Fill in the details below. Your request will be sent to your team lead for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Exception Type */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Exception Type
              </label>
              <div className="space-y-2">
                {exceptionTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      formData.type === type.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`font-medium ${
                      formData.type === type.value ? 'text-primary-700' : 'text-gray-700'
                    }`}>
                      {type.label}
                    </p>
                    <p className={`text-sm ${
                      formData.type === type.value ? 'text-primary-600' : 'text-gray-500'
                    }`}>
                      {type.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Link to Incident (Optional) */}
            {myIncidents && myIncidents.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Link to Incident Report (Optional)
                  </div>
                </label>
                <select
                  value={formData.linkedIncidentId || ''}
                  onChange={(e) => setFormData({ ...formData, linkedIncidentId: e.target.value || undefined })}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">No linked incident</option>
                  {myIncidents.map((incident) => (
                    <option key={incident.id} value={incident.id}>
                      {incident.caseNumber} - {incident.title} ({incident.severity})
                    </option>
                  ))}
                </select>
                {formData.linkedIncidentId && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Linking an incident report helps your team lead understand the context of your request.
                      The incident details will be visible in the approval review.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                leftIcon={<Calendar className="h-5 w-5" />}
                required
              />
              <Input
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                leftIcon={<Calendar className="h-5 w-5" />}
                required
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Reason / Additional Details
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
                placeholder="Please provide additional details about your request..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                required
              />
            </div>

            {/* Error */}
            {createMutation.isError && (
              <div className="p-4 rounded-lg bg-danger-50 border border-danger-200">
                <p className="text-sm text-danger-600">
                  Failed to submit request. Please try again.
                </p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={createMutation.isPending}
              leftIcon={<Send className="h-5 w-5" />}
            >
              Submit Request
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Requests */}
      {myExceptions && myExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <CardTitle>My Requests</CardTitle>
            </div>
            <CardDescription>Track the status of your exception requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myExceptions.map((exception) => {
                const config = getStatusConfig(exception.status);
                const StatusIcon = config.icon;
                return (
                  <div
                    key={exception.id}
                    className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-5 w-5 ${
                          exception.status === 'PENDING' ? 'text-warning-600' :
                          exception.status === 'APPROVED' ? 'text-success-600' :
                          exception.status === 'REJECTED' ? 'text-danger-600' : 'text-gray-600'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {exceptionTypes.find(t => t.value === exception.type)?.label || exception.type}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDisplayDate(exception.startDate, timezone)} - {formatDisplayDate(exception.endDate, timezone)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{exception.reason}</p>
                    <p className="text-xs text-gray-400">
                      Requested {formatDisplayDateTime(exception.createdAt, timezone)}
                    </p>
                    {exception.reviewedBy && (
                      <p className="text-xs text-gray-500 mt-2">
                        Reviewed by: {exception.reviewedBy.firstName} {exception.reviewedBy.lastName}
                        {exception.reviewNote && ` - "${exception.reviewNote}"`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">How it works</p>
              <p className="text-sm text-blue-700 mt-1">
                Your exception request will be sent to your team lead for approval. You'll receive a notification once your request has been reviewed. Approved exceptions will automatically update your readiness status for the specified dates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
