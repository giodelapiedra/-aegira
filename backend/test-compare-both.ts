/**
 * Test Script: Compare Teams Overview vs Team Analytics
 *
 * Directly compares the grades from both views for the SAME team and period.
 * Run with: npx tsx test-compare-both.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateTeamsOverviewOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('  COMPARE: Teams Overview vs Team Analytics');
  console.log('==========================================\n');

  // Get company
  const company = await prisma.company.findFirst({
    select: { id: true, name: true, timezone: true },
  });

  if (!company) {
    console.log('❌ No company found');
    return;
  }

  console.log(`📍 Company: ${company.name}\n`);

  // Get first team
  const team = await prisma.team.findFirst({
    where: { companyId: company.id, isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
      },
    },
  });

  if (!team) {
    console.log('❌ No team found');
    return;
  }

  console.log(`📁 Team: ${team.name}\n`);

  // Test both 7 days and 14 days
  for (const days of [7, 14]) {
    console.log(`\n==========================================`);
    console.log(`  ${days}-DAY COMPARISON`);
    console.log(`==========================================\n`);

    // Get Teams Overview result
    const overviewResult = await calculateTeamsOverviewOptimized({
      companyId: company.id,
      days,
      timezone: company.timezone,
      teamIds: [team.id],
    });

    const overviewTeam = overviewResult.teams[0];

    // Simulate what Team Analytics calculates
    // (We'll calculate it manually using the same logic as the endpoint)
    const teamAnalyticsResult = await calculateTeamAnalyticsGrade(team.id, company.id, company.timezone, days);

    // Debug: show the raw values
    console.log('Raw overviewTeam:', JSON.stringify(overviewTeam, null, 2));
    console.log('');

    console.log('┌──────────────────┬───────────────────┬───────────────────┐');
    console.log('│ Metric           │ Teams Overview    │ Team Analytics    │');
    console.log('├──────────────────┼───────────────────┼───────────────────┤');
    console.log(`│ Grade            │ ${(overviewTeam?.grade || 'N/A').padEnd(17)} │ ${(teamAnalyticsResult?.letter || 'N/A').padEnd(17)} │`);
    console.log(`│ Score            │ ${String(overviewTeam?.score || 0).padEnd(17)} │ ${String(teamAnalyticsResult?.score || 0).padEnd(17)} │`);
    console.log(`│ Compliance       │ ${String(overviewTeam?.attendanceRate || 0).padEnd(15)}% │ ${String(teamAnalyticsResult?.compliance || 0).padEnd(15)}% │`);
    console.log(`│ On-Time Rate     │ ${String(overviewTeam?.onTimeRate || 0).padEnd(15)}% │ N/A               │`);
    console.log('└──────────────────┴───────────────────┴───────────────────┘');

    // Check if they match
    const gradeMatch = overviewTeam?.grade === teamAnalyticsResult?.letter;
    const scoreMatch = overviewTeam?.score === teamAnalyticsResult?.score;
    const complianceMatch = overviewTeam?.attendanceRate === teamAnalyticsResult?.compliance;

    console.log('');
    console.log(`Grade Match: ${gradeMatch ? '✅ YES' : '❌ NO'} (${overviewTeam?.grade} vs ${teamAnalyticsResult?.letter})`);
    console.log(`Score Match: ${scoreMatch ? '✅ YES' : '❌ NO'} (${overviewTeam?.score} vs ${teamAnalyticsResult?.score})`);
    console.log(`Compliance Match: ${complianceMatch ? '✅ YES' : '❌ NO'} (${overviewTeam?.attendanceRate}% vs ${teamAnalyticsResult?.compliance}%)`);

    if (!gradeMatch || !scoreMatch) {
      console.log('');
      console.log('⚠️  DIFFERENCE FOUND!');
      console.log('');
      console.log('Teams Overview calculation:');
      console.log(`  Avg Readiness: ${overviewTeam?.attendanceRate}%`);
      console.log(`  Compliance: ${overviewTeam?.attendanceRate}%`);
      console.log(`  Score: (${overviewTeam?.attendanceRate} × 0.6) + (${overviewTeam?.attendanceRate} × 0.4) = ${overviewTeam?.score}`);
      console.log('');
      console.log('Team Analytics calculation:');
      console.log(`  Avg Readiness: ${teamAnalyticsResult?.avgReadiness}%`);
      console.log(`  Compliance: ${teamAnalyticsResult?.compliance}%`);
      console.log(`  Score: (${teamAnalyticsResult?.avgReadiness} × 0.6) + (${teamAnalyticsResult?.compliance} × 0.4) = ${teamAnalyticsResult?.score}`);
    }
  }

  console.log('\n✅ Test Complete');
}

/**
 * Simulates Team Analytics grade calculation
 * This should match what /teams/my/analytics returns
 */
async function calculateTeamAnalyticsGrade(teamId: string, companyId: string, timezone: string, days: number) {
  const { getLastNDaysRange, formatLocalDate, getTodayRange, getStartOfNextDay, getStartOfDay } = await import('./src/utils/date-helpers.js');

  // Team Analytics uses (days - 1) for getLastNDaysRange
  // e.g., 14days uses getLastNDaysRange(13), 7days uses getLastNDaysRange(6)
  const { start: startDate, end: endDate } = getLastNDaysRange(days - 1, timezone);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
        select: { id: true, teamJoinedAt: true, createdAt: true },
      },
    },
  });

  if (!team) return null;

  const memberIds = team.members.map(m => m.id);
  const teamWorkDays = team.workDays || 'MON,TUE,WED,THU,FRI';
  const workDaysList = teamWorkDays.split(',').map(d => d.trim().toUpperCase());
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

  // Group check-ins by date
  const checkinsByDate = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const dateStr = formatLocalDate(c.createdAt, timezone);
    if (!checkinsByDate.has(dateStr)) checkinsByDate.set(dateStr, []);
    checkinsByDate.get(dateStr)!.push(c);
  }

  // Build member effective start dates
  const memberStarts = new Map<string, Date>();
  for (const m of team.members) {
    memberStarts.set(m.id, getStartOfNextDay(m.teamJoinedAt || m.createdAt, timezone));
  }

  // Calculate daily compliance (same as Team Analytics trendData)
  // UPDATED: Now matches Team Analytics exactly with getStartOfDay and exempted-but-checked-in logic
  const dailyCompliances: number[] = [];
  const allScores: number[] = [];

  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatLocalDate(current, timezone);
    const dayOfWeek = current.getDay();

    // Skip non-work days and holidays
    if (!workDaysList.includes(dayNames[dayOfWeek]) || holidaySet.has(dateStr)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Normalize current date for exemption comparison (same as Team Analytics)
    const currentDayStart = getStartOfDay(current, timezone);

    // Separate expected members from exempted members
    const expectedMembers: string[] = [];
    const exemptedMembers: string[] = [];

    for (const member of team.members) {
      const effStart = memberStarts.get(member.id)!;
      if (current < effStart) continue;

      // Check exemption with proper date normalization (same as Team Analytics)
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

    // Get check-ins for this day
    const dayCheckins = checkinsByDate.get(dateStr) || [];
    const dayCheckinUserIds = new Set(dayCheckins.map(c => c.userId));

    // Count expected members who checked in
    const expectedCheckedIn = expectedMembers.filter(id => dayCheckinUserIds.has(id)).length;

    // Count exempted members who also checked in (same as Team Analytics)
    const exemptedButCheckedIn = exemptedMembers.filter(id => dayCheckinUserIds.has(id)).length;

    // Add readiness scores from all check-ins (including exempted who checked in)
    for (const c of dayCheckins) {
      allScores.push(c.readinessScore);
    }

    // Calculate compliance (same as Team Analytics):
    // Expected = regular expected members + exempted who checked in
    // CheckedIn = expected who checked in + exempted who checked in
    const dayExpected = expectedMembers.length + exemptedButCheckedIn;
    const dayCheckedIn = expectedCheckedIn + exemptedButCheckedIn;

    if (dayExpected > 0) {
      const comp = Math.min(100, Math.round((dayCheckedIn / dayExpected) * 100));
      dailyCompliances.push(comp);
    }

    current.setDate(current.getDate() + 1);
  }

  // Calculate averages (same as Team Analytics)
  const avgReadiness = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  const periodCompliance = dailyCompliances.length > 0
    ? Math.round(dailyCompliances.reduce((a, b) => a + b, 0) / dailyCompliances.length)
    : 0;

  // Calculate grade score
  const score = Math.round((avgReadiness * 0.6) + (periodCompliance * 0.4));

  // Get letter grade
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
    compliance: periodCompliance,
  };
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
