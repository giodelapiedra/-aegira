/**
 * My Incidents Page
 * Track personal incident reports and their status
 * Uses centralized components and utilities - no duplicate code
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  MapPin,
  Calendar,
  Plus,
  Filter,
  RefreshCw,
  User,
  Eye,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import { incidentService } from '../../services/incident.service';

// Import reusable components
import { PageHeader } from '../../components/ui/PageHeader';
import { StatsCard, StatsCardGrid } from '../../components/ui/StatsCard';
import { SeverityBadge, IncidentStatusBadge } from '../../components/ui/StatusBadge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';

// ============================================
// CONSTANTS
// ============================================

type StatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const STATUS_FILTERS: { value: StatusFilter; label: string; icon: typeof Clock }[] = [
  { value: 'ALL', label: 'All', icon: FileText },
  { value: 'OPEN', label: 'Open', icon: Clock },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: RefreshCw },
  { value: 'RESOLVED', label: 'Resolved', icon: CheckCircle2 },
  { value: 'CLOSED', label: 'Closed', icon: XCircle },
];

const INCIDENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  INJURY: { label: 'Physical Injury', icon: AlertTriangle },
  ILLNESS: { label: 'Illness/Sickness', icon: XCircle },
  MENTAL_HEALTH: { label: 'Mental Health', icon: User },
  EQUIPMENT: { label: 'Equipment Issue', icon: AlertTriangle },
  ENVIRONMENTAL: { label: 'Environmental Hazard', icon: AlertTriangle },
  OTHER: { label: 'Other', icon: FileText },
};

const ITEMS_PER_PAGE = 10;

// ============================================
// COMPONENT
// ============================================

export function MyIncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const { data: incidents, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['incidents', 'my'],
    queryFn: () => incidentService.getMyIncidents(),
  });

  // Computed data
  const { filteredIncidents, stats, paginatedIncidents, totalPages } = useMemo(() => {
    const all = incidents || [];

    const filtered = statusFilter === 'ALL'
      ? all
      : all.filter((i) => i.status === statusFilter);

    const pages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );

    return {
      filteredIncidents: filtered,
      paginatedIncidents: paginated,
      totalPages: pages,
      stats: {
        total: all.length,
        open: all.filter((i) => i.status === 'OPEN').length,
        inProgress: all.filter((i) => i.status === 'IN_PROGRESS').length,
        resolved: all.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
      },
    };
  }, [incidents, statusFilter, currentPage]);

  // Handlers
  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const getFilterCount = (filter: StatusFilter) => {
    if (filter === 'ALL') return stats.total;
    return incidents?.filter((i) => i.status === filter).length || 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="My Incidents"
        description="Track your reported incidents and their status"
        icon={AlertTriangle}
        className="bg-danger-100 text-danger-600"
        actions={[
          {
            label: 'Refresh',
            icon: RefreshCw,
            variant: 'secondary',
            onClick: () => refetch(),
            disabled: isFetching,
          },
          {
            label: 'Report New',
            icon: Plus,
            href: '/report-incident',
          },
        ]}
      />

      {/* Stats Cards */}
      <StatsCardGrid columns={4}>
        <StatsCard
          label="Total Reports"
          value={stats.total}
          icon={FileText}
          variant="secondary"
        />
        <StatsCard
          label="Open"
          value={stats.open}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          label="In Progress"
          value={stats.inProgress}
          icon={RefreshCw}
          variant="primary"
        />
        <StatsCard
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          variant="success"
        />
      </StatsCardGrid>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
        {STATUS_FILTERS.map((filter) => {
          const Icon = filter.icon;
          const count = getFilterCount(filter.value);
          const isActive = statusFilter === filter.value;

          return (
            <button
              key={filter.value}
              onClick={() => handleFilterChange(filter.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Icon className="h-4 w-4" />
              {filter.label}
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                isActive
                  ? 'bg-primary-200 text-primary-800'
                  : 'bg-gray-200 text-gray-600'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={statusFilter === 'ALL' ? 'No Incidents Reported' : `No ${statusFilter.replace('_', ' ')} Incidents`}
          description={
            statusFilter === 'ALL'
              ? "You haven't reported any incidents yet."
              : "You don't have any incidents with this status."
          }
          action={statusFilter === 'ALL' ? {
            label: 'Report an Incident',
            icon: Plus,
            href: '/report-incident',
          } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {paginatedIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onClick={() => navigate(`/incidents/${incident.id}`)}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredIncidents.length}
                pageSize={ITEMS_PER_PAGE}
                showItemCount
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface IncidentCardProps {
  incident: any;
  onClick: () => void;
}

function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const navigate = useNavigate();
  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type] || INCIDENT_TYPE_CONFIG.OTHER;
  const TypeIcon = typeConfig.icon;
  const progress = getStatusProgress(incident.status);

  const severityColors: Record<string, { bg: string; text: string }> = {
    CRITICAL: { bg: 'bg-status-red-100', text: 'text-status-red-600' },
    HIGH: { bg: 'bg-orange-100', text: 'text-orange-600' },
    MEDIUM: { bg: 'bg-status-yellow-100', text: 'text-status-yellow-600' },
    LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
  };

  const colors = severityColors[incident.severity] || severityColors.LOW;

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', colors.bg)}>
              <TypeIcon className={cn('h-5 w-5', colors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                  {incident.caseNumber}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{incident.title}</h3>
              <p className="text-sm text-gray-500">{typeConfig.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SeverityBadge severity={incident.severity} size="sm" />
            <IncidentStatusBadge status={incident.status} size="sm" />
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {incident.description}
        </p>

        {/* Progress Tracker */}
        <ProgressTracker currentStep={progress.step} color={progress.color} />

        {/* Meta Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <MetaItem icon={Calendar} text={formatDisplayDateTime(incident.createdAt)} />
            {incident.location && <MetaItem icon={MapPin} text={incident.location} />}
            {incident.assignee && (
              <MetaItem
                icon={User}
                text={`Assigned to ${incident.assignee.firstName} ${incident.assignee.lastName}`}
              />
            )}
            {incident.resolvedAt && (
              <MetaItem
                icon={CheckCircle2}
                text={`Resolved ${formatDisplayDateTime(incident.resolvedAt)}`}
                className="text-success-600"
              />
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Eye className="h-4 w-4" />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/incidents/${incident.id}`);
            }}
          >
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProgressTracker({ currentStep, color }: { currentStep: number; color: string }) {
  const steps = ['Submitted', 'Reviewing', 'Resolved', 'Closed'];

  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex-1">
            <div
              className={cn(
                'h-1.5 rounded-full',
                step <= currentStep ? color : 'bg-gray-200'
              )}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {steps.map((label) => (
          <span key={label} className="text-xs text-gray-400">{label}</span>
        ))}
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  text,
  className,
}: {
  icon: typeof Calendar;
  text: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getStatusProgress(status: string) {
  const config: Record<string, { step: number; color: string }> = {
    OPEN: { step: 1, color: 'bg-warning-500' },
    IN_PROGRESS: { step: 2, color: 'bg-primary-500' },
    RESOLVED: { step: 3, color: 'bg-success-500' },
    CLOSED: { step: 4, color: 'bg-gray-500' },
  };

  return config[status] || { step: 0, color: 'bg-gray-300' };
}
