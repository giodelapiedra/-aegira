import { PrismaClient } from '@prisma/client';
import { formatLocalDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function check() {
  // Get Alpha team
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true, totalCheckins: true }
      }
    }
  });

  if (!team) {
    console.log('Team not found');
    return;
  }

  console.log('=== Alpha Team - Score Breakdown ===\n');

  // Check threshold
  const MIN_CHECKIN_DAYS_THRESHOLD = 3;
  console.log('--- Total Check-ins (for threshold) ---');
  for (const m of team.members) {
    const status = m.totalCheckins >= MIN_CHECKIN_DAYS_THRESHOLD ? 'INCLUDED' : 'EXCLUDED (onboarding)';
    console.log(`${m.firstName}: ${m.totalCheckins} total → ${status}`);
  }
  console.log('');

  // Get check-ins for last 7 days (Jan 6-12)
  const endDate = new Date('2026-01-12T23:59:59Z');
  const startDate = new Date('2026-01-06T00:00:00Z');

  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: team.members.map(m => m.id) },
      createdAt: { gte: startDate, lte: endDate }
    },
    select: { userId: true, readinessScore: true, createdAt: true }
  });

  console.log('Total check-ins in period:', checkins.length);

  // Calculate per-member averages (Team Analytics method)
  const memberScores = new Map<string, number[]>();
  for (const checkin of checkins) {
    if (!memberScores.has(checkin.userId)) memberScores.set(checkin.userId, []);
    memberScores.get(checkin.userId)!.push(checkin.readinessScore);
  }

  console.log('\n--- Per Member Scores (last 7 days) ---');
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

  // Team Avg Score = average of member averages
  const teamAvgScore = memberAverages.length > 0
    ? memberAverages.reduce((a, b) => a + b, 0) / memberAverages.length
    : 0;

  console.log('\n--- Calculations ---');
  console.log(`Member averages: [${memberAverages.map(a => a.toFixed(1)).join(', ')}]`);
  console.log(`Team Avg Score = ${teamAvgScore.toFixed(1)}%`);
  console.log(`(Average OF member averages, each member weighted equally)`);

  // Also show flat average for comparison
  const allScores = checkins.map(c => c.readinessScore);
  const flatAvg = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;
  console.log(`\nFlat average (all scores): ${flatAvg.toFixed(1)}%`);
  console.log(`(Just for comparison - NOT what Team Analytics uses)`);

  // Compliance (from DailyTeamSummary)
  const summaries = await prisma.dailyTeamSummary.findMany({
    where: { teamId: team.id },
    orderBy: { date: 'desc' },
    take: 7
  });

  const workDaySummaries = summaries.filter(s => s.isWorkDay && !s.isHoliday);
  const totalCheckins = workDaySummaries.reduce((sum, s) => sum + s.checkedInCount, 0);
  const totalExpected = workDaySummaries.reduce((sum, s) => sum + s.expectedToCheckIn, 0);
  const compliance = totalExpected > 0 ? (totalCheckins / totalExpected) * 100 : 0;

  console.log('\n--- Compliance (from DailyTeamSummary) ---');
  console.log(`Total check-ins: ${totalCheckins}`);
  console.log(`Total expected: ${totalExpected}`);
  console.log(`Compliance = ${totalCheckins}/${totalExpected} = ${compliance.toFixed(0)}%`);

  console.log('\n=== Summary ===');
  console.log(`Team Avg Score: ${Math.round(teamAvgScore)}% (readiness quality)`);
  console.log(`Compliance: ${Math.round(compliance)}% (attendance rate)`);

  await prisma.$disconnect();
}

check().catch(console.error);
