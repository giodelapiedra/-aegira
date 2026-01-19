import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SkeletonDashboard } from '../../components/ui/Skeleton';
import { Badge, SeverityBadge, IncidentStatusBadge } from '../../components/ui/StatusBadge';
import { HorizontalBarChart } from '../../components/charts/HorizontalBarChart';
import { cn } from '../../lib/utils';
import { whsService } from '../../services/whs.service';

// ============================================
// TYPES
// ============================================

interface OverdueCase {
  id: string;
  caseNumber: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  whsAssignedAt: string;
  days_open: number;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  team_name: string | null;
}

interface RTWPendingCase {
  id: string;
  caseNumber: string;
  type: string;
  resolvedAt: string;
  daysSinceResolved: number | null;
  reporter: { firstName: string; lastName: string };
  team: { name: string } | null;
}

// ============================================
// CONSTANTS
// ============================================

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#3b82f6',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#ef4444',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

// ============================================
// DONUT CHART COMPONENT (WHS-specific)
// ============================================

interface DonutChartData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number; // Index signature for recharts compatibility
}

interface DonutChartProps {
  data: DonutChartData[];
  total: number;
}

function DonutChart({ data, total }: DonutChartProps) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Activity className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = Math.round((item.value / total) * 100);
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium" style={{ color: item.color }}>
            {item.name}
          </p>
          <p className="text-lg font-bold text-gray-900">{item.value} cases</p>
          <p className="text-xs text-gray-500">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col items-center">
        <div className="relative w-full max-w-[200px] aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-gray-900">{total}</span>
            <span className="text-xs text-gray-500">Total</span>
          </div>
        </div>

        <div className="w-full mt-4 space-y-2">
          {data.map((item) => {
            const percentage = Math.round((item.value / total) * 100);
            return (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{item.value}</span>
                  <span className="text-xs text-gray-400">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TABLE COLUMNS
// ============================================

const overdueColumns: Column<OverdueCase>[] = [
  {
    key: 'caseNumber',
    header: 'Case #',
    sortable: true,
    render: (item) => (
      <Link
        to={`/incidents/${item.id}`}
        className="font-mono text-sm text-primary-600 hover:underline"
      >
        {item.caseNumber}
      </Link>
    ),
  },
  {
    key: 'reporter',
    header: 'Worker',
    render: (item) => (
      <span className="text-sm text-gray-900">
        {item.reporter_first_name && item.reporter_last_name
          ? `${item.reporter_first_name} ${item.reporter_last_name}`
          : 'Unknown'}
      </span>
    ),
  },
  {
    key: 'severity',
    header: 'Severity',
    sortable: true,
    render: (item) => <SeverityBadge severity={item.severity} size="sm" />,
  },
  {
    key: 'days_open',
    header: 'Days Open',
    sortable: true,
    render: (item) => (
      <span className={cn('text-sm font-medium', item.days_open > 7 ? 'text-danger-600' : 'text-gray-900')}>
        {item.days_open} days
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => <IncidentStatusBadge status={item.status} size="sm" />,
  },
];

const rtwColumns: Column<RTWPendingCase>[] = [
  {
    key: 'reporter',
    header: 'Worker',
    render: (item) => (
      <span className="text-sm text-gray-900">
        {item.reporter.firstName} {item.reporter.lastName}
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (item) => <Badge label={item.type.replace(/_/g, ' ')} variant="secondary" size="sm" />,
  },
  {
    key: 'daysSinceResolved',
    header: 'Days Waiting',
    sortable: true,
    render: (item) => (
      <span
        className={cn('text-sm font-medium', (item.daysSinceResolved || 0) > 7 ? 'text-danger-600' : 'text-gray-900')}
      >
        {item.daysSinceResolved || 0} days
      </span>
    ),
  },
  {
    key: 'caseNumber',
    header: 'Case #',
    render: (item) => (
      <Link to={`/incidents/${item.id}`} className="font-mono text-sm text-primary-600 hover:underline">
        {item.caseNumber}
      </Link>
    ),
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function WHSAnalyticsPage() {
  // Fetch all data in parallel
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['whs', 'analytics', 'summary'],
    queryFn: whsService.getAnalyticsSummary,
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ['whs', 'analytics', 'breakdown'],
    queryFn: whsService.getAnalyticsBreakdown,
  });

  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['whs', 'analytics', 'overdue'],
    queryFn: whsService.getOverdueCases,
  });

  const { data: rtwData, isLoading: rtwLoading } = useQuery({
    queryKey: ['whs', 'analytics', 'rtw'],
    queryFn: whsService.getRTWPending,
  });

  const isLoading = summaryLoading || breakdownLoading || overdueLoading || rtwLoading;

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  // Transform breakdown data for charts
  const typeData =
    breakdown?.byType?.map((item) => ({
      label: item.type,
      value: item._count.type,
    })) || [];

  const severityData =
    breakdown?.bySeverity?.map((item) => ({
      name: item.severity,
      value: item._count.severity,
      color: SEVERITY_COLORS[item.severity] || '#6b7280',
    })) || [];

  const statusData =
    breakdown?.byStatus?.map((item) => ({
      name: STATUS_LABELS[item.status] || item.status,
      value: item._count.status,
      color: STATUS_COLORS[item.status] || '#6b7280',
    })) || [];

  const severityTotal = severityData.reduce((sum, item) => sum + item.value, 0);
  const statusTotal = statusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Shield className="h-6 w-6 text-primary-600" />
          </div>
          WHS Analytics
        </h1>
        <p className="text-gray-500 mt-1">
          Insights into workplace safety incidents and resolution metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={FileText}
          value={summary?.total || 0}
          label="Total Cases"
          color="primary"
          description="Assigned to me"
        />
        <StatCard
          icon={Activity}
          value={summary?.active || 0}
          label="Active"
          color="warning"
          description="Open + In Progress"
        />
        <StatCard
          icon={TrendingUp}
          value={summary?.avgResolutionDays ? `${summary.avgResolutionDays}d` : '-'}
          label="Avg Resolution"
          color="success"
          description="Days to close"
        />
        <StatCard
          icon={AlertTriangle}
          value={summary?.critical || 0}
          label="Critical/High"
          color="danger"
          description="Priority cases"
        />
        <StatCard
          icon={Clock}
          value={summary?.pendingRTW || 0}
          label="Pending RTW"
          color="gray"
          description="Need certificate"
        />
      </div>

      {/* Charts Section - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident Types - Full width bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>Incident Types</CardTitle>
            <CardDescription>Distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={typeData}
              colorScheme="type"
              showPercentage
              emptyMessage="No incidents assigned"
            />
          </CardContent>
        </Card>

        {/* Severity & Status - Side by side donuts */}
        <Card>
          <CardHeader>
            <CardTitle>Severity & Status</CardTitle>
            <CardDescription>Risk assessment and workflow state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Severity</h4>
                <DonutChart data={severityData} total={severityTotal} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Status</h4>
                <DonutChart data={statusData} total={statusTotal} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Cases */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-danger-700">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue Cases
                </CardTitle>
                <CardDescription>Cases exceeding SLA ({overdueData?.data?.length || 0})</CardDescription>
              </div>
              {(overdueData?.data?.length || 0) > 0 && <Badge label="Attention" variant="danger" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overdueData?.data && overdueData.data.length > 0 ? (
              <DataTable
                data={overdueData.data}
                columns={overdueColumns}
                keyExtractor={(item) => item.id}
                className="border-0 shadow-none"
              />
            ) : (
              <div className="text-center py-10">
                <div className="bg-success-50 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-success-600" />
                </div>
                <p className="text-gray-600 font-medium">All cases within SLA</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending RTW */}
        <Card>
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-warning-700">
                  <FileText className="h-5 w-5" />
                  Pending RTW
                </CardTitle>
                <CardDescription>Awaiting clearance ({rtwData?.data?.length || 0})</CardDescription>
              </div>
              {(rtwData?.data?.length || 0) > 0 && <Badge label="Action" variant="warning" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rtwData?.data && rtwData.data.length > 0 ? (
              <DataTable
                data={rtwData.data}
                columns={rtwColumns}
                keyExtractor={(item) => item.id}
                className="border-0 shadow-none"
              />
            ) : (
              <div className="text-center py-10">
                <div className="bg-success-50 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-success-600" />
                </div>
                <p className="text-gray-600 font-medium">All RTW certificates complete</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
