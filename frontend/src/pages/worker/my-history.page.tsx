import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkinService, LOW_SCORE_REASONS } from '../../services/checkin.service';
import type { AttendanceStatus, LowScoreReason } from '../../services/checkin.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date-utils';
import {
  History,
  Smile,
  Brain,
  Moon,
  Heart,
  Calendar,
  TrendingUp,
  BarChart3,
  Filter,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarX,
  MessageCircle,
} from 'lucide-react';

export function MyHistoryPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'GREEN' | 'YELLOW' | 'RED'>('all');
  const [activeTab, setActiveTab] = useState<'readiness' | 'attendance'>('readiness');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | AttendanceStatus>('all');
  const limit = 10;

  const { data: checkinsData, isLoading } = useQuery({
    queryKey: ['checkins', 'history', page, filter],
    queryFn: () => checkinService.getMyCheckins({
      page,
      limit,
      ...(filter !== 'all' && { status: filter }),
    }),
    enabled: activeTab === 'readiness',
  });

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance', 'history', attendanceFilter],
    queryFn: () => checkinService.getAttendanceHistory(
      60, // Last 60 days
      attendanceFilter !== 'all' ? attendanceFilter : undefined
    ),
    enabled: activeTab === 'attendance',
  });

  const { data: attendancePerformance } = useQuery({
    queryKey: ['attendance', 'performance'],
    queryFn: () => checkinService.getAttendancePerformance('all'),
    enabled: activeTab === 'attendance',
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'GREEN':
        return { variant: 'success' as const, label: 'Ready', bgColor: 'bg-success-50' };
      case 'YELLOW':
        return { variant: 'warning' as const, label: 'Limited', bgColor: 'bg-warning-50' };
      case 'RED':
        return { variant: 'danger' as const, label: 'Not Ready', bgColor: 'bg-danger-50' };
      default:
        return { variant: 'default' as const, label: 'Unknown', bgColor: 'bg-gray-50' };
    }
  };

  const getScoreColor = (value: number, inverted = false) => {
    if (inverted) {
      if (value <= 3) return 'text-success-600';
      
      if (value <= 6) return 'text-warning-600';
      return 'text-danger-600';
    }
    if (value <= 3) return 'text-danger-600';
    if (value <= 6) return 'text-warning-600';
    return 'text-success-600';
  };

  const getGradeConfig = (grade: string) => {
    switch (grade) {
      case 'A':
        return { color: 'text-success-600', bgColor: 'bg-success-100', ringColor: 'ring-success-500', emoji: '🎉' };
      case 'B':
        return { color: 'text-primary-600', bgColor: 'bg-primary-100', ringColor: 'ring-primary-500', emoji: '👍' };
      case 'C':
        return { color: 'text-warning-600', bgColor: 'bg-warning-100', ringColor: 'ring-warning-500', emoji: '😐' };
      default:
        return { color: 'text-danger-600', bgColor: 'bg-danger-100', ringColor: 'ring-danger-500', emoji: '😰' };
    }
  };

  const getAttendanceStatusConfig = (status: AttendanceStatus) => {
    switch (status) {
      case 'GREEN':
        return {
          label: 'On-time',
          variant: 'success' as const,
          icon: CheckCircle2,
          bgColor: 'bg-success-50',
          textColor: 'text-success-700',
        };
      case 'YELLOW':
        return {
          label: 'Late',
          variant: 'warning' as const,
          icon: AlertTriangle,
          bgColor: 'bg-warning-50',
          textColor: 'text-warning-700',
        };
      case 'ABSENT':
        return {
          label: 'Absent',
          variant: 'danger' as const,
          icon: XCircle,
          bgColor: 'bg-danger-50',
          textColor: 'text-danger-700',
        };
      case 'EXCUSED':
        return {
          label: 'Excused',
          variant: 'default' as const,
          icon: CalendarX,
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
        };
    }
  };

  const formatExceptionType = (type: string) => {
    return type.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getLowScoreReasonLabel = (reason: LowScoreReason): string => {
    const found = LOW_SCORE_REASONS.find(r => r.value === reason);
    return found?.label || reason;
  };

  // Calculate stats from current page data
  const stats = useMemo(() => {
    if (!checkinsData?.data) return null;

    const data = checkinsData.data;
    if (data.length === 0) return null;

    const avgScore = Math.round(data.reduce((sum, c) => sum + c.readinessScore, 0) / data.length);
    const greenCount = data.filter(c => c.readinessStatus === 'GREEN').length;
    const yellowCount = data.filter(c => c.readinessStatus === 'YELLOW').length;
    const redCount = data.filter(c => c.readinessStatus === 'RED').length;

    return { avgScore, greenCount, yellowCount, redCount };
  }, [checkinsData?.data]);
  const totalPages = checkinsData?.pagination ? Math.ceil(checkinsData.pagination.total / limit) : 1;

  const isPageLoading = (activeTab === 'readiness' && isLoading) || (activeTab === 'attendance' && isLoadingAttendance);

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
            <History className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My History</h1>
            <p className="text-gray-500">View your check-in and attendance history</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('readiness')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'readiness'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Readiness History
          </span>
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Attendance History
          </span>
        </button>
      </div>

      {/* Readiness Tab Content */}
      {activeTab === 'readiness' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <TrendingUp className="h-6 w-6 text-primary-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{stats.avgScore}%</p>
                  <p className="text-xs text-gray-500">Average Score</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <div className="h-6 w-6 rounded-full bg-success-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-success-600">{stats.greenCount}</p>
                  <p className="text-xs text-gray-500">Ready Days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <div className="h-6 w-6 rounded-full bg-warning-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-warning-600">{stats.yellowCount}</p>
                  <p className="text-xs text-gray-500">Limited Days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <div className="h-6 w-6 rounded-full bg-danger-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-danger-600">{stats.redCount}</p>
                  <p className="text-xs text-gray-500">Not Ready Days</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Filter:</span>
                {(['all', 'GREEN', 'YELLOW', 'RED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => { setFilter(status); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filter === status
                        ? status === 'all'
                          ? 'bg-primary-100 text-primary-700'
                          : status === 'GREEN'
                            ? 'bg-success-100 text-success-700'
                            : status === 'YELLOW'
                              ? 'bg-warning-100 text-warning-700'
                              : 'bg-danger-100 text-danger-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'GREEN' ? 'Ready' : status === 'YELLOW' ? 'Limited' : 'Not Ready'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* History List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-400" />
                  <CardTitle>Check-in Records</CardTitle>
                </div>
                {checkinsData?.pagination && (
                  <p className="text-sm text-gray-500">
                    {checkinsData.pagination.total} total records
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!checkinsData?.data || checkinsData.data.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No check-in records found</p>
                  <p className="text-sm text-gray-400">Complete your first daily check-in to start tracking</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkinsData.data.map((checkin) => {
                    const config = getStatusConfig(checkin.readinessStatus);
                    return (
                      <div
                        key={checkin.id}
                        className={`p-4 rounded-lg border ${config.bgColor} border-gray-200`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {formatDisplayDate(checkin.createdAt)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDisplayDateTime(checkin.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={config.variant}>{config.label}</Badge>
                            <span className="text-xl font-bold text-gray-900">
                              {checkin.readinessScore}%
                            </span>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="text-center p-2 bg-white rounded-lg">
                            <Smile className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                            <p className={`text-lg font-semibold ${getScoreColor(checkin.mood)}`}>
                              {checkin.mood}
                            </p>
                            <p className="text-xs text-gray-500">Mood</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg">
                            <Brain className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                            <p className={`text-lg font-semibold ${getScoreColor(checkin.stress, true)}`}>
                              {checkin.stress}
                            </p>
                            <p className="text-xs text-gray-500">Stress</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg">
                            <Moon className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                            <p className={`text-lg font-semibold ${getScoreColor(checkin.sleep)}`}>
                              {checkin.sleep}
                            </p>
                            <p className="text-xs text-gray-500">Sleep</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg">
                            <Heart className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                            <p className={`text-lg font-semibold ${getScoreColor(checkin.physicalHealth)}`}>
                              {checkin.physicalHealth}
                            </p>
                            <p className="text-xs text-gray-500">Physical</p>
                          </div>
                        </div>

                        {/* Low Score Reason - for RED status */}
                        {checkin.readinessStatus === 'RED' && checkin.lowScoreReason && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-start gap-2">
                              <MessageCircle className="h-4 w-4 text-danger-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-danger-700">
                                  Reason: {getLowScoreReasonLabel(checkin.lowScoreReason)}
                                </p>
                                {checkin.lowScoreDetails && (
                                  <p className="text-sm text-gray-600 mt-1">{checkin.lowScoreDetails}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {checkin.notes && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm text-gray-600">{checkin.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={checkinsData?.pagination?.total}
                pageSize={limit}
                onPageChange={setPage}
                className="mt-6 pt-4 border-t"
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Attendance Tab Content */}
      {activeTab === 'attendance' && (
        <>
          {/* Performance Stats */}
          {attendancePerformance && (
            attendancePerformance.countedDays > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="md:col-span-1">
                  <CardContent className="py-4 text-center">
                    <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg relative overflow-hidden mx-auto mb-3 ${getGradeConfig(attendancePerformance.grade).bgColor} ${getGradeConfig(attendancePerformance.grade).ringColor} ring-4`}>
                      <span className="text-4xl animate-bounce-slow relative z-10">
                        {getGradeConfig(attendancePerformance.grade).emoji}
                      </span>
                      <div className={`absolute inset-0 ${getGradeConfig(attendancePerformance.grade).bgColor} opacity-20 animate-pulse`} />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{attendancePerformance.score}%</p>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <p className="text-xs text-gray-500">{attendancePerformance.label}</p>
                    </div>
                    <span className={`text-xl font-black ${getGradeConfig(attendancePerformance.grade).color}`}>
                      {attendancePerformance.grade}
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-success-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-success-600">{attendancePerformance.breakdown.green}</p>
                    <p className="text-xs text-gray-500">On-time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <AlertTriangle className="h-6 w-6 text-warning-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-warning-600">{attendancePerformance.breakdown.yellow}</p>
                    <p className="text-xs text-gray-500">Late</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <XCircle className="h-6 w-6 text-danger-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-danger-600">{attendancePerformance.breakdown.absent}</p>
                    <p className="text-xs text-gray-500">Absent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <CalendarX className="h-6 w-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-600">{attendancePerformance.breakdown.excused}</p>
                    <p className="text-xs text-gray-500">Excused</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full flex items-center justify-center bg-gray-100 ring-4 ring-gray-200">
                      <span className="text-2xl font-bold text-gray-400">—</span>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-500">No record yet</p>
                      <p className="text-sm text-gray-400">Attendance score will appear after your first work day</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Filter */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Filter:</span>
                {(['all', 'GREEN', 'YELLOW', 'ABSENT', 'EXCUSED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setAttendanceFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      attendanceFilter === status
                        ? status === 'all'
                          ? 'bg-primary-100 text-primary-700'
                          : status === 'GREEN'
                            ? 'bg-success-100 text-success-700'
                            : status === 'YELLOW'
                              ? 'bg-warning-100 text-warning-700'
                              : status === 'ABSENT'
                                ? 'bg-danger-100 text-danger-700'
                                : 'bg-gray-200 text-gray-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {status === 'all' ? 'All' : getAttendanceStatusConfig(status).label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Attendance List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <CardTitle>Attendance Records</CardTitle>
                </div>
                {attendanceData?.data && (
                  <p className="text-sm text-gray-500">
                    {attendanceData.data.length} records (last {attendanceData.period.days} days)
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!attendanceData?.data || attendanceData.data.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No attendance records found</p>
                  <p className="text-sm text-gray-400">Your attendance history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attendanceData.data.map((record) => {
                    const config = getAttendanceStatusConfig(record.status);
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={record.date}
                        className={`p-4 rounded-lg border ${config.bgColor} border-gray-200`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <StatusIcon className={`h-5 w-5 ${config.textColor}`} />
                            <div>
                              <p className="font-medium text-gray-900">
                                {formatDisplayDate(record.date)}
                              </p>
                              {record.checkInTime && (
                                <p className="text-xs text-gray-500">
                                  Checked in: {new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  {record.minutesLate && record.minutesLate > 0 && (
                                    <span className="text-warning-600 ml-1">({record.minutesLate} mins late)</span>
                                  )}
                                </p>
                              )}
                              {record.exceptionType && (
                                <p className="text-xs text-gray-500">
                                  {formatExceptionType(record.exceptionType)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={config.variant}>{config.label}</Badge>
                            {record.score !== null && (
                              <span className="text-lg font-bold text-gray-900">
                                {record.score}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
