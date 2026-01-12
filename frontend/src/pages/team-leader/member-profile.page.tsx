import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  teamService,
  type MemberCheckin,
  type MemberExemption,
  type MemberIncident,
  type TeamWithStats,
} from '../../services/team.service';
import { ReadinessTrendChart } from '../../components/charts/ReadinessTrendChart';
import { StatusDistributionChart } from '../../components/charts/StatusDistributionChart';
import { MetricsAverageChart } from '../../components/charts/MetricsAverageChart';
import { userService } from '../../services/user.service';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDisplayDate, formatTime, formatDisplayDateTime } from '../../lib/date-utils';
import { cn } from '../../lib/utils';
import { getExceptionTypeLabel } from '../../services/exemption.service';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Flame,
  Calendar,
  Mail,
  Phone,
  Shield,
  UserMinus,
  UserPlus,
  ArrowRightLeft,
  Smile,
  Brain,
  Moon,
  Heart,
  Loader2,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  BarChart3,
} from 'lucide-react';

export function MemberProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'checkins' | 'exemptions' | 'incidents'>('overview');
  const [checkinPage, setCheckinPage] = useState(1);
  const [checkinFilter, setCheckinFilter] = useState<'all' | 'GREEN' | 'YELLOW' | 'RED'>('all');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Get member profile
  const { data: member, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['member-profile', userId],
    queryFn: () => teamService.getMemberProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes - avoid refetching on tab switches
  });

  // Get all teams for transfer dropdown (forTransfer: true allows Team Leads to see all company teams)
  const { data: allTeamsData } = useQuery({
    queryKey: ['all-teams-for-transfer'],
    queryFn: () => teamService.getAll({ forTransfer: true }),
    enabled: showTransferModal,
  });

  // Get member check-ins (paginated)
  const { data: checkinsData, isLoading: checkinsLoading } = useQuery({
    queryKey: ['member-checkins', userId, checkinPage, checkinFilter],
    queryFn: () =>
      teamService.getMemberCheckins(userId!, {
        page: checkinPage,
        limit: 15,
        status: checkinFilter === 'all' ? undefined : checkinFilter,
      }),
    enabled: !!userId && activeTab === 'checkins',
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Get member exemptions
  const { data: exemptionsData, isLoading: exemptionsLoading } = useQuery({
    queryKey: ['member-exemptions', userId],
    queryFn: () => teamService.getMemberExemptions(userId!),
    enabled: !!userId && activeTab === 'exemptions',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get member incidents
  const { data: incidentsData, isLoading: incidentsLoading } = useQuery({
    queryKey: ['member-incidents', userId],
    queryFn: () => teamService.getMemberIncidents(userId!),
    enabled: !!userId && activeTab === 'incidents',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get member analytics for charts (30 days to match UI label)
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['member-analytics', userId],
    queryFn: () => teamService.getMemberAnalytics(userId!, 30),
    enabled: !!userId && activeTab === 'overview',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Use latest check-in from profile data (no separate API call needed)
  const latestCheckin = member?.recentCheckins?.[0];

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => userService.deactivate(id),
    onSuccess: () => {
      toast.success('Member deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      setShowDeactivateModal(false);
    },
    onError: () => {
      toast.error('Failed to deactivate member');
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => userService.reactivate(id),
    onSuccess: () => {
      toast.success('Member reactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      setShowReactivateModal(false);
    },
    onError: () => {
      toast.error('Failed to reactivate member');
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({ odUserId, teamId }: { odUserId: string; teamId: string }) =>
      userService.update(odUserId, { teamId }),
    onSuccess: () => {
      toast.success('Member transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      navigate('/team/members');
    },
    onError: () => {
      toast.error('Failed to transfer member');
    },
  });

  const allTeams: TeamWithStats[] = allTeamsData?.data || [];
  const otherTeams = allTeams.filter((t) => t.id !== member?.teamId);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'GREEN':
        return {
          label: 'Ready',
          emoji: '😊',
          icon: CheckCircle2,
          bg: 'bg-success-50',
          text: 'text-success-700',
          border: 'border-success-200',
        };
      case 'YELLOW':
        return {
          label: 'Limited',
          emoji: '😐',
          icon: AlertCircle,
          bg: 'bg-warning-50',
          text: 'text-warning-700',
          border: 'border-warning-200',
        };
      case 'RED':
        return {
          label: 'Not Ready',
          emoji: '😰',
          icon: XCircle,
          bg: 'bg-danger-50',
          text: 'text-danger-700',
          border: 'border-danger-200',
        };
      default:
        return {
          label: 'Unknown',
          emoji: '😐',
          icon: AlertCircle,
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
        };
    }
  };

  const getMetricColor = (value: number, inverted = false) => {
    if (inverted) {
      if (value <= 3) return 'text-success-600';
      if (value <= 6) return 'text-warning-600';
      return 'text-danger-600';
    }
    if (value <= 3) return 'text-danger-600';
    if (value <= 6) return 'text-warning-600';
    return 'text-success-600';
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (profileError || !member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Member Not Found</h2>
        <p className="text-gray-500 mb-4">The member you're looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => navigate('/team/members')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Team Members
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/team/members')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {member.firstName.charAt(0)}
                  {member.lastName.charAt(0)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">
                  {member.firstName} {member.lastName}
                </h1>
                {member.isOnLeave && (
                  <Badge variant="warning" className="bg-warning-400/20 text-warning-100 border-warning-400/30">
                    On Leave
                  </Badge>
                )}
                {!member.isActive && (
                  <Badge variant="danger" className="bg-danger-400/20 text-danger-100 border-danger-400/30">
                    Inactive
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-100">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </span>
                {member.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {member.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {member.teamJoinedAt ? formatDisplayDate(member.teamJoinedAt) : 'N/A'}
                </span>
              </div>

              {member.team && (
                <p className="text-sm text-primary-200 mt-2">
                  Team: {member.team.name}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 sm:flex-col">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTransferModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </Button>
              {member.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeactivateModal(true)}
                  className="bg-white/10 hover:bg-danger-500/30 text-white border-0"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReactivateModal(true)}
                  className="bg-white/10 hover:bg-success-500/30 text-white border-0"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              <span className="text-2xl font-bold text-gray-900">{member.stats.attendanceScore}%</span>
            </div>
            <p className="text-xs text-gray-500">Attendance Score</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-gray-900">{member.currentStreak}</span>
            </div>
            <p className="text-xs text-gray-500">Current Streak</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-success-500" />
              <span className="text-2xl font-bold text-gray-900">{member.stats.totalCheckins}</span>
            </div>
            <p className="text-xs text-gray-500">Total Check-ins</p>
          </div>
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900">{member.longestStreak}</span>
            </div>
            <p className="text-xs text-gray-500">Best Streak</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab Headers - Scrollable on mobile */}
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex-1 min-w-0 py-3 md:py-4 text-xs md:text-sm font-medium transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4',
              activeTab === 'overview'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <BarChart3 className="h-5 w-5 md:h-4 md:w-4" />
            <span className="truncate">Overview</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('checkins');
              setCheckinPage(1);
            }}
            className={cn(
              'flex-1 min-w-0 py-3 md:py-4 text-xs md:text-sm font-medium transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 relative',
              activeTab === 'checkins'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="relative">
              <CheckCircle2 className="h-5 w-5 md:h-4 md:w-4" />
              {member.stats.totalCheckins > 0 && (
                <span className="absolute -top-1 -right-1 md:hidden h-4 w-4 text-[10px] rounded-full bg-primary-500 text-white flex items-center justify-center">
                  {member.stats.totalCheckins > 99 ? '99+' : member.stats.totalCheckins}
                </span>
              )}
            </div>
            <span className="truncate">Check-ins</span>
            <span className="hidden md:inline px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {member.stats.totalCheckins}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('exemptions')}
            className={cn(
              'flex-1 min-w-0 py-3 md:py-4 text-xs md:text-sm font-medium transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4',
              activeTab === 'exemptions'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="relative">
              <Shield className="h-5 w-5 md:h-4 md:w-4" />
              {member.stats.exemptionsCount > 0 && (
                <span className="absolute -top-1 -right-1 md:hidden h-4 w-4 text-[10px] rounded-full bg-warning-500 text-white flex items-center justify-center">
                  {member.stats.exemptionsCount > 99 ? '99+' : member.stats.exemptionsCount}
                </span>
              )}
            </div>
            <span className="truncate">Exemptions</span>
            <span className="hidden md:inline px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {member.stats.exemptionsCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={cn(
              'flex-1 min-w-0 py-3 md:py-4 text-xs md:text-sm font-medium transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4',
              activeTab === 'incidents'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="relative">
              <AlertTriangle className="h-5 w-5 md:h-4 md:w-4" />
              {member.stats.incidentsCount > 0 && (
                <span className="absolute -top-1 -right-1 md:hidden h-4 w-4 text-[10px] rounded-full bg-danger-500 text-white flex items-center justify-center">
                  {member.stats.incidentsCount > 99 ? '99+' : member.stats.incidentsCount}
                </span>
              )}
            </div>
            <span className="truncate">Incidents</span>
            <span className="hidden md:inline px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {member.stats.incidentsCount}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size="md" />
                </div>
              ) : analyticsData ? (
                <div className="space-y-6">
                  {/* Current Status Card */}
                  {latestCheckin && (() => {
                    const statusConfig = getStatusConfig(latestCheckin.readinessStatus);
                    return (
                      <Card className={`border-2 ${statusConfig.border} ${statusConfig.bg} transition-all duration-300 hover:shadow-lg`}>
                        <CardContent className="py-6">
                          <div className="flex items-center gap-4">
                            <div className={`h-16 w-16 rounded-2xl ${statusConfig.bg} flex items-center justify-center shadow-lg relative overflow-hidden`}>
                              <span className="text-4xl animate-bounce-slow relative z-10">{statusConfig.emoji}</span>
                              <div className={`absolute inset-0 ${statusConfig.bg} opacity-20 animate-pulse`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={latestCheckin.readinessStatus === 'GREEN' ? 'success' : latestCheckin.readinessStatus === 'YELLOW' ? 'warning' : 'danger'}>
                                  {statusConfig.label}
                                </Badge>
                                <span className="text-3xl font-bold text-gray-900 animate-fade-in">{latestCheckin.readinessScore}%</span>
                              </div>
                              <p className="text-sm text-gray-500 flex items-center gap-1 animate-fade-in">
                                <Clock className="h-4 w-4" />
                                Last check-in: {formatDisplayDateTime(latestCheckin.createdAt)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Summary Card */}
                  <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 border border-primary-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-primary-600 font-medium">30-Day Average Readiness</p>
                        <p className="text-3xl font-bold text-primary-700">
                          {(analyticsData.avgReadinessScore ?? 0).toFixed(0)}%
                        </p>
                      </div>
                      <div className="h-14 w-14 rounded-full bg-primary-500/10 flex items-center justify-center">
                        <TrendingUp className="h-7 w-7 text-primary-600" />
                      </div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Readiness Trend Chart */}
                    <Card className="p-6">
                      <ReadinessTrendChart data={analyticsData.trendData || []} height={240} />
                    </Card>

                    {/* Right Column - Status & Metrics */}
                    <div className="space-y-6">
                      {/* Status Distribution */}
                      <Card className="p-6">
                        <StatusDistributionChart data={analyticsData.statusCounts || { green: 0, yellow: 0, red: 0 }} size={140} />
                      </Card>

                      {/* Average Metrics */}
                      <Card className="p-6">
                        <MetricsAverageChart data={analyticsData.avgMetrics || { mood: 0, stress: 0, sleep: 0, physicalHealth: 0 }} />
                      </Card>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-medium">No analytics data available</p>
                  <p className="text-sm text-gray-500 mt-1">Check-in data is required to generate analytics</p>
                </div>
              )}
            </div>
          )}

          {/* Check-ins Tab */}
          {activeTab === 'checkins' && (
            <div>
              {/* Filter Bar */}
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500">Filter:</span>
                  {(['all', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setCheckinFilter(status);
                        setCheckinPage(1);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        checkinFilter === status
                          ? status === 'all'
                            ? 'bg-gray-900 text-white'
                            : status === 'GREEN'
                            ? 'bg-success-500 text-white'
                            : status === 'YELLOW'
                            ? 'bg-warning-500 text-white'
                            : 'bg-danger-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {status === 'all' ? 'All' : status === 'GREEN' ? 'Ready' : status === 'YELLOW' ? 'Limited' : 'Not Ready'}
                    </button>
                  ))}
                </div>
              </div>

              {checkinsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size="md" />
                </div>
              ) : checkinsData?.data && checkinsData.data.length > 0 ? (
                <>
                  {/* Check-ins Table */}
                  <div className="divide-y divide-gray-100">
                    {/* Header - Desktop */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Time</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-4 text-center">Metrics</div>
                      <div className="col-span-2 text-center">Score</div>
                    </div>

                    {checkinsData.data.map((checkin: MemberCheckin) => {
                      const config = getStatusConfig(checkin.readinessStatus);
                      const StatusIcon = config.icon;

                      return (
                        <div
                          key={checkin.id}
                          className="grid grid-cols-2 lg:grid-cols-12 gap-4 px-4 lg:px-6 py-4 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Date */}
                          <div className="col-span-1 lg:col-span-2 flex items-center">
                            <span className="text-sm font-medium text-gray-900">
                              {formatDisplayDate(checkin.createdAt)}
                            </span>
                          </div>

                          {/* Time - Desktop */}
                          <div className="hidden lg:flex lg:col-span-2 items-center">
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTime(checkin.createdAt)}
                            </span>
                          </div>

                          {/* Status */}
                          <div className="col-span-1 lg:col-span-2 flex items-center justify-end lg:justify-center">
                            <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium', config.bg, config.text)}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{config.label}</span>
                            </div>
                          </div>

                          {/* Metrics - Desktop */}
                          <div className="hidden lg:flex lg:col-span-4 items-center justify-center gap-6">
                            <div className="text-center">
                              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-1">
                                <Smile className="h-4 w-4 text-blue-600" />
                              </div>
                              <p className={cn('text-sm font-bold', getMetricColor(checkin.mood))}>{checkin.mood}</p>
                            </div>
                            <div className="text-center">
                              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-1">
                                <Brain className="h-4 w-4 text-purple-600" />
                              </div>
                              <p className={cn('text-sm font-bold', getMetricColor(checkin.stress, true))}>{checkin.stress}</p>
                            </div>
                            <div className="text-center">
                              <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-1">
                                <Moon className="h-4 w-4 text-indigo-600" />
                              </div>
                              <p className={cn('text-sm font-bold', getMetricColor(checkin.sleep))}>{checkin.sleep}</p>
                            </div>
                            <div className="text-center">
                              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-1">
                                <Heart className="h-4 w-4 text-red-600" />
                              </div>
                              <p className={cn('text-sm font-bold', getMetricColor(checkin.physicalHealth))}>{checkin.physicalHealth}</p>
                            </div>
                          </div>

                          {/* Score - Desktop */}
                          <div className="hidden lg:flex lg:col-span-2 items-center justify-center">
                            <span
                              className={cn(
                                'text-lg font-bold',
                                checkin.readinessScore >= 70
                                  ? 'text-success-600'
                                  : checkin.readinessScore >= 40
                                  ? 'text-warning-600'
                                  : 'text-danger-600'
                              )}
                            >
                              {checkin.readinessScore}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {checkinsData.pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                      <Pagination
                        currentPage={checkinPage}
                        totalPages={checkinsData.pagination.totalPages}
                        totalItems={checkinsData.pagination.total}
                        pageSize={15}
                        onPageChange={setCheckinPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-medium">No check-ins found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {checkinFilter !== 'all' ? 'Try changing the filter' : 'No check-in records available'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Exemptions Tab */}
          {activeTab === 'exemptions' && (
            <div>
              {exemptionsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size="md" />
                </div>
              ) : exemptionsData?.data && exemptionsData.data.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {/* Header - Desktop */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-3">Type</div>
                    <div className="col-span-3">Date Range</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-center">Category</div>
                    <div className="col-span-2">Reviewed By</div>
                  </div>

                  {exemptionsData.data.map((exemption: MemberExemption) => (
                    <div
                      key={exemption.id}
                      className="grid grid-cols-2 md:grid-cols-12 gap-4 px-4 md:px-6 py-4 hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Type */}
                      <div className="col-span-1 md:col-span-3 flex items-center">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {getExceptionTypeLabel(exemption.type)}
                          </span>
                        </div>
                      </div>

                      {/* Date Range - Desktop */}
                      <div className="hidden md:flex md:col-span-3 items-center">
                        <span className="text-sm text-gray-500">
                          {exemption.startDate && exemption.endDate
                            ? `${formatDisplayDate(exemption.startDate)} - ${formatDisplayDate(exemption.endDate)}`
                            : formatDisplayDate(exemption.createdAt)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-end md:justify-center">
                        <Badge
                          variant={
                            exemption.status === 'APPROVED'
                              ? 'success'
                              : exemption.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {exemption.status}
                        </Badge>
                      </div>

                      {/* Category - Desktop */}
                      <div className="hidden md:flex md:col-span-2 items-center justify-center">
                        {exemption.isExemption ? (
                          <Badge variant="primary" className="text-xs">Exemption</Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Leave</Badge>
                        )}
                      </div>

                      {/* Reviewed By - Desktop */}
                      <div className="hidden md:flex md:col-span-2 items-center">
                        {exemption.reviewedBy ? (
                          <span className="text-sm text-gray-500">
                            {exemption.reviewedBy.firstName} {exemption.reviewedBy.lastName}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-medium">No exemptions found</p>
                  <p className="text-sm text-gray-500 mt-1">No leave or exemption records available</p>
                </div>
              )}
            </div>
          )}

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <div>
              {incidentsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size="md" />
                </div>
              ) : incidentsData?.data && incidentsData.data.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {/* Header - Desktop */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4">Title</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2 text-center">Severity</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2">Location</div>
                  </div>

                  {incidentsData.data.map((incident: MemberIncident) => (
                    <Link
                      key={incident.id}
                      to={`/incidents/${incident.id}`}
                      className="grid grid-cols-2 md:grid-cols-12 gap-4 px-4 md:px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      {/* Title */}
                      <div className="col-span-1 md:col-span-4 flex items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {incident.title}
                          </span>
                        </div>
                      </div>

                      {/* Date - Desktop */}
                      <div className="hidden md:flex md:col-span-2 items-center">
                        <span className="text-sm text-gray-500">
                          {formatDisplayDate(incident.createdAt)}
                        </span>
                      </div>

                      {/* Severity */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-end md:justify-center">
                        <Badge
                          variant={
                            incident.severity === 'CRITICAL'
                              ? 'danger'
                              : incident.severity === 'HIGH'
                              ? 'warning'
                              : incident.severity === 'MEDIUM'
                              ? 'primary'
                              : 'default'
                          }
                        >
                          {incident.severity}
                        </Badge>
                      </div>

                      {/* Status - Desktop */}
                      <div className="hidden md:flex md:col-span-2 items-center justify-center">
                        <Badge
                          variant={
                            incident.status === 'RESOLVED' || incident.status === 'CLOSED'
                              ? 'success'
                              : incident.status === 'IN_PROGRESS'
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {incident.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Location - Desktop */}
                      <div className="hidden md:flex md:col-span-2 items-center">
                        <span className="text-sm text-gray-500 truncate">
                          {incident.location || '-'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-medium">No incidents reported</p>
                  <p className="text-sm text-gray-500 mt-1">This member hasn't reported any incidents</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTransferModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-slide-up">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Transfer Member</h2>
              <p className="text-sm text-gray-500 mb-6">
                Transfer {member.firstName} {member.lastName} to another team. This will remove them from your team.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Destination Team
                  </label>
                  <div className="relative">
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                    >
                      <option value="">Select a team...</option>
                      {otherTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.memberCount} members)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    transferMutation.mutate({
                      odUserId: userId!,
                      teamId: selectedTeamId,
                    })
                  }
                  disabled={!selectedTeamId || transferMutation.isPending}
                >
                  {transferMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                  )}
                  Transfer Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={() => deactivateMutation.mutate(userId!)}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate ${member.firstName} ${member.lastName}? They will no longer be able to access the system.`}
        confirmText="Deactivate"
        type="danger"
        action="remove"
        isLoading={deactivateMutation.isPending}
      />

      {/* Reactivate Confirmation Modal */}
      <ConfirmModal
        isOpen={showReactivateModal}
        onClose={() => setShowReactivateModal(false)}
        onConfirm={() => reactivateMutation.mutate(userId!)}
        title="Reactivate Member"
        message={`Are you sure you want to reactivate ${member.firstName} ${member.lastName}? They will regain access to the system.`}
        confirmText="Reactivate"
        type="info"
        action="custom"
        isLoading={reactivateMutation.isPending}
      />
    </div>
  );
}
