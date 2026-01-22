import { prisma } from '../src/config/prisma.js';

async function test() {
  // Check today's check-ins
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCheckins = await prisma.checkin.count({
    where: {
      createdAt: { gte: today, lt: tomorrow }
    }
  });

  console.log('=== TODAY CHECK-IN STATUS ===');
  console.log('Today:', today.toISOString().split('T')[0]);
  console.log('Check-ins today:', todayCheckins);

  // Check last 7 days
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const last7DaysCheckins = await prisma.checkin.count({
    where: {
      createdAt: { gte: sevenDaysAgo, lt: tomorrow }
    }
  });

  console.log('\n=== LAST 7 DAYS ===');
  console.log('From:', sevenDaysAgo.toISOString().split('T')[0]);
  console.log('Check-ins:', last7DaysCheckins);

  // Get latest check-in date
  const latestCheckin = await prisma.checkin.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  console.log('\n=== LATEST CHECK-IN ===');
  console.log('Date:', latestCheckin?.createdAt?.toISOString() || 'None');

  // Check DailyTeamSummary count
  const summaryCount = await prisma.dailyTeamSummary.count();
  const latestSummary = await prisma.dailyTeamSummary.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true, checkedInCount: true, avgReadinessScore: true }
  });

  console.log('\n=== DAILY SUMMARIES ===');
  console.log('Total summaries:', summaryCount);
  console.log('Latest summary date:', latestSummary?.date?.toISOString().split('T')[0] || 'None');
  console.log('Latest checked in:', latestSummary?.checkedInCount || 0);
}

test().finally(() => prisma.$disconnect());
