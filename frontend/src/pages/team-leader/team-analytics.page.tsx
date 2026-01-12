import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Calendar,
  Target,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Moon,
  Heart,
  BrainCircuit,
  Gauge,
  Clock,
  FileText,
  ChevronDown,
  CalendarDays,
  Shield,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { teamService, type TeamAnalytics } from '../../services/team.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Avatar } from '../../components/ui/Avatar';

type PeriodOption = 'today' | '7days' | '14days' | 'alltime' | 'custom';

const periodLabels: Record<PeriodOption, string> = {
  'today': 'Today',
  '7days': 'Last 7 Days',
  '14days': 'Last 14 Days',
  'alltime': 'All Time',
  'custom': 'Custom Range',
};

export function TeamAnalyticsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodOption>('7days');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['team-analytics', period, customStartDate, customEndDate],
    queryFn: () => {
      if (period === 'custom' && customStartDate && customEndDate) {
        return teamService.getTeamAnalytics('custom', customStartDate, customEndDate);
      }
      return teamService.getTeamAnalytics(period);
    },
    enabled: period !== 'custom' || (!!customStartDate && !!customEndDate),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Analytics</h2>
        <p className="text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const gradeColorMap = {
    GREEN: 'from-success-500 to-success-600',
    YELLOW: 'from-warning-500 to-warning-600',
    ORANGE: 'from-orange-500 to-orange-600',
    RED: 'from-danger-500 to-danger-600',
  };

  const gradeBgMap = {
    GREEN: 'bg-success-50 text-success-700 border-success-200',
    YELLOW: 'bg-warning-50 text-warning-700 border-warning-200',
    ORANGE: 'bg-orange-50 text-orange-700 border-orange-200',
    RED: 'bg-danger-50 text-danger-700 border-danger-200',
  };

  // Get emoticon based on grade score
  const getGradeEmoji = (score: number) => {
    if (score >= 90) return '😊'; // A grades - Happy
    if (score >= 80) return '😐'; // B grades - Neutral
    if (score >= 70) return '😰'; // C grades - Worried
    if (score >= 60) return '😰'; // D grades - Worried
    return '😱'; // F grades - Very worried
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 text-primary-200 mb-1">
          <BarChart3 className="h-4 w-4" />
          <span className="text-sm font-medium">Team Analytics</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">{analytics.team?.name ?? 'Team'}</h1>
        <p className="text-primary-200 text-sm">
          {analytics.team?.totalMembers ?? 0} team members
        </p>

        {/* Period Selector Dropdown */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          {/* Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-primary-700 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors min-w-[160px]"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="flex-1 text-left">
                {period === 'custom' && customStartDate && customEndDate
                  ? `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: analytics?.team?.timezone || 'Asia/Manila' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: analytics?.team?.timezone || 'Asia/Manila' })}`
                  : periodLabels[period]
                }
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showPeriodDropdown && 'rotate-180')} />
            </button>

            {showPeriodDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {(['today', '7days', '14days', 'alltime'] as PeriodOption[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setShowPeriodDropdown(false);
                      setShowCustomDatePicker(false);
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                      period === p ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                    )}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setPeriod('custom');
                    setShowPeriodDropdown(false);
                    setShowCustomDatePicker(true);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2',
                    period === 'custom' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  Custom Range
                </button>
              </div>
            )}
          </div>

          {/* Custom Date Picker */}
          {(showCustomDatePicker || period === 'custom') && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-white text-gray-900 rounded-lg text-sm border-0 shadow-sm focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-white/70">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-white text-gray-900 rounded-lg text-sm border-0 shadow-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Period Info */}
          {analytics?.period && (
            <div className="text-xs text-primary-200 ml-auto">
              {analytics.period?.startDate ? new Date(analytics.period.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: analytics.team?.timezone }) : 'N/A'}
              {' - '}
              {analytics.period?.endDate ? new Date(analytics.period.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: analytics.team?.timezone }) : 'N/A'}
            </div>
          )}
        </div>
      </div>

      {/* Team Grade Card */}
      {analytics.teamGrade ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary-600" />
                Team Readiness Grade
              </h2>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium border', gradeBgMap[analytics.teamGrade.color])}>
                {analytics.teamGrade.label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Letter Grade */}
              <div className="text-center">
                <div className={cn(
                  'w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-lg relative overflow-hidden',
                  gradeColorMap[analytics.teamGrade.color]
                )}>
                  <span className="text-5xl animate-bounce-slow relative z-10">
                    {getGradeEmoji(analytics.teamGrade.score)}
                  </span>
                  <div className={cn(
                    'absolute inset-0 opacity-20 animate-pulse',
                    gradeColorMap[analytics.teamGrade.color].split(' ')[1]
                  )} />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black text-gray-900">
                    {analytics.teamGrade.letter}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Letter Grade</p>
                <p className="text-xs text-gray-400 mt-1">Score: {analytics.teamGrade.score}/100</p>
              </div>

              {/* Team Avg Readiness (All-time) */}
              <div className="text-center p-4 bg-primary-50 rounded-xl border border-primary-100">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Gauge className="h-5 w-5 text-primary-600" />
                  <span className="text-2xl font-bold text-primary-700">
                    {analytics.teamGrade.avgReadiness}%
                  </span>
                </div>
                <p className="text-sm text-primary-600 font-medium">Team Avg Score</p>
                <p className="text-xs text-primary-400 mt-1">Based on member averages</p>
              </div>

              {/* Period/Today's Avg Readiness */}
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-gray-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {period === 'today' ? analytics.teamGrade.todayAvgReadiness : analytics.teamGrade.periodAvgReadiness}%
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {period === 'today' ? "Today's Avg" : 'Period Avg'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {period === 'today' ? "From today's check-ins" : `${period === '7days' ? '7-day' : period === '14days' ? '14-day' : 'Period'} average`}
                </p>
              </div>

              {/* Period Compliance */}
              <div className="text-center p-4 bg-success-50 rounded-xl border border-success-100">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-success-600" />
                  <span className="text-2xl font-bold text-success-700">
                    {analytics.teamGrade.compliance}%
                  </span>
                </div>
                <p className="text-sm text-success-600 font-medium">Compliance</p>
                <p className="text-xs text-success-400 mt-1">
                  {period === 'today' ? "Today's rate" : `${period === '7days' ? '7-day' : period === '14days' ? '14-day' : 'Period'} average`}
                </p>
              </div>
            </div>

            {/* Grade Formula Explanation */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Grade = (Team Avg Score × 60%) + (Period Compliance × 40%)
              </p>
              {analytics.teamGrade?.onboardingCount && analytics.teamGrade.onboardingCount > 0 && (
                <p className="text-xs text-blue-500 text-center mt-2">
                  {analytics.teamGrade.onboardingCount} new member{analytics.teamGrade.onboardingCount > 1 ? 's' : ''} with &lt;3 check-ins not yet included in grade calculation
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Target className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Grade Data Yet</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Team grade will be calculated once team members start checking in.
            The grade is based on individual member average scores and compliance rate.
          </p>
        </div>
      )}

      {/* Compliance Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Checked In"
          value={analytics.complianceDetails?.checkedIn ?? 0}
          icon={CheckCircle2}
          color="success"
        />
        <StatCard
          label="Active Members"
          value={analytics.complianceDetails?.activeMembers ?? 0}
          icon={Users}
          color="primary"
        />
        <StatCard
          label="On Leave"
          value={analytics.complianceDetails?.onLeave ?? 0}
          icon={Calendar}
          color="warning"
        />
        <StatCard
          label="Not Checked In"
          value={analytics.complianceDetails?.notCheckedIn ?? 0}
          icon={Clock}
          color="danger"
        />
      </div>

      {/* Status Distribution & Trend Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-600" />
            Status Distribution
          </h3>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="h-4 rounded-full overflow-hidden bg-gray-100 flex">
              {analytics.statusDistribution?.total > 0 && (
                <>
                  <div
                    className="h-full bg-success-500 transition-all"
                    style={{
                      width: `${((analytics.statusDistribution.green || 0) / analytics.statusDistribution.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-warning-500 transition-all"
                    style={{
                      width: `${((analytics.statusDistribution.yellow || 0) / analytics.statusDistribution.total) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-danger-500 transition-all"
                    style={{
                      width: `${((analytics.statusDistribution.red || 0) / analytics.statusDistribution.total) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-success-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-xl font-bold text-success-700">
                    {analytics.statusDistribution?.green ?? 0}
                  </span>
                </div>
                <p className="text-xs text-success-600">Green (Ready)</p>
              </div>
              <div className="text-center p-3 bg-warning-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-4 w-4 text-warning-600" />
                  <span className="text-xl font-bold text-warning-700">
                    {analytics.statusDistribution?.yellow ?? 0}
                  </span>
                </div>
                <p className="text-xs text-warning-600">Yellow (Caution)</p>
              </div>
              <div className="text-center p-3 bg-danger-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Activity className="h-4 w-4 text-danger-600" />
                  <span className="text-xl font-bold text-danger-700">
                    {analytics.statusDistribution?.red ?? 0}
                  </span>
                </div>
                <p className="text-xs text-danger-600">Red (At Risk)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Metrics */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            Average Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Mood"
              value={analytics.avgMetrics?.mood ?? 0}
              icon={Sparkles}
              color="yellow"
            />
            <MetricCard
              label="Stress"
              value={analytics.avgMetrics?.stress ?? 0}
              icon={BrainCircuit}
              color="red"
              inverted
            />
            <MetricCard
              label="Sleep"
              value={analytics.avgMetrics?.sleep ?? 0}
              icon={Moon}
              color="blue"
            />
            <MetricCard
              label="Physical Health"
              value={analytics.avgMetrics?.physicalHealth ?? 0}
              icon={Heart}
              color="green"
            />
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {analytics.trendData && analytics.trendData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" />
            Readiness Trend
          </h3>
          <TrendChart 
            data={analytics.trendData} 
            timezone={analytics.team?.timezone || 'Asia/Manila'}
            periodCompliance={analytics.teamGrade?.compliance || 0}
          />
        </div>
      )}

      {/* Top Metric Issues */}
      {analytics.topReasons && analytics.topReasons.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Common Issues in Check-ins</h3>
            <p className="text-xs text-gray-500 mt-0.5">Based on {period === 'today' ? "today's" : 'period'} check-in data</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-10">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Issue</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-28">Occurrences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.topReasons.map((reason, index) => (
                <tr key={reason.reason} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-900">{reason.label}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                      {reason.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Members Needing Attention & On Leave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members Needing Attention */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-danger-500" />
              Needs Attention
            </h3>
            <span className="bg-danger-100 text-danger-700 text-xs font-medium px-2 py-1 rounded-full">
              {analytics.membersNeedingAttention?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {!analytics.membersNeedingAttention || analytics.membersNeedingAttention.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <CheckCircle2 className="h-10 w-10 text-success-300 mx-auto mb-2" />
                <p>All team members are doing well!</p>
              </div>
            ) : (
              (analytics.membersNeedingAttention || []).map((member) => (
                <button
                  key={member.id}
                  onClick={() => navigate(`/team/members/${member.id}`)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Avatar
                    src={member.avatar}
                    firstName={member.name.split(' ')[0]}
                    lastName={member.name.split(' ').slice(1).join(' ')}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-sm text-gray-500 truncate">{member.details}</p>
                  </div>
                  <span className={cn(
                    'flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium',
                    member.issue === 'RED_STATUS' ? 'bg-danger-100 text-danger-700' : 'bg-gray-100 text-gray-700'
                  )}>
                    {member.issue === 'RED_STATUS' ? 'Red Status' : 'No Check-in'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Members On Leave */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-warning-500" />
              Currently On Leave
            </h3>
            <span className="bg-warning-100 text-warning-700 text-xs font-medium px-2 py-1 rounded-full">
              {analytics.membersOnLeave?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {!analytics.membersOnLeave || analytics.membersOnLeave.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p>No members currently on leave</p>
              </div>
            ) : (
              (analytics.membersOnLeave || []).map((member) => (
                <button
                  key={member.id}
                  onClick={() => navigate(`/team/members/${member.id}`)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Avatar
                    src={member.avatar}
                    firstName={member.name.split(' ')[0]}
                    lastName={member.name.split(' ').slice(1).join(' ')}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(member.startDate).toLocaleDateString('en-US', { timeZone: analytics.team?.timezone || 'Asia/Manila' })} - {new Date(member.endDate).toLocaleDateString('en-US', { timeZone: analytics.team?.timezone || 'Asia/Manila' })}
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                    {member.leaveType}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  color: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  inverted = false,
}: {
  label: string;
  value: number;
  icon: typeof Sparkles;
  color: 'yellow' | 'red' | 'blue' | 'green';
  inverted?: boolean;
}) {
  const colorClasses = {
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
  };

  const bgClasses = {
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
  };

  // For inverted metrics like stress, lower is better
  // Values are on 1-10 scale
  const displayValue = value.toFixed(1);
  const percentage = (value / 10) * 100;
  const barColor = inverted
    ? value <= 4 ? 'bg-success-500' : value <= 6 ? 'bg-warning-500' : 'bg-danger-500'
    : value >= 7 ? 'bg-success-500' : value >= 5 ? 'bg-warning-500' : 'bg-danger-500';

  return (
    <div className={cn('p-4 rounded-xl', bgClasses[color])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', colorClasses[color])} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
        <span className="text-sm text-gray-500">/10</span>
      </div>
      <div className="h-2 bg-white/50 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Professional Trend Chart Component using Recharts
function TrendChart({ data, timezone, periodCompliance }: { data: TeamAnalytics['trendData']; timezone: string; periodCompliance: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No trend data available</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.map((d) => ({
    date: d.date,
    readiness: d.score !== null ? Math.round(d.score) : null,
    compliance: d.compliance !== null ? Math.round(d.compliance) : null, // null when all on exemption
    checkedIn: d.checkedIn,
    expected: d.expected || 0,
    onExemption: d.onExemption || 0,
    hasData: d.hasData,
  }));

  // Calculate trend indicators
  const validScores = chartData.filter(d => d.readiness !== null).map(d => d.readiness!);
  const latestScore = validScores.length > 0 ? validScores[validScores.length - 1] : null;
  const previousScore = validScores.length > 1 ? validScores[validScores.length - 2] : null;
  const scoreChange = latestScore && previousScore ? latestScore - previousScore : 0;

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (data.length <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: timezone });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[160px]">
          <p className="text-xs text-gray-500 mb-2 font-medium">{formatDate(data.date)}</p>
          {data.readiness !== null && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                Readiness
              </span>
              <span className="text-sm font-bold text-indigo-600">{data.readiness}%</span>
            </div>
          )}
          {data.compliance !== null ? (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Compliance
              </span>
              <span className="text-sm font-bold text-emerald-600">{data.compliance}%</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                All Exempted
              </span>
              <span className="text-xs font-medium text-blue-600">N/A</span>
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Checked In</span>
              <span className="text-xs font-medium text-gray-700">{data.checkedIn}/{data.expected} members</span>
            </div>
            {data.onExemption > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-blue-500" />
                  Exempted
                </span>
                <span className="text-xs font-medium text-blue-600">{data.onExemption} members</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-xl p-4 border border-primary-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-primary-600 font-medium">Avg Readiness</span>
            {scoreChange !== 0 && (
              <span className={cn(
                'text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full',
                scoreChange > 0 
                  ? 'text-success-700 bg-success-100' 
                  : 'text-danger-700 bg-danger-100'
              )}>
                {scoreChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(scoreChange)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-primary-700">
            {latestScore !== null ? `${latestScore}%` : 'N/A'}
          </p>
        </div>
        <div className="bg-gradient-to-br from-success-50 to-success-100/50 rounded-xl p-4 border border-success-200">
          <span className="text-xs text-success-600 font-medium block mb-2">Check-in Compliance</span>
          <p className="text-3xl font-bold text-success-700">{periodCompliance}%</p>
          <p className="text-xs text-success-500 mt-1">Period Average</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 -mx-2 min-h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
            {/* Gradient Definitions */}
            <defs>
              <linearGradient id="readinessGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#10b981" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Grid */}
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

            {/* Threshold lines */}
            <ReferenceLine
              y={70}
              stroke="#22c55e"
              strokeDasharray="5 5"
              strokeOpacity={0.4}
            />
            <ReferenceLine
              y={40}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeOpacity={0.4}
            />

            {/* X Axis */}
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval="preserveStartEnd"
              angle={-45}
              textAnchor="end"
              height={60}
            />

            {/* Y Axis */}
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              width={50}
            />

            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} />

            {/* Readiness Gradient Area */}
            <Area
              type="monotone"
              dataKey="readiness"
              stroke="transparent"
              fill="url(#readinessGradient)"
              connectNulls={true}
            />

            {/* Compliance Gradient Area */}
            <Area
              type="monotone"
              dataKey="compliance"
              stroke="transparent"
              fill="url(#complianceGradient)"
              connectNulls={true}
            />

            {/* Readiness Line */}
            <Line
              type="monotone"
              dataKey="readiness"
              stroke="#6366f1"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cy === undefined || cy === null || payload.readiness === null) {
                  return <g />;
                }
                if (payload.onExemption > 0) {
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
                      <circle cx={cx} cy={cy} r={8} fill="none" stroke="#3b82f6" strokeWidth={2} opacity={0.6} />
                      <text x={cx} y={cy - 15} textAnchor="middle" fontSize="10" fill="#3b82f6" fontWeight="600">
                        {payload.onExemption}E
                      </text>
                    </g>
                  );
                }
                return <circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cy === undefined || cy === null || payload.readiness === null) {
                  return <g />;
                }
                if (payload.onExemption > 0) {
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={7} fill="#6366f1" stroke="#fff" strokeWidth={2} />
                      <circle cx={cx} cy={cy} r={10} fill="none" stroke="#3b82f6" strokeWidth={2.5} opacity={0.7} />
                      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="11" fill="#3b82f6" fontWeight="700">
                        {payload.onExemption}E
                      </text>
                    </g>
                  );
                }
                return <circle cx={cx} cy={cy} r={7} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
              }}
              connectNulls={true}
              name="Readiness Score"
            />

            {/* Compliance Line */}
            <Line
              type="monotone"
              dataKey="compliance"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cy === undefined || cy === null || payload.compliance === null) {
                  return <g />;
                }
                return <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cy === undefined || cy === null || payload.compliance === null) {
                  return <g />;
                }
                return <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />;
              }}
              connectNulls={true}
              name="Compliance %"
            />

            {/* Legend */}
            <Legend
              wrapperStyle={{ paddingTop: '10px', paddingBottom: '0' }}
              iconType="line"
              iconSize={12}
              formatter={(value) => (
                <span className="text-xs text-gray-700 font-medium">{value}</span>
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
