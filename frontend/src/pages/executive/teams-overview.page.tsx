/**
 * Teams Overview Page - Clean UI Design
 *
 * Displays all teams with their performance grades for Executive and Supervisor roles.
 * Shows team grades, attendance rates, trends, and allows drilling down to team details.
 *
 * ACCESS: EXECUTIVE, SUPERVISOR only
 *
 * @module pages/executive/teams-overview
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  MoreHorizontal,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { analyticsService, type TeamGradeSummary, type TeamsOverviewParams } from '../../services/analytics.service';
import { Avatar } from '../../components/ui/Avatar';
import { SkeletonDashboard } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';

// ===========================================
// CONSTANTS
// ===========================================

const PERIOD_OPTIONS = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

const SORT_OPTIONS = [
  { value: 'grade', label: 'Grade (Worst First)' },
  { value: 'name', label: 'Team Name' },
  { value: 'score', label: 'Score' },
  { value: 'members', label: 'Member Count' },
  { value: 'attendance', label: 'Attendance Rate' },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get progress bar color based on score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-blue-500';
  if (score >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Get grade badge styling
 */
function getGradeStyle(grade: string): { bg: string; text: string } {
  // Handle grade variants (A+, A, A-, B+, etc.)
  const baseGrade = grade.charAt(0);
  switch (baseGrade) {
    case 'A':
      return { bg: 'bg-green-100', text: 'text-green-700' };
    case 'B':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'C':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'D':
    case 'F':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'N': // N/A - no data
      return { bg: 'bg-gray-100', text: 'text-gray-500' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
}

/**
 * Get trend display info
 */
function getTrendDisplay(trend: 'up' | 'down' | 'stable', delta: number) {
  switch (trend) {
    case 'up':
      return { icon: TrendingUp, color: 'text-green-600', label: `+${delta.toFixed(1)}` };
    case 'down':
      return { icon: TrendingDown, color: 'text-red-600', label: delta.toFixed(1) };
    default:
      return { icon: Minus, color: 'text-gray-400', label: 'Stable' };
  }
}

/**
 * Get status label based on score and grade
 */
function getStatusLabel(score: number, grade?: string): { label: string; color: string } {
  // Handle N/A grade (no data)
  if (grade === 'N/A') return { label: 'No Data', color: 'text-gray-500' };
  if (score >= 90) return { label: 'Excellent', color: 'text-green-600' };
  if (score >= 80) return { label: 'Good', color: 'text-blue-600' };
  if (score >= 70) return { label: 'Fair', color: 'text-yellow-600' };
  return { label: 'Needs Attention', color: 'text-red-600' };
}

// ===========================================
// COMPONENTS
// ===========================================

/**
 * Individual team card - Clean design
 */
function TeamCard({ team, onClick }: { team: TeamGradeSummary; onClick: () => void }) {
  const gradeStyle = getGradeStyle(team.grade);
  const trendDisplay = getTrendDisplay(team.trend, team.scoreDelta);
  const TrendIcon = trendDisplay.icon;
  const scoreColor = getScoreColor(team.score);
  const status = getStatusLabel(team.score, team.grade);
  const isNoData = team.grade === 'N/A';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            {team.name}
          </h3>
          <p className="text-sm text-gray-500">{team.memberCount} members</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Score Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-medium ${status.color}`}>
            {isNoData ? 'No Data Yet' : `${team.score}% Score`}
          </span>
          {!isNoData && (
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-3.5 w-3.5 ${trendDisplay.color}`} />
              <span className={`text-xs font-medium ${trendDisplay.color}`}>{trendDisplay.label}</span>
            </div>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${isNoData ? 'bg-gray-300' : scoreColor} rounded-full transition-all duration-500`}
            style={{ width: `${isNoData ? 100 : team.score}%` }}
          />
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
        {isNoData ? (
          <span className="text-gray-400 italic">Awaiting first check-ins from team members</span>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-600">{team.breakdown.green} Checked In</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-600">{team.breakdown.absent} Absent</span>
            </div>
            {team.breakdown.excused > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-600">{team.breakdown.excused} Excused</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Attendance</p>
            <p className="text-sm font-semibold text-gray-900">{isNoData ? '—' : `${team.attendanceRate}%`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Checked In</p>
            <p className="text-sm font-semibold text-gray-900">
              {isNoData ? '—' : `${team.breakdown.green} / ${team.memberCount}`}
            </p>
          </div>
        </div>
      </div>

      {/* Footer - Leader & Grade */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Team Leader */}
        <div className="flex items-center gap-2">
          {team.leader ? (
            <>
              <Avatar
                src={team.leader.avatar}
                firstName={team.leader.name.split(' ')[0]}
                lastName={team.leader.name.split(' ').slice(1).join(' ')}
                size="xs"
              />
              <span className="text-sm text-gray-600 truncate max-w-[100px]">{team.leader.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400 italic">No leader</span>
          )}
        </div>

        {/* Grade Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className={`px-2.5 py-1 rounded-lg ${gradeStyle.bg}`}>
            <span className={`text-sm font-bold ${gradeStyle.text}`}>
              {isNoData ? 'New Team' : `Grade ${team.grade}`}
            </span>
          </div>
          {!isNoData && team.includedMemberCount !== undefined && team.includedMemberCount < team.memberCount && (
            <span className="text-xs text-gray-400">
              based on {team.includedMemberCount} of {team.memberCount}
            </span>
          )}
        </div>
      </div>

      {/* At Risk Warning */}
      {team.atRiskCount > 0 && (
        <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-medium">{team.atRiskCount} member{team.atRiskCount > 1 ? 's' : ''} need attention</span>
        </div>
      )}
    </div>
  );
}

// ===========================================
// MAIN PAGE COMPONENT
// ===========================================

export function TeamsOverviewPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<TeamsOverviewParams>({
    days: 30,
    sort: 'grade',
    order: 'asc',
  });
  const [_showFilters, _setShowFilters] = useState(false);

  // Fetch teams overview
  const { data, isLoading, error } = useQuery({
    queryKey: ['teams-overview', params],
    queryFn: () => analyticsService.getTeamsOverview(params),
  });

  // Navigate to team analytics on click
  const handleTeamClick = (teamId: string) => {
    navigate(`/executive/team-analytics/${teamId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams Overview</h1>
          {data && (
            <p className="text-gray-500 mt-1">
              Showing {data.teams.length} of {data.summary.totalTeams} teams
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Period Dropdown */}
          <div className="relative">
            <select
              value={params.days}
              onChange={(e) => setParams((p) => ({ ...p, days: Number(e.target.value) }))}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Last {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={params.sort}
              onChange={(e) => setParams((p) => ({ ...p, sort: e.target.value as TeamsOverviewParams['sort'] }))}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <SkeletonDashboard />}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Failed to load teams overview</p>
          <p className="text-sm text-red-500 mt-1">Please try again later</p>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Teams"
              value={data.summary.totalTeams}
              subtext={`${data.summary.totalMembers} total members`}
              icon={Users}
              color="primary"
            />
            <StatCard
              label="Average Score"
              value={`${data.summary.avgScore}%`}
              subtext={`Grade ${data.summary.avgGrade}`}
              icon={TrendingUp}
              color={data.summary.avgScore >= 80 ? 'success' : data.summary.avgScore >= 70 ? 'warning' : 'danger'}
            />
            <StatCard
              label="Needs Attention"
              value={data.summary.teamsAtRisk}
              subtext="Grade C or D teams"
              icon={AlertTriangle}
              color={data.summary.teamsAtRisk > 0 ? 'danger' : 'success'}
            />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500 mb-3">Trends</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">Improving</span>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{data.summary.teamsImproving}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-gray-600">Declining</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{data.summary.teamsDeclining}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Teams Grid */}
          {data.teams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Teams Found</h2>
              <p className="text-gray-500">There are no active teams to display</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {data.teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onClick={() => handleTeamClick(team.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
