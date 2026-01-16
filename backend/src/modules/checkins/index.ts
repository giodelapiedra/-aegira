import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import { calculateReadiness } from '../../utils/readiness.js';
import { getUserLeaveStatus, getDaysCoveredByLeave } from '../../utils/leave.js';
import {
  calculateAttendanceStatus,
  calculatePerformanceScore,
  getPerformanceGrade,
  getDateOnly,
  getAttendanceHistory,
  ATTENDANCE_SCORES,
} from '../../utils/attendance.js';
import { createSystemLog } from '../system-logs/index.js';
import { createCheckinSchema } from '../../utils/validator.js';
import type { AppContext } from '../../types/context.js';
import {
  getTodayRange,
  getTodayForDbDate,
  getCurrentDayName,
  getNow,
  getDateParts,
  isWorkDay,
  formatLocalDate,
  getLastNDaysRange,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';
import { recalculateTodaySummary } from '../../utils/daily-summary.js';

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Grace period in minutes for early check-in
 * - Workers can check in this many minutes BEFORE their shift starts
 * - All check-ins within shift hours are GREEN (no late penalty)
 */
const GRACE_PERIOD_MINUTES = 15;

const checkinsRoutes = new Hono<AppContext>();

// GET /checkins/leave-status - Check if user is on leave or returning
checkinsRoutes.get('/leave-status', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  const leaveStatus = await getUserLeaveStatus(userId, timezone);
  return c.json(leaveStatus);
});

// GET /checkins/today - Get today's check-in for current user
checkinsRoutes.get('/today', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Use timezone-aware date range
  const { start: today, end: tomorrow } = getTodayRange(timezone);

  const checkin = await prisma.checkin.findFirst({
    where: {
      userId,
      createdAt: {
        gte: today,
        lte: tomorrow,
      },
    },
  });

  return c.json(checkin);
});

// GET /checkins/my - Get current user's check-ins with pagination
checkinsRoutes.get('/my', async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const status = c.req.query('status');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (status) {
    where.readinessStatus = status;
  }

  // Date range filtering (server-side for proper pagination)
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      // Include the entire end date day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [checkins, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        readinessStatus: true,
        readinessScore: true,
        lowScoreReason: true,
        lowScoreDetails: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.checkin.count({ where }),
  ]);

  return c.json({
    data: checkins,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /checkins - List all check-ins (company-scoped, except for ADMIN - super admin sees all)
checkinsRoutes.get('/', async (c) => {
  const companyId = c.get('companyId');
  const user = c.get('user');
  const currentUserId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const userId = c.req.query('userId');
  let teamId = c.req.query('teamId');
  const status = c.req.query('status');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const skip = (page - 1) * limit;

  // ADMIN: Super admin - can see all check-ins across all companies
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';

  // TEAM_LEAD: Can only see their own team's check-ins
  if (isTeamLead) {
    // Find the team this user leads
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: currentUserId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }

    // If teamId is provided, verify it matches their team
    if (teamId && teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view check-ins for your own team' }, 403);
    }

    // Force teamId to their team (even if not provided)
    teamId = leaderTeam.id;
  }

  const where: any = {};

  if (!isAdmin) {
    where.companyId = companyId;
  }

  if (userId) where.userId = userId;
  if (status) where.readinessStatus = status;
  if (teamId) {
    where.user = { teamId };
  }

  // Date range filtering
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [checkins, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            teamId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.checkin.count({ where }),
  ]);

  return c.json({
    data: checkins,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /checkins - Create check-in (only for MEMBER role with team)
checkinsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const body = createCheckinSchema.parse(await c.req.json());

  // Get user with team and company info (including pre-computed stats for running average)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      company: {
        select: { timezone: true },
      },
    },
  });

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Validation 1: Only MEMBER/WORKER role can check in (Team leaders supervise only)
  if (user?.role !== 'MEMBER' && user?.role !== 'WORKER') {
    return c.json({
      error: 'Daily check-in is only required for team members',
      code: 'NOT_MEMBER_ROLE'
    }, 400);
  }

  // Validation 2: User must belong to a team
  if (!user?.teamId || !user.team) {
    return c.json({
      error: 'You must be assigned to a team before you can check in',
      code: 'NO_TEAM'
    }, 400);
  }

  const team = user.team;

  // Validation 3: Check if user is on approved leave (use company timezone)
  const leaveStatus = await getUserLeaveStatus(userId, timezone);
  if (leaveStatus.isOnLeave) {
    const exceptionType = leaveStatus.currentException?.type.toLowerCase().replace('_', ' ');
    return c.json({
      error: `You are currently on approved ${exceptionType}. Check-in is not required during your leave period.`,
      code: 'ON_LEAVE',
      exception: leaveStatus.currentException,
    }, 400);
  }

  // Validation 4: Check if today is a work day for the team (timezone-aware)
  const currentDay = getCurrentDayName(timezone);
  const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());

  if (!workDaysList.includes(currentDay)) {
    return c.json({
      error: `Today (${currentDay}) is not a scheduled work day for your team. Work days: ${workDaysList.join(', ')}`,
      code: 'NOT_WORK_DAY'
    }, 400);
  }

  // Validation 5: Check if today is a company holiday
  const todayForHolidayCheck = getTodayForDbDate(timezone);
  const holiday = await prisma.holiday.findFirst({
    where: {
      companyId,
      date: todayForHolidayCheck,
    },
  });

  if (holiday) {
    return c.json({
      error: `Today is a company holiday (${holiday.name}). Check-in is not required.`,
      code: 'HOLIDAY'
    }, 400);
  }

  // Validation 6: Check if current time is within shift hours (timezone-aware)
  const dateParts = getDateParts(timezone);
  const currentTimeMinutes = dateParts.hour * 60 + dateParts.minute;

  const [shiftStartHour, shiftStartMin] = team.shiftStart.split(':').map(Number);
  const [shiftEndHour, shiftEndMin] = team.shiftEnd.split(':').map(Number);
  const shiftStartMinutes = shiftStartHour * 60 + shiftStartMin;
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;

  // Allow early check-in using the same grace period as attendance scoring
  const allowedStartMinutes = shiftStartMinutes - GRACE_PERIOD_MINUTES;

  if (currentTimeMinutes < allowedStartMinutes) {
    return c.json({
      error: `Check-in is not yet available. Your shift starts at ${team.shiftStart}. You can check in starting ${GRACE_PERIOD_MINUTES} minutes before.`,
      code: 'TOO_EARLY'
    }, 400);
  }

  if (currentTimeMinutes > shiftEndMinutes) {
    return c.json({
      error: `Check-in time has ended. Your shift ended at ${team.shiftEnd}.`,
      code: 'TOO_LATE'
    }, 400);
  }

  // Check if already checked in today (timezone-aware)
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const now = new Date(); // Keep actual UTC for database storage
  // Use getTodayForDbDate for @db.Date columns to avoid timezone issues
  // e.g., Jan 7 Manila = Jan 6 16:00 UTC, which PostgreSQL would store as Jan 6
  const todayForDb = getTodayForDbDate(timezone); // Creates Date at noon UTC with correct date

  const existingCheckin = await prisma.checkin.findFirst({
    where: {
      userId,
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  if (existingCheckin) {
    return c.json({ error: 'Already checked in today', code: 'ALREADY_CHECKED_IN' }, 400);
  }

  // Calculate readiness
  const { score, status } = calculateReadiness({
    mood: body.mood,
    stress: body.stress,
    sleep: body.sleep,
    physicalHealth: body.physicalHealth,
  });

  // Determine if this is a "returning from leave" check-in
  const isReturning = leaveStatus.isReturning;

  // Calculate attendance status - simplified, no more late penalty
  // Basta within shift hours = GREEN
  const attendanceResult = calculateAttendanceStatus(now, team.shiftStart, team.shiftEnd, timezone);

  // Create checkin and attendance record in transaction
  const [checkin, attendance] = await prisma.$transaction([
    prisma.checkin.create({
      data: {
        userId,
        companyId,
        mood: body.mood,
        stress: body.stress,
        sleep: body.sleep,
        physicalHealth: body.physicalHealth,
        notes: body.notes || null,
        readinessScore: score,
        readinessStatus: status,
      },
    }),
    prisma.dailyAttendance.upsert({
      where: {
        userId_date: { userId, date: todayForDb },
      },
      create: {
        userId,
        companyId,
        teamId: team.id,
        date: todayForDb,
        scheduledStart: team.shiftStart,
        checkInTime: now,
        status: attendanceResult.status,
        score: attendanceResult.score,
        isCounted: attendanceResult.isCounted,
      },
      update: {
        checkInTime: now,
        status: attendanceResult.status,
        score: attendanceResult.score,
        isCounted: attendanceResult.isCounted,
      },
    }),
  ]);

  // Update user's lastCheckinDate and streak
  let newStreak = 1;

  // Calculate streak based on previous check-in, accounting for approved leave (timezone-aware)
  if (user.lastCheckinDate) {
    const lastCheckin = new Date(user.lastCheckinDate);
    const daysDiff = Math.floor((todayStart.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0 || daysDiff === 1) {
      // Same day or consecutive day - continue streak
      newStreak = (user.currentStreak || 0) + 1;
    } else if (daysDiff > 1) {
      // Check if the gap was covered by approved leave or non-work days
      const gapStart = new Date(lastCheckin);
      gapStart.setDate(gapStart.getDate() + 1);
      const gapEnd = new Date(todayStart);
      gapEnd.setDate(gapEnd.getDate() - 1);

      if (gapStart <= gapEnd) {
        // Count days covered by approved leave (use company timezone)
        const leaveDays = await getDaysCoveredByLeave(userId, gapStart, gapEnd, timezone);

        // Count total work days in the gap (timezone-aware)
        let workDaysInGap = 0;
        const current = new Date(gapStart);
        while (current <= gapEnd) {
          if (isWorkDay(current, team.workDays, timezone)) {
            workDaysInGap++;
          }
          current.setDate(current.getDate() + 1);
        }

        // If all work days in gap were covered by leave, continue streak
        if (leaveDays >= workDaysInGap) {
          newStreak = (user.currentStreak || 0) + 1;
        }
      } else {
        // Gap is 0 days (e.g., weekend), continue streak
        newStreak = (user.currentStreak || 0) + 1;
      }
    }
  }

  const newLongestStreak = Math.max(user.longestStreak || 0, newStreak);

  // Calculate new running average for readiness score
  // Formula: newAvg = ((oldAvg * oldCount) + newScore) / newCount
  const oldAvg = user.avgReadinessScore || 0;
  const oldCount = user.totalCheckins || 0;
  const newCount = oldCount + 1;
  const newAvgReadinessScore = ((oldAvg * oldCount) + score) / newCount;

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastCheckinDate: now,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      totalCheckins: newCount,
      avgReadinessScore: Math.round(newAvgReadinessScore * 100) / 100, // Round to 2 decimal places
      lastReadinessStatus: status, // GREEN, YELLOW, or RED
    },
  });

  // Recalculate daily team summary (for analytics dashboard)
  // Fire and forget - don't block response for non-critical analytics update
  recalculateTodaySummary(team.id, timezone).catch(err => {
    console.error('Failed to recalculate daily team summary:', err);
  });

  // Log check-in submission
  await createSystemLog({
    companyId,
    userId,
    action: 'CHECKIN_SUBMITTED',
    entityType: 'checkin',
    entityId: checkin.id,
    description: `${user.firstName} ${user.lastName} submitted daily check-in (Readiness: ${status}, Attendance: ${attendanceResult.status})${isReturning ? ' - returning from leave' : ''}`,
    metadata: {
      readinessScore: score,
      readinessStatus: status,
      attendanceStatus: attendanceResult.status,
      attendanceScore: attendanceResult.score,
      isReturning,
    },
  });

  return c.json({
    ...checkin,
    attendance: {
      status: attendanceResult.status,
      score: attendanceResult.score,
    },
    isReturning,
  }, 201);
});

// ===========================================
// ATTENDANCE ENDPOINTS (must be before /:id route)
// ===========================================

// GET /checkins/week-stats - Get current week's check-in stats for worker dashboard
checkinsRoutes.get('/week-stats', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get user with team and company info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      // Timezone comes from context, no need to include company
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');
  const workDays = user.team?.workDays?.split(',').map(d => d.trim().toUpperCase()) || ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  // Get current week's Monday to Sunday range (in company timezone)
  const now = getNow(timezone);
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Get all check-ins for this week
  const weekCheckins = await prisma.checkin.findMany({
    where: {
      userId,
      createdAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      readinessScore: true,
      readinessStatus: true,
      createdAt: true,
    },
  });

  // Calculate stats
  const totalCheckins = weekCheckins.length;
  const avgScore = totalCheckins > 0
    ? Math.round(weekCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / totalCheckins)
    : 0;

  // Build daily status map (MON, TUE, WED, THU, FRI, SAT, SUN)
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dailyStatus: Record<string, { status: string; score: number } | null> = {};

  // Initialize all days as null
  for (const day of dayNames) {
    dailyStatus[day] = null;
  }

  // Fill in actual check-in data
  for (const checkin of weekCheckins) {
    const checkinDate = new Date(checkin.createdAt);
    const dayName = dayNames[checkinDate.getDay()];
    dailyStatus[dayName] = {
      status: checkin.readinessStatus,
      score: checkin.readinessScore,
    };
  }

  // Count work days this week (up to today)
  const today = getNow(timezone);
  const currentDayIndex = today.getDay();
  let scheduledDaysThisWeek = 0;
  let scheduledDaysSoFar = 0;

  for (let i = 0; i < 7; i++) {
    const dayIndex = (1 + i) % 7; // Start from Monday (1)
    const dayName = dayNames[dayIndex];
    if (workDays.includes(dayName)) {
      scheduledDaysThisWeek++;
      // Count only days up to and including today
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      if (dayDate <= today) {
        scheduledDaysSoFar++;
      }
    }
  }

  return c.json({
    weekStart: formatLocalDate(weekStart, timezone),
    weekEnd: formatLocalDate(weekEnd, timezone),
    totalCheckins,
    scheduledDaysThisWeek,
    scheduledDaysSoFar,
    avgScore,
    avgStatus: avgScore >= 70 ? 'GREEN' : avgScore >= 50 ? 'YELLOW' : totalCheckins > 0 ? 'RED' : null,
    dailyStatus,
    workDays,
    currentStreak: user.currentStreak || 0,
    longestStreak: user.longestStreak || 0,
  });
});

// GET /checkins/attendance/today - Get today's attendance status
checkinsRoutes.get('/attendance/today', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Use getTodayForDbDate for @db.Date columns to avoid timezone issues
  const todayForDb = getTodayForDbDate(timezone);

  const attendance = await prisma.dailyAttendance.findUnique({
    where: { userId_date: { userId, date: todayForDb } },
  });

  return c.json({
    attendance,
    checkedIn: !!attendance?.checkInTime,
  });
});

// GET /checkins/attendance/history - Get attendance history (lazy evaluation)
checkinsRoutes.get('/attendance/history', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const days = parseInt(c.req.query('days') || '30');
  const status = c.req.query('status');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Use timezone-aware date range to avoid off-by-one errors at timezone boundaries
  const { start: startDate, end: endDate } = getLastNDaysRange(days, timezone);

  // Get attendance history with lazy evaluation (use company timezone)
  let records = await getAttendanceHistory(userId, startDate, endDate, timezone);

  // Filter by status if provided
  if (status) {
    records = records.filter(r => r.status === status.toUpperCase());
  }

  return c.json({
    data: records,
    period: {
      days,
      startDate: formatLocalDate(startDate, timezone),
      endDate: formatLocalDate(endDate, timezone),
    },
  });
});

// GET /checkins/attendance/performance - Get performance score
checkinsRoutes.get('/attendance/performance', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const daysParam = c.req.query('days');

  // Get company timezone from context (no DB query needed!)
  const timezone = c.get('timezone');

  // Max cap: 2 years (730 days) for performance safety
  const MAX_DAYS = 730;

  // Handle "all time" - cap at MAX_DAYS for safety
  // The calculatePerformanceScore will still adjust to first check-in date if earlier
  let days: number;
  let isAllTime = false;

  if (daysParam === 'all' || daysParam === null || daysParam === undefined) {
    days = MAX_DAYS; // Cap at 2 years
    isAllTime = true;
  } else {
    days = Math.min(parseInt(daysParam) || 30, MAX_DAYS); // Cap user input too
  }

  // Use timezone-aware date range to avoid off-by-one errors at timezone boundaries
  const { start: startDate, end: endDate } = getLastNDaysRange(days, timezone);

  // Use company timezone for performance calculation
  const performance = await calculatePerformanceScore(userId, startDate, endDate, timezone);
  const { grade, label } = getPerformanceGrade(performance.score);

  return c.json({
    ...performance,
    grade,
    label,
    period: {
      days: isAllTime ? 'all' : days,
      maxDays: MAX_DAYS,
      startDate: formatLocalDate(startDate, timezone),
      endDate: formatLocalDate(endDate, timezone),
    },
  });
});

// ===========================================
// LOW SCORE REASON ENDPOINT
// ===========================================

const lowScoreReasons = [
  'PHYSICAL_INJURY',
  'ILLNESS_SICKNESS',
  'POOR_SLEEP',
  'HIGH_STRESS',
  'PERSONAL_ISSUES',
  'FAMILY_EMERGENCY',
  'WORK_RELATED',
  'OTHER',
] as const;

// Human-readable reason labels
const lowScoreReasonLabels: Record<string, string> = {
  PHYSICAL_INJURY: 'Physical Injury',
  ILLNESS_SICKNESS: 'Illness/Sickness',
  POOR_SLEEP: 'Poor Sleep',
  HIGH_STRESS: 'High Stress',
  PERSONAL_ISSUES: 'Personal Issues',
  FAMILY_EMERGENCY: 'Family Emergency',
  WORK_RELATED: 'Work-Related Issues',
  OTHER: 'Other',
};

// PATCH /checkins/:id/low-score-reason - Update low score reason for a check-in
checkinsRoutes.patch('/:id/low-score-reason', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const body = await c.req.json();
  const { reason, details } = body;

  // Validate reason
  if (!reason || !lowScoreReasons.includes(reason)) {
    return c.json({ error: 'Invalid reason provided' }, 400);
  }

  // Find the check-in with user and team info
  const checkin = await prisma.checkin.findFirst({
    where: { id, userId, companyId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              leaderId: true,
            },
          },
        },
      },
    },
  });

  if (!checkin) {
    return c.json({ error: 'Check-in not found' }, 404);
  }

  // Only allow updating reason for RED or YELLOW status check-ins
  if (checkin.readinessStatus !== 'RED' && checkin.readinessStatus !== 'YELLOW') {
    return c.json({ error: 'Low score reason can only be set for RED or YELLOW status check-ins' }, 400);
  }

  // Update the check-in with reason
  const updated = await prisma.checkin.update({
    where: { id },
    data: {
      lowScoreReason: reason,
      lowScoreDetails: reason === 'OTHER' ? details : null,
    },
  });

  // Notify team leader if exists
  if (checkin.user.team?.leaderId) {
    const workerName = `${checkin.user.firstName} ${checkin.user.lastName || ''}`.trim();
    const reasonLabel = lowScoreReasonLabels[reason] || reason;
    const statusEmoji = checkin.readinessStatus === 'RED' ? '🔴' : '🟡';

    await prisma.notification.create({
      data: {
        userId: checkin.user.team.leaderId,
        companyId,
        title: `${statusEmoji} Low Score Report`,
        message: `${workerName} reported: ${reasonLabel}${reason === 'OTHER' && details ? ` - ${details}` : ''}. Score: ${checkin.readinessScore.toFixed(0)}%`,
        type: 'LOW_SCORE_REPORT',
        data: {
          checkinId: id,
          workerId: userId,
          workerName,
          score: checkin.readinessScore,
          status: checkin.readinessStatus,
          reason,
          reasonLabel,
          details: reason === 'OTHER' ? details : null,
        },
      },
    });
  }

  return c.json(updated);
});

// GET /checkins/:id - Get check-in by ID (company-scoped, except for ADMIN, team-filtered for team leads)
// IMPORTANT: This must be AFTER all specific routes like /attendance/* to avoid matching them
checkinsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const user = c.get('user');
  const userId = c.get('userId');

  // ADMIN: Super admin - can access any check-in
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
  const where: any = { id };
  if (!isAdmin) {
    where.companyId = companyId;
  }

  const checkin = await prisma.checkin.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          teamId: true,
        },
      },
    },
  });

  if (!checkin) {
    return c.json({ error: 'Check-in not found' }, 404);
  }

  // TEAM_LEAD: Can only view check-ins from their own team members
  if (isTeamLead && checkin.user.teamId) {
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: userId, companyId, isActive: true },
      select: { id: true },
    });

    if (!leaderTeam || checkin.user.teamId !== leaderTeam.id) {
      return c.json({ error: 'You can only view check-ins from your own team members' }, 403);
    }
  }

  return c.json(checkin);
});

export { checkinsRoutes };
