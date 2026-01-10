/**
 * Test Script: Team Analytics Accuracy Verification
 *
 * This script verifies that the Team Analytics computation
 * matches the actual check-in data from workers.
 *
 * Run: npx ts-node test-team-analytics-accuracy.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Timezone helper (simplified)
function getStartOfDay(date: Date, timezone: string): Date {
  const d = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date, timezone: string): Date {
  const d = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function testTeamAnalyticsAccuracy() {
  console.log('=' .repeat(70));
  console.log('🧪 TEAM ANALYTICS ACCURACY TEST');
  console.log('=' .repeat(70));
  console.log('');

  // 1. Get a team with members
  const team = await prisma.team.findFirst({
    where: {
      isActive: true,
      members: {
        some: {
          isActive: true,
          role: { in: ['WORKER', 'MEMBER'] },
        },
      },
    },
    include: {
      members: {
        where: {
          isActive: true,
          role: { in: ['WORKER', 'MEMBER'] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      company: {
        select: {
          timezone: true,
        },
      },
    },
  });

  if (!team) {
    console.log('❌ No team found with active workers');
    return;
  }

  const timezone = team.company?.timezone || 'Asia/Manila';
  console.log(`📋 Team: ${team.name}`);
  console.log(`👥 Members: ${team.members.length}`);
  console.log(`🌐 Timezone: ${timezone}`);
  console.log('');

  // 2. Define test periods
  const now = new Date();
  const periods = [
    { name: 'Today', days: 0 },
    { name: 'Last 7 Days', days: 6 },
    { name: 'Last 14 Days', days: 13 },
  ];

  for (const period of periods) {
    console.log('-'.repeat(70));
    console.log(`📅 PERIOD: ${period.name}`);
    console.log('-'.repeat(70));

    // Calculate date range
    const endDate = getEndOfDay(now, timezone);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - period.days);
    const startOfPeriod = getStartOfDay(startDate, timezone);

    console.log(`   Date Range: ${formatDate(startOfPeriod)} to ${formatDate(endDate)}`);
    console.log('');

    const memberIds = team.members.map((m) => m.id);

    // 3. Get RAW check-in data
    const rawCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: {
          gte: startOfPeriod,
          lte: endDate,
        },
      },
      select: {
        id: true,
        userId: true,
        readinessScore: true,
        readinessStatus: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   📊 Raw Check-ins Found: ${rawCheckins.length}`);
    console.log('');

    if (rawCheckins.length === 0) {
      console.log('   ⚠️  No check-ins in this period');
      console.log('');
      continue;
    }

    // 4. Manual Computation (what analytics SHOULD return)
    console.log('   🔢 MANUAL COMPUTATION (Expected):');
    console.log('   ' + '-'.repeat(50));

    // Group by user and calculate per-member averages
    const checkinsByUser = new Map<string, typeof rawCheckins>();
    for (const checkin of rawCheckins) {
      const userCheckins = checkinsByUser.get(checkin.userId) || [];
      userCheckins.push(checkin);
      checkinsByUser.set(checkin.userId, userCheckins);
    }

    const memberStats: {
      name: string;
      checkinCount: number;
      avgScore: number;
      avgMood: number;
      avgStress: number;
      avgSleep: number;
      avgPhysicalHealth: number;
      greenCount: number;
      yellowCount: number;
      redCount: number;
    }[] = [];

    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;

    for (const member of team.members) {
      const userCheckins = checkinsByUser.get(member.id) || [];

      if (userCheckins.length === 0) {
        console.log(`      ${member.firstName} ${member.lastName}: No check-ins`);
        continue;
      }

      const avgScore = userCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / userCheckins.length;
      const avgMood = userCheckins.reduce((sum, c) => sum + c.mood, 0) / userCheckins.length;
      const avgStress = userCheckins.reduce((sum, c) => sum + c.stress, 0) / userCheckins.length;
      const avgSleep = userCheckins.reduce((sum, c) => sum + c.sleep, 0) / userCheckins.length;
      const avgPhysicalHealth = userCheckins.reduce((sum, c) => sum + c.physicalHealth, 0) / userCheckins.length;

      const greenCount = userCheckins.filter((c) => c.readinessStatus === 'GREEN').length;
      const yellowCount = userCheckins.filter((c) => c.readinessStatus === 'YELLOW').length;
      const redCount = userCheckins.filter((c) => c.readinessStatus === 'RED').length;

      totalGreen += greenCount;
      totalYellow += yellowCount;
      totalRed += redCount;

      memberStats.push({
        name: `${member.firstName} ${member.lastName}`,
        checkinCount: userCheckins.length,
        avgScore: Math.round(avgScore * 100) / 100,
        avgMood: Math.round(avgMood * 10) / 10,
        avgStress: Math.round(avgStress * 10) / 10,
        avgSleep: Math.round(avgSleep * 10) / 10,
        avgPhysicalHealth: Math.round(avgPhysicalHealth * 10) / 10,
        greenCount,
        yellowCount,
        redCount,
      });

      console.log(`      ${member.firstName} ${member.lastName}:`);
      console.log(`         Check-ins: ${userCheckins.length}`);
      console.log(`         Avg Score: ${Math.round(avgScore * 100) / 100}`);
      console.log(`         Status: ${greenCount}G / ${yellowCount}Y / ${redCount}R`);
    }

    // Calculate team averages (average of member averages)
    const membersWithCheckins = memberStats.filter((m) => m.checkinCount > 0);

    if (membersWithCheckins.length === 0) {
      console.log('   ⚠️  No members with check-ins');
      continue;
    }

    const manualTeamAvgScore = membersWithCheckins.reduce((sum, m) => sum + m.avgScore, 0) / membersWithCheckins.length;
    const manualAvgMood = membersWithCheckins.reduce((sum, m) => sum + m.avgMood, 0) / membersWithCheckins.length;
    const manualAvgStress = membersWithCheckins.reduce((sum, m) => sum + m.avgStress, 0) / membersWithCheckins.length;
    const manualAvgSleep = membersWithCheckins.reduce((sum, m) => sum + m.avgSleep, 0) / membersWithCheckins.length;
    const manualAvgPhysicalHealth = membersWithCheckins.reduce((sum, m) => sum + m.avgPhysicalHealth, 0) / membersWithCheckins.length;

    console.log('');
    console.log('   📈 TEAM TOTALS (Manual Calculation):');
    console.log(`      Team Avg Readiness: ${Math.round(manualTeamAvgScore * 100) / 100}%`);
    console.log(`      Avg Mood: ${Math.round(manualAvgMood * 10) / 10}`);
    console.log(`      Avg Stress: ${Math.round(manualAvgStress * 10) / 10}`);
    console.log(`      Avg Sleep: ${Math.round(manualAvgSleep * 10) / 10}`);
    console.log(`      Avg Physical Health: ${Math.round(manualAvgPhysicalHealth * 10) / 10}`);
    console.log(`      Status Distribution: ${totalGreen}G / ${totalYellow}Y / ${totalRed}R`);
    console.log('');

    // 5. Get what Prisma groupBy returns (same as analytics endpoint)
    console.log('   🔍 PRISMA GROUPBY RESULT (What Analytics Uses):');
    console.log('   ' + '-'.repeat(50));

    const prismaGroupBy = await prisma.checkin.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
        createdAt: {
          gte: startOfPeriod,
          lte: endDate,
        },
      },
      _avg: {
        readinessScore: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
      },
      _count: {
        id: true,
      },
    });

    for (const row of prismaGroupBy) {
      const member = team.members.find((m) => m.id === row.userId);
      console.log(`      ${member?.firstName} ${member?.lastName}:`);
      console.log(`         Count: ${row._count.id}`);
      console.log(`         Avg Score: ${Math.round((row._avg.readinessScore || 0) * 100) / 100}`);
    }

    // Calculate team average from Prisma groupBy
    const prismaAvgScores = prismaGroupBy
      .filter((r) => r._avg.readinessScore !== null)
      .map((r) => r._avg.readinessScore!);

    const prismaTeamAvg = prismaAvgScores.length > 0
      ? prismaAvgScores.reduce((sum, s) => sum + s, 0) / prismaAvgScores.length
      : 0;

    console.log('');
    console.log(`      Team Avg (from groupBy): ${Math.round(prismaTeamAvg * 100) / 100}%`);
    console.log('');

    // 6. Compare results
    console.log('   ✅ COMPARISON:');
    console.log('   ' + '-'.repeat(50));

    const scoreDiff = Math.abs(manualTeamAvgScore - prismaTeamAvg);
    const isMatch = scoreDiff < 0.01; // Allow tiny floating point diff

    console.log(`      Manual Team Avg:  ${Math.round(manualTeamAvgScore * 100) / 100}%`);
    console.log(`      Prisma Team Avg:  ${Math.round(prismaTeamAvg * 100) / 100}%`);
    console.log(`      Difference:       ${Math.round(scoreDiff * 100) / 100}`);
    console.log(`      Match: ${isMatch ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // 7. Show individual check-in records (sample)
    console.log('   📝 SAMPLE RAW CHECK-IN RECORDS (Last 5):');
    console.log('   ' + '-'.repeat(50));

    const sampleCheckins = rawCheckins.slice(0, 5);
    for (const checkin of sampleCheckins) {
      console.log(`      ${checkin.user.firstName} ${checkin.user.lastName} - ${formatDate(checkin.createdAt)}`);
      console.log(`         Score: ${checkin.readinessScore} | Status: ${checkin.readinessStatus}`);
      console.log(`         Mood: ${checkin.mood} | Stress: ${checkin.stress} | Sleep: ${checkin.sleep} | Physical: ${checkin.physicalHealth}`);
    }
    console.log('');
  }

  // 8. Test exemption handling
  console.log('='.repeat(70));
  console.log('🛡️  EXEMPTION HANDLING TEST');
  console.log('='.repeat(70));
  console.log('');

  const todayStart = getStartOfDay(now, timezone);
  const todayEnd = getEndOfDay(now, timezone);

  const membersOnLeaveToday = await prisma.exception.findMany({
    where: {
      userId: { in: team.members.map((m) => m.id) },
      status: 'APPROVED',
      startDate: { lte: todayEnd },
      endDate: { gte: todayStart },
    },
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  console.log(`   Members on approved leave today: ${membersOnLeaveToday.length}`);
  for (const exemption of membersOnLeaveToday) {
    console.log(`      - ${exemption.user.firstName} ${exemption.user.lastName}: ${exemption.type}`);
    console.log(`        (${formatDate(exemption.startDate!)} to ${formatDate(exemption.endDate!)})`);
  }
  console.log('');

  // Calculate expected vs actual compliance
  const onLeaveUserIds = new Set(membersOnLeaveToday.map((e) => e.userId));
  const activeMembers = team.members.filter((m) => !onLeaveUserIds.has(m.id)).length;

  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: team.members.map((m) => m.id) },
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    select: { userId: true },
  });

  const checkedInUserIds = new Set(todayCheckins.map((c) => c.userId));
  const checkedInToday = checkedInUserIds.size;

  // Members on leave who also checked in
  const onLeaveButCheckedIn = [...onLeaveUserIds].filter((id) => checkedInUserIds.has(id)).length;
  const expectedToCheckin = activeMembers + onLeaveButCheckedIn;

  const compliance = expectedToCheckin > 0
    ? Math.min(100, Math.round((checkedInToday / expectedToCheckin) * 100))
    : 100;

  console.log('   📊 TODAY\'S COMPLIANCE CALCULATION:');
  console.log(`      Total Members:        ${team.members.length}`);
  console.log(`      On Leave:             ${membersOnLeaveToday.length}`);
  console.log(`      Active (not on leave): ${activeMembers}`);
  console.log(`      On Leave but Checked In: ${onLeaveButCheckedIn}`);
  console.log(`      Expected to Check-in: ${expectedToCheckin}`);
  console.log(`      Actually Checked In:  ${checkedInToday}`);
  console.log(`      Compliance:           ${compliance}%`);
  console.log('');

  console.log('='.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(70));
}

// Run test
testTeamAnalyticsAccuracy()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
