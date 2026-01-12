import { PrismaClient } from '@prisma/client';
import {
  getTodayRange,
  getLastNDaysRange,
  getStartOfDay,
  getEndOfDay,
  getStartOfNextDay,
  formatLocalDate,
  isWorkDay,
} from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function debug() {
  console.log('=== Debug Team Analytics API Calculation ===\n');

  // Get Alpha team
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, teamJoinedAt: true, createdAt: true }
      }
    }
  });

  if (!team) {
    console.log('Team not found');
    return;
  }

  // Same date range as API with period='7days'
  const { start: todayStart, end: todayEnd } = getTodayRange(TIMEZONE);
  const range = getLastNDaysRange(6, TIMEZONE);
  const startDate = range.start;
  const endDate = range.end;

  console.log('Date Range:');
  console.log('  Start:', formatLocalDate(startDate, TIMEZONE));
  console.log('  End:', formatLocalDate(endDate, TIMEZONE));
  console.log('');

  // Get exemptions
  const allExemptions = await prisma.exception.findMany({
    where: {
      userId: { in: team.members.map(m => m.id) },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  console.log('Exemptions:');
  for (const ex of allExemptions) {
    const user = team.members.find(m => m.id === ex.userId);
    console.log(`  ${user?.firstName}: ${formatLocalDate(ex.startDate, TIMEZONE)} to ${formatLocalDate(ex.endDate, TIMEZONE)}`);
  }
  console.log('');

  // Get EXCUSED absences
  const excusedAbsences = await prisma.absence.findMany({
    where: {
      userId: { in: team.members.map(m => m.id) },
      status: 'EXCUSED',
      absenceDate: { gte: startDate, lte: endDate },
    },
  });

  console.log('EXCUSED Absences:');
  for (const a of excusedAbsences) {
    const user = team.members.find(m => m.id === a.userId);
    console.log(`  ${user?.firstName}: ${formatLocalDate(a.absenceDate, TIMEZONE)}`);
  }
  console.log('');

  // Get check-ins
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: team.members.map(m => m.id) },
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  // Helper to check exemption
  const wasOnExemption = (userId: string, date: Date): boolean => {
    const dateStr = formatLocalDate(date, TIMEZONE);
    return allExemptions.some((ex) => {
      if (ex.userId !== userId) return false;
      const exemptStartStr = formatLocalDate(ex.startDate, TIMEZONE);
      const exemptEndStr = formatLocalDate(ex.endDate, TIMEZONE);
      return dateStr >= exemptStartStr && dateStr < exemptEndStr;
    });
  };

  // Helper to check EXCUSED absence
  const hasExcusedAbsence = (userId: string, date: Date): boolean => {
    const dateStr = formatLocalDate(date, TIMEZONE);
    return excusedAbsences.some((a) => {
      if (a.userId !== userId) return false;
      return formatLocalDate(a.absenceDate, TIMEZONE) === dateStr;
    });
  };

  // Simulate API trendData calculation
  console.log('=== Day by Day Calculation (like API) ===\n');

  const dayMs = 24 * 60 * 60 * 1000;
  const currentDate = new Date(startDate);
  let totalCheckins = 0;
  let totalExpected = 0;

  while (currentDate <= endDate) {
    const dateStr = formatLocalDate(currentDate, TIMEZONE);
    const dayStart = getStartOfDay(currentDate, TIMEZONE);
    const dayEnd = getEndOfDay(currentDate, TIMEZONE);
    const isWorkDayResult = isWorkDay(currentDate, team.workDays, TIMEZONE);

    if (!isWorkDayResult) {
      console.log(`${dateStr}: [REST DAY - skipped]`);
      currentDate.setTime(currentDate.getTime() + dayMs);
      continue;
    }

    // Get day check-ins
    const dayCheckins = checkins.filter((c) => {
      const d = new Date(c.createdAt);
      return d >= dayStart && d <= dayEnd;
    });

    // Get unique users who checked in
    const checkedInUserIds = new Set(dayCheckins.map(c => c.userId));

    // Calculate expected members (same logic as API)
    const expectedMembers = team.members.filter((member) => {
      const joinDate = member.teamJoinedAt || member.createdAt;
      const memberEffectiveStart = getStartOfNextDay(joinDate, TIMEZONE);
      const dayStartNorm = getStartOfDay(currentDate, TIMEZONE);

      if (memberEffectiveStart > dayStartNorm) return false;
      if (wasOnExemption(member.id, currentDate)) return false;
      if (hasExcusedAbsence(member.id, currentDate)) return false;

      return true;
    });

    // Exempted but checked in
    const exemptedButCheckedIn = team.members.filter((member) => {
      const joinDate = member.teamJoinedAt || member.createdAt;
      const memberEffectiveStart = getStartOfNextDay(joinDate, TIMEZONE);
      const dayStartNorm = getStartOfDay(currentDate, TIMEZONE);

      if (memberEffectiveStart > dayStartNorm) return false;

      const isExempted = wasOnExemption(member.id, currentDate) || hasExcusedAbsence(member.id, currentDate);
      if (!isExempted) return false;
      if (!checkedInUserIds.has(member.id)) return false;

      return true;
    });

    const expectedCheckedIn = expectedMembers.filter(m => checkedInUserIds.has(m.id)).length;
    const checkedInCount = expectedCheckedIn + exemptedButCheckedIn.length;
    const dayExpected = expectedMembers.length + exemptedButCheckedIn.length;

    totalCheckins += checkedInCount;
    totalExpected += dayExpected;

    const dayCompliance = dayExpected > 0 ? Math.round((checkedInCount / dayExpected) * 100) : null;

    console.log(`${dateStr}: ${checkedInCount}/${dayExpected} = ${dayCompliance}%`);
    console.log(`  Expected: ${expectedMembers.map(m => m.firstName).join(', ') || 'none'}`);
    console.log(`  Exempted+CheckedIn: ${exemptedButCheckedIn.map(m => m.firstName).join(', ') || 'none'}`);

    currentDate.setTime(currentDate.getTime() + dayMs);
  }

  console.log('\n=== Total Sum ===');
  console.log(`Total Check-ins: ${totalCheckins}`);
  console.log(`Total Expected: ${totalExpected}`);
  console.log(`Period Compliance: ${totalExpected > 0 ? Math.round((totalCheckins / totalExpected) * 100) : 0}%`);

  // Compare with DailyTeamSummary
  console.log('\n=== DailyTeamSummary (for comparison) ===');
  const summaries = await prisma.dailyTeamSummary.findMany({
    where: { teamId: team.id },
    orderBy: { date: 'desc' },
    take: 7,
  });

  let summaryTotal = 0;
  let summaryExpected = 0;
  for (const s of summaries.filter(s => s.isWorkDay && !s.isHoliday).reverse()) {
    const dateStr = formatLocalDate(s.date, TIMEZONE);
    summaryTotal += s.checkedInCount;
    summaryExpected += s.expectedToCheckIn;
    console.log(`${dateStr}: ${s.checkedInCount}/${s.expectedToCheckIn}`);
  }
  console.log(`Summary Compliance: ${summaryExpected > 0 ? Math.round((summaryTotal / summaryExpected) * 100) : 0}%`);

  await prisma.$disconnect();
}

debug().catch(console.error);
