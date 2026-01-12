/**
 * Debug Alpha Team compliance mismatch
 */

import { PrismaClient } from '@prisma/client';
import { calculateSingleTeamGradeOptimized } from './src/utils/team-grades-optimized.js';
import { getLastNDaysRange, formatLocalDate, getStartOfDay } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function debug() {
  console.log('='.repeat(60));
  console.log('Alpha Team Debug');
  console.log('='.repeat(60));

  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!team) {
    console.log('Alpha team not found');
    return;
  }

  console.log('\nTeam:', team.name);
  console.log('Members:', team.members.length);
  console.log('Work Days:', team.workDays);

  // Get Team Analytics date range (uses days - 1)
  const { start: analyticsStart, end: analyticsEnd } = getLastNDaysRange(6, TIMEZONE);
  console.log('\nTeam Analytics Date Range:');
  console.log('  Start:', formatLocalDate(analyticsStart, TIMEZONE));
  console.log('  End:', formatLocalDate(analyticsEnd, TIMEZONE));

  // Get Team Summary date range
  const now = new Date();
  const summaryEnd = new Date(now);
  summaryEnd.setUTCHours(12, 0, 0, 0);
  const summaryStart = new Date(now);
  summaryStart.setDate(summaryStart.getDate() - 6);
  summaryStart.setUTCHours(12, 0, 0, 0);
  console.log('\nTeam Summary Date Range:');
  console.log('  Start:', summaryStart.toISOString().split('T')[0]);
  console.log('  End:', summaryEnd.toISOString().split('T')[0]);

  // Get approved exemptions for this team
  const memberIds = team.members.map(m => m.id);
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: analyticsEnd },
      endDate: { gte: analyticsStart },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  console.log('\nApproved Exemptions in range:');
  if (exemptions.length === 0) {
    console.log('  None');
  } else {
    exemptions.forEach(e => {
      console.log(`  ${e.user.firstName} ${e.user.lastName}: ${e.type}`);
      console.log(`    ${e.startDate.toISOString().split('T')[0]} to ${e.endDate.toISOString().split('T')[0]}`);
    });
  }

  // Get DailyTeamSummary data
  const summaries = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId: team.id,
      date: { gte: summaryStart, lte: summaryEnd },
    },
    orderBy: { date: 'desc' },
  });

  console.log('\n--- DailyTeamSummary Data ---');
  let totalExp = 0;
  let totalIn = 0;
  summaries.forEach(s => {
    const dateStr = s.date.toISOString().split('T')[0];
    if (s.isWorkDay && !s.isHoliday) {
      totalExp += s.expectedToCheckIn;
      totalIn += s.checkedInCount;
      console.log(`  ${dateStr}: ${s.checkedInCount}/${s.expectedToCheckIn} (onLeave: ${s.onLeaveCount})`);
    } else {
      console.log(`  ${dateStr}: [${s.isHoliday ? 'Holiday' : 'Rest Day'}]`);
    }
  });
  console.log(`  TOTAL: ${totalIn}/${totalExp} = ${Math.round((totalIn/totalExp)*100)}%`);

  // Now check what Team Analytics is calculating
  console.log('\n--- Team Analytics Calculation ---');
  const grade = await calculateSingleTeamGradeOptimized(team.id, {
    companyId: team.companyId,
    days: 7,
    timezone: TIMEZONE,
  });

  console.log('  Attendance Rate:', grade?.attendanceRate + '%');
  console.log('  Breakdown:', grade?.breakdown);

  await prisma.$disconnect();
}

debug().catch(console.error);
