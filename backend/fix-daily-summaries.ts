import { PrismaClient } from '@prisma/client';
import { recalculateDailyTeamSummary } from './src/utils/daily-summary.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function fix() {
  console.log('=== Recalculating DailyTeamSummary for all teams ===\n');

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: { id: true, name: true, companyId: true }
  });

  // Recalculate last 30 days for each team
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const team of teams) {
    console.log(`\nRecalculating: ${team.name}`);

    let currentDate = new Date(thirtyDaysAgo);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      try {
        const summary = await recalculateDailyTeamSummary(team.id, new Date(currentDate), TIMEZONE);

        // Only log work days with exemptions
        if (summary.isWorkDay && !summary.isHoliday && summary.onLeaveCount > 0) {
          console.log(`  ${dateStr}: Excused=${summary.onLeaveCount}, Expected=${summary.expectedToCheckIn}`);
        }
      } catch (err) {
        console.error(`  Error on ${dateStr}:`, err);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  console.log('\n=== Verification after fix ===\n');

  // Verify Jan 5 specifically
  const jan5Summary = await prisma.dailyTeamSummary.findFirst({
    where: {
      date: new Date('2026-01-05T12:00:00.000Z'),
    },
    include: { team: { select: { name: true } } }
  });

  if (jan5Summary) {
    console.log(`Jan 5 (${jan5Summary.team.name}):`);
    console.log(`  Expected: ${jan5Summary.expectedToCheckIn}`);
    console.log(`  CheckedIn: ${jan5Summary.checkedInCount}`);
    console.log(`  Excused: ${jan5Summary.onLeaveCount}`);
    console.log(`  Absent: ${jan5Summary.expectedToCheckIn - jan5Summary.checkedInCount}`);
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
