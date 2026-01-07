/**
 * System Logs Page
 * Centralized page accessible by ADMIN and EXECUTIVE roles
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  Search,
  Filter,
  Activity,
  User,
  Users,
  AlertTriangle,
  FileText,
  ClipboardCheck,
  Settings,
  RefreshCw,
  X,
  TrendingUp,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDisplayDateTime } from '../../lib/date-utils';
import {
  systemLogsService,
  formatActionLabel,
  getActionColor,
  type SystemLog,
  type SystemLogsParams,
} from '../../services/system-logs.service';
import api from '../../services/api';

// Import reusable components
import { PageHeader } from '../../components/ui/PageHeader';
import { StatsCard, StatsCardGrid } from '../../components/ui/StatsCard';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/StatusBadge';

// ============================================
// ACTION ICON MAPPING
// ============================================

const actionIconMap: Record<string, LucideIcon> = {
  USER_: User,
  TEAM_: Users,
  INCIDENT_: AlertTriangle,
  EXCEPTION_: FileText,
  CHECKIN_: ClipboardCheck,
  SETTINGS_: Settings,
  AI_: Brain,
  CERTIFICATE_: FileText,
};

function getActionIcon(action: string): LucideIcon {
  for (const [prefix, icon] of Object.entries(actionIconMap)) {
    if (action.startsWith(prefix)) return icon;
  }
  return Activity;
}

// ============================================
// COMPONENT
// ============================================

export function SystemLogsPage() {
  const [params, setParams] = useState<SystemLogsParams>({
    page: 1,
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Fetch logs
  const { data: logsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-logs', params],
    queryFn: () => systemLogsService.getLogs(params),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['system-logs-stats'],
    queryFn: () => systemLogsService.getStats(),
  });

  // Fetch filter options
  const { data: actions } = useQuery({
    queryKey: ['system-log-actions'],
    queryFn: () => systemLogsService.getActions(),
  });

  const { data: entityTypes } = useQuery({
    queryKey: ['system-log-entity-types'],
    queryFn: () => systemLogsService.getEntityTypes(),
  });

  // Fetch users for user filter
  const { data: users } = useQuery({
    queryKey: ['company-users-list'],
    queryFn: async () => {
      const response = await api.get<{ data: Array<{ id: string; firstName: string; lastName: string; email: string }>; pagination: any }>('/users?limit=500');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    },
  });

  // Handlers
  const handleSearch = () => {
    setParams({ ...params, search: searchInput || undefined, page: 1 });
  };

  const handleFilterChange = (key: keyof SystemLogsParams, value: string | undefined) => {
    setParams({ ...params, [key]: value || undefined, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setParams({ ...params, page });
  };

  const clearFilters = () => {
    setParams({ page: 1, limit: 20 });
    setSearchInput('');
  };

  const hasActiveFilters = params.action || params.entityType || params.startDate || params.endDate || params.search || params.userId;

  // Table columns definition
  const columns: Column<SystemLog>[] = useMemo(() => [
    {
      key: 'action',
      header: 'Action',
      render: (log) => <ActionBadge action={log.action} />,
    },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-md',
      render: (log) => (
        <p className="text-sm text-gray-900 line-clamp-2">{log.description}</p>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (log) => <UserCell user={log.user} />,
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (log) => (
        <span className="text-sm text-gray-500 capitalize">{log.entityType}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date & Time',
      render: (log) => (
        <span className="text-sm text-gray-500">{formatDisplayDateTime(log.createdAt)}</span>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="System Logs"
        description="Monitor all system activity and changes"
        icon={ScrollText}
        actions={[
          {
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => refetch(),
            disabled: isFetching,
          },
        ]}
      />

      {/* Stats Cards */}
      {stats && (
        <StatsCardGrid columns={4}>
          <StatsCard
            label="Total Logs"
            value={stats.totalLogs}
            icon={ScrollText}
            variant="primary"
          />
          <StatsCard
            label="Today"
            value={stats.todayLogs}
            icon={Activity}
            variant="success"
          />
          <StatsCard
            label="This Week"
            value={stats.weekLogs}
            icon={TrendingUp}
            variant="warning"
          />
          <StatsCard
            label="Active Users"
            value={stats.mostActiveUsers.length}
            icon={Users}
            variant="secondary"
          />
        </StatsCardGrid>
      )}

      {/* Search and Filters */}
      <SearchAndFilters
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveFilters={!!hasActiveFilters}
        params={params}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        actions={actions}
        entityTypes={entityTypes}
        users={users}
      />

      {/* Data Table */}
      <DataTable
        data={logsData?.data || []}
        columns={columns}
        keyExtractor={(log) => log.id}
        isLoading={isLoading}
        pagination={logsData?.pagination}
        onPageChange={handlePageChange}
        emptyTitle="No logs found"
        emptyDescription="Try adjusting your filters"
      />
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ActionBadge({ action }: { action: string }) {
  const Icon = getActionIcon(action);
  const colorClass = getActionColor(action);

  const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
    success: 'success',
    danger: 'danger',
    warning: 'warning',
    primary: 'primary',
    secondary: 'secondary',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center',
        colorClass === 'success' && 'bg-success-100 text-success-600',
        colorClass === 'danger' && 'bg-danger-100 text-danger-600',
        colorClass === 'warning' && 'bg-warning-100 text-warning-600',
        colorClass === 'primary' && 'bg-primary-100 text-primary-600',
        colorClass === 'secondary' && 'bg-gray-100 text-gray-600',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <Badge
        label={formatActionLabel(action)}
        variant={variantMap[colorClass] || 'secondary'}
        size="sm"
      />
    </div>
  );
}

function UserCell({ user }: { user?: SystemLog['user'] }) {
  if (!user) {
    return <span className="text-sm text-gray-400">System</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-xs font-medium text-gray-600">
          {user.firstName[0]}{user.lastName[0]}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-gray-500">{user.role}</p>
      </div>
    </div>
  );
}

interface SearchAndFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  params: SystemLogsParams;
  onFilterChange: (key: keyof SystemLogsParams, value: string | undefined) => void;
  onClearFilters: () => void;
  actions?: { value: string; label: string }[];
  entityTypes?: { value: string; label: string }[];
  users?: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

function SearchAndFilters({
  searchInput,
  onSearchInputChange,
  onSearch,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  params,
  onFilterChange,
  onClearFilters,
  actions,
  entityTypes,
  users,
}: SearchAndFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          className={cn(
            'flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors',
            showFilters
              ? 'bg-primary-50 border-primary-200 text-primary-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="h-2 w-2 bg-primary-600 rounded-full" />
          )}
        </button>

        {/* Search Button */}
        <button
          onClick={onSearch}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <FilterSelect
              label="User"
              value={params.userId || ''}
              onChange={(v) => onFilterChange('userId', v)}
              options={users?.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })) || []}
              placeholder="All Users"
            />
            <FilterSelect
              label="Action Type"
              value={params.action || ''}
              onChange={(v) => onFilterChange('action', v)}
              options={actions?.map((a) => ({ value: a.value, label: a.label })) || []}
              placeholder="All Actions"
            />
            <FilterSelect
              label="Entity Type"
              value={params.entityType || ''}
              onChange={(v) => onFilterChange('entityType', v)}
              options={entityTypes?.map((e) => ({ value: e.value, label: e.label })) || []}
              placeholder="All Types"
            />
            <FilterDateInput
              label="Start Date"
              value={params.startDate || ''}
              onChange={(v) => onFilterChange('startDate', v)}
            />
            <FilterDateInput
              label="End Date"
              value={params.endDate || ''}
              onChange={(v) => onFilterChange('endDate', v)}
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="mt-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}
