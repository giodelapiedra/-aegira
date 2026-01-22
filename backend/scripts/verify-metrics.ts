import { prisma } from '../src/config/prisma.js';

async function verify() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log('Date range:', startStr, 'to', endStr);

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });

  for (const team of teams) {
    const summaries = await prisma.dailyTeamSummary.findMany({
      where: {
        teamId: team.id,
        date: { gte: new Date(startStr), lte: new Date(endStr) },
        checkedInCount: { gt: 0 }
      },
      select: {
        date: true,
        checkedInCount: true,
        avgMood: true,
        avgStress: true,
        avgSleep: true,
        avgPhysical: true
      }
    });

    console.log('\n' + team.name + ' - DailyTeamSummary (' + summaries.length + ' days with check-ins):');

    if (summaries.length > 0) {
      let totalWeight = 0;
      let wMood = 0, wStress = 0, wSleep = 0, wPhysical = 0;

      for (const s of summaries) {
        if (s.avgMood !== null) {
          wMood += s.avgMood * s.checkedInCount;
          wStress += (s.avgStress ?? 0) * s.checkedInCount;
          wSleep += (s.avgSleep ?? 0) * s.checkedInCount;
          wPhysical += (s.avgPhysical ?? 0) * s.checkedInCount;
          totalWeight += s.checkedInCount;
        }
        const dateStr = s.date.toISOString().split('T')[0];
        console.log('  ' + dateStr + ': ' + s.checkedInCount + ' check-ins, mood=' + (s.avgMood?.toFixed(1) ?? 'null'));
      }

      if (totalWeight > 0) {
        console.log('\n  Weighted averages:');
        console.log('  Mood:', (wMood / totalWeight).toFixed(1));
        console.log('  Stress:', (wStress / totalWeight).toFixed(1));
        console.log('  Sleep:', (wSleep / totalWeight).toFixed(1));
        console.log('  Physical:', (wPhysical / totalWeight).toFixed(1));
      }
    }
  }
  await prisma.$disconnect();
}

verify();
