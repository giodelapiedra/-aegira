/**
 * Recalculate DailyTeamSummary for dates with EXCUSED absences
 */

import { PrismaClient } from '@prisma/client';
import { recalculateDailyTeamSummary } from './src/utils/daily-summary.js';

const prisma = new PrismaClient();

async function recalc() {
  console.log('Recalculating DailyTeamSummary...');

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: { id: true, name: true, companyId: true },
  });

  // Recalculate last 7 days for all teams
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    for (const team of teams) {
      await recalculateDailyTeamSummary(team.id, date, 'Asia/Manila');
      console.log(`  ${date.toISOString().split('T')[0]} - ${team.name}`);
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

recalc().catch(console.error);
