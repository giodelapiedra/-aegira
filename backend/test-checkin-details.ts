import { PrismaClient } from '@prisma/client';
import { formatLocalDate, getStartOfDay } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function check() {
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true }
      }
    }
  });

  if (!team) return;

  console.log('=== Alpha Team Check-in Details ===\n');

  // Get all check-ins for team members
  const checkins = await prisma.checkin.findMany({
    where: { userId: { in: team.members.map(m => m.id) } },
    orderBy: { createdAt: 'desc' },
    select: {
      userId: true,
      readinessScore: true,
      readinessStatus: true,
      createdAt: true
    }
  });

  const memberNames = new Map(team.members.map(m => [m.id, m.firstName]));

  console.log('All check-ins by date (Manila time):');
  console.log('-'.repeat(60));

  // Group by date
  const byDate = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const dateStr = formatLocalDate(c.createdAt, TIMEZONE);
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(c);
  }

  // Sort dates descending
  const dates = Array.from(byDate.keys()).sort().reverse();

  for (const dateStr of dates.slice(0, 14)) { // Last 14 days
    const dayCheckins = byDate.get(dateStr)!;
    console.log(`\n${dateStr}:`);
    for (const c of dayCheckins) {
      const name = memberNames.get(c.userId) || 'Unknown';
      console.log(`  ${name}: ${c.readinessScore} (${c.readinessStatus})`);
    }
  }

  // Now calculate member averages for Jan 6-12 (same as 7-day period)
  console.log('\n' + '='.repeat(60));
  console.log('Member Averages for Jan 6-12:');
  console.log('='.repeat(60));

  const targetDates = new Set(['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12']);

  const memberScores = new Map<string, number[]>();
  for (const c of checkins) {
    const dateStr = formatLocalDate(c.createdAt, TIMEZONE);
    if (targetDates.has(dateStr)) {
      if (!memberScores.has(c.userId)) memberScores.set(c.userId, []);
      memberScores.get(c.userId)!.push(c.readinessScore);
    }
  }

  const memberAverages: number[] = [];
  for (const member of team.members) {
    const scores = memberScores.get(member.id) || [];
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      memberAverages.push(avg);
      console.log(`${member.firstName}: [${scores.join(', ')}] → avg=${avg.toFixed(1)}`);
    } else {
      console.log(`${member.firstName}: no check-ins in period`);
    }
  }

  const teamAvgScore = memberAverages.length > 0
    ? memberAverages.reduce((a, b) => a + b, 0) / memberAverages.length
    : 0;

  console.log(`\nTeam Avg Score = ${teamAvgScore.toFixed(1)} → rounded = ${Math.round(teamAvgScore)}`);

  await prisma.$disconnect();
}

check().catch(console.error);
