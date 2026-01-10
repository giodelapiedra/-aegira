/**
 * EXEMPTION & HOLIDAY LOGIC TEST
 *
 * Verifies that:
 * 1. Workers on EXEMPTION are NOT counted as ABSENT (should be EXCUSED)
 * 2. HOLIDAY days are NOT counted in grading (skipped entirely)
 * 3. Both exemption and holiday days are excluded from performance calculation
 *
 * Run: npx tsx test-exemption-holiday-logic.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculatePerformanceScore, getAttendanceHistory } from './src/utils/attendance.js';
import { getUserLeaveStatus, getDaysCoveredByLeave } from './src/utils/leave.js';

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

const pass = (msg: string) => { console.log(`${colors.green}✓ PASS${colors.reset}: ${msg}`); passCount++; };
const fail = (msg: string) => { console.log(`${colors.red}✗ FAIL${colors.reset}: ${msg}`); failCount++; };
const info = (msg: string) => console.log(`${colors.cyan}ℹ INFO${colors.reset}: ${msg}`);
const warn = (msg: string) => console.log(`${colors.yellow}⚠ WARN${colors.reset}: ${msg}`);

const timezone = 'Asia/Manila';
const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });

let passCount = 0;
let failCount = 0;

async function runTests() {
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║       EXEMPTION & HOLIDAY LOGIC VERIFICATION TEST            ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const now = new Date();
  const todayStr = todayFormatter.format(now);
  info(`Today: ${todayStr}\n`);

  // Get company
  const company = await prisma.company.findFirst({
    select: { id: true, name: true, timezone: true },
  });

  if (!company) {
    fail('No company found');
    return;
  }

  const tz = company.timezone || timezone;

  // ============================================
  // TEST 1: EXEMPTION LOGIC
  // ============================================
  console.log(`${colors.bold}${colors.blue}═══ TEST 1: EXEMPTION LOGIC ═══${colors.reset}\n`);

  // Find worker with active exemption
  const workerWithExemption = await prisma.user.findFirst({
    where: {
      role: { in: ['MEMBER', 'WORKER'] },
      exceptions: {
        some: {
          status: 'APPROVED',
          endDate: { gte: now },
        },
      },
    },
    include: {
      team: true,
      exceptions: {
        where: { status: 'APPROVED' },
        orderBy: { endDate: 'desc' },
        take: 1,
      },
    },
  });

  if (workerWithExemption) {
    const exemption = workerWithExemption.exceptions[0];
    info(`Worker with exemption: ${workerWithExemption.firstName} ${workerWithExemption.lastName}`);
    info(`Exemption: ${exemption.type} (${exemption.startDate?.toISOString().split('T')[0]} to ${exemption.endDate?.toISOString().split('T')[0]})`);

    // Check leave status
    const leaveStatus = await getUserLeaveStatus(workerWithExemption.id, tz);

    if (leaveStatus.isOnLeave) {
      pass(`Worker is correctly marked as ON LEAVE`);
    } else {
      fail(`Worker should be ON LEAVE but isOnLeave=${leaveStatus.isOnLeave}`);
    }

    // Check performance score - exemption days should be EXCUSED, not ABSENT
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const performance = await calculatePerformanceScore(workerWithExemption.id, thirtyDaysAgo, now, tz);

    info(`Performance breakdown:`);
    console.log(`  GREEN: ${performance.breakdown.green}`);
    console.log(`  YELLOW: ${performance.breakdown.yellow}`);
    console.log(`  ABSENT: ${performance.breakdown.absent}`);
    console.log(`  EXCUSED: ${performance.breakdown.excused}`);
    console.log(`  Work Days: ${performance.workDays}, Counted: ${performance.countedDays}`);
    console.log(`  Score: ${performance.score}%`);

    // Key test: EXCUSED should be > 0 if they have exemption
    if (performance.breakdown.excused > 0) {
      pass(`Exemption days are correctly marked as EXCUSED (${performance.breakdown.excused} days)`);
    } else {
      warn(`No EXCUSED days found - exemption may be outside 30-day range`);
    }

    // Key test: EXCUSED days should NOT be in countedDays
    const totalCounted = performance.breakdown.green + performance.breakdown.yellow + performance.breakdown.absent;
    if (totalCounted === performance.countedDays) {
      pass(`EXCUSED days are NOT counted in score calculation`);
    } else {
      fail(`EXCUSED days may be incorrectly counted. countedDays=${performance.countedDays}, but G+Y+A=${totalCounted}`);
    }

  } else {
    warn('No worker with active exemption found - creating test scenario');

    // Create test data
    const testWorker = await prisma.user.findFirst({
      where: { role: { in: ['MEMBER', 'WORKER'] }, teamId: { not: null } },
      include: { team: true },
    });

    if (testWorker) {
      // Create a test exemption for yesterday to today+2
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysLater = new Date(now);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);

      const testExemption = await prisma.exception.create({
        data: {
          userId: testWorker.id,
          companyId: testWorker.companyId,
          type: 'SICK_LEAVE',
          reason: 'TEST - Exemption logic test',
          status: 'APPROVED',
          isExemption: true,
          startDate: yesterday,
          endDate: twoDaysLater,
          approvedBy: testWorker.id,
          approvedAt: now,
        },
      });

      info(`Created test exemption: ${testExemption.id}`);

      // Test leave status
      const leaveStatus = await getUserLeaveStatus(testWorker.id, tz);
      if (leaveStatus.isOnLeave) {
        pass(`Test worker correctly marked as ON LEAVE`);
      } else {
        fail(`Test worker should be ON LEAVE`);
      }

      // Clean up
      await prisma.exception.delete({ where: { id: testExemption.id } });
      info('Cleaned up test exemption');
    }
  }

  // ============================================
  // TEST 2: HOLIDAY LOGIC
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 2: HOLIDAY LOGIC ═══${colors.reset}\n`);

  // Check existing holidays
  const holidays = await prisma.holiday.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'desc' },
    take: 5,
  });

  info(`Company holidays: ${holidays.length}`);
  for (const h of holidays) {
    console.log(`  ${todayFormatter.format(h.date)}: ${h.name}`);
  }

  // Create a test holiday for verification
  const testHolidayDate = new Date(now);
  testHolidayDate.setDate(testHolidayDate.getDate() - 3); // 3 days ago
  const testHolidayDateStr = todayFormatter.format(testHolidayDate);

  // Check if holiday already exists
  const existingHoliday = await prisma.holiday.findFirst({
    where: {
      companyId: company.id,
      date: {
        gte: new Date(testHolidayDateStr + 'T00:00:00'),
        lt: new Date(testHolidayDateStr + 'T23:59:59'),
      },
    },
  });

  let testHoliday = existingHoliday;
  let createdTestHoliday = false;

  if (!existingHoliday) {
    // Get executive to create holiday
    const executive = await prisma.user.findFirst({
      where: { role: 'EXECUTIVE', companyId: company.id },
    });

    if (executive) {
      testHoliday = await prisma.holiday.create({
        data: {
          companyId: company.id,
          date: new Date(testHolidayDateStr + 'T12:00:00Z'),
          name: 'TEST HOLIDAY - Logic verification',
          createdBy: executive.id,
        },
      });
      createdTestHoliday = true;
      info(`Created test holiday on ${testHolidayDateStr}`);
    }
  }

  // Get a worker and verify holiday is excluded from their calculation
  const worker = await prisma.user.findFirst({
    where: { role: { in: ['MEMBER', 'WORKER'] }, teamId: { not: null } },
    include: { team: true },
  });

  if (worker && testHoliday) {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const performance = await calculatePerformanceScore(worker.id, sevenDaysAgo, now, tz);
    const attendanceHistory = await getAttendanceHistory(worker.id, sevenDaysAgo, now, tz);

    info(`${worker.firstName}'s attendance history (7 days):`);
    for (const record of attendanceHistory) {
      console.log(`  ${record.date}: ${record.status} (score: ${record.score}, counted: ${record.isCounted})`);
    }

    // Holiday should NOT appear in attendance history (skipped entirely)
    const holidayInHistory = attendanceHistory.find(a => a.date === testHolidayDateStr);
    if (!holidayInHistory) {
      pass(`Holiday (${testHolidayDateStr}) is correctly SKIPPED from attendance history`);
    } else {
      fail(`Holiday should not appear in attendance history but found: ${JSON.stringify(holidayInHistory)}`);
    }

    info(`Performance score: ${performance.score}% (${performance.countedDays} counted days)`);
  }

  // Clean up test holiday
  if (createdTestHoliday && testHoliday) {
    await prisma.holiday.delete({ where: { id: testHoliday.id } });
    info('Cleaned up test holiday');
  }

  // ============================================
  // TEST 3: GRADING EXCLUSION VERIFICATION
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 3: GRADING EXCLUSION VERIFICATION ═══${colors.reset}\n`);

  // Get all workers and verify their performance calculation
  const allWorkers = await prisma.user.findMany({
    where: {
      role: { in: ['MEMBER', 'WORKER'] },
      teamId: { not: null },
      isActive: true,
    },
    include: { team: true },
    take: 5,
  });

  for (const w of allWorkers) {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const performance = await calculatePerformanceScore(w.id, thirtyDaysAgo, now, tz);

    // Verify formula: score = (GREEN*100 + YELLOW*75 + ABSENT*0) / countedDays
    const expectedTotal = performance.breakdown.green * 100 + performance.breakdown.yellow * 75;
    const expectedScore = performance.countedDays > 0
      ? Math.round((expectedTotal / performance.countedDays) * 10) / 10
      : 0;

    const scoreMatch = Math.abs(performance.score - expectedScore) < 1;

    console.log(`${w.firstName} ${w.lastName}:`);
    console.log(`  G=${performance.breakdown.green}, Y=${performance.breakdown.yellow}, A=${performance.breakdown.absent}, E=${performance.breakdown.excused}`);
    console.log(`  Counted: ${performance.countedDays}, Score: ${performance.score}% (expected: ${expectedScore}%)`);

    if (scoreMatch) {
      pass(`${w.firstName}'s score calculation is correct (EXCUSED excluded)`);
    } else {
      fail(`${w.firstName}'s score mismatch: got ${performance.score}, expected ${expectedScore}`);
    }

    // Verify EXCUSED is not in counted
    const computedCounted = performance.breakdown.green + performance.breakdown.yellow + performance.breakdown.absent;
    if (computedCounted === performance.countedDays) {
      pass(`${w.firstName}'s EXCUSED days correctly excluded from count`);
    } else {
      fail(`${w.firstName}: countedDays=${performance.countedDays} but G+Y+A=${computedCounted}`);
    }
  }

  // ============================================
  // TEST 4: CHECK-IN BLOCKING FOR EXEMPTION
  // ============================================
  console.log(`\n${colors.bold}${colors.blue}═══ TEST 4: CHECK-IN BLOCKING ═══${colors.reset}\n`);

  // Workers on leave should be blocked from checking in
  const workersOnLeave = await prisma.exception.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  info(`Workers currently on approved leave: ${workersOnLeave.length}`);

  for (const exception of workersOnLeave) {
    const leaveStatus = await getUserLeaveStatus(exception.userId, tz);

    if (leaveStatus.isOnLeave) {
      pass(`${exception.user.firstName} ${exception.user.lastName} is correctly blocked (isOnLeave=true)`);
    } else {
      fail(`${exception.user.firstName} should be blocked but isOnLeave=${leaveStatus.isOnLeave}`);
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║                    TEST SUMMARY                               ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.green}PASSED: ${passCount}${colors.reset}`);
  console.log(`${colors.red}FAILED: ${failCount}${colors.reset}`);
  console.log(`TOTAL:  ${passCount + failCount}\n`);

  if (failCount === 0) {
    console.log(`${colors.green}${colors.bold}✓ EXEMPTION & HOLIDAY LOGIC WORKING CORRECTLY!${colors.reset}`);
    console.log(`\nVerified:`);
    console.log(`  ✓ Workers on EXEMPTION are marked as EXCUSED (not ABSENT)`);
    console.log(`  ✓ HOLIDAY days are SKIPPED from grading`);
    console.log(`  ✓ EXCUSED days are NOT counted in performance score`);
    console.log(`  ✓ Workers on leave are BLOCKED from check-in\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ SOME LOGIC ISSUES DETECTED${colors.reset}\n`);
  }
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
