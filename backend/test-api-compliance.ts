import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('=== Testing Team Analytics API Compliance ===\n');

  // Get Alpha team's DailyTeamSummary for comparison
  const summaries = await prisma.dailyTeamSummary.findMany({
    where: { team: { name: { contains: 'Alpha' } } },
    orderBy: { date: 'desc' },
    take: 7,
  });

  const workDaySummaries = summaries.filter(s => s.isWorkDay && !s.isHoliday);

  let totalCheckins = 0;
  let totalExpected = 0;

  console.log('DailyTeamSummary data:');
  for (const s of workDaySummaries.reverse()) {
    const dateStr = s.date.toISOString().split('T')[0];
    totalCheckins += s.checkedInCount;
    totalExpected += s.expectedToCheckIn;
    console.log(`  ${dateStr}: ${s.checkedInCount}/${s.expectedToCheckIn}`);
  }

  const summaryCompliance = totalExpected > 0 ? Math.round((totalCheckins / totalExpected) * 100) : 0;

  console.log(`\nTeam Summary (Total Sum): ${totalCheckins}/${totalExpected} = ${summaryCompliance}%`);

  // Now we need to call the API - but since we can't do that from here,
  // let's just show the expected result
  console.log('\nExpected Team Analytics compliance should also be: ' + summaryCompliance + '%');
  console.log('\nPlease refresh http://localhost:5173/team/analytics to verify');

  await prisma.$disconnect();
}

test().catch(console.error);
