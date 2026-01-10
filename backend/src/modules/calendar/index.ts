/**
 * Calendar Module
 * Provides calendar view data for workers and team leaders
 *
 * - Workers: See their own check-ins, exemptions, holidays
 * - Team Leaders: See team-wide check-ins, exemptions, holidays
 */

import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import { DateTime } from 'luxon';
import {
  getStartOfDay,
  getEndOfDay,
  formatLocalDate,
  getDayName,
  getStartOfNextDay,
  DEFAULT_TIMEZONE,
} from '../../utils/date-helpers.js';

const calendarRoutes = new Hono<AppContext>();

// Helper: Get company timezone
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}

// Helper: Get days in month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// GET /calendar/my - Worker's personal calendar
// Query params: ?year=2026&month=1
calendarRoutes.get('/my', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const yearParam = c.req.query('year');
  const monthParam = c.req.query('month');

  const timezone = await getCompanyTimezone(companyId);

  // Default to current month
  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) - 1 : now.getMonth(); // 0-indexed

  // Get user with team info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          workDays: true,
          shiftStart: true,
          shiftEnd: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Determine the effective start date for this user's check-in requirement
  // Check-in requirement starts the DAY AFTER joining (not same day)
  // This gives members time to prepare after being added to a team
  const userJoinDate = user.teamJoinedAt || user.createdAt;
  const teamCreateDate = user.team?.createdAt || user.createdAt;
  // The join date is the later of the two (user must have joined AND team must exist)
  const joinDate = userJoinDate > teamCreateDate ? userJoinDate : teamCreateDate;
  // Effective start is NEXT DAY after joining
  const effectiveStartDate = getStartOfNextDay(joinDate, timezone);
  const effectiveStartStr = formatLocalDate(effectiveStartDate, timezone);

  // Calculate date range for the month (timezone-aware)
  // FIX: Use Luxon to create dates in company timezone, not server local time
  // Note: JS month is 0-indexed, Luxon month is 1-indexed
  const startOfMonthDT = DateTime.fromObject(
    { year, month: month + 1, day: 1 },
    { zone: timezone }
  ).startOf('day');
  const startOfMonth = startOfMonthDT.toJSDate();
  const endOfMonth = startOfMonthDT.endOf('month').toJSDate();

  // Fetch data in parallel
  const [holidays, exemptions, checkins] = await Promise.all([
    // Company holidays for the month
    prisma.holiday.findMany({
      where: {
        companyId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: 'asc' },
    }),
    // User's approved exemptions overlapping with the month
    prisma.exception.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      orderBy: { startDate: 'asc' },
    }),
    // User's check-ins for the month
    prisma.checkin.findMany({
      where: {
        userId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Get attendance records for more detailed info
  const attendanceRecords = await prisma.dailyAttendance.findMany({
    where: {
      userId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  // Build attendance map by date
  const attendanceMap = new Map<string, typeof attendanceRecords[0]>();
  for (const record of attendanceRecords) {
    const dateKey = formatLocalDate(record.date, timezone);
    attendanceMap.set(dateKey, record);
  }

  // Build check-in map by date
  const checkinMap = new Map<string, typeof checkins[0]>();
  for (const checkin of checkins) {
    const dateKey = formatLocalDate(checkin.createdAt, timezone);
    checkinMap.set(dateKey, checkin);
  }

  // Build holiday map by date
  const holidayMap = new Map<string, typeof holidays[0]>();
  for (const holiday of holidays) {
    const dateKey = formatLocalDate(holiday.date, timezone);
    holidayMap.set(dateKey, holiday);
  }

  // Check if date is covered by exemption
  const getExemptionForDate = (dateStr: string) => {
    for (const exemption of exemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStartStr = formatLocalDate(exemption.startDate, timezone);
      const exEndStr = formatLocalDate(exemption.endDate, timezone);
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return exemption;
      }
    }
    return null;
  };

  // Build days array
  const workDays = user.team?.workDays?.split(',').map(d => d.trim().toUpperCase()) || [];
  const daysInMonth = getDaysInMonth(year, month);
  const days: {
    date: string;
    dayOfWeek: string;
    isWorkDay: boolean;
    isHoliday: boolean;
    holidayName?: string;
    isExempted: boolean;
    exemptionType?: string;
    checkinStatus?: string;
    checkinTime?: string;
    readinessScore?: number;
    attendanceStatus?: string;
    isPast: boolean;
    isToday: boolean;
    isBeforeStart: boolean; // Date is before user joined team
  }[] = [];

  const todayStr = formatLocalDate(new Date(), timezone);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatLocalDate(date, timezone);
    const dayName = getDayName(date, timezone);
    // Only count as work day if date is on or after effective start date
    const isBeforeStart = dateStr < effectiveStartStr;
    const isWorkDay = !isBeforeStart && workDays.includes(dayName);
    const holiday = holidayMap.get(dateStr);
    const exemption = getExemptionForDate(dateStr);
    const checkin = checkinMap.get(dateStr);
    const attendance = attendanceMap.get(dateStr);

    days.push({
      date: dateStr,
      dayOfWeek: dayName,
      isWorkDay,
      isHoliday: !!holiday,
      holidayName: holiday?.name,
      isExempted: !!exemption,
      exemptionType: exemption?.type,
      checkinStatus: checkin?.readinessStatus,
      checkinTime: checkin?.createdAt.toISOString(),
      readinessScore: checkin?.readinessScore,
      attendanceStatus: attendance?.status,
      isPast: dateStr < todayStr,
      isToday: dateStr === todayStr,
      isBeforeStart,
    });
  }

  // Calculate summary
  // Work days = scheduled work days that are NOT holidays and NOT before start
  const workDaysCount = days.filter(d => d.isWorkDay && !d.isHoliday).length;
  const checkedInCount = days.filter(d => d.checkinStatus).length;
  const holidayCount = days.filter(d => d.isHoliday).length;
  const exemptedCount = days.filter(d => d.isExempted && !d.isHoliday).length;

  return c.json({
    year,
    month: month + 1,
    startDate: effectiveStartStr, // When user's check-in requirement started
    team: user.team
      ? {
          id: user.team.id,
          name: user.team.name,
          workDays: user.team.workDays,
          shiftStart: user.team.shiftStart,
          shiftEnd: user.team.shiftEnd,
        }
      : null,
    days,
    summary: {
      totalDays: daysInMonth,
      workDays: workDaysCount,
      checkedIn: checkedInCount,
      holidays: holidayCount,
      exempted: exemptedCount,
    },
    holidays: holidays.map(h => ({
      date: formatLocalDate(h.date, timezone),
      name: h.name,
    })),
    exemptions: exemptions.map(e => ({
      id: e.id,
      type: e.type,
      reason: e.reason,
      startDate: e.startDate ? formatLocalDate(e.startDate, timezone) : null,
      endDate: e.endDate ? formatLocalDate(e.endDate, timezone) : null,
    })),
  });
});

// GET /calendar/team - Team leader's team calendar
// Query params: ?year=2026&month=1
calendarRoutes.get('/team', async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const user = c.get('user');
  const yearParam = c.req.query('year');
  const monthParam = c.req.query('month');

  const timezone = await getCompanyTimezone(companyId);

  // Default to current month
  const now = new Date();
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) - 1 : now.getMonth();

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!currentUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // TEAM_LEAD: Can only view the team they lead
  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';
  let team;

  if (isTeamLead) {
    // For TEAM_LEAD, only allow access to the team they lead
    team = await prisma.team.findFirst({
      where: {
        companyId,
        isActive: true,
        leaderId: userId, // Must be the leader
      },
      include: {
        members: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            teamJoinedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!team) {
      return c.json({ error: 'You are not assigned as a team leader' }, 403);
    }
  } else {
    // Higher roles can view any team they're associated with
    team = await prisma.team.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { leaderId: userId },
          { members: { some: { id: userId } } },
        ],
      },
      include: {
        members: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            teamJoinedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!team) {
      return c.json({ error: 'No team found' }, 404);
    }
  }

  // Team start date (check-ins start NEXT DAY after team was created)
  const teamEffectiveStart = getStartOfNextDay(team.createdAt, timezone);
  const teamStartStr = formatLocalDate(teamEffectiveStart, timezone);

  // Build member start date map (when each member started requiring check-ins)
  // Check-in requirement starts the DAY AFTER joining
  const memberStartDates = new Map<string, string>();
  for (const member of team.members) {
    const memberJoinDate = member.teamJoinedAt || member.createdAt;
    // Join date is the later of team creation or member join
    const joinDate = memberJoinDate > team.createdAt ? memberJoinDate : team.createdAt;
    // Effective start is NEXT DAY after joining
    const effectiveStart = getStartOfNextDay(joinDate, timezone);
    memberStartDates.set(member.id, formatLocalDate(effectiveStart, timezone));
  }

  const memberIds = team.members.map(m => m.id);

  // Calculate date range (timezone-aware)
  // FIX: Use Luxon to create dates in company timezone, not server local time
  const startOfMonthDT = DateTime.fromObject(
    { year, month: month + 1, day: 1 },
    { zone: timezone }
  ).startOf('day');
  const startOfMonth = startOfMonthDT.toJSDate();
  const endOfMonth = startOfMonthDT.endOf('month').toJSDate();

  // Fetch data in parallel
  const [holidays, exemptions, checkins] = await Promise.all([
    // Company holidays
    prisma.holiday.findMany({
      where: {
        companyId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: 'asc' },
    }),
    // All team members' exemptions
    prisma.exception.findMany({
      where: {
        userId: { in: memberIds },
        status: 'APPROVED',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    }),
    // All team members' check-ins
    prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build maps
  const holidayMap = new Map<string, typeof holidays[0]>();
  for (const holiday of holidays) {
    const dateKey = formatLocalDate(holiday.date, timezone);
    holidayMap.set(dateKey, holiday);
  }

  // Build check-ins by date and user
  const checkinsByDate = new Map<string, Map<string, typeof checkins[0]>>();
  for (const checkin of checkins) {
    const dateKey = formatLocalDate(checkin.createdAt, timezone);
    if (!checkinsByDate.has(dateKey)) {
      checkinsByDate.set(dateKey, new Map());
    }
    checkinsByDate.get(dateKey)!.set(checkin.userId, checkin);
  }

  // Check exemption for user on date
  const getExemptionForUserOnDate = (userId: string, dateStr: string) => {
    for (const exemption of exemptions) {
      if (exemption.userId !== userId) continue;
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStartStr = formatLocalDate(exemption.startDate, timezone);
      const exEndStr = formatLocalDate(exemption.endDate, timezone);
      if (dateStr >= exStartStr && dateStr <= exEndStr) {
        return exemption;
      }
    }
    return null;
  };

  // Build days array
  const workDays = team.workDays.split(',').map(d => d.trim().toUpperCase());
  const daysInMonth = getDaysInMonth(year, month);
  const todayStr = formatLocalDate(new Date(), timezone);

  const days: {
    date: string;
    dayOfWeek: string;
    isWorkDay: boolean;
    isHoliday: boolean;
    holidayName?: string;
    isBeforeTeamStart: boolean; // Date is before team was created
    memberStatuses: {
      userId: string;
      name: string;
      avatar?: string;
      status: 'checked_in' | 'exempted' | 'absent' | 'pending' | 'not_required';
      checkinTime?: string;
      readinessStatus?: string;
      exemptionType?: string;
      startDate?: string;
    }[];
    checkedInCount: number;
    exemptedCount: number;
    requiredCount: number; // How many members were required to check in
    isPast: boolean;
    isToday: boolean;
  }[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatLocalDate(date, timezone);
    const dayName = getDayName(date, timezone);
    const isWorkDay = workDays.includes(dayName);
    const holiday = holidayMap.get(dateStr);
    const dayCheckins = checkinsByDate.get(dateStr) || new Map();

    const memberStatuses = team.members.map(member => {
      const checkin = dayCheckins.get(member.id);
      const exemption = getExemptionForUserOnDate(member.id, dateStr);
      const memberStartStr = memberStartDates.get(member.id) || teamStartStr;
      const isBeforeMemberStart = dateStr < memberStartStr;

      let status: 'checked_in' | 'exempted' | 'absent' | 'pending' | 'not_required';
      if (isBeforeMemberStart) {
        // Date is before this member joined - no check-in required
        status = 'not_required';
      } else if (checkin) {
        status = 'checked_in';
      } else if (exemption || holiday) {
        status = 'exempted';
      } else if (dateStr < todayStr && isWorkDay) {
        status = 'absent';
      } else {
        status = 'pending';
      }

      return {
        userId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        avatar: member.avatar || undefined,
        status,
        checkinTime: checkin?.createdAt.toISOString(),
        readinessStatus: checkin?.readinessStatus,
        exemptionType: exemption?.type,
        startDate: memberStartStr, // When this member started requiring check-ins
      };
    });

    const isBeforeTeamStart = dateStr < teamStartStr;
    // Count only members who are required to check in (not 'not_required')
    const requiredMembers = memberStatuses.filter(m => m.status !== 'not_required');

    days.push({
      date: dateStr,
      dayOfWeek: dayName,
      isWorkDay: !isBeforeTeamStart && isWorkDay, // Not a work day if before team start
      isHoliday: !!holiday,
      holidayName: holiday?.name,
      isBeforeTeamStart,
      memberStatuses,
      checkedInCount: memberStatuses.filter(m => m.status === 'checked_in').length,
      exemptedCount: memberStatuses.filter(m => m.status === 'exempted').length,
      requiredCount: requiredMembers.length,
      isPast: dateStr < todayStr,
      isToday: dateStr === todayStr,
    });
  }

  // Calculate summary
  // Work days = scheduled work days that are NOT holidays
  const workDaysInMonth = days.filter(d => d.isWorkDay && !d.isHoliday).length;
  const holidaysInMonth = days.filter(d => d.isHoliday).length;

  return c.json({
    year,
    month: month + 1,
    startDate: teamStartStr, // When team was created (check-in requirement started)
    team: {
      id: team.id,
      name: team.name,
      workDays: team.workDays,
      shiftStart: team.shiftStart,
      shiftEnd: team.shiftEnd,
      memberCount: team.members.length,
    },
    members: team.members.map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      avatar: m.avatar,
    })),
    days,
    summary: {
      totalDays: daysInMonth,
      workDays: workDaysInMonth,
      holidays: holidaysInMonth,
      totalMembers: team.members.length,
    },
    holidays: holidays.map(h => ({
      date: formatLocalDate(h.date, timezone),
      name: h.name,
    })),
    exemptions: exemptions.map(e => ({
      id: e.id,
      userId: e.userId,
      userName: `${e.user.firstName} ${e.user.lastName}`,
      type: e.type,
      reason: e.reason,
      startDate: e.startDate ? formatLocalDate(e.startDate, timezone) : null,
      endDate: e.endDate ? formatLocalDate(e.endDate, timezone) : null,
    })),
  });
});

export { calendarRoutes };
