import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Teams Overview Data Check ===\n');

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  console.log('Teams:', teams.map(t => t.name).join(', '));
  console.log('');

  // Get last 30 days of DailyTeamSummary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const team of teams) {
    const summaries = await prisma.dailyTeamSummary.findMany({
      where: {
        teamId: team.id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    console.log(`\n=== ${team.name} ===`);
    
    // Aggregate totals (only work days, not holidays)
    let totalCheckins = 0;
    let totalExpected = 0;
    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;
    let totalExcused = 0;
    let workDayCount = 0;

    for (const s of summaries) {
      if (!s.isWorkDay || s.isHoliday) continue;
      
      workDayCount++;
      totalCheckins += s.checkedInCount;
      totalExpected += s.expectedToCheckIn;
      totalGreen += s.greenCount;
      totalYellow += s.yellowCount;
      totalRed += s.redCount;
      totalExcused += s.onLeaveCount;
    }

    const absent = Math.max(0, totalExpected - totalCheckins);
    const compliance = totalExpected > 0 ? Math.round((totalCheckins / totalExpected) * 100) : 0;

    console.log(`Work days in period: ${workDayCount}`);
    console.log(`Total Check-ins: ${totalCheckins}`);
    console.log(`Total Expected: ${totalExpected}`);
    console.log(`Compliance: ${compliance}%`);
    console.log(`Green (on-time): ${totalGreen}`);
    console.log(`Yellow (late): ${totalYellow}`);
    console.log(`Red: ${totalRed}`);
    console.log(`Absent: ${absent}`);
    console.log(`Excused/Exempted: ${totalExcused}`);
  }

  // Also show recent days breakdown
  console.log('\n\n=== Recent Days Breakdown (Last 7 work days) ===');
  
  const recentSummaries = await prisma.dailyTeamSummary.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
      isWorkDay: true,
      isHoliday: false,
    },
    orderBy: { date: 'desc' },
    take: 50,
    include: { team: { select: { name: true } } }
  });

  // Group by date
  const byDate = new Map<string, typeof recentSummaries>();
  for (const s of recentSummaries) {
    const dateStr = s.date.toISOString().split('T')[0];
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(s);
  }

  const sortedDates = Array.from(byDate.keys()).sort().reverse().slice(0, 7);
  
  for (const dateStr of sortedDates) {
    console.log(`\n${dateStr}:`);
    const daySummaries = byDate.get(dateStr)!;
    for (const s of daySummaries) {
      console.log(`  ${s.team.name}: ${s.checkedInCount}/${s.expectedToCheckIn} (G:${s.greenCount} Y:${s.yellowCount} R:${s.redCount} Ex:${s.onLeaveCount})`);
    }
  }

  await prisma.$disconnect();
}

check().catch(console.error);
