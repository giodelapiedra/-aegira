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

const checkinsRoutes = new Hono<AppContext>();

// GET /checkins/leave-status - Check if user is on leave or returning
checkinsRoutes.get('/leave-status', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone for accurate leave status
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

  const leaveStatus = await getUserLeaveStatus(userId, timezone);
  return c.json(leaveStatus);
});

// GET /checkins/today - Get today's check-in for current user
checkinsRoutes.get('/today', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

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

  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (status) {
    where.readinessStatus = status;
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
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const userId = c.req.query('userId');
  const teamId = c.req.query('teamId');
  const status = c.req.query('status');

  const skip = (page - 1) * limit;

  // ADMIN: Super admin - can see all check-ins across all companies
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
  const where: any = {};
  
  if (!isAdmin) {
    where.companyId = companyId;
  }
  
  if (userId) where.userId = userId;
  if (status) where.readinessStatus = status;
  if (teamId) {
    where.user = { teamId };
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

  // Get user with team and company info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      company: {
        select: { timezone: true },
      },
    },
  });

  // Get company timezone (centralized)
  const timezone = user?.company?.timezone || DEFAULT_TIMEZONE;

  // Validation 1: Only MEMBER/WORKER role can check in
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

  // Validation 5: Check if current time is within shift hours (timezone-aware)
  const dateParts = getDateParts(timezone);
  const currentTimeMinutes = dateParts.hour * 60 + dateParts.minute;

  const [shiftStartHour, shiftStartMin] = team.shiftStart.split(':').map(Number);
  const [shiftEndHour, shiftEndMin] = team.shiftEnd.split(':').map(Number);
  const shiftStartMinutes = shiftStartHour * 60 + shiftStartMin;
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;

  // Allow 30 minutes early check-in (grace period)
  const gracePeriod = 30;
  const allowedStartMinutes = shiftStartMinutes - gracePeriod;

  if (currentTimeMinutes < allowedStartMinutes) {
    return c.json({
      error: `Check-in is not yet available. Your shift starts at ${team.shiftStart}. You can check in starting ${gracePeriod} minutes before.`,
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

  // Calculate attendance status (on-time vs late) using company timezone
  const gracePeriodMins = 15;
  const attendanceResult = calculateAttendanceStatus(now, team.shiftStart, gracePeriodMins, timezone);

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
        gracePeriodMins,
        checkInTime: now,
        minutesLate: attendanceResult.minutesLate,
        status: attendanceResult.status,
        score: attendanceResult.score,
        isCounted: attendanceResult.isCounted,
      },
      update: {
        checkInTime: now,
        minutesLate: attendanceResult.minutesLate,
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      lastCheckinDate: now,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
    },
  });

  // Log check-in submission
  await createSystemLog({
    companyId,
    userId,
    action: 'CHECKIN_SUBMITTED',
    entityType: 'checkin',
    entityId: checkin.id,
    description: `${user.firstName} ${user.lastName} submitted daily check-in (Readiness: ${status}, Attendance: ${attendanceResult.status}${attendanceResult.minutesLate > 0 ? `, ${attendanceResult.minutesLate} mins late` : ''})${isReturning ? ' - returning from leave' : ''}`,
    metadata: {
      readinessScore: score,
      readinessStatus: status,
      attendanceStatus: attendanceResult.status,
      attendanceScore: attendanceResult.score,
      minutesLate: attendanceResult.minutesLate,
      isReturning,
    },
  });

  return c.json({
    ...checkin,
    attendance: {
      status: attendanceResult.status,
      score: attendanceResult.score,
      minutesLate: attendanceResult.minutesLate,
    },
    isReturning,
  }, 201);
});

// ===========================================
// ATTENDANCE ENDPOINTS (must be before /:id route)
// ===========================================

// GET /checkins/attendance/today - Get today's attendance status
checkinsRoutes.get('/attendance/today', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  // Get company timezone
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

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

  // Get company timezone
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

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

  // Get company timezone
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;

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

  // Find the check-in (must belong to current user)
  const checkin = await prisma.checkin.findFirst({
    where: { id, userId, companyId },
  });

  if (!checkin) {
    return c.json({ error: 'Check-in not found' }, 404);
  }

  // Only allow updating reason for RED status check-ins
  if (checkin.readinessStatus !== 'RED') {
    return c.json({ error: 'Low score reason can only be set for RED status check-ins' }, 400);
  }

  // Update the check-in with reason
  const updated = await prisma.checkin.update({
    where: { id },
    data: {
      lowScoreReason: reason,
      lowScoreDetails: reason === 'OTHER' ? details : null,
    },
  });

  return c.json(updated);
});

// GET /checkins/:id - Get check-in by ID (company-scoped, except for ADMIN)
// IMPORTANT: This must be AFTER all specific routes like /attendance/* to avoid matching them
checkinsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const user = c.get('user');

  // ADMIN: Super admin - can access any check-in
  const isAdmin = user.role?.toUpperCase() === 'ADMIN';
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
        },
      },
    },
  });

  if (!checkin) {
    return c.json({ error: 'Check-in not found' }, 404);
  }

  return c.json(checkin);
});

export { checkinsRoutes };
