/**
 * Test script for DailyTeamSummary functionality
 * Run: npx tsx test-daily-summary.ts
 */

import { prisma } from './src/config/prisma.js';
import {
  recalculateTodaySummary,
  recalculateDailyTeamSummary,
  getTeamSummaryForDate,
  aggregateSummaries,
  generateWorkerHealthReport,
} from './src/utils/daily-summary.js';
import { getTodayForDbDate, DEFAULT_TIMEZONE } from './src/utils/date-helpers.js';

async function main() {
  console.log('='.repeat(60));
  console.log('DailyTeamSummary Test');
  console.log('='.repeat(60));

  try {
    // 1. Get a team to test with
    const team = await prisma.team.findFirst({
      where: { isActive: true },
      include: {
        company: { select: { timezone: true } },
        members: {
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!team) {
      console.log('No active team found. Please create a team first.');
      return;
    }

    const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
    console.log(`\nTeam: ${team.name}`);
    console.log(`Members: ${team.members.length}`);
    console.log(`Work Days: ${team.workDays}`);
    console.log(`Timezone: ${timezone}`);

    // 2. Recalculate today's summary
    console.log('\n--- Recalculating Today\'s Summary ---');
    const todaySummary = await recalculateTodaySummary(team.id, timezone);

    console.log('\nToday\'s Summary:');
    console.log(`  Date: ${todaySummary.date.toISOString().split('T')[0]}`);
    console.log(`  Is Work Day: ${todaySummary.isWorkDay}`);
    console.log(`  Is Holiday: ${todaySummary.isHoliday}`);
    console.log(`  Total Members: ${todaySummary.totalMembers}`);
    console.log(`  On Leave: ${todaySummary.onLeaveCount}`);
    console.log(`  Expected to Check In: ${todaySummary.expectedToCheckIn}`);
    console.log(`  Checked In: ${todaySummary.checkedInCount}`);
    console.log(`  Not Checked In: ${todaySummary.notCheckedInCount}`);
    console.log(`  Status Distribution: GREEN=${todaySummary.greenCount}, YELLOW=${todaySummary.yellowCount}, RED=${todaySummary.redCount}`);
    console.log(`  Avg Readiness: ${todaySummary.avgReadinessScore?.toFixed(1) || 'N/A'}`);
    console.log(`  Compliance Rate: ${todaySummary.complianceRate?.toFixed(1) || 'N/A'}%`);

    // 3. Verify it was saved to database
    console.log('\n--- Verifying Database Record ---');
    const dbRecord = await prisma.dailyTeamSummary.findUnique({
      where: {
        teamId_date: {
          teamId: team.id,
          date: getTodayForDbDate(timezone),
        },
      },
    });

    if (dbRecord) {
      console.log('✓ Summary saved to database successfully!');
      console.log(`  Record ID: ${dbRecord.id}`);
      console.log(`  Created At: ${dbRecord.createdAt}`);
      console.log(`  Updated At: ${dbRecord.updatedAt}`);
    } else {
      console.log('✗ Summary NOT found in database!');
    }

    // 4. Test Worker Health Report (if there are members)
    if (team.members.length > 0) {
      const testMember = team.members[0];
      console.log(`\n--- Testing Worker Health Report ---`);
      console.log(`Worker: ${testMember.firstName} ${testMember.lastName}`);

      try {
        const healthReport = await generateWorkerHealthReport(testMember.id);
        console.log('\nHealth Report:');
        console.log(`  Worker: ${healthReport.worker.name}`);
        console.log(`  Email: ${healthReport.worker.email}`);
        console.log(`  Team: ${healthReport.worker.team}`);

        if (healthReport.baseline) {
          console.log(`\n  Baseline (${healthReport.baseline.period} days):`);
          console.log(`    Total Check-ins: ${healthReport.baseline.totalCheckins}`);
          console.log(`    Avg Score: ${healthReport.baseline.avgScore.toFixed(1)}`);
          console.log(`    Avg Mood: ${healthReport.baseline.avgMood.toFixed(1)}`);
          console.log(`    Avg Stress: ${healthReport.baseline.avgStress.toFixed(1)}`);
          console.log(`    Avg Sleep: ${healthReport.baseline.avgSleep.toFixed(1)}`);
          console.log(`    Lowest Score: ${healthReport.baseline.lowestScore}`);
          console.log(`    Highest Score: ${healthReport.baseline.highestScore}`);
        } else {
          console.log('  No baseline data (no check-ins in period)');
        }

        if (healthReport.monthlyHistory.length > 0) {
          console.log(`\n  Monthly History (${healthReport.monthlyHistory.length} months):`);
          for (const month of healthReport.monthlyHistory.slice(0, 3)) {
            console.log(`    ${month.year}-${String(month.month).padStart(2, '0')}: Avg=${month.avgScore.toFixed(1)}, Check-ins=${month.totalCheckins}`);
          }
        }
      } catch (error) {
        console.log(`  Error generating health report: ${error}`);
      }
    }

    // 5. Show all DailyTeamSummary records in DB
    console.log('\n--- All DailyTeamSummary Records ---');
    const allSummaries = await prisma.dailyTeamSummary.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        team: { select: { name: true } },
      },
    });

    if (allSummaries.length > 0) {
      console.log(`Found ${allSummaries.length} records:`);
      for (const s of allSummaries) {
        console.log(`  ${s.date.toISOString().split('T')[0]} | ${s.team.name} | Members=${s.totalMembers} | CheckedIn=${s.checkedInCount}/${s.expectedToCheckIn} | Compliance=${s.complianceRate?.toFixed(0) || 'N/A'}%`);
      }
    } else {
      console.log('No summary records found yet.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
