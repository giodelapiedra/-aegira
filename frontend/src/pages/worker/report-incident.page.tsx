import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentService } from '../../services/incident.service';
import type { CreateIncidentData } from '../../services/incident.service';
import { teamService } from '../../services/team.service';
import { useUser } from '../../hooks/useUser';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { SkeletonForm } from '../../components/ui/Skeleton';
import { formatDisplayDateTime } from '../../lib/date-utils';
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  XCircle,
  Users,
  UserX,
} from 'lucide-react';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type IncidentType = 'INJURY' | 'ILLNESS' | 'MENTAL_HEALTH' | 'MEDICAL_EMERGENCY' | 'HEALTH_SAFETY' | 'OTHER';

const severityOptions: { value: Severity; label: string; description: string; color: string }[] = [
  { value: 'LOW', label: 'Low', description: 'Minor issue, no immediate action needed', color: 'bg-gray-100 border-gray-300 text-gray-700' },
  { value: 'MEDIUM', label: 'Medium', description: 'Moderate concern, should be addressed soon', color: 'bg-status-yellow-50 border-status-yellow-300 text-status-yellow-700' },
  { value: 'HIGH', label: 'High', description: 'Serious issue requiring prompt attention', color: 'bg-orange-50 border-orange-300 text-orange-700' },
  { value: 'CRITICAL', label: 'Critical', description: 'Emergency - immediate action required', color: 'bg-status-red-50 border-status-red-300 text-status-red-700' },
];

const incidentTypes: { value: IncidentType; label: string; icon: typeof AlertTriangle }[] = [
  { value: 'INJURY', label: 'Physical Injury', icon: AlertCircle },
  { value: 'ILLNESS', label: 'Illness/Sickness', icon: XCircle },
  { value: 'MENTAL_HEALTH', label: 'Mental Health', icon: Info },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency', icon: AlertTriangle },
  { value: 'HEALTH_SAFETY', label: 'Health & Safety Concern', icon: AlertTriangle },
  { value: 'OTHER', label: 'Other', icon: FileText },
];

export function ReportIncidentPage() {
  const queryClient = useQueryClient();
  const { user, company } = useUser();
  const toast = useToast();
  const timezone = company?.timezone || 'UTC';
  const [formData, setFormData] = useState<Omit<CreateIncidentData, 'requestException'>>({
    type: 'OTHER',
    severity: 'MEDIUM',
    title: '',
    description: '',
    location: '',
  });
  const [showHistory, setShowHistory] = useState(false);

  const isMemberOrWorker = user?.role === 'MEMBER' || user?.role === 'WORKER';

  // Check if user has team and team leader (only required for MEMBER/WORKER role)
  // No auto-refetch - data only changes on page load
  const { data: myTeam, isLoading: isLoadingTeam, error: teamError } = useQuery({
    queryKey: ['team', 'my'],
    queryFn: () => teamService.getMyTeam(),
    retry: false,
    enabled: isMemberOrWorker,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // My incidents - refetch only after submit (via mutation invalidation)
  const { data: myIncidents } = useQuery({
    queryKey: ['incidents', 'my'],
    queryFn: () => incidentService.getMyIncidents(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // ALL HOOKS MUST BE CALLED BEFORE ANY RETURNS
  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateIncidentData, 'requestException'>) => incidentService.create(data),
    onSuccess: () => {
      // Invalidate all incident-related queries across the app
      invalidateRelatedQueries(queryClient, 'incidents');
      setFormData({
        type: 'OTHER',
        severity: 'MEDIUM',
        title: '',
        description: '',
        location: '',
      });
      toast.success('Incident Reported', 'Your incident report has been submitted.');
    },
    onError: () => {
      toast.error('Submission Failed', 'Failed to submit incident report.');
    },
  });

  const hasTeam = !!myTeam;
  const hasTeamLeader = !!myTeam?.leaderId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

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
                You need to be assigned to a team before you can report incidents.
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
                Incident reports need a team leader to receive them.
                Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return <Badge>Low</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium</Badge>;
      case 'HIGH':
        return <Badge variant="danger">High</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-status-red-600 text-white">Critical</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="warning">Open</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="primary">In Progress</Badge>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge>Closed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-danger-100 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-danger-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Incident</h1>
          <p className="text-gray-500">Submit a new incident or safety concern</p>
        </div>
      </div>

      {/* Success Message */}
      {createMutation.isSuccess && (
        <div className="p-4 rounded-xl bg-success-50 border border-success-200 animate-slide-down flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-600" />
          <p className="text-sm text-success-700 font-medium">
            Incident reported successfully. Your team leader will be notified and can approve leave if needed.
          </p>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
          <CardDescription>
            Please provide as much detail as possible about the incident
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Incident Type */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Incident Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {incidentTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value })}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.type === type.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${
                        formData.type === type.value ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                      <p className={`text-sm font-medium ${
                        formData.type === type.value ? 'text-primary-700' : 'text-gray-700'
                      }`}>
                        {type.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Severity */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Severity Level
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {severityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, severity: option.value })}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      formData.severity === option.value
                        ? `${option.color} border-current`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      formData.severity === option.value ? '' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {severityOptions.find(s => s.value === formData.severity)?.description}
              </p>
            </div>

            {/* Title */}
            <Input
              label="Incident Title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief summary of the incident"
              required
            />

            {/* Location */}
            <Input
              label="Location (Optional)"
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Where did this occur?"
            />

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Provide detailed information about what happened, when it occurred, and any relevant circumstances..."
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                required
              />
            </div>

            {/* Error */}
            {createMutation.isError && (
              <div className="p-4 rounded-lg bg-danger-50 border border-danger-200">
                <p className="text-sm text-danger-600">
                  Failed to submit incident report. Please try again.
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
              Submit Incident Report
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Incidents History */}
      {myIncidents && myIncidents.length > 0 && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <CardTitle>My Recent Reports</CardTitle>
                <Badge>{myIncidents.length}</Badge>
              </div>
              {showHistory ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="space-y-3">
                {myIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="font-medium text-gray-900">{incident.title}</h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getSeverityBadge(incident.severity)}
                        {getStatusBadge(incident.status)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                      {incident.description}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">
                        Reported {formatDisplayDateTime(incident.createdAt, timezone)}
                      </p>
                      {/* Approval Status Indicator */}
                      {incident.exception && (
                        <div className="flex items-center gap-2">
                          {incident.exception.status === 'APPROVED' && incident.exception.reviewedBy && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-success-50 border border-success-200 rounded-md">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success-600" />
                              <span className="text-xs font-medium text-success-700">
                                Approved by {incident.exception.reviewedBy.firstName} {incident.exception.reviewedBy.lastName}
                              </span>
                            </div>
                          )}
                          {incident.exception.status === 'REJECTED' && incident.exception.reviewedBy && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-danger-50 border border-danger-200 rounded-md">
                              <XCircle className="h-3.5 w-3.5 text-danger-600" />
                              <span className="text-xs font-medium text-danger-700">
                                Rejected by {incident.exception.reviewedBy.firstName} {incident.exception.reviewedBy.lastName}
                              </span>
                            </div>
                          )}
                          {incident.exception.status === 'PENDING' && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-warning-50 border border-warning-200 rounded-md">
                              <Clock className="h-3.5 w-3.5 text-warning-600" />
                              <span className="text-xs font-medium text-warning-700">
                                Pending approval
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
