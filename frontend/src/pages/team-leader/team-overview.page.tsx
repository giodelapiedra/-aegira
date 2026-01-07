import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  UserPlus,
  UserMinus,
  X,
  Building2,
  Calendar,
  Flame,
  Timer,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import { useUser } from '../../hooks/useUser';
import { getNextWorkDay } from '../../lib/schedule-utils';
import { DAY_INDEX_TO_CODE } from '../../lib/constants';
import { getNowInTimezone, createDateWithTimeInTimezone } from '../../lib/date-utils';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
  currentStreak?: number;
  longestStreak?: number;
  checkinCount?: number;
}

interface TeamStats {
  totalMembers: number;
  checkedIn: number;
  notCheckedIn: number;
  isWorkDay?: boolean;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingExceptions: number;
  openIncidents: number;
  checkinRate: number;
}

interface TodayCheckin {
  id: string;
  userId: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface AvailableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  teamId: string | null;
}

export function TeamOverviewPage() {
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const toast = useToast();

  // Get user's team
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['my-team'],
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - team data rarely changes
  });

  // Check if current user is the team leader
  const isTeamLeader = team?.leader?.id === currentUser?.id;

  // Get team stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['team-stats', team?.id],
    queryFn: async () => {
      const response = await api.get(`/teams/${team.id}/stats`);
      return response.data as TeamStats;
    },
    enabled: !!team?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Get today's check-ins for team
  const { data: checkinsData } = useQuery({
    queryKey: ['team-checkins', team?.id],
    queryFn: async () => {
      const response = await api.get(`/checkins?teamId=${team.id}&limit=50`);
      return response.data;
    },
    enabled: !!team?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch available users (MEMBER role only, not in any team)
  const { data: usersData } = useQuery({
    queryKey: ['available-users'],
    queryFn: async () => {
      const response = await api.get('/users?limit=100');
      return response.data;
    },
    enabled: showAddMemberModal && isTeamLeader,
    staleTime: 60 * 1000, // 1 minute
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/teams/${team.id}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['available-users'] });
      toast.success('Member Added', 'The member has been added to the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to add member. Please try again.');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/teams/${team.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['available-users'] });
      setShowRemoveMemberConfirm(false);
      setSelectedMember(null);
      toast.success('Member Removed', 'The member has been removed from the team.');
    },
    onError: () => {
      toast.error('Error', 'Failed to remove member. Please try again.');
    },
  });

  const todayCheckins: TodayCheckin[] = checkinsData?.data || [];
  const members: TeamMember[] = team?.members || [];

  // Filter available users - only MEMBER/WORKER role and not already in this team
  const availableUsers: AvailableUser[] = (usersData?.data || []).filter(
    (user: AvailableUser) =>
      (user.role === 'MEMBER' || user.role === 'WORKER') &&
      !members.some((member) => member.id === user.id)
  );

  // Create a map of userId to their check-in
  const checkinMap = new Map(todayCheckins.map((c) => [c.userId, c]));

  // Calculate next check-in time for team members based on team schedule
  const getNextCheckinInfo = () => {
    if (!team?.shiftStart || !team?.workDays || !team?.shiftEnd) return null;

    // Use company timezone if available, otherwise use browser timezone
    const timezone = team.company?.timezone || 'Asia/Manila';
    const nowInTz = getNowInTimezone(timezone);
    const now = nowInTz.date;

    // Get today's date components in company timezone
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayParts = dateFormatter.formatToParts(now);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')!.value);
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')!.value) - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')!.value);

    // Helper to get day code in company timezone
    const getDayCodeInTimezone = (date: Date): string => {
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });
      const dayStr = dayFormatter.format(date);
      const dayMap: Record<string, string> = {
        'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED',
        'Thu': 'THU', 'Fri': 'FRI', 'Sat': 'SAT'
      };
      return dayMap[dayStr] || 'SUN';
    };

    const todayCode = DAY_INDEX_TO_CODE[nowInTz.dayOfWeek];
    const workDays = team.workDays.split(',').map((d: string) => d.trim().toUpperCase());

    // Check if today is a work day
    const todayIsWorkDay = workDays.includes(todayCode);

    // Create today's date at noon UTC (for passing to createDateWithTimeInTimezone)
    const todayDateUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 12, 0, 0));

    if (todayIsWorkDay) {
      // Create shift times in company timezone
      const todayShiftEnd = createDateWithTimeInTimezone(team.shiftEnd, todayDateUTC, timezone);

      // Grace period: 30 minutes before shift start
      const [shiftHours, shiftMinutes] = team.shiftStart.split(':').map(Number);
      const graceMinutes = shiftMinutes - 30;
      const graceHours = graceMinutes < 0 ? shiftHours - 1 : shiftHours;
      const finalGraceMinutes = graceMinutes < 0 ? graceMinutes + 60 : graceMinutes;
      const graceTimeString = `${String(graceHours).padStart(2, '0')}:${String(finalGraceMinutes).padStart(2, '0')}`;
      const graceStart = createDateWithTimeInTimezone(graceTimeString, todayDateUTC, timezone);

      // If we're before grace period, next check-in is today's grace start
      if (now < graceStart) {
        return {
          date: graceStart,
          isToday: true,
        };
      }

      // If we're within check-in window (grace period to shift end), next is tomorrow's shift
      if (now >= graceStart && now <= todayShiftEnd) {
        // Check if tomorrow is a work day first (using company timezone)
        const tomorrowDateUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
        const tomorrowCode = getDayCodeInTimezone(tomorrowDateUTC);

        if (workDays.includes(tomorrowCode)) {
          // Tomorrow is a work day, use tomorrow
          const nextCheckinTime = createDateWithTimeInTimezone(team.shiftStart, tomorrowDateUTC, timezone);
          return {
            date: nextCheckinTime,
            isToday: false,
          };
        } else {
          // Tomorrow is not a work day, find next work day
          const nextWorkDay = getNextWorkDay(team.workDays, tomorrowDateUTC);
          const nextCheckinTime = createDateWithTimeInTimezone(team.shiftStart, nextWorkDay, timezone);
          return {
            date: nextCheckinTime,
            isToday: false,
          };
        }
      }

      // If we're after shift end today, next is next work day
      if (now > todayShiftEnd) {
        // Check if tomorrow is a work day first (using company timezone)
        const tomorrowDateUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay + 1, 12, 0, 0));
        const tomorrowCode = getDayCodeInTimezone(tomorrowDateUTC);

        if (workDays.includes(tomorrowCode)) {
          // Tomorrow is a work day, use tomorrow
          const nextCheckinTime = createDateWithTimeInTimezone(team.shiftStart, tomorrowDateUTC, timezone);
          return {
            date: nextCheckinTime,
            isToday: false,
          };
        } else {
          // Tomorrow is not a work day, find next work day
          const nextWorkDay = getNextWorkDay(team.workDays, tomorrowDateUTC);
          const nextCheckinTime = createDateWithTimeInTimezone(team.shiftStart, nextWorkDay, timezone);
          return {
            date: nextCheckinTime,
            isToday: false,
          };
        }
      }
    }

    // Today is not a work day, find next work day
    const nextWorkDay = getNextWorkDay(team.workDays);
    const nextCheckinTime = createDateWithTimeInTimezone(team.shiftStart, nextWorkDay, timezone);
    return {
      date: nextCheckinTime,
      isToday: false,
    };
  };

  const nextCheckinInfo = getNextCheckinInfo();

  // Calculate time until next check-in (updates every minute)
  const [timeUntil, setTimeUntil] = useState<string>('');

  useEffect(() => {
    if (!nextCheckinInfo) {
      setTimeUntil('');
      return;
    }

    const updateTimeUntil = () => {
      // Use company timezone for current time calculation
      const timezone = team?.company?.timezone || 'Asia/Manila';
      const nowInTz = getNowInTimezone(timezone);
      const now = nowInTz.date;
      const diffMs = nextCheckinInfo.date.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeUntil('Now');
        return;
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;

      if (diffDays > 0) {
        setTimeUntil(`${diffDays}d ${remainingHours}h`);
      } else if (diffHours > 0) {
        setTimeUntil(`${diffHours}h ${diffMins}m`);
      } else {
        setTimeUntil(`${diffMins}m`);
      }
    };

    updateTimeUntil();
    const interval = setInterval(updateTimeUntil, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nextCheckinInfo]);

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Users className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Team Assigned</h2>
        <p className="text-gray-500">You are not currently assigned to a team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-1.5 text-sm text-primary-600 mb-1">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">{team.company?.name || 'Company'}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        <p className="text-gray-500 mt-1">
          {members.length} team members
        </p>

        {/* Team Schedule */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Work Schedule</span>
            </div>
            {team?.company?.timezone && (
              <span className="text-xs text-gray-500">
                Timezone: {team.company.timezone}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {/* Work Days */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Work Days</p>
              <div className="flex gap-1">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => {
                  const workDays = team.workDays?.split(',') || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                  const isActive = workDays.includes(day);
                  return (
                    <span
                      key={day}
                      className={cn(
                        'w-8 h-8 flex items-center justify-center text-xs font-medium rounded-lg',
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {day.charAt(0)}
                    </span>
                  );
                })}
              </div>
            </div>
            {/* Shift Times */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Shift Hours</p>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  {(() => {
                    // Format shift times in company timezone
                    const timezone = team?.company?.timezone || 'Asia/Manila';
                    const shiftStart = team.shiftStart || '08:00';
                    const shiftEnd = team.shiftEnd || '17:00';
                    
                    // Create a date object for today in the company timezone
                    const todayInTz = getNowInTimezone(timezone);
                    const todayDate = new Date(todayInTz.date);
                    todayDate.setHours(0, 0, 0, 0);
                    
                    // Create shift start and end times in company timezone
                    const startTime = createDateWithTimeInTimezone(shiftStart, todayDate, timezone);
                    const endTime = createDateWithTimeInTimezone(shiftEnd, todayDate, timezone);
                    
                    // Format for display in company timezone
                    const startFormatted = startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: timezone,
                    });
                    const endFormatted = endTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: timezone,
                    });
                    
                    return `${startFormatted} - ${endFormatted}`;
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Next Check-in */}
          {nextCheckinInfo && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Timer className="h-4 w-4" />
                <span className="font-medium">Next Check-in</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-primary-50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Upcoming</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {nextCheckinInfo.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          timeZone: team?.company?.timezone || 'Asia/Manila',
                        })}{' '}
                        at {nextCheckinInfo.date.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: team?.company?.timezone || 'Asia/Manila',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">Time until</p>
                      <p className="text-sm font-bold text-primary-600">
                        {timeUntil || 'Calculating...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={stats?.totalMembers || members.length}
          icon={Users}
          color="primary"
          isLoading={statsLoading}
        />
        <StatCard
          label="Checked In Today"
          value={stats?.checkedIn || 0}
          icon={UserCheck}
          color="success"
          isLoading={statsLoading}
        />
        <StatCard
          label="Not Checked In"
          value={stats?.notCheckedIn || 0}
          icon={UserX}
          color="warning"
          isLoading={statsLoading}
        />
        <StatCard
          label="Check-in Rate"
          value={`${stats?.checkinRate || 0}%`}
          icon={TrendingUp}
          color="secondary"
          isLoading={statsLoading}
        />
      </div>

      {/* Readiness Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Readiness</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-success-50 rounded-xl">
            <div className="h-12 w-12 rounded-full bg-success-500 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-success-700">{stats?.greenCount || 0}</p>
            <p className="text-sm text-success-600">Ready (Green)</p>
          </div>
          <div className="text-center p-4 bg-warning-50 rounded-xl">
            <div className="h-12 w-12 rounded-full bg-warning-500 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-warning-700">{stats?.yellowCount || 0}</p>
            <p className="text-sm text-warning-600">Caution (Yellow)</p>
          </div>
          <div className="text-center p-4 bg-danger-50 rounded-xl">
            <div className="h-12 w-12 rounded-full bg-danger-500 flex items-center justify-center mx-auto mb-2">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-danger-700">{stats?.redCount || 0}</p>
            <p className="text-sm text-danger-600">At Risk (Red)</p>
          </div>
        </div>
      </div>

      {/* Pending Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending Exceptions</h3>
            <span className="bg-warning-100 text-warning-700 text-sm font-medium px-2.5 py-1 rounded-full">
              {stats?.pendingExceptions || 0}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {stats?.pendingExceptions
              ? `${stats.pendingExceptions} exception request(s) awaiting your approval`
              : 'No pending exception requests'}
          </p>
          {stats?.pendingExceptions ? (
            <a
              href="/team/approvals"
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-3"
            >
              View Approvals
              <Clock className="h-4 w-4" />
            </a>
          ) : null}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Open Incidents</h3>
            <span className="bg-danger-100 text-danger-700 text-sm font-medium px-2.5 py-1 rounded-full">
              {stats?.openIncidents || 0}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {stats?.openIncidents
              ? `${stats.openIncidents} incident(s) require attention`
              : 'No open incidents'}
          </p>
          {stats?.openIncidents ? (
            <a
              href="/team/incidents"
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-3"
            >
              View Incidents
              <AlertTriangle className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          {isTeamLeader && (
            <Button
              size="sm"
              onClick={() => setShowAddMemberModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add Member
            </Button>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {members.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No team members found</div>
          ) : (
            members.map((member) => {
              const checkin = checkinMap.get(member.id);
              return (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-white">
                        {member.firstName.charAt(0)}
                        {member.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        {/* Streak Indicator */}
                        {member.currentStreak && member.currentStreak > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0">
                            <Flame className="h-3 w-3" />
                            {member.currentStreak}
                          </span>
                        )}
                        {/* Check-in Count Indicator */}
                        {member.checkinCount !== undefined && member.checkinCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 flex-shrink-0">
                            <Activity className="h-3 w-3" />
                            {member.checkinCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {checkin ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                          checkin.readinessStatus === 'GREEN' &&
                            'bg-success-100 text-success-700',
                          checkin.readinessStatus === 'YELLOW' &&
                            'bg-warning-100 text-warning-700',
                          checkin.readinessStatus === 'RED' && 'bg-danger-100 text-danger-700'
                        )}
                      >
                        {checkin.readinessStatus === 'GREEN' && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {checkin.readinessStatus === 'YELLOW' && (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {checkin.readinessStatus === 'RED' && <Activity className="h-3 w-3" />}
                        {checkin.readinessStatus}
                      </span>
                    ) : (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        stats?.isWorkDay === false
                          ? 'bg-gray-50 text-gray-400'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        <Clock className="h-3 w-3" />
                        {stats?.isWorkDay === false ? 'Not a work day' : 'Not checked in'}
                      </span>
                    )}
                    {isTeamLeader && (member.role === 'MEMBER' || member.role === 'WORKER') && (
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRemoveMemberConfirm(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                        title="Remove from team"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && isTeamLeader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
                <p className="text-sm text-gray-500">Select members to add to your team</p>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No available members to add</p>
                  <p className="text-sm mt-1">All members are already in a team</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => addMemberMutation.mutate(user.id)}
                        disabled={addMemberMutation.isPending}
                        className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Add to team"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShowAddMemberModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      <ConfirmModal
        isOpen={showRemoveMemberConfirm && !!selectedMember}
        onClose={() => {
          setShowRemoveMemberConfirm(false);
          setSelectedMember(null);
        }}
        onConfirm={() => {
          if (selectedMember) {
            removeMemberMutation.mutate(selectedMember.id);
          }
        }}
        title="Remove Member?"
        message={
          <>
            Are you sure you want to remove{' '}
            <span className="font-medium">
              {selectedMember?.firstName} {selectedMember?.lastName}
            </span>{' '}
            from your team?
          </>
        }
        confirmText="Remove"
        type="danger"
        action="remove"
        isLoading={removeMemberMutation.isPending}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    secondary: 'bg-secondary-50 text-secondary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        {isLoading ? (
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}
