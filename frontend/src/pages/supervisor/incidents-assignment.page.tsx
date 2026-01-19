import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  UserPlus,
  ChevronRight,
  X,
  Filter,
  Shield,
  Users,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import { supervisorService } from '../../services/supervisor.service';
import { Pagination } from '../../components/ui/Pagination';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { useToast } from '../../components/ui/Toast';
import { StatCard } from '../../components/ui/StatCard';
import type { Incident, WHSOfficer } from '../../types/user';

type TabType = 'pending' | 'assigned';
type SeverityFilter = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================
// CONSTANTS
// ============================================
const severityConfig: Record<string, { color: string; bg: string; dotColor: string; label: string; priority: number }> = {
  CRITICAL: { color: 'text-red-700', bg: 'bg-red-50', dotColor: 'bg-red-500', label: 'Critical', priority: 4 },
  HIGH: { color: 'text-orange-700', bg: 'bg-orange-50', dotColor: 'bg-orange-500', label: 'High', priority: 3 },
  MEDIUM: { color: 'text-blue-700', bg: 'bg-blue-50', dotColor: 'bg-blue-500', label: 'Medium', priority: 2 },
  LOW: { color: 'text-gray-600', bg: 'bg-gray-50', dotColor: 'bg-gray-400', label: 'Low', priority: 1 },
};

const incidentTypeLabels: Record<string, string> = {
  INJURY: 'Injury',
  ILLNESS: 'Illness',
  MENTAL_HEALTH: 'Mental Health',
  MEDICAL_EMERGENCY: 'Medical Emergency',
  HEALTH_SAFETY: 'Health & Safety',
  OTHER: 'Other',
};


// ============================================
// INCIDENT CARD COMPONENT (Mobile)
// ============================================
function IncidentCard({
  incident,
  activeTab,
  onAssign,
  onView,
}: {
  incident: Incident;
  activeTab: TabType;
  onAssign: () => void;
  onView: () => void;
}) {
  const severity = severityConfig[incident.severity];
  const isUrgent = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';

  return (
    <div
      className={cn(
        'p-4 border rounded-xl transition-colors',
        isUrgent ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
      )}
      onClick={onView}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {isUrgent && (
            <span className="flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
          <span className="font-semibold text-gray-900 truncate">{incident.caseNumber}</span>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
          severity?.bg,
          severity?.color
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', severity?.dotColor)} />
          {severity?.label}
        </span>
      </div>

      {/* Title */}
      {incident.title && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{incident.title}</p>
      )}

      {/* Worker Info */}
      <div className="flex items-center gap-3 mb-3 p-2 bg-gray-50 rounded-lg">
        <Avatar
          src={incident.reporter?.avatar}
          firstName={incident.reporter?.firstName}
          lastName={incident.reporter?.lastName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {incident.reporter?.firstName} {incident.reporter?.lastName}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{incident.reporter?.team?.name || 'No Team'}</span>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {incidentTypeLabels[incident.type] || incident.type}
        </span>
      </div>

      {/* Assignment Info / Action */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {activeTab === 'pending' ? (
          <>
            <div className="text-xs text-gray-500">
              <span className="text-gray-400">TL:</span>{' '}
              {incident.exception?.reviewedBy?.firstName} {incident.exception?.reviewedBy?.lastName}
            </div>
            <Button
              size="sm"
              variant={isUrgent ? 'danger' : 'primary'}
              onClick={(e) => {
                e.stopPropagation();
                onAssign();
              }}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Assign
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Avatar
                src={incident.whsOfficer?.avatar}
                firstName={incident.whsOfficer?.firstName}
                lastName={incident.whsOfficer?.lastName}
                size="xs"
              />
              <div className="text-xs">
                <span className="text-gray-900">
                  {incident.whsOfficer?.firstName} {incident.whsOfficer?.lastName}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// ASSIGN MODAL COMPONENT
// ============================================
function AssignModal({
  incident,
  whsOfficers,
  onClose,
  onConfirm,
  isLoading,
}: {
  incident: Incident;
  whsOfficers: WHSOfficer[];
  onClose: () => void;
  onConfirm: (whsOfficerId: string, note?: string) => void;
  isLoading: boolean;
}) {
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [note, setNote] = useState('');
  const severity = severityConfig[incident.severity];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Assign to WHS Officer</h3>
              <p className="text-xs sm:text-sm text-gray-500">Select an officer to handle this case</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Incident Summary */}
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className={cn('rounded-xl p-3 sm:p-4 border', severity?.bg, 'border-gray-200')}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500">{incident.caseNumber}</span>
                  <Badge variant={incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'danger' : 'default'} size="sm">
                    {severity?.label}
                  </Badge>
                </div>
                <h4 className="font-medium text-gray-900 truncate">{incident.title || 'Untitled Incident'}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar
                    firstName={incident.reporter?.firstName}
                    lastName={incident.reporter?.lastName}
                    size="xs"
                  />
                  <span className="text-sm text-gray-600">
                    {incident.reporter?.firstName} {incident.reporter?.lastName}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">
                    {incident.reporter?.team?.name || 'No Team'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WHS Officer <span className="text-red-500">*</span>
            </label>
            {whsOfficers.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                No WHS officers available. Please contact admin.
              </div>
            ) : (
              <div className="space-y-2">
                {whsOfficers.map((officer) => (
                  <label
                    key={officer.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      selectedOfficer === officer.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="officer"
                      value={officer.id}
                      checked={selectedOfficer === officer.id}
                      onChange={(e) => setSelectedOfficer(e.target.value)}
                      className="sr-only"
                    />
                    <Avatar
                      src={officer.avatar}
                      firstName={officer.firstName}
                      lastName={officer.lastName}
                      size="sm"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {officer.firstName} {officer.lastName}
                      </p>
                      <p className="text-xs text-gray-500">WHS Officer</p>
                    </div>
                    {selectedOfficer === officer.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary-600" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructions (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context or priority instructions..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{note.length}/500</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 sm:p-6 pt-0 pb-safe">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedOfficer, note || undefined)}
            disabled={!selectedOfficer || isLoading}
            isLoading={isLoading}
            className="flex-1"
          >
            Assign Case
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export function IncidentsAssignmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('');
  const [assigningIncident, setAssigningIncident] = useState<Incident | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch stats (separate endpoint for accurate counts)
  const { data: stats } = useQuery({
    queryKey: ['supervisor-incidents-stats'],
    queryFn: () => supervisorService.getIncidentStats(),
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch pending incidents with server-side filtering
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['supervisor-incidents', 'pending', page, limit, debouncedSearch, severityFilter],
    queryFn: () => supervisorService.getPendingIncidents({
      page,
      limit,
      search: debouncedSearch || undefined,
      severity: severityFilter || undefined,
    }),
    enabled: activeTab === 'pending',
  });

  // Fetch assigned incidents with server-side filtering
  const { data: assignedData, isLoading: assignedLoading } = useQuery({
    queryKey: ['supervisor-incidents', 'assigned', page, limit, debouncedSearch, severityFilter],
    queryFn: () => supervisorService.getAssignedIncidents({
      page,
      limit,
      search: debouncedSearch || undefined,
      severity: severityFilter || undefined,
    }),
    enabled: activeTab === 'assigned',
  });

  // Fetch WHS officers
  const { data: whsOfficers = [] } = useQuery({
    queryKey: ['whs-officers'],
    queryFn: () => supervisorService.getWHSOfficers(),
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: ({ incidentId, whsOfficerId, note }: { incidentId: string; whsOfficerId: string; note?: string }) =>
      supervisorService.assignToWHS(incidentId, whsOfficerId, note),
    onSuccess: () => {
      toast.success('Incident Assigned', 'Incident assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['supervisor-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-incidents-stats'] });
      setAssigningIncident(null);
    },
    onError: () => {
      toast.error('Assignment Failed', 'Failed to assign incident');
    },
  });

  const currentData = activeTab === 'pending' ? pendingData : assignedData;
  const isLoading = activeTab === 'pending' ? pendingLoading : assignedLoading;
  const incidents = currentData?.data || [];
  const pagination = currentData?.pagination;

  const handleAssign = (whsOfficerId: string, note?: string) => {
    if (assigningIncident) {
      assignMutation.mutate({
        incidentId: assigningIncident.id,
        whsOfficerId,
        note,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Incident Assignment</h1>
        <p className="text-gray-500 mt-1">Review and assign TL-approved incidents to WHS officers</p>
      </div>

      {/* Stats Overview - Using Centralized StatCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          value={stats?.pending ?? 0}
          label="Pending Assignment"
          color={(stats?.pending ?? 0) > 0 ? 'warning' : 'gray'}
        />
        <StatCard
          icon={AlertTriangle}
          value={stats?.urgent ?? 0}
          label="Urgent (High/Critical)"
          color={(stats?.urgent ?? 0) > 0 ? 'danger' : 'gray'}
        />
        <StatCard
          icon={CheckCircle2}
          value={stats?.assigned ?? 0}
          label="Assigned"
          color="success"
        />
        <StatCard
          icon={Users}
          value={whsOfficers.length}
          label="WHS Officers"
          color="gray"
        />
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center">
            <button
              onClick={() => { setActiveTab('pending'); setPage(1); setSeverityFilter(''); }}
              className={cn(
                'relative px-6 py-4 text-sm font-medium transition-colors',
                activeTab === 'pending'
                  ? 'text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Pending</span>
                {(stats?.pending ?? 0) > 0 && (
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    activeTab === 'pending' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {stats?.pending ?? 0}
                  </span>
                )}
              </div>
              {activeTab === 'pending' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('assigned'); setPage(1); setSeverityFilter(''); }}
              className={cn(
                'relative px-6 py-4 text-sm font-medium transition-colors',
                activeTab === 'assigned'
                  ? 'text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Assigned</span>
              </div>
              {activeTab === 'assigned' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search case #, worker, or team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm"
              />
            </div>

            {/* Severity Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm appearance-none cursor-pointer min-w-[160px]"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <>
            {/* Mobile loading skeleton */}
            <div className="p-4 space-y-3 md:hidden">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-xl animate-pulse">
                  <div className="flex justify-between mb-3">
                    <div className="h-5 w-24 bg-gray-200 rounded" />
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-3">
                    <div className="h-8 w-8 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                    <div className="h-8 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop loading skeleton */}
            <div className="hidden md:block">
              <SkeletonTable rows={5} columns={6} />
            </div>
          </>
        ) : incidents.length === 0 ? (
          <div className="p-8 sm:p-16 text-center">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              {search || severityFilter
                ? 'No matching incidents'
                : activeTab === 'pending'
                ? 'All caught up!'
                : 'No assigned incidents'}
            </h3>
            <p className="text-sm sm:text-base text-gray-500 max-w-sm mx-auto">
              {search || severityFilter
                ? 'Try adjusting your search or filters.'
                : activeTab === 'pending'
                ? 'There are no incidents waiting for assignment.'
                : 'Incidents will appear here once assigned to WHS officers.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="p-4 space-y-3 md:hidden">
              {incidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  activeTab={activeTab}
                  onAssign={() => setAssigningIncident(incident)}
                  onView={() => navigate(`/incidents/${incident.id}`)}
                />
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Case
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {activeTab === 'pending' ? 'Approved By' : 'Assigned To'}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map((incident) => {
                  const severity = severityConfig[incident.severity];
                  const isUrgent = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';

                  return (
                    <tr
                      key={incident.id}
                      className={cn(
                        'group transition-colors cursor-pointer',
                        isUrgent ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'
                      )}
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      {/* Case Number */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <span className="flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                          )}
                          <span className="font-semibold text-gray-900">{incident.caseNumber}</span>
                        </div>
                      </td>

                      {/* Worker */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={incident.reporter?.avatar}
                            firstName={incident.reporter?.firstName}
                            lastName={incident.reporter?.lastName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {incident.reporter?.firstName} {incident.reporter?.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {incident.reporter?.team?.name || 'No Team'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {incidentTypeLabels[incident.type] || incident.type}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                          severity?.bg,
                          severity?.color
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', severity?.dotColor)} />
                          {severity?.label}
                        </span>
                      </td>

                      {/* Approved By / Assigned To */}
                      <td className="px-6 py-4">
                        {activeTab === 'pending' ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {incident.exception?.reviewedBy?.firstName} {incident.exception?.reviewedBy?.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {incident.exception?.approvedAt
                                ? formatDisplayDateTime(incident.exception.approvedAt)
                                : '-'}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={incident.whsOfficer?.avatar}
                              firstName={incident.whsOfficer?.firstName}
                              lastName={incident.whsOfficer?.lastName}
                              size="sm"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {incident.whsOfficer?.firstName} {incident.whsOfficer?.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {incident.whsAssignedAt
                                  ? formatDisplayDateTime(incident.whsAssignedAt)
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        {activeTab === 'pending' ? (
                          <Button
                            size="sm"
                            variant={isUrgent ? 'danger' : 'primary'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningIncident(incident);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-1.5" />
                            Assign
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/incidents/${incident.id}`);
                            }}
                          >
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assigningIncident && (
        <AssignModal
          incident={assigningIncident}
          whsOfficers={whsOfficers}
          onClose={() => setAssigningIncident(null)}
          onConfirm={handleAssign}
          isLoading={assignMutation.isPending}
        />
      )}
    </div>
  );
}
