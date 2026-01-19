/**
 * Full Test: Daily Summary Counts with Mock Data
 *
 * Creates test data for all scenarios:
 * - Worker on approved leave (Exception)
 * - Worker marked ABSENT (cron)
 * - Worker marked EXCUSED (TL approved)
 * - Worker checked in (GREEN)
 *
 * Usage: npx tsx scripts/test-daily-summary-full.ts
 */

import { PrismaClient } from '@prisma/client';
import { recalculateDailyTeamSummary } from '../src/utils/daily-summary.js';
import { toDbDate, getNowDT, getStartOfDay, getEndOfDay } from '../src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';
const TEST_PREFIX = 'TEST_SUMMARY_';

async function cleanup() {
  console.log('🧹 Cleaning up previous test data...');

  // Delete test checkins
  await prisma.checkin.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  // Delete test daily attendance
  await prisma.dailyAttendance.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  // Delete test absences
  await prisma.absence.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  // Delete test exceptions
  await prisma.exception.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  // Delete test users
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });

  // Delete test team
  await prisma.team.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });

  console.log('✅ Cleanup complete\n');
}

async function createTestData() {
  console.log('📦 Creating test data...\n');

  // Get first active company
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    throw new Error('No active company found');
  }

  const tz = company.timezone || TIMEZONE;
  const now = getNowDT(tz);
  const todayDate = toDbDate(now.toJSDate(), tz);
  const dayStart = getStartOfDay(now.toJSDate(), tz);

  // Create test team
  const team = await prisma.team.create({
    data: {
      name: `${TEST_PREFIX}Team_${Date.now()}`,
      companyId: company.id,
      shiftStart: '08:00',
      shiftEnd: '17:00',
      workDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
      isActive: true,
    },
  });

  console.log(`   Created team: ${team.name}`);

  // Create 4 workers with different statuses
  const workers = [];

  // Worker 1: On approved leave (Exception)
  const worker1 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}onleave_${Date.now()}@test.com`,
      firstName: 'OnLeave',
      lastName: 'Worker',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // Create approved exception for worker 1
  await prisma.exception.create({
    data: {
      userId: worker1.id,
      companyId: company.id,
      type: 'SICK_LEAVE',
      status: 'APPROVED',
      startDate: todayDate,
      endDate: todayDate,
      reason: 'Test leave',
    },
  });

  workers.push({ user: worker1, expectedStatus: 'ON_LEAVE' });
  console.log(`   Created: ${worker1.firstName} ${worker1.lastName} → ON LEAVE (Exception)`);

  // Worker 2: ABSENT (cron marked)
  const worker2 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}absent_${Date.now()}@test.com`,
      firstName: 'Absent',
      lastName: 'Worker',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // Create DailyAttendance ABSENT for worker 2
  await prisma.dailyAttendance.create({
    data: {
      userId: worker2.id,
      companyId: company.id,
      teamId: team.id,
      date: todayDate,
      status: 'ABSENT',
      score: 0,
      isCounted: true,
      scheduledStart: '08:00',
    },
  });

  workers.push({ user: worker2, expectedStatus: 'ABSENT' });
  console.log(`   Created: ${worker2.firstName} ${worker2.lastName} → ABSENT (penalized)`);

  // Worker 3: EXCUSED (TL approved)
  const worker3 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}excused_${Date.now()}@test.com`,
      firstName: 'Excused',
      lastName: 'Worker',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // Create DailyAttendance EXCUSED for worker 3
  await prisma.dailyAttendance.create({
    data: {
      userId: worker3.id,
      companyId: company.id,
      teamId: team.id,
      date: todayDate,
      status: 'EXCUSED',
      score: null,
      isCounted: false,
      scheduledStart: '08:00',
    },
  });

  workers.push({ user: worker3, expectedStatus: 'EXCUSED' });
  console.log(`   Created: ${worker3.firstName} ${worker3.lastName} → EXCUSED (TL approved)`);

  // Worker 4: Checked in (GREEN)
  const worker4 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}checkedin_${Date.now()}@test.com`,
      firstName: 'CheckedIn',
      lastName: 'Worker',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // Create DailyAttendance GREEN for worker 4
  await prisma.dailyAttendance.create({
    data: {
      userId: worker4.id,
      companyId: company.id,
      teamId: team.id,
      date: todayDate,
      status: 'GREEN',
      score: 95,
      isCounted: true,
      scheduledStart: '08:00',
      checkInTime: new Date(),
    },
  });

  // Create Checkin record for worker 4
  await prisma.checkin.create({
    data: {
      userId: worker4.id,
      companyId: company.id,
      mood: 4,
      stress: 2,
      sleep: 4,
      physicalHealth: 4,
      readinessScore: 95,
      readinessStatus: 'GREEN',
      createdAt: dayStart,
    },
  });

  workers.push({ user: worker4, expectedStatus: 'CHECKED_IN' });
  console.log(`   Created: ${worker4.firstName} ${worker4.lastName} → CHECKED IN (GREEN)`);

  console.log('\n✅ Test data created\n');

  return { company, team, workers, todayDate, tz };
}

async function runTest(team: any, todayDate: Date, tz: string) {
  console.log('🚀 Running recalculateDailyTeamSummary()...\n');

  const summary = await recalculateDailyTeamSummary(team.id, todayDate, tz);

  return summary;
}

async function verifyResults(summary: any) {
  console.log('═══════════════════════════════════════════════════');
  console.log('   RESULTS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Summary Counts:');
  console.log('─────────────────────────────────────────');
  console.log(`  totalMembers:      ${summary.totalMembers}`);
  console.log(`  onLeaveCount:      ${summary.onLeaveCount} (Exception APPROVED)`);
  console.log(`  excusedCount:      ${summary.excusedCount} (TL approved absence)`);
  console.log(`  absentCount:       ${summary.absentCount} (penalized, 0 pts)`);
  console.log(`  checkedInCount:    ${summary.checkedInCount}`);
  console.log(`  expectedToCheckIn: ${summary.expectedToCheckIn}`);
  console.log(`  complianceRate:    ${summary.complianceRate?.toFixed(1)}%`);
  console.log('');

  // Expected values
  const expected = {
    totalMembers: 4,
    onLeaveCount: 1,      // 1 worker on Exception
    excusedCount: 1,      // 1 worker EXCUSED
    absentCount: 1,       // 1 worker ABSENT
    checkedInCount: 1,    // 1 worker checked in
    expectedToCheckIn: 2, // total (4) - onLeave (1) - excused (1) = 2
  };

  console.log('Expected Values:');
  console.log('─────────────────────────────────────────');
  console.log(`  totalMembers:      ${expected.totalMembers}`);
  console.log(`  onLeaveCount:      ${expected.onLeaveCount}`);
  console.log(`  excusedCount:      ${expected.excusedCount}`);
  console.log(`  absentCount:       ${expected.absentCount}`);
  console.log(`  checkedInCount:    ${expected.checkedInCount}`);
  console.log(`  expectedToCheckIn: ${expected.expectedToCheckIn}`);
  console.log('');

  // Verify
  console.log('Verification:');
  console.log('─────────────────────────────────────────');

  let passed = 0;
  let failed = 0;

  const checks = [
    { name: 'totalMembers', actual: summary.totalMembers, expected: expected.totalMembers },
    { name: 'onLeaveCount', actual: summary.onLeaveCount, expected: expected.onLeaveCount },
    { name: 'excusedCount', actual: summary.excusedCount, expected: expected.excusedCount },
    { name: 'absentCount', actual: summary.absentCount, expected: expected.absentCount },
    { name: 'checkedInCount', actual: summary.checkedInCount, expected: expected.checkedInCount },
    { name: 'expectedToCheckIn', actual: summary.expectedToCheckIn, expected: expected.expectedToCheckIn },
  ];

  for (const check of checks) {
    if (check.actual === check.expected) {
      console.log(`  ✅ ${check.name}: ${check.actual}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.name}: got ${check.actual}, expected ${check.expected}`);
      failed++;
    }
  }

  // Check no duplication
  console.log('');
  const totalAccounted = summary.onLeaveCount + summary.excusedCount + summary.absentCount + summary.checkedInCount;
  if (totalAccounted === summary.totalMembers) {
    console.log(`  ✅ NO DUPLICATION: ${totalAccounted} accounted = ${summary.totalMembers} total`);
    passed++;
  } else {
    console.log(`  ❌ DUPLICATION: ${totalAccounted} accounted ≠ ${summary.totalMembers} total`);
    failed++;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`   PASSED: ${passed}  |  FAILED: ${failed}`);
  console.log(`   STATUS: ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('═══════════════════════════════════════════════════');

  return { passed, failed };
}

async function testHolidayScenario() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   HOLIDAY SCENARIO TEST');
  console.log('═══════════════════════════════════════════════════\n');

  // Get first active company
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    throw new Error('No active company found');
  }

  const tz = company.timezone || TIMEZONE;
  const now = getNowDT(tz);
  const todayDate = toDbDate(now.toJSDate(), tz);

  // Create test team for holiday
  const team = await prisma.team.create({
    data: {
      name: `${TEST_PREFIX}Holiday_Team_${Date.now()}`,
      companyId: company.id,
      shiftStart: '08:00',
      shiftEnd: '17:00',
      workDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
      isActive: true,
    },
  });

  console.log(`   Created team: ${team.name}`);

  // Create 3 workers
  for (let i = 1; i <= 3; i++) {
    await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}holiday_worker${i}_${Date.now()}@test.com`,
        firstName: `Holiday${i}`,
        lastName: 'Worker',
        role: 'WORKER',
        companyId: company.id,
        teamId: team.id,
        teamJoinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
  }

  console.log(`   Created 3 workers`);

  // Get any user to be the holiday creator
  const creatorUser = await prisma.user.findFirst({
    where: { companyId: company.id, isActive: true },
  });

  if (!creatorUser) {
    console.log('   ⚠️ No user found, skipping holiday test');
    return { passed: 0, failed: 0 };
  }

  // Create holiday for today
  const holiday = await prisma.holiday.create({
    data: {
      company: { connect: { id: company.id } },
      creator: { connect: { id: creatorUser.id } },
      date: todayDate,
      name: 'Test Holiday',
    },
  });

  console.log(`   Created holiday: ${holiday.name}`);

  // Run summary
  console.log('\n🚀 Running recalculateDailyTeamSummary() for HOLIDAY...\n');
  const summary = await recalculateDailyTeamSummary(team.id, todayDate, tz);

  console.log('Summary Counts (Holiday):');
  console.log('─────────────────────────────────────────');
  console.log(`  totalMembers:      ${summary.totalMembers}`);
  console.log(`  isHoliday:         ${summary.isHoliday}`);
  console.log(`  expectedToCheckIn: ${summary.expectedToCheckIn}`);
  console.log(`  absentCount:       ${summary.absentCount}`);
  console.log(`  excusedCount:      ${summary.excusedCount}`);
  console.log(`  complianceRate:    ${summary.complianceRate}`);
  console.log('');

  // Verify
  let passed = 0;
  let failed = 0;

  if (summary.isHoliday === true) {
    console.log('  ✅ isHoliday: true');
    passed++;
  } else {
    console.log('  ❌ isHoliday: expected true');
    failed++;
  }

  if (summary.expectedToCheckIn === 0) {
    console.log('  ✅ expectedToCheckIn: 0 (no one expected to check in on holiday)');
    passed++;
  } else {
    console.log(`  ❌ expectedToCheckIn: expected 0, got ${summary.expectedToCheckIn}`);
    failed++;
  }

  if (summary.complianceRate === null) {
    console.log('  ✅ complianceRate: null (no expectation = no rate)');
    passed++;
  } else {
    console.log(`  ❌ complianceRate: expected null, got ${summary.complianceRate}`);
    failed++;
  }

  if (summary.absentCount === 0) {
    console.log('  ✅ absentCount: 0 (cron skips holidays)');
    passed++;
  } else {
    console.log(`  ❌ absentCount: expected 0, got ${summary.absentCount}`);
    failed++;
  }

  console.log('');
  console.log(`   PASSED: ${passed}  |  FAILED: ${failed}`);
  console.log(`   STATUS: ${failed === 0 ? '✅ HOLIDAY TEST PASSED' : '❌ HOLIDAY TEST FAILED'}`);

  // Cleanup holiday
  await prisma.holiday.delete({ where: { id: holiday.id } });

  return { passed, failed };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   DAILY SUMMARY FULL TEST');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    await cleanup();

    // Test 1: Normal scenario
    const { team, todayDate, tz } = await createTestData();
    const summary = await runTest(team, todayDate, tz);
    const normalResult = await verifyResults(summary);

    // Test 2: Holiday scenario
    const holidayResult = await testHolidayScenario();

    // Final cleanup
    await cleanup();

    // Final summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   FINAL SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Normal Test:  ${normalResult.failed === 0 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Holiday Test: ${holidayResult.failed === 0 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
