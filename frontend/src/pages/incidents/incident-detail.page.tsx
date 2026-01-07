import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Paperclip,
  Send,
  Loader2,
  RefreshCw,
  XCircle,
  AlertCircle,
  Download,
  Brain,
  Printer,
  X,
  Edit3,
  ChevronDown,
  Calendar,
  Upload,
  FileCheck,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime, formatDisplayDate } from '../../lib/date-utils';
import { invalidateRelatedQueries } from '../../lib/query-utils';
import { incidentService } from '../../services/incident.service';
import { exceptionService } from '../../services/exception.service';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../components/ui/Toast';
import type { Incident, IncidentActivity } from '../../types/user';

// Status configuration
const statusConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: typeof AlertCircle;
  description: string;
}> = {
  OPEN: {
    label: 'Open',
    color: 'text-status-red-700',
    bg: 'bg-status-red-50 border-status-red-200',
    icon: AlertCircle,
    description: 'Awaiting review'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'text-status-yellow-700',
    bg: 'bg-status-yellow-50 border-status-yellow-200',
    icon: RefreshCw,
    description: 'Being investigated'
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'text-status-green-700',
    bg: 'bg-status-green-50 border-status-green-200',
    icon: CheckCircle2,
    description: 'Issue has been resolved'
  },
  CLOSED: {
    label: 'Closed',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    icon: XCircle,
    description: 'Case closed'
  },
};

const severityConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
}> = {
  LOW: { label: 'Low', color: 'text-slate-700', bg: 'bg-slate-100' },
  MEDIUM: { label: 'Medium', color: 'text-status-yellow-700', bg: 'bg-status-yellow-100' },
  HIGH: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  CRITICAL: { label: 'Critical', color: 'text-status-red-700', bg: 'bg-status-red-100' },
};

const typeConfig: Record<string, { label: string }> = {
  INJURY: { label: 'Physical Injury' },
  ILLNESS: { label: 'Illness' },
  MENTAL_HEALTH: { label: 'Mental Health' },
  EQUIPMENT: { label: 'Equipment Issue' },
  ENVIRONMENTAL: { label: 'Environmental' },
  OTHER: { label: 'Other' },
};

const activityConfig: Record<string, {
  icon: typeof FileText;
  color: string;
  bg: string;
}> = {
  CREATED: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  STATUS_CHANGED: { icon: ArrowRight, color: 'text-status-yellow-600', bg: 'bg-status-yellow-100' },
  ASSIGNED: { icon: User, color: 'text-purple-600', bg: 'bg-purple-100' },
  COMMENT: { icon: MessageSquare, color: 'text-gray-600', bg: 'bg-gray-100' },
  SEVERITY_CHANGED: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
  RESOLVED: { icon: CheckCircle2, color: 'text-status-green-600', bg: 'bg-status-green-100' },
};

function getActivityText(activity: IncidentActivity): { action: string; detail?: string } {
  const name = `${activity.user.firstName} ${activity.user.lastName}`;
  switch (activity.type) {
    case 'CREATED':
      return { action: `${name} reported this incident` };
    case 'STATUS_CHANGED':
      return {
        action: `${name} updated status`,
        detail: `${activity.oldValue?.replace('_', ' ')} → ${activity.newValue?.replace('_', ' ')}`
      };
    case 'ASSIGNED':
      return { action: `${name} assigned to ${activity.newValue}` };
    case 'COMMENT':
      return { action: name, detail: activity.comment };
    case 'SEVERITY_CHANGED':
      return {
        action: `${name} changed severity`,
        detail: `${activity.oldValue} → ${activity.newValue}`
      };
    case 'RESOLVED':
      return { action: `${name} resolved this incident` };
    default:
      return { action: name };
  }
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  // Exception management state
  const [isEditingException, setIsEditingException] = useState(false);
  const [exceptionEndDate, setExceptionEndDate] = useState('');
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // RTW Certificate state
  const [showRTWModal, setShowRTWModal] = useState(false);
  const [rtwFormData, setRtwFormData] = useState({
    certificateUrl: '',
    certDate: '',
    notes: '',
  });

  const canUpdateStatus = user?.role !== 'MEMBER' && user?.role !== 'WORKER';
  const canUploadRTW = ['EXECUTIVE', 'ADMIN', 'SUPERVISOR', 'TEAM_LEAD', 'WHS_CONTROL', 'CLINICIAN'].includes(user?.role || '');

  const { data: incident, isLoading, error } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentService.getById(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, note }: { status: Incident['status']; note?: string }) => {
      return incidentService.updateStatus(id!, status, note);
    },
    onSuccess: (_, variables) => {
      invalidateRelatedQueries(queryClient, 'incidents');
      const statusLabel = statusConfig[variables.status]?.label || variables.status;
      toast.success(`Status updated to ${statusLabel}`);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      return incidentService.addComment(id!, commentText);
    },
    onSuccess: () => {
      setComment('');
      invalidateRelatedQueries(queryClient, 'incidents');
    },
  });

  // Exception mutations
  const approveExceptionMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      return exceptionService.approve(exceptionId);
    },
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'incidents');
      invalidateRelatedQueries(queryClient, 'exceptions');
      toast.success('Leave request approved');
    },
    onError: () => {
      toast.error('Failed to approve leave request');
    },
  });

  const rejectExceptionMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      return exceptionService.reject(exceptionId);
    },
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'incidents');
      invalidateRelatedQueries(queryClient, 'exceptions');
      toast.success('Leave request rejected');
    },
    onError: () => {
      toast.error('Failed to reject leave request');
    },
  });

  const updateExceptionMutation = useMutation({
    mutationFn: async ({ exceptionId, endDate }: { exceptionId: string; endDate: string }) => {
      // Get current exception data to preserve other fields
      const exception = incident?.exception;
      if (!exception) throw new Error('No exception found');

      return exceptionService.update(exceptionId, {
        startDate: new Date(exception.startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: exception.reason,
        notes: exception.notes,
      });
    },
    onSuccess: () => {
      setIsEditingException(false);
      setExceptionEndDate('');
      invalidateRelatedQueries(queryClient, 'incidents');
      invalidateRelatedQueries(queryClient, 'exceptions');
      toast.success('Leave duration updated');
    },
    onError: () => {
      toast.error('Failed to update leave duration');
    },
  });

  // RTW Certificate mutations
  const uploadRTWMutation = useMutation({
    mutationFn: (data: { certificateUrl: string; certDate?: string; notes?: string }) =>
      incidentService.uploadRTWCertificate(id!, data),
    onSuccess: () => {
      setShowRTWModal(false);
      setRtwFormData({ certificateUrl: '', certDate: '', notes: '' });
      invalidateRelatedQueries(queryClient, 'incidents');
      toast.success('Return to Work certificate uploaded');
    },
    onError: () => {
      toast.error('Failed to upload RTW certificate');
    },
  });

  const removeRTWMutation = useMutation({
    mutationFn: () => incidentService.removeRTWCertificate(id!),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'incidents');
      toast.success('RTW certificate removed');
    },
    onError: () => {
      toast.error('Failed to remove RTW certificate');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading incident details...</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Incident Not Found</h2>
        <p className="text-gray-500 mb-6">This incident doesn't exist or you don't have access.</p>
        <Button variant="secondary" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Go Back
        </Button>
      </div>
    );
  }

  const status = statusConfig[incident.status];
  const severity = severityConfig[incident.severity];
  const type = typeConfig[incident.type] || typeConfig.OTHER;

  const InfoRow = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className={cn("flex justify-between items-center py-2 border-b border-gray-50 last:border-0", className)}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '-'}</span>
    </div>
  );

  // Handle print/PDF
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // Dynamic import for html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    const element = document.getElementById('print-content');
    if (!element) return;

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `Case-${incident.caseNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 print-container" id="print-content">
      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block print-header mb-6">
        <div className="flex justify-between items-center border-b-4 border-indigo-600 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">INCIDENT REPORT</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm font-semibold text-indigo-600">Case #{incident.caseNumber}</span>
              <span className="text-sm text-gray-500">|</span>
              <span className={cn("text-sm font-semibold", status.color)}>{status.label.toUpperCase()}</span>
              <span className="text-sm text-gray-500">|</span>
              <span className={cn("text-sm font-semibold", severity.color)}>{severity.label.toUpperCase()} SEVERITY</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">Aegira</p>
            <p className="text-xs text-gray-500">Safety Management System</p>
            <p className="text-xs text-gray-400 mt-1">Report Date: {formatDisplayDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>

      {/* Top Header - Hidden when printing */}
      <div className="flex items-start justify-between mb-8 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case Details</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4" />
              {incident.reporter?.firstName} {incident.reporter?.lastName}
            </span>
            <Badge
              variant={incident.severity === 'CRITICAL' ? 'danger' : incident.severity === 'HIGH' ? 'warning' : 'default'}
              className="uppercase text-xs"
            >
              {incident.severity}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          {canUpdateStatus && (
            <div className="relative status-dropdown">
              <button
                onClick={() => setIsStatusOpen(!isStatusOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                  status.bg,
                  status.color,
                  "hover:opacity-80 active:scale-95"
                )}
              >
                <status.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{status.label}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>

              {isStatusOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsStatusOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-xs font-semibold text-gray-400 px-2 py-1.5 mb-1 uppercase tracking-wider">
                      Update Status
                    </div>
                    {Object.entries(statusConfig).map(([key, config]) => {
                      const Icon = config.icon;
                      const isActive = incident.status === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (!isActive) {
                              updateStatusMutation.mutate({ status: key as Incident['status'] });
                              setIsStatusOpen(false);
                            }
                          }}
                          disabled={isActive || updateStatusMutation.isPending}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                            isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isActive ? "text-primary-600" : "text-gray-400")} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span>{config.label}</span>
                              {isActive && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="h-6 w-px bg-gray-200 mx-1" />

          <Button variant="secondary" size="sm" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownloadPDF}>
            PDF
          </Button>
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print-grid">
        {/* CASE INFORMATION */}
        <Card className="page-break-avoid">
          <CardHeader className="pb-2 border-b border-gray-100 mb-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-900">CASE INFORMATION</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1">
            <InfoRow label="Case Number:" value={incident.caseNumber} />
            <InfoRow 
              label="Status:" 
              value={<span className={cn("font-medium", status.color)}>{status.label.toUpperCase()}</span>} 
            />
            <InfoRow 
              label="Severity:" 
              value={<span className={cn("font-medium", severity.color)}>{severity.label.toUpperCase()}</span>} 
            />
            <InfoRow label="Incident Type:" value={type.label} />
            <InfoRow label="Created:" value={formatDisplayDate(incident.createdAt)} />
          </CardContent>
        </Card>

        {/* WORKER INFORMATION */}
        <Card className="page-break-avoid">
          <CardHeader className="pb-2 border-b border-gray-100 mb-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-900">WORKER INFORMATION</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1">
            <InfoRow 
              label="Name:" 
              value={`${incident.reporter?.firstName || ''} ${incident.reporter?.lastName || ''}`} 
            />
            <InfoRow label="Email:" value={incident.reporter?.email} />
            <InfoRow label="Team:" value={incident.reporter?.team?.name} />
            <InfoRow
              label="Team Leader:"
              value={incident.reporter?.team?.leader
                ? `${incident.reporter.team.leader.firstName} ${incident.reporter.team.leader.lastName}`
                : 'Not Assigned'}
            />
            <InfoRow label="Site Location:" value={incident.location} />
          </CardContent>
        </Card>

        {/* INCIDENT DETAILS */}
        <Card className="page-break-avoid">
          <CardHeader className="pb-2 border-b border-gray-100 mb-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-900">INCIDENT DETAILS</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1">
            <InfoRow
              label="Start Date:"
              value={formatDisplayDate(incident.exception?.startDate || incident.incidentDate || incident.createdAt)}
            />
            <InfoRow
              label="End Date:"
              value={formatDisplayDate(incident.exception?.endDate || incident.resolvedAt || incident.createdAt)}
            />
            <div className="pt-2 mt-2 border-t border-gray-50">
              <span className="text-sm text-gray-500 block mb-1">Reason/Description:</span>
              <p className="text-sm text-gray-900 line-clamp-3">{incident.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* SUPERVISOR INFORMATION */}
        <Card className="page-break-avoid">
          <CardHeader className="pb-2 border-b border-gray-100 mb-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-900">SUPERVISOR INFORMATION</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-1">
            <InfoRow 
              label="Supervisor:" 
              value={incident.assignee ? `${incident.assignee.firstName} ${incident.assignee.lastName}` : 'Unassigned'} 
            />
            <InfoRow 
              label="Last Updated:" 
              value={incident.updatedAt ? formatDisplayDate(incident.updatedAt) : formatDisplayDate(incident.createdAt)} 
            />
            <div className="flex justify-end pt-2">
              <Badge variant={incident.assignee ? 'success' : 'default'}>
                {incident.assignee ? 'ASSIGNED TO CLINICIAN' : 'UNASSIGNED'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Details & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          {incident.aiSummary && (
            <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white ai-summary-card page-break-avoid">
               <div className="flex items-center gap-3 mb-4">
                  <Brain className="h-6 w-6" />
                  <h3 className="font-semibold text-lg">AI Summary</h3>
               </div>
               <p className="text-white/90 leading-relaxed bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                 {incident.aiSummary}
               </p>
            </div>
          )}

          {/* Activity Timeline - Hidden in Print */}
          <Card className="no-print">
            <CardHeader className="border-b border-gray-100">
               <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>

            {/* Comment Input */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 comment-input-section">
               <div className="flex gap-3">
                 <Avatar
                   src={user?.avatar}
                   firstName={user?.firstName || ''}
                   lastName={user?.lastName || ''}
                   size="md"
                 />
                 <div className="flex-1 relative">
                   <input
                     type="text"
                     value={comment}
                     onChange={(e) => setComment(e.target.value)}
                     placeholder="Add a comment..."
                     className="w-full px-4 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey && comment.trim()) {
                         e.preventDefault();
                         addCommentMutation.mutate(comment.trim());
                       }
                     }}
                   />
                   <button
                     onClick={() => comment.trim() && addCommentMutation.mutate(comment.trim())}
                     disabled={!comment.trim() || addCommentMutation.isPending}
                     className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                   >
                     <Send className="h-4 w-4" />
                   </button>
                 </div>
               </div>
            </div>

            <CardContent className="max-h-[500px] overflow-y-auto">
              {incident.activities && incident.activities.length > 0 ? (
                <div className="relative space-y-6 pl-4">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100" />
                  {incident.activities.map((activity) => {
                    const config = activityConfig[activity.type] || activityConfig.COMMENT;
                    const Icon = config.icon;
                    const { action, detail } = getActivityText(activity);
                    
                    return (
                      <div key={activity.id} className="relative flex gap-4">
                        <div className={cn(
                          'relative z-10 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm',
                          config.bg
                        )}>
                          <Icon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm text-gray-900 font-medium">{action}</p>
                          {detail && <p className="text-sm text-gray-500 mt-0.5">{detail}</p>}
                          <p className="text-xs text-gray-400 mt-1">{formatDisplayDateTime(activity.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No activity yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           {/* Linked Exception */}
           {incident.exception && (
            <Card className="page-break-avoid">
              <CardHeader className="border-b border-gray-100">
                <CardTitle>Leave Request</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Status</span>
                    <Badge variant={incident.exception.status === 'APPROVED' ? 'success' : incident.exception.status === 'REJECTED' ? 'danger' : 'warning'}>
                      {incident.exception.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Type</span>
                    <span className="text-sm font-medium">{incident.exception.type.replace(/_/g, ' ')}</span>
                  </div>
                  
                  {/* Date Range Section */}
                  <div className={cn(
                    "rounded-xl transition-all duration-200",
                    isEditingException ? "bg-gray-50 p-4 border border-gray-100" : ""
                  )}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500 font-medium">Date Range</span>
                      {incident.exception.status !== 'REJECTED' && canUpdateStatus && !isEditingException && (
                        <button
                          onClick={() => {
                            setIsEditingException(true);
                            // Set initial end date to current end date
                            const endDate = new Date(incident.exception!.endDate);
                            setExceptionEndDate(endDate.toISOString().split('T')[0]);
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-primary-50 transition-colors no-print"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit Range
                        </button>
                      )}
                    </div>
                    
                    {isEditingException && incident.exception.status !== 'REJECTED' ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Start Date"
                            type="date"
                            value={new Date(incident.exception.startDate).toISOString().split('T')[0]}
                            disabled
                            className="bg-white"
                            leftIcon={<Calendar className="h-4 w-4" />}
                          />
                          <Input
                            label="End Date"
                            type="date"
                            value={exceptionEndDate}
                            min={new Date(incident.exception.startDate).toISOString().split('T')[0]}
                            onChange={(e) => setExceptionEndDate(e.target.value)}
                            leftIcon={<Calendar className="h-4 w-4" />}
                            className="bg-white"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsEditingException(false);
                              setExceptionEndDate('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              if (exceptionEndDate && incident.exception) {
                                updateExceptionMutation.mutate({
                                  exceptionId: incident.exception.id,
                                  endDate: exceptionEndDate,
                                });
                              }
                            }}
                            isLoading={updateExceptionMutation.isPending}
                            disabled={!exceptionEndDate}
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{formatDisplayDate(incident.exception.startDate)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span>{formatDisplayDate(incident.exception.endDate)}</span>
                      </div>
                    )}
                  </div>
                  
                  {incident.exception.status === 'PENDING' && canUpdateStatus && (
                    <div className="flex gap-2 pt-2 no-print">
                      <Button size="sm" variant="success" className="flex-1" onClick={() => approveExceptionMutation.mutate(incident.exception!.id)}>Approve</Button>
                      <Button size="sm" variant="danger" className="flex-1" onClick={() => rejectExceptionMutation.mutate(incident.exception!.id)}>Reject</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Return to Work Certificate */}
          {(incident.type === 'INJURY' || incident.type === 'ILLNESS' || incident.type === 'MENTAL_HEALTH') && (
            <Card className="page-break-avoid">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-status-green-600" />
                    Return to Work
                  </CardTitle>
                  {incident.rtwCertificateUrl && (
                    <Badge variant="success">Cleared</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {incident.rtwCertificateUrl ? (
                  <div className="space-y-3">
                    <div className="bg-status-green-50 border border-status-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 bg-status-green-100 rounded-lg flex items-center justify-center">
                          <FileCheck className="h-5 w-5 text-status-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-status-green-900">Certificate of Fitness</p>
                          <p className="text-sm text-status-green-700">Employee cleared for return</p>
                        </div>
                      </div>
                      {incident.rtwCertDate && (
                        <div className="flex items-center gap-2 text-sm text-status-green-700 mb-2">
                          <Calendar className="h-4 w-4" />
                          <span>Cert Date: {formatDisplayDate(incident.rtwCertDate)}</span>
                        </div>
                      )}
                      {incident.rtwNotes && (
                        <p className="text-sm text-status-green-700 bg-white/50 rounded p-2 mt-2">
                          {incident.rtwNotes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-status-green-200">
                        <a
                          href={incident.rtwCertificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-status-green-700 rounded-lg hover:bg-status-green-100 transition-colors text-sm font-medium"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Certificate
                        </a>
                        {canUploadRTW && (
                          <button
                            onClick={() => {
                              if (confirm('Remove this RTW certificate?')) {
                                removeRTWMutation.mutate();
                              }
                            }}
                            className="p-2 text-status-red-600 hover:bg-status-red-50 rounded-lg transition-colors no-print"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {incident.rtwUploader && (
                      <p className="text-xs text-gray-400 text-center">
                        Uploaded by {incident.rtwUploader.firstName} {incident.rtwUploader.lastName}
                        {incident.rtwUploadedAt && ` on ${formatDisplayDate(incident.rtwUploadedAt)}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileCheck className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mb-3">No RTW certificate uploaded</p>
                    {canUploadRTW && (
                      <div className="space-y-2 no-print">
                        <Link to={`/whs/pdf-templates?incidentId=${incident.id}`}>
                          <Button
                            size="sm"
                            variant="primary"
                            className="w-full"
                            leftIcon={<FileText className="h-4 w-4" />}
                          >
                            Fill PDF Form Template
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setShowRTWModal(true)}
                          leftIcon={<Upload className="h-4 w-4" />}
                          className="w-full"
                        >
                          Upload Existing Certificate
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attachments - Hidden in Print */}
          {incident.attachments && incident.attachments.length > 0 && (
             <Card className="no-print">
               <CardHeader className="border-b border-gray-100">
                 <CardTitle>Attachments ({incident.attachments.length})</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-2 gap-2">
                   {incident.attachments.map((url, i) => (
                     <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg bg-gray-50 border border-gray-100 overflow-hidden hover:border-primary-300 transition-colors relative group">
                        {/\.(jpg|jpeg|png|gif)$/i.test(url) ? (
                          <img src={url} alt="attachment" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Paperclip className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                           <Download className="h-5 w-5 text-white" />
                        </div>
                     </a>
                   ))}
                 </div>
               </CardContent>
             </Card>
          )}
        </div>
      </div>

      {/* Case Progress - Hidden in Print */}
      <Card className="no-print">
        <CardHeader className="border-b border-gray-100">
          <CardTitle>Case Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex justify-between">
            {/* Progress Bar Background */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full -z-0" />
            
            {/* Progress Bar Fill */}
            <div 
              className="absolute top-1/2 left-0 h-1 bg-primary-500 -translate-y-1/2 rounded-full -z-0 transition-all duration-500"
              style={{
                width: `${(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].indexOf(incident.status) / 3) * 100}%`
              }}
            />

            {Object.entries(statusConfig).map(([key, config]) => {
              const statusOrder = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
              const currentIndex = statusOrder.indexOf(incident.status);
              const stepIndex = statusOrder.indexOf(key);
              const isCompleted = stepIndex <= currentIndex;
              const isCurrent = key === incident.status;
              const Icon = config.icon;

              return (
                <div key={key} className="relative z-10 flex flex-col items-center bg-white px-2">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 mb-2",
                    isCompleted ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-gray-200 text-gray-400",
                    isCurrent && "ring-4 ring-primary-100"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    isCompleted ? "text-primary-700" : "text-gray-400"
                  )}>
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Print Footer - Only visible when printing */}
      <div className="hidden print:block mt-10 pt-6 border-t-2 border-gray-300">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-gray-700">CONFIDENTIAL</p>
            <p className="text-xs text-gray-500">This document contains sensitive employee information.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Aegira Safety Management System</p>
            <p className="text-xs text-gray-400">Case #{incident.caseNumber} • {formatDisplayDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>

      {/* RTW Certificate Upload Modal */}
      {showRTWModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-status-green-600" />
                Upload RTW Certificate
              </h3>
              <button
                onClick={() => setShowRTWModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!rtwFormData.certificateUrl) {
                  toast.error('Please enter the certificate URL');
                  return;
                }
                uploadRTWMutation.mutate(rtwFormData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificate URL <span className="text-status-red-500">*</span>
                </label>
                <Input
                  value={rtwFormData.certificateUrl}
                  onChange={(e) => setRtwFormData({ ...rtwFormData, certificateUrl: e.target.value })}
                  placeholder="https://storage.example.com/cert.pdf"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Upload the certificate to your storage and paste the URL here
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificate Date
                </label>
                <Input
                  type="date"
                  value={rtwFormData.certDate}
                  onChange={(e) => setRtwFormData({ ...rtwFormData, certDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={rtwFormData.notes}
                  onChange={(e) => setRtwFormData({ ...rtwFormData, notes: e.target.value })}
                  placeholder="Any additional notes about the clearance..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowRTWModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={uploadRTWMutation.isPending}
                  leftIcon={<Upload className="h-4 w-4" />}
                >
                  Upload
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
