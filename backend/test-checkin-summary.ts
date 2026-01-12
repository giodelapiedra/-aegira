/**
 * Test script to simulate check-ins and verify DailyTeamSummary updates
 * Run: npx tsx test-checkin-summary.ts
 */

import { prisma } from './src/config/prisma.js';
import { recalculateTodaySummary } from './src/utils/daily-summary.js';
import { getTodayForDbDate, getTodayRange, DEFAULT_TIMEZONE } from './src/utils/date-helpers.js';
import { calculateReadiness } from './src/utils/readiness.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Check-in & Summary Test');
  console.log('='.repeat(60));

  try {
    // 1. Get a team with members
    const team = await prisma.team.findFirst({
      where: { isActive: true },
      include: {
        company: { select: { id: true, timezone: true } },
        members: {
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true },
          take: 5,
        },
      },
    });

    if (!team || team.members.length === 0) {
      console.log('No active team with members found.');
      return;
    }

    const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
    const companyId = team.companyId;
    const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

    console.log(`\nTeam: ${team.name}`);
    console.log(`Members: ${team.members.length}`);
    console.log(`Timezone: ${timezone}`);

    // 2. Check for existing check-ins today
    const existingCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: team.members.map(m => m.id) },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { userId: true },
    });

    const checkedInUserIds = new Set(existingCheckins.map(c => c.userId));
    const membersToCheckIn = team.members.filter(m => !checkedInUserIds.has(m.id));

    console.log(`\nExisting check-ins today: ${checkedInUserIds.size}`);
    console.log(`Members to check in: ${membersToCheckIn.length}`);

    // 3. Create check-ins for members who haven't checked in
    if (membersToCheckIn.length > 0) {
      console.log('\n--- Creating Check-ins ---');

      for (let i = 0; i < Math.min(3, membersToCheckIn.length); i++) {
        const member = membersToCheckIn[i];

        // Random health data
        const mood = 5 + Math.floor(Math.random() * 5); // 5-9
        const stress = 2 + Math.floor(Math.random() * 5); // 2-6
        const sleep = 5 + Math.floor(Math.random() * 4); // 5-8
        const physicalHealth = 6 + Math.floor(Math.random() * 4); // 6-9

        const { score, status } = calculateReadiness({ mood, stress, sleep, physicalHealth });

        const checkin = await prisma.checkin.create({
          data: {
            userId: member.id,
            companyId,
            mood,
            stress,
            sleep,
            physicalHealth,
            readinessScore: score,
            readinessStatus: status,
          },
        });

        console.log(`  ✓ ${member.firstName} ${member.lastName}: Score=${score} (${status})`);
      }
    }

    // 4. Recalculate today's summary
    console.log('\n--- Recalculating Summary ---');
    const summary = await recalculateTodaySummary(team.id, timezone);

    console.log('\nUpdated Summary:');
    console.log(`  Date: ${summary.date.toISOString().split('T')[0]}`);
    console.log(`  Is Work Day: ${summary.isWorkDay}`);
    console.log(`  Total Members: ${summary.totalMembers}`);
    console.log(`  On Leave: ${summary.onLeaveCount}`);
    console.log(`  Expected: ${summary.expectedToCheckIn}`);
    console.log(`  Checked In: ${summary.checkedInCount}`);
    console.log(`  Not Checked In: ${summary.notCheckedInCount}`);
    console.log(`  Status: GREEN=${summary.greenCount}, YELLOW=${summary.yellowCount}, RED=${summary.redCount}`);
    console.log(`  Avg Readiness: ${summary.avgReadinessScore?.toFixed(1) || 'N/A'}`);
    console.log(`  Compliance: ${summary.complianceRate?.toFixed(1) || 'N/A'}%`);

    // 5. Verify database record
    const dbRecord = await prisma.dailyTeamSummary.findUnique({
      where: {
        teamId_date: {
          teamId: team.id,
          date: getTodayForDbDate(timezone),
        },
      },
    });

    if (dbRecord) {
      console.log('\n✓ Database record verified!');
      console.log(`  Record ID: ${dbRecord.id}`);
    }

    // 6. Show all summaries
    console.log('\n--- All DailyTeamSummary Records ---');
    const allSummaries = await prisma.dailyTeamSummary.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: { team: { select: { name: true } } },
    });

    for (const s of allSummaries) {
      const complianceStr = s.complianceRate !== null ? `${s.complianceRate.toFixed(0)}%` : 'N/A';
      console.log(`  ${s.date.toISOString().split('T')[0]} | ${s.team.name.substring(0, 20)} | Checked=${s.checkedInCount}/${s.expectedToCheckIn} | Compliance=${complianceStr}`);
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
