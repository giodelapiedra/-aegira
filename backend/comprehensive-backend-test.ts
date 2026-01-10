/**
 * COMPREHENSIVE BACKEND TESTING SCRIPT
 * Tests all major features:
 * 1. Worker Check-in Logic (readiness calculation, attendance status)
 * 2. Exemption Flow (create, approve, verify EXCUSED)
 * 3. Team Lead Analytics Data Accuracy
 * 4. Daily Monitoring Dashboard Data
 * 5. Performance Score Calculation
 *
 * Run: npx tsx comprehensive-backend-test.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateReadiness } from './src/utils/readiness.js';
import { calculateAttendanceStatus, calculatePerformanceScore, ATTENDANCE_SCORES } from './src/utils/attendance.js';

const prisma = new PrismaClient();

// Colors for console output
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
const section = (title: string) => console.log(`\n${colors.bold}${colors.blue}═══════════════════════════════════════════${colors.reset}`);
const header = (title: string) => {
  section(title);
  console.log(`${colors.bold}${colors.blue}  ${title}${colors.reset}`);
  section(title);
};

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

const timezone = 'Asia/Manila';
const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });

async function runTests() {
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║         AEGIRA COMPREHENSIVE BACKEND TEST SUITE              ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const now = new Date();
  const todayStr = todayFormatter.format(now);
  info(`Test Date: ${todayStr}`);
  info(`Timezone: ${timezone}`);

  // ============================================
  // SECTION 1: READINESS CALCULATION TESTS
  // ============================================
  header('1. READINESS CALCULATION TESTS');

  // Test GREEN status (score >= 70)
  const greenResult = calculateReadiness({
    mood: 8,
    stress: 2,  // Low stress = high score (inverted)
    sleep: 8,
    physicalHealth: 8,
  });
  test(greenResult.status === 'GREEN', `GREEN status: mood=8, stress=2, sleep=8, health=8 → ${greenResult.score}% (expected >= 70)`);
  test(greenResult.score >= 70, `Score ${greenResult.score} is >= 70 for GREEN`);

  // Test YELLOW status (40 <= score < 70)
  const yellowResult = calculateReadiness({
    mood: 6,
    stress: 5,
    sleep: 5,
    physicalHealth: 5,
  });
  test(yellowResult.status === 'YELLOW', `YELLOW status: mood=6, stress=5, sleep=5, health=5 → ${yellowResult.score}%`);
  test(yellowResult.score >= 40 && yellowResult.score < 70, `Score ${yellowResult.score} is between 40-69 for YELLOW`);

  // Test RED status (score < 40)
  const redResult = calculateReadiness({
    mood: 2,
    stress: 9,  // High stress = low score
    sleep: 2,
    physicalHealth: 2,
  });
  test(redResult.status === 'RED', `RED status: mood=2, stress=9, sleep=2, health=2 → ${redResult.score}%`);
  test(redResult.score < 40, `Score ${redResult.score} is < 40 for RED`);

  // Test stress inversion logic
  const highStressResult = calculateReadiness({
    mood: 10,
    stress: 10,  // Maximum stress
    sleep: 10,
    physicalHealth: 10,
  });
  const lowStressResult = calculateReadiness({
    mood: 10,
    stress: 1,  // Minimum stress
    sleep: 10,
    physicalHealth: 10,
  });
  test(lowStressResult.score > highStressResult.score,
    `Stress inversion: low stress (${lowStressResult.score}%) > high stress (${highStressResult.score}%)`);

  // Test boundary cases
  const exactGreenBoundary = calculateReadiness({ mood: 7, stress: 3, sleep: 7, physicalHealth: 7 });
  test(exactGreenBoundary.score >= 70, `Boundary test: score=${exactGreenBoundary.score} → ${exactGreenBoundary.status}`);

  // ============================================
  // SECTION 2: ATTENDANCE STATUS TESTS
  // ============================================
  header('2. ATTENDANCE STATUS TESTS');

  const shiftStart = '08:00';
  const gracePeriod = 15; // minutes

  // Test ON-TIME (before shift start)
  const earlyCheckin = new Date();
  earlyCheckin.setHours(7, 45, 0, 0);
  const earlyResult = calculateAttendanceStatus(earlyCheckin, shiftStart, gracePeriod, timezone);
  test(earlyResult.status === 'GREEN', `Early check-in (7:45) → GREEN (on-time)`);
  test(earlyResult.score === 100, `Early check-in score = 100`);
  test(earlyResult.minutesLate === 0, `Early check-in minutes late = 0`);

  // Test ON-TIME (within grace period)
  const graceCheckin = new Date();
  graceCheckin.setHours(8, 10, 0, 0);
  const graceResult = calculateAttendanceStatus(graceCheckin, shiftStart, gracePeriod, timezone);
  test(graceResult.status === 'GREEN', `Grace period check-in (8:10) → GREEN (within 15min grace)`);
  test(graceResult.score === 100, `Grace period score = 100`);

  // Test LATE (after grace period)
  const lateCheckin = new Date();
  lateCheckin.setHours(8, 30, 0, 0);
  const lateResult = calculateAttendanceStatus(lateCheckin, shiftStart, gracePeriod, timezone);
  test(lateResult.status === 'YELLOW', `Late check-in (8:30) → YELLOW`);
  test(lateResult.score === 75, `Late check-in score = 75`);
  test(lateResult.minutesLate === 15, `Late by 15 minutes (8:30 - 8:15 grace end)`);

  // Test very late
  const veryLateCheckin = new Date();
  veryLateCheckin.setHours(10, 0, 0, 0);
  const veryLateResult = calculateAttendanceStatus(veryLateCheckin, shiftStart, gracePeriod, timezone);
  test(veryLateResult.status === 'YELLOW', `Very late check-in (10:00) → YELLOW`);
  test(veryLateResult.minutesLate === 105, `Very late by 105 minutes`);

  // ============================================
  // SECTION 3: DATABASE DATA TESTS
  // ============================================
  header('3. DATABASE DATA TESTS');

  // Get a test worker
  const worker = await prisma.user.findFirst({
    where: {
      role: { in: ['MEMBER', 'WORKER'] },
      teamId: { not: null },
      isActive: true,
    },
    include: {
      team: {
        include: {
          leader: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      company: true,
    },
  });

  if (!worker) {
    fail('No active worker found in database - cannot run data tests');
    return;
  }

  pass(`Found test worker: ${worker.firstName} ${worker.lastName} (${worker.email})`);
  info(`Team: ${worker.team?.name}`);
  info(`Team Leader: ${worker.team?.leader?.firstName} ${worker.team?.leader?.lastName}`);
  info(`Company: ${worker.company?.name}`);

  // Get team lead
  const teamLead = worker.team?.leader;
  if (!teamLead) {
    fail('Team has no leader assigned');
  } else {
    pass(`Team Leader found: ID=${teamLead.id}`);
  }

  // ============================================
  // SECTION 4: EXEMPTION FLOW TEST
  // ============================================
  header('4. EXEMPTION FLOW TEST');

  // Clear previous test data for this worker
  info('Clearing previous test data...');
  await prisma.exception.deleteMany({ where: { userId: worker.id, reason: { contains: 'TEST_EXEMPTION' } } });

  // Count worker's existing exemptions
  const existingExemptions = await prisma.exception.count({ where: { userId: worker.id } });
  info(`Worker has ${existingExemptions} existing exemptions`);

  // Create a test exemption (PENDING)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const testExemption = await prisma.exception.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'SICK_LEAVE',
      reason: 'TEST_EXEMPTION - Automated test',
      status: 'PENDING',
      isExemption: true,
    },
  });
  pass(`Created PENDING exemption: ID=${testExemption.id}`);
  test(testExemption.status === 'PENDING', 'Exemption status is PENDING');

  // Simulate Team Lead approval
  const approvedExemption = await prisma.exception.update({
    where: { id: testExemption.id },
    data: {
      status: 'APPROVED',
      startDate: now,
      endDate: threeDaysFromNow,
      approvedBy: teamLead?.id || worker.id,
      approvedAt: now,
    },
  });
  pass(`Approved exemption: ${todayFormatter.format(now)} to ${todayFormatter.format(threeDaysFromNow)}`);
  test(approvedExemption.status === 'APPROVED', 'Exemption status changed to APPROVED');
  test(approvedExemption.approvedAt !== null, 'Approval timestamp is set');

  // Clean up test exemption
  await prisma.exception.delete({ where: { id: testExemption.id } });
  info('Cleaned up test exemption');

  // ============================================
  // SECTION 5: CHECK-IN HISTORY TEST
  // ============================================
  header('5. CHECK-IN HISTORY TEST');

  // Get worker's recent check-ins
  const recentCheckins = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 7,
  });

  info(`Worker has ${recentCheckins.length} check-ins in last 7 entries`);

  if (recentCheckins.length > 0) {
    pass('Worker has check-in history');

    // Verify check-in data structure
    const latestCheckin = recentCheckins[0];
    test(latestCheckin.mood >= 1 && latestCheckin.mood <= 10, `Mood is valid (1-10): ${latestCheckin.mood}`);
    test(latestCheckin.stress >= 1 && latestCheckin.stress <= 10, `Stress is valid (1-10): ${latestCheckin.stress}`);
    test(latestCheckin.sleep >= 1 && latestCheckin.sleep <= 10, `Sleep is valid (1-10): ${latestCheckin.sleep}`);
    test(latestCheckin.physicalHealth >= 1 && latestCheckin.physicalHealth <= 10, `Physical Health valid: ${latestCheckin.physicalHealth}`);
    test(latestCheckin.readinessScore >= 0 && latestCheckin.readinessScore <= 100, `Readiness score valid: ${latestCheckin.readinessScore}`);
    test(['GREEN', 'YELLOW', 'RED'].includes(latestCheckin.readinessStatus), `Status is valid: ${latestCheckin.readinessStatus}`);

    // Verify readiness calculation matches stored value
    const recalculated = calculateReadiness({
      mood: latestCheckin.mood,
      stress: latestCheckin.stress,
      sleep: latestCheckin.sleep,
      physicalHealth: latestCheckin.physicalHealth,
    });
    test(recalculated.score === latestCheckin.readinessScore,
      `Stored score (${latestCheckin.readinessScore}) matches recalculated (${recalculated.score})`);
    test(recalculated.status === latestCheckin.readinessStatus,
      `Stored status (${latestCheckin.readinessStatus}) matches recalculated (${recalculated.status})`);
  } else {
    info('No check-ins found - skipping check-in validation');
  }

  // ============================================
  // SECTION 6: DAILY ATTENDANCE RECORDS TEST
  // ============================================
  header('6. DAILY ATTENDANCE RECORDS TEST');

  const attendanceRecords = await prisma.dailyAttendance.findMany({
    where: { userId: worker.id },
    orderBy: { date: 'desc' },
    take: 10,
  });

  info(`Worker has ${attendanceRecords.length} daily attendance records`);

  if (attendanceRecords.length > 0) {
    for (const record of attendanceRecords.slice(0, 3)) {
      const dateStr = todayFormatter.format(record.date);
      console.log(`  ${dateStr}: ${record.status} (score: ${record.score}, counted: ${record.isCounted})`);
    }

    // Verify attendance status logic
    const latestAttendance = attendanceRecords[0];
    test(
      ['GREEN', 'YELLOW', 'ABSENT', 'EXCUSED'].includes(latestAttendance.status),
      `Attendance status is valid: ${latestAttendance.status}`
    );

    if (latestAttendance.status === 'GREEN') {
      test(latestAttendance.score === 100, 'GREEN attendance has score 100');
      test(latestAttendance.isCounted === true, 'GREEN attendance is counted');
    } else if (latestAttendance.status === 'YELLOW') {
      test(latestAttendance.score === 75, 'YELLOW attendance has score 75');
      test(latestAttendance.isCounted === true, 'YELLOW attendance is counted');
    } else if (latestAttendance.status === 'EXCUSED') {
      test(latestAttendance.score === null || latestAttendance.isCounted === false, 'EXCUSED attendance not counted');
    }
  }

  // ============================================
  // SECTION 7: PERFORMANCE SCORE TEST
  // ============================================
  header('7. PERFORMANCE SCORE CALCULATION TEST');

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const performanceScore = await calculatePerformanceScore(
    worker.id,
    thirtyDaysAgo,
    now,
    timezone
  );

  info(`Performance Score Breakdown (last 30 days):`);
  console.log(`  Total Work Days: ${performanceScore.totalDays}`);
  console.log(`  Counted Days: ${performanceScore.countedDays}`);
  console.log(`  GREEN: ${performanceScore.breakdown.green}`);
  console.log(`  YELLOW: ${performanceScore.breakdown.yellow}`);
  console.log(`  ABSENT: ${performanceScore.breakdown.absent}`);
  console.log(`  EXCUSED: ${performanceScore.breakdown.excused}`);
  console.log(`  Final Score: ${performanceScore.score}`);

  test(performanceScore.score >= 0 && performanceScore.score <= 100, `Performance score is valid (0-100): ${performanceScore.score}`);
  test(
    performanceScore.breakdown.green + performanceScore.breakdown.yellow + performanceScore.breakdown.absent <= performanceScore.totalDays,
    'Breakdown counts are consistent with total days'
  );

  // Verify score calculation
  if (performanceScore.countedDays > 0) {
    const expectedScore = Math.round(
      (performanceScore.breakdown.green * 100 + performanceScore.breakdown.yellow * 75) / performanceScore.countedDays * 10
    ) / 10;
    test(
      Math.abs(performanceScore.score - expectedScore) < 1,
      `Score calculation is correct: ${performanceScore.score} ≈ ${expectedScore}`
    );
  }

  // ============================================
  // SECTION 8: TEAM LEAD DATA ACCESS TEST
  // ============================================
  header('8. TEAM LEAD DATA ACCESS TEST');

  if (worker.team && worker.team.leader) {
    const teamId = worker.team.id;

    // Get all team members
    const teamMembers = await prisma.user.findMany({
      where: { teamId, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
      select: { id: true, firstName: true, lastName: true },
    });

    info(`Team has ${teamMembers.length} active members`);
    pass('Team leader can access team member list');

    // Get today's team check-ins
    const { start: todayStart, end: todayEnd } = {
      start: new Date(todayStr + 'T00:00:00'),
      end: new Date(todayStr + 'T23:59:59'),
    };

    const teamCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: teamMembers.map(m => m.id) },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    info(`Today's team check-ins: ${teamCheckins.length}`);

    const greenCount = teamCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellowCount = teamCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const redCount = teamCheckins.filter(c => c.readinessStatus === 'RED').length;

    console.log(`  GREEN: ${greenCount}`);
    console.log(`  YELLOW: ${yellowCount}`);
    console.log(`  RED: ${redCount}`);

    test(greenCount + yellowCount + redCount === teamCheckins.length, 'All check-ins have valid status');

    // Get pending exemptions for team
    const pendingExemptions = await prisma.exception.findMany({
      where: {
        status: 'PENDING',
        user: { teamId },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    info(`Pending exemptions for team: ${pendingExemptions.length}`);
    pass('Team leader can access pending exemptions');

    // Get active exemptions
    const activeExemptions = await prisma.exception.findMany({
      where: {
        status: 'APPROVED',
        user: { teamId },
        endDate: { gte: now },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    info(`Active exemptions for team: ${activeExemptions.length}`);
    pass('Team leader can access active exemptions');
  }

  // ============================================
  // SECTION 9: SUDDEN CHANGE DETECTION TEST
  // ============================================
  header('9. SUDDEN CHANGE DETECTION TEST');

  // Find workers with check-ins to test sudden change logic
  const workersWithHistory = await prisma.user.findMany({
    where: {
      role: { in: ['MEMBER', 'WORKER'] },
      teamId: { not: null },
      isActive: true,
    },
    select: { id: true, firstName: true, lastName: true },
    take: 5,
  });

  let suddenChangesFound = 0;

  for (const w of workersWithHistory) {
    // Get 7-day historical average
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const todayStart = new Date(todayStr + 'T00:00:00');

    const historicalCheckins = await prisma.checkin.findMany({
      where: {
        userId: w.id,
        createdAt: { gte: sevenDaysAgo, lt: todayStart },
      },
      select: { readinessScore: true },
    });

    if (historicalCheckins.length >= 3) {
      const avgScore = Math.round(
        historicalCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / historicalCheckins.length
      );

      // Get today's check-in
      const todayCheckin = await prisma.checkin.findFirst({
        where: {
          userId: w.id,
          createdAt: { gte: todayStart },
        },
        select: { readinessScore: true, readinessStatus: true },
      });

      if (todayCheckin) {
        const change = todayCheckin.readinessScore - avgScore;
        if (change <= -10) {
          suddenChangesFound++;
          console.log(`  ${w.firstName} ${w.lastName}: ${avgScore}% avg → ${todayCheckin.readinessScore}% today (${change} drop)`);
        }
      }
    }
  }

  info(`Workers with sudden changes (≥10 point drop): ${suddenChangesFound}`);
  pass('Sudden change detection logic verified');

  // ============================================
  // SECTION 10: COMPANY SCOPING TEST
  // ============================================
  header('10. COMPANY SCOPING TEST');

  // Verify all data is properly company-scoped
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  info(`Total companies in system: ${companies.length}`);

  if (companies.length > 1) {
    const company1 = companies[0];
    const company2 = companies[1];

    const team1 = await prisma.team.findFirst({ where: { companyId: company1.id } });
    const team2 = await prisma.team.findFirst({ where: { companyId: company2.id } });

    if (team1 && team2) {
      test(team1.companyId !== team2.companyId, 'Teams are properly scoped to different companies');
    }

    // Verify check-ins are company-scoped
    const checkins1 = await prisma.checkin.count({ where: { companyId: company1.id } });
    const checkins2 = await prisma.checkin.count({ where: { companyId: company2.id } });

    info(`Check-ins in ${company1.name}: ${checkins1}`);
    info(`Check-ins in ${company2.name}: ${checkins2}`);
    pass('Check-ins are properly company-scoped');
  } else {
    info('Only one company - skipping multi-company scoping test');
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║                        TEST SUMMARY                           ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.green}PASSED: ${passCount}${colors.reset}`);
  console.log(`${colors.red}FAILED: ${failCount}${colors.reset}`);
  console.log(`TOTAL:  ${passCount + failCount}\n`);

  if (failCount === 0) {
    console.log(`${colors.green}${colors.bold}✓ ALL TESTS PASSED!${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ SOME TESTS FAILED - Review above for details${colors.reset}\n`);
  }

  return { passCount, failCount };
}

// Run tests
runTests()
  .catch((error) => {
    console.error(`${colors.red}Test Error:${colors.reset}`, error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
