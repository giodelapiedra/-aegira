/**
 * Test compliance consistency between Team Analytics and Team Summary
 */

import { PrismaClient } from '@prisma/client';
import { calculateSingleTeamGradeOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient();

async function test() {
  console.log('='.repeat(60));
  console.log('Compliance Consistency Test (Total Sum Method)');
  console.log('='.repeat(60));

  // Get all teams with summaries
  const teams = await prisma.team.findMany({
    where: { dailyTeamSummaries: { some: {} } },
    include: { company: { select: { id: true, timezone: true } } },
  });

  if (teams.length === 0) {
    console.log('No teams found');
    return;
  }

  let allConsistent = true;

  for (const team of teams) {
    console.log('\n--- Team:', team.name, '---');

    // Calculate using Team Analytics method (team-grades-optimized)
    const analyticsGrade = await calculateSingleTeamGradeOptimized(team.id, {
      companyId: team.companyId,
      days: 7,
      timezone: team.company?.timezone || 'Asia/Manila',
    });

    // Calculate using Team Summary method (DailyTeamSummary)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setUTCHours(12, 0, 0, 0);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setUTCHours(12, 0, 0, 0);

    const summaries = await prisma.dailyTeamSummary.findMany({
      where: {
        teamId: team.id,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Calculate compliance using Total Sum from DailyTeamSummary
    const workDaySummaries = summaries.filter(s => s.isWorkDay && !s.isHoliday);
    const totalExpected = workDaySummaries.reduce((sum, s) => sum + s.expectedToCheckIn, 0);
    const totalCheckedIn = workDaySummaries.reduce((sum, s) => sum + s.checkedInCount, 0);
    const summaryCompliance = totalExpected > 0
      ? Math.round((totalCheckedIn / totalExpected) * 100)
      : 0;

    console.log('  Team Analytics Compliance:', analyticsGrade?.attendanceRate + '%');
    console.log('  Team Summary Compliance:', summaryCompliance + '%');
    console.log('  Check-ins:', totalCheckedIn + '/' + totalExpected);

    if (analyticsGrade?.attendanceRate === summaryCompliance) {
      console.log('  ✓ CONSISTENT');
    } else {
      console.log('  ✗ MISMATCH!');
      allConsistent = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allConsistent) {
    console.log('✓ ALL TEAMS CONSISTENT');
  } else {
    console.log('✗ SOME TEAMS HAVE MISMATCHES');
  }
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

test().catch(console.error);
