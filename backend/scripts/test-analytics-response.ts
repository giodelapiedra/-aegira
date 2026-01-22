import { prisma } from '../src/config/prisma.js';
import { getTodayRange, getTodayForDbDate, getLastNDaysRange, toDbDate } from '../src/utils/date-helpers.js';

const TIMEZONE = 'Asia/Manila';

async function testAnalytics() {
  // Get a team
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true }
      }
    }
  });

  if (!team) {
    console.log('No team found');
    return;
  }

  const memberIds = team.members.map(m => m.id);
  console.log('Team:', team.name);
  console.log('Members:', memberIds.length);

  // Test TODAY
  const { start: todayStart, end: todayEnd } = getTodayRange(TIMEZONE);
  const todayCheckins = await prisma.checkin.count({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: todayStart, lte: todayEnd }
    }
  });

  console.log('\n=== TODAY (', todayStart.toISOString().split('T')[0], ') ===');
  console.log('Check-ins:', todayCheckins);

  // Test TODAY's DailyTeamSummary
  const todayForDb = getTodayForDbDate(TIMEZONE);
  const todaySummary = await prisma.dailyTeamSummary.findUnique({
    where: { teamId_date: { teamId: team.id, date: todayForDb } }
  });

  console.log('Summary exists:', !!todaySummary);
  if (todaySummary) {
    console.log('  checkedInCount:', todaySummary.checkedInCount);
    console.log('  avgReadinessScore:', todaySummary.avgReadinessScore);
    console.log('  greenCount:', todaySummary.greenCount);
  }

  // Test LAST 7 DAYS
  const { start: sevenDaysStart, end: sevenDaysEnd } = getLastNDaysRange(6, TIMEZONE);
  const dbStartDate = toDbDate(sevenDaysStart, TIMEZONE);
  const dbEndDate = toDbDate(sevenDaysEnd, TIMEZONE);

  const summaries7Days = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId: team.id,
      date: { gte: dbStartDate, lte: dbEndDate }
    },
    orderBy: { date: 'asc' }
  });

  console.log('\n=== LAST 7 DAYS ===');
  console.log('From:', sevenDaysStart.toISOString().split('T')[0], 'to', sevenDaysEnd.toISOString().split('T')[0]);
  console.log('Summaries found:', summaries7Days.length);
  
  let totalCheckedIn = 0;
  let daysWithData = 0;
  for (const s of summaries7Days) {
    if (s.checkedInCount > 0) {
      totalCheckedIn += s.checkedInCount;
      daysWithData++;
    }
    console.log('  ', s.date.toISOString().split('T')[0], '- checked in:', s.checkedInCount, ', avg:', s.avgReadinessScore);
  }

  console.log('\nTotal checked in (7 days):', totalCheckedIn);
  console.log('Days with data:', daysWithData);

  // Simulate what API would return if NO data
  console.log('\n=== EMPTY DATA SCENARIO ===');
  if (todayCheckins === 0) {
    console.log('TODAY period would show:');
    console.log('  teamGrade: null (no check-ins)');
    console.log('  statusDistribution: { green: 0, yellow: 0, red: 0, total: 0 }');
    console.log('  trendData: [] (empty for today period)');
    console.log('  avgMetrics: { mood: 0, stress: 0, sleep: 0, physicalHealth: 0 }');
  }
}

testAnalytics().finally(() => prisma.$disconnect());
