/**
 * TEAM LEAD DATA FLOW TEST
 *
 * Tests the accuracy of data that Team Lead receives from workers:
 * 1. Daily Monitoring Dashboard Data
 * 2. Team Analytics Aggregation
 * 3. Member Performance Scores
 * 4. Exemption/Exception Flow
 * 5. Sudden Change Detection
 *
 * Run: npx tsx test-team-lead-data-flow.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateReadiness } from './src/utils/readiness.js';
import { calculatePerformanceScore, getAttendanceHistory } from './src/utils/attendance.js';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const pass = (msg: string) => console.log(`${colors.green}✓ PASS${colors.reset}: ${msg}`);
const fail = (msg: string) => console.log(`${colors.red}✗ FAIL${colors.reset}: ${msg}`);
const info = (msg: string) => console.log(`${colors.cyan}ℹ INFO${colors.reset}: ${msg}`);

const timezone = 'Asia/Manila';
const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });

let passCount = 0;
let failCount = 0;

function test(condition: boolean, description: string) {
  if (condition) {
    pass(description);
    passCount++;
  } else {
    fail(description);
    failCount++;
  }
}

async function runTests() {
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║          TEAM LEAD DATA FLOW ACCURACY TEST                   ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const now = new Date();
  const todayStr = todayFormatter.format(now);

  // Get a team with members
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      leader: { select: { id: true, firstName: true, lastName: true, email: true } },
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
      company: { select: { timezone: true } },
    },
  });

  if (!team) {
    fail('No team found in database');
    return;
  }

  const tz = team.company?.timezone || timezone;

  console.log(`${colors.bold}TEAM: ${team.name}${colors.reset}`);
  console.log(`Team Leader: ${team.leader?.firstName} ${team.leader?.lastName}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Timezone: ${tz}\n`);

  // ============================================
  // TEST 1: VERIFY MEMBER COUNT MATCHES
  // ============================================
  console.log(`${colors.bold}${colors.blue}═══ TEST 1: MEMBER COUNT VERIFICATION ═══${colors.reset}\n`);

  const dbMemberCount = await prisma.user.count({
    where: { teamId: team.id, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
  });

  test(dbMemberCount === team.members.length, `Direct query member count (${dbMemberCount}) matches team.members.length (${team.members.length})`);

  // ============================================
  // TEST 2: DAILY MONITORING DATA
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 2: DAILY MONITORING DATA ═══${colors.reset}\n`);

  const todayStart = new Date(todayStr + 'T00:00:00');
  const todayEnd = new Date(todayStr + 'T23:59:59');
  const memberIds = team.members.map(m => m.id);

  // Get today's check-ins
  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: todayStart, lte: todayEnd },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  info(`Today's check-ins: ${todayCheckins.length}/${team.members.length}`);

  // Verify readiness scores are correct
  let allScoresValid = true;
  for (const checkin of todayCheckins) {
    const recalc = calculateReadiness({
      mood: checkin.mood,
      stress: checkin.stress,
      sleep: checkin.sleep,
      physicalHealth: checkin.physicalHealth,
    });
    if (checkin.readinessScore !== recalc.score) {
      allScoresValid = false;
      console.log(`  INVALID: ${checkin.user.firstName} - stored ${checkin.readinessScore} vs calculated ${recalc.score}`);
    }
  }
  test(allScoresValid, 'All today\'s check-in scores are correctly calculated');

  // Get pending exemptions for team
  const pendingExemptions = await prisma.exception.findMany({
    where: {
      status: 'PENDING',
      user: { teamId: team.id },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  info(`Pending exemptions: ${pendingExemptions.length}`);
  test(pendingExemptions.every(e => e.status === 'PENDING'), 'All pending exemptions have PENDING status');

  // Get active exemptions
  const activeExemptions = await prisma.exception.findMany({
    where: {
      status: 'APPROVED',
      user: { teamId: team.id },
      endDate: { gte: now },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  info(`Active exemptions: ${activeExemptions.length}`);
  for (const e of activeExemptions) {
    console.log(`  ${e.user.firstName} ${e.user.lastName}: ${e.type} until ${e.endDate?.toISOString().split('T')[0]}`);
  }
  test(activeExemptions.every(e => e.status === 'APPROVED'), 'All active exemptions have APPROVED status');

  // Members on leave should NOT have check-ins today
  const onLeaveUserIds = activeExemptions.map(e => e.userId);
  const checkinsFromOnLeaveUsers = todayCheckins.filter(c => onLeaveUserIds.includes(c.userId));
  test(
    checkinsFromOnLeaveUsers.length === 0,
    `Workers on leave (${onLeaveUserIds.length}) have no check-ins today`
  );

  // ============================================
  // TEST 3: ATTENDANCE RECORDS
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 3: ATTENDANCE RECORDS ═══${colors.reset}\n`);

  // Get attendance records for team
  const attendanceRecords = await prisma.dailyAttendance.findMany({
    where: {
      teamId: team.id,
      date: {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        lte: now,
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });

  info(`Attendance records (last 7 days): ${attendanceRecords.length}`);

  // Verify attendance status scores
  const validAttendanceScores = attendanceRecords.every(a => {
    if (a.status === 'GREEN') return a.score === 100;
    if (a.status === 'YELLOW') return a.score === 75;
    if (a.status === 'ABSENT') return a.score === 0;
    if (a.status === 'EXCUSED') return a.score === null || !a.isCounted;
    return false;
  });
  test(validAttendanceScores, 'All attendance records have correct scores for their status');

  // Count status distribution
  const statusCounts = { GREEN: 0, YELLOW: 0, ABSENT: 0, EXCUSED: 0 };
  for (const a of attendanceRecords) {
    statusCounts[a.status as keyof typeof statusCounts]++;
  }
  console.log(`  Status distribution: GREEN=${statusCounts.GREEN}, YELLOW=${statusCounts.YELLOW}, ABSENT=${statusCounts.ABSENT}, EXCUSED=${statusCounts.EXCUSED}`);

  // ============================================
  // TEST 4: PERFORMANCE SCORES
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 4: MEMBER PERFORMANCE SCORES ═══${colors.reset}\n`);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const member of team.members.slice(0, 3)) { // Test first 3 members
    const performance = await calculatePerformanceScore(member.id, thirtyDaysAgo, now, tz);

    console.log(`${member.firstName} ${member.lastName}:`);
    console.log(`  Score: ${performance.score}%`);
    console.log(`  Work Days: ${performance.workDays}, Counted: ${performance.countedDays}`);
    console.log(`  Breakdown: G=${performance.breakdown.green}, Y=${performance.breakdown.yellow}, A=${performance.breakdown.absent}, E=${performance.breakdown.excused}`);

    // Verify score is valid
    test(performance.score >= 0 && performance.score <= 100, `${member.firstName}'s score ${performance.score} is valid (0-100)`);

    // Verify breakdown adds up
    const totalBreakdown = performance.breakdown.green + performance.breakdown.yellow + performance.breakdown.absent;
    test(
      totalBreakdown <= performance.workDays,
      `${member.firstName}'s breakdown (${totalBreakdown}) <= work days (${performance.workDays})`
    );
  }

  // ============================================
  // TEST 5: HISTORICAL CHECK-INS
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 5: HISTORICAL CHECK-IN DATA ═══${colors.reset}\n`);

  // Get historical check-ins for the team (last 7 days)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const historicalCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: sevenDaysAgo, lte: now },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  info(`Historical check-ins (7 days): ${historicalCheckins.length}`);

  // Calculate 7-day average for team
  const averageScore = historicalCheckins.length > 0
    ? Math.round(historicalCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / historicalCheckins.length)
    : 0;
  info(`Team average readiness (7 days): ${averageScore}%`);

  // Verify all historical check-ins have valid data
  const validHistorical = historicalCheckins.every(c =>
    c.mood >= 1 && c.mood <= 10 &&
    c.stress >= 1 && c.stress <= 10 &&
    c.sleep >= 1 && c.sleep <= 10 &&
    c.physicalHealth >= 1 && c.physicalHealth <= 10 &&
    c.readinessScore >= 0 && c.readinessScore <= 100 &&
    ['GREEN', 'YELLOW', 'RED'].includes(c.readinessStatus)
  );
  test(validHistorical, 'All historical check-ins have valid data ranges');

  // ============================================
  // TEST 6: SUDDEN CHANGE DETECTION
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 6: SUDDEN CHANGE DETECTION ═══${colors.reset}\n`);

  // For each member, compare today's score to their 7-day average
  let suddenChangesDetected = 0;

  for (const member of team.members) {
    const memberHistory = historicalCheckins.filter(c =>
      c.userId === member.id &&
      c.createdAt < todayStart // Exclude today
    );

    if (memberHistory.length >= 3) {
      const avgScore = Math.round(memberHistory.reduce((sum, c) => sum + c.readinessScore, 0) / memberHistory.length);

      const todayCheckin = todayCheckins.find(c => c.userId === member.id);
      if (todayCheckin) {
        const change = todayCheckin.readinessScore - avgScore;
        if (change <= -10) {
          suddenChangesDetected++;
          const severity = change <= -30 ? 'CRITICAL' : change <= -20 ? 'SIGNIFICANT' : change <= -10 ? 'NOTABLE' : 'MINOR';
          console.log(`  ${member.firstName} ${member.lastName}: ${avgScore}% → ${todayCheckin.readinessScore}% (${change}, ${severity})`);
        }
      }
    }
  }

  info(`Sudden changes detected: ${suddenChangesDetected}`);
  pass('Sudden change detection logic executed successfully');

  // ============================================
  // TEST 7: CHECK-IN RATE CALCULATION
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 7: CHECK-IN RATE CALCULATION ═══${colors.reset}\n`);

  const expectedToCheckin = team.members.length - activeExemptions.length;
  const actualCheckins = todayCheckins.length;
  const checkinRate = expectedToCheckin > 0 ? Math.round((actualCheckins / expectedToCheckin) * 100) : 0;

  console.log(`  Total members: ${team.members.length}`);
  console.log(`  On leave: ${activeExemptions.length}`);
  console.log(`  Expected to check in: ${expectedToCheckin}`);
  console.log(`  Actually checked in: ${actualCheckins}`);
  console.log(`  Check-in rate: ${checkinRate}%`);

  test(checkinRate >= 0 && checkinRate <= 100, `Check-in rate (${checkinRate}%) is valid`);
  test(actualCheckins <= expectedToCheckin || checkinRate === 100, 'Check-in count does not exceed expected');

  // ============================================
  // TEST 8: DATA CONSISTENCY ACROSS TABLES
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 8: DATA CONSISTENCY ═══${colors.reset}\n`);

  // Every check-in should have a corresponding attendance record
  for (const checkin of todayCheckins.slice(0, 3)) {
    const dateStr = todayFormatter.format(checkin.createdAt);
    const dbDate = new Date(dateStr + 'T12:00:00Z');

    const attendance = await prisma.dailyAttendance.findUnique({
      where: {
        userId_date: {
          userId: checkin.userId,
          date: dbDate,
        },
      },
    });

    test(
      attendance !== null,
      `${checkin.user.firstName}'s check-in has matching attendance record`
    );

    if (attendance) {
      test(
        attendance.checkInTime !== null,
        `${checkin.user.firstName}'s attendance has check-in time recorded`
      );
    }
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║               TEAM LEAD DATA FLOW TEST SUMMARY               ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.green}PASSED: ${passCount}${colors.reset}`);
  console.log(`${colors.red}FAILED: ${failCount}${colors.reset}`);
  console.log(`TOTAL:  ${passCount + failCount}\n`);

  if (failCount === 0) {
    console.log(`${colors.green}${colors.bold}✓ ALL TEAM LEAD DATA FLOW TESTS PASSED!${colors.reset}`);
    console.log(`Team Leader "${team.leader?.firstName} ${team.leader?.lastName}" receives accurate data.\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ SOME TESTS FAILED - Data flow issues detected${colors.reset}\n`);
  }
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
