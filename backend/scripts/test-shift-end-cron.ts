/**
 * Test Script: Shift-End Cron Feature
 *
 * Tests the shift-end absence detection feature.
 * Creates mock data, runs the cron, and verifies results.
 *
 * Usage: npx tsx scripts/test-shift-end-cron.ts
 */

import { PrismaClient } from '@prisma/client';
import { processShiftEndAbsences } from '../src/cron/attendance-finalizer.js';
import { toDbDate, getNowDT } from '../src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

// Test configuration
const TEST_PREFIX = 'TEST_SHIFT_';
const SHIFT_END_HOUR = new Date().getHours(); // Current hour for immediate testing

async function cleanup() {
  console.log('\n🧹 Cleaning up previous test data...');

  // Delete in correct order (foreign key constraints)
  await prisma.absence.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  await prisma.dailyAttendance.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  await prisma.checkin.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });

  await prisma.team.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });

  console.log('✅ Cleanup complete');
}

async function createTestData() {
  console.log('\n📦 Creating test data...');

  // Get first active company
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    throw new Error('No active company found. Please seed the database first.');
  }

  console.log(`   Using company: ${company.name} (${company.id})`);

  // Create test team with shift ending at current hour
  const shiftEnd = `${SHIFT_END_HOUR.toString().padStart(2, '0')}:00`;
  const shiftStart = `${(SHIFT_END_HOUR - 8).toString().padStart(2, '0')}:00`;

  const team = await prisma.team.create({
    data: {
      name: `${TEST_PREFIX}Team_${Date.now()}`,
      companyId: company.id,
      shiftStart,
      shiftEnd,
      workDays: 'MON,TUE,WED,THU,FRI,SAT,SUN', // All days for testing
      isActive: true,
    },
  });

  console.log(`   Created team: ${team.name}`);
  console.log(`   Shift: ${shiftStart} - ${shiftEnd}`);

  // Create test workers
  const workers = [];

  // Worker 1: No check-in (should be marked absent)
  const worker1 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}worker1_${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'NoCheckin',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Joined 7 days ago
      isActive: true,
    },
  });
  workers.push({ user: worker1, expectedAbsent: true, reason: 'No check-in' });
  console.log(`   Created worker: ${worker1.firstName} ${worker1.lastName} (NO check-in)`);

  // Worker 2: Has check-in today (should NOT be marked absent)
  const worker2 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}worker2_${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'WithCheckin',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  // Create check-in for worker 2 using same date format as cron
  const now = getNowDT(TIMEZONE);
  const todayDate = toDbDate(now.toJSDate(), TIMEZONE);

  // Create checkInTime as proper DateTime
  const checkInDateTime = new Date();
  checkInDateTime.setHours(parseInt(shiftStart.split(':')[0]), 0, 0, 0);

  await prisma.dailyAttendance.create({
    data: {
      userId: worker2.id,
      companyId: company.id,
      teamId: team.id,
      date: todayDate, // Use same date format as cron
      status: 'GREEN',
      score: 100,
      isCounted: true,
      scheduledStart: shiftStart,
      checkInTime: checkInDateTime,
    },
  });

  workers.push({ user: worker2, expectedAbsent: false, reason: 'Has check-in' });
  console.log(`   Created worker: ${worker2.firstName} ${worker2.lastName} (WITH check-in)`);

  // Worker 3: Inactive (should NOT be marked absent)
  const worker3 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}worker3_${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'Inactive',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isActive: false, // Inactive
    },
  });
  workers.push({ user: worker3, expectedAbsent: false, reason: 'Inactive worker' });
  console.log(`   Created worker: ${worker3.firstName} ${worker3.lastName} (INACTIVE)`);

  console.log('✅ Test data created');

  return { company, team, workers };
}

async function runCronTest() {
  console.log('\n🚀 Running shift-end cron (forced)...');

  const result = await processShiftEndAbsences(true); // Force run

  console.log(`   Teams processed: ${result.teamsProcessed}`);
  console.log(`   Marked absent: ${result.markedAbsent}`);
  console.log(`   Skipped: ${result.skipped}`);

  return result;
}

async function verifyResults(workers: Array<{ user: any; expectedAbsent: boolean; reason: string }>) {
  console.log('\n🔍 Verifying results...');

  // Use same date format as cron
  const now = getNowDT(TIMEZONE);
  const today = toDbDate(now.toJSDate(), TIMEZONE);

  let passed = 0;
  let failed = 0;

  for (const { user, expectedAbsent, reason } of workers) {
    const absence = await prisma.absence.findUnique({
      where: {
        userId_absenceDate: {
          userId: user.id,
          absenceDate: today,
        },
      },
    });

    const dailyAttendance = await prisma.dailyAttendance.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    const hasAbsence = !!absence;
    const isAbsent = dailyAttendance?.status === 'ABSENT';

    const testPassed = expectedAbsent ? (hasAbsence && isAbsent) : (!hasAbsence || !isAbsent);

    if (testPassed) {
      console.log(`   ✅ ${user.firstName} ${user.lastName}: ${reason} → ${expectedAbsent ? 'ABSENT' : 'NOT ABSENT'}`);
      passed++;
    } else {
      console.log(`   ❌ ${user.firstName} ${user.lastName}: Expected ${expectedAbsent ? 'ABSENT' : 'NOT ABSENT'}, got ${hasAbsence ? 'ABSENT' : 'NOT ABSENT'}`);
      failed++;
    }
  }

  return { passed, failed };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   SHIFT-END CRON TEST');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Current hour: ${SHIFT_END_HOUR}:00`);

  try {
    // Step 1: Cleanup
    await cleanup();

    // Step 2: Create test data
    const { workers } = await createTestData();

    // Step 3: Run cron
    await runCronTest();

    // Step 4: Verify
    const { passed, failed } = await verifyResults(workers);

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   RESULTS');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Status: ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    // Cleanup after test
    await cleanup();

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
