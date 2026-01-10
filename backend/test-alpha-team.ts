/**
 * Test: Compare Alpha Team grades between Teams Overview and Team Analytics
 * Run with: npx tsx test-alpha-team.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateTeamsOverviewOptimized } from './src/utils/team-grades-optimized.js';
import { getLastNDaysRange, formatLocalDate, getStartOfDay, getStartOfNextDay } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('  ALPHA TEAM COMPARISON');
  console.log('==========================================\n');

  const company = await prisma.company.findFirst({
    select: { id: true, name: true, timezone: true },
  });

  if (!company) {
    console.log('No company found');
    return;
  }

  const timezone = company.timezone;
  console.log(`Company: ${company.name}`);
  console.log(`Timezone: ${timezone}\n`);

  // Find Alpha Team
  const alphaTeam = await prisma.team.findFirst({
    where: { companyId: company.id, name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true, role: true, teamJoinedAt: true, createdAt: true },
      },
      leader: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!alphaTeam) {
    console.log('Alpha Team not found');
    return;
  }

  console.log(`Team: ${alphaTeam.name}`);
  console.log(`Leader: ${alphaTeam.leader?.firstName} ${alphaTeam.leader?.lastName}`);
  console.log(`Members (WORKER/MEMBER only): ${alphaTeam.members.length}`);
  for (const m of alphaTeam.members) {
    console.log(`  - ${m.firstName} ${m.lastName} (${m.role})`);
  }
  console.log('');

  // Check if there are other members with different roles
  const allMembers = await prisma.user.findMany({
    where: { teamId: alphaTeam.id, isActive: true },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  console.log(`All active users in team: ${allMembers.length}`);
  for (const m of allMembers) {
    const included = alphaTeam.members.some(am => am.id === m.id);
    console.log(`  - ${m.firstName} ${m.lastName} (${m.role}) ${included ? '✓ included' : '✗ EXCLUDED'}`);
  }
  console.log('');

  // Test 7 days
  const days = 7;
  const { start: startDate, end: endDate } = getLastNDaysRange(days - 1, timezone);

  console.log(`Period: Last ${days} days`);
  console.log(`Date Range: ${formatLocalDate(startDate, timezone)} to ${formatLocalDate(endDate, timezone)}\n`);

  // Get Teams Overview result for Alpha Team
  const overviewResult = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    days,
    timezone,
    teamIds: [alphaTeam.id],
  });

  const overviewTeam = overviewResult.teams[0];

  // Calculate Team Analytics style (simulating the endpoint)
  const analyticsResult = await calculateTeamAnalytics(alphaTeam.id, company.id, timezone, days);

  console.log('==========================================');
  console.log('  RESULTS COMPARISON');
  console.log('==========================================\n');

  console.log('TEAMS OVERVIEW (Executive view):');
  console.log(`  Grade: ${overviewTeam?.grade} (${overviewTeam?.score}/100)`);
  console.log(`  Compliance: ${overviewTeam?.attendanceRate}%`);
  console.log(`  Members: ${overviewTeam?.memberCount}`);
  console.log('');

  console.log('TEAM ANALYTICS (Team Lead view):');
  console.log(`  Grade: ${analyticsResult?.letter} (${analyticsResult?.score}/100)`);
  console.log(`  Compliance: ${analyticsResult?.compliance}%`);
  console.log(`  Avg Readiness: ${analyticsResult?.avgReadiness}%`);
  console.log(`  Members: ${analyticsResult?.memberCount}`);
  console.log('');

  // Check match
  const gradeMatch = overviewTeam?.grade === analyticsResult?.letter;
  const scoreMatch = overviewTeam?.score === analyticsResult?.score;
  const complianceMatch = overviewTeam?.attendanceRate === analyticsResult?.compliance;

  console.log('==========================================');
  console.log('  MATCH STATUS');
  console.log('==========================================');
  console.log(`Grade: ${gradeMatch ? '✅' : '❌'} (${overviewTeam?.grade} vs ${analyticsResult?.letter})`);
  console.log(`Score: ${scoreMatch ? '✅' : '❌'} (${overviewTeam?.score} vs ${analyticsResult?.score})`);
  console.log(`Compliance: ${complianceMatch ? '✅' : '❌'} (${overviewTeam?.attendanceRate}% vs ${analyticsResult?.compliance}%)`);
}

async function calculateTeamAnalytics(teamId: string, companyId: string, timezone: string, days: number) {
  // Same calculation as Team Analytics endpoint
  const { start: startDate, end: endDate } = getLastNDaysRange(days - 1, timezone);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, teamJoinedAt: true, createdAt: true },
      },
    },
  });

  if (!team) return null;

  const memberIds = team.members.map(m => m.id);
  const workDaysList = (team.workDays || 'MON,TUE,WED,THU,FRI').split(',').map(d => d.trim().toUpperCase());
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Get holidays
  const holidays = await prisma.holiday.findMany({
    where: { companyId, date: { gte: startDate, lte: endDate } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map(h => formatLocalDate(h.date, timezone)));

  // Get exemptions
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  const exemptionsByUser = new Map<string, typeof exemptions>();
  for (const ex of exemptions) {
    if (!exemptionsByUser.has(ex.userId)) exemptionsByUser.set(ex.userId, []);
    exemptionsByUser.get(ex.userId)!.push(ex);
  }

  // Get check-ins
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { userId: true, createdAt: true, readinessScore: true },
  });

  // Group by user and date
  const checkinsByUser = new Map<string, Map<string, number>>();
  for (const c of checkins) {
    if (!checkinsByUser.has(c.userId)) checkinsByUser.set(c.userId, new Map());
    const dateStr = formatLocalDate(c.createdAt, timezone);
    if (!checkinsByUser.get(c.userId)!.has(dateStr)) {
      checkinsByUser.get(c.userId)!.set(dateStr, c.readinessScore);
    }
  }

  // Build member effective starts
  const memberStarts = new Map<string, Date>();
  for (const m of team.members) {
    memberStarts.set(m.id, getStartOfNextDay(m.teamJoinedAt || m.createdAt, timezone));
  }

  // Calculate daily compliance
  const dailyCompliances: number[] = [];
  const allScores: number[] = [];

  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatLocalDate(current, timezone);
    const dayOfWeek = current.getDay();

    if (!workDaysList.includes(dayNames[dayOfWeek]) || holidaySet.has(dateStr)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const currentDayStart = getStartOfDay(current, timezone);
    const expectedMembers: string[] = [];
    const exemptedMembers: string[] = [];

    for (const member of team.members) {
      const effStart = memberStarts.get(member.id)!;
      if (current < effStart) continue;

      const userExemptions = exemptionsByUser.get(member.id) || [];
      const isExempted = userExemptions.some(ex => {
        if (!ex.startDate || !ex.endDate) return false;
        const exemptStart = getStartOfDay(ex.startDate, timezone);
        const exemptEnd = getStartOfDay(ex.endDate, timezone);
        return currentDayStart >= exemptStart && currentDayStart <= exemptEnd;
      });

      if (isExempted) {
        exemptedMembers.push(member.id);
      } else {
        expectedMembers.push(member.id);
      }
    }

    let expectedCheckedIn = 0;
    let exemptedButCheckedIn = 0;

    for (const memberId of expectedMembers) {
      const score = checkinsByUser.get(memberId)?.get(dateStr);
      if (score !== undefined) {
        expectedCheckedIn++;
        allScores.push(score);
      }
    }

    for (const memberId of exemptedMembers) {
      const score = checkinsByUser.get(memberId)?.get(dateStr);
      if (score !== undefined) {
        exemptedButCheckedIn++;
        allScores.push(score);
      }
    }

    const dayExpected = expectedMembers.length + exemptedButCheckedIn;
    const dayCheckedIn = expectedCheckedIn + exemptedButCheckedIn;

    if (dayExpected > 0) {
      const comp = Math.min(100, Math.round((dayCheckedIn / dayExpected) * 100));
      dailyCompliances.push(comp);
    }

    current.setDate(current.getDate() + 1);
  }

  const avgReadiness = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  const compliance = dailyCompliances.length > 0
    ? Math.round(dailyCompliances.reduce((a, b) => a + b, 0) / dailyCompliances.length)
    : 0;

  const score = Math.round((avgReadiness * 0.6) + (compliance * 0.4));

  const getLetterGrade = (s: number) => {
    if (s >= 97) return 'A+';
    if (s >= 93) return 'A';
    if (s >= 90) return 'A-';
    if (s >= 87) return 'B+';
    if (s >= 83) return 'B';
    if (s >= 80) return 'B-';
    if (s >= 77) return 'C+';
    if (s >= 73) return 'C';
    if (s >= 70) return 'C-';
    if (s >= 67) return 'D+';
    if (s >= 63) return 'D';
    if (s >= 60) return 'D-';
    return 'F';
  };

  return {
    letter: getLetterGrade(score),
    score,
    avgReadiness,
    compliance,
    memberCount: memberIds.length,
  };
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
