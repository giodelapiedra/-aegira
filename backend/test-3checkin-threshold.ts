/**
 * TEST: 3 Check-in Threshold for Team Grades
 *
 * This test verifies that the onboarding threshold (MIN_CHECKIN_DAYS_THRESHOLD = 3)
 * is based on TOTAL historical check-ins, NOT the filtered period's check-ins.
 *
 * EXPECTED BEHAVIOR:
 * - Workers with < 3 total check-ins EVER = onboarding (excluded from analytics)
 * - Workers with >= 3 total check-ins EVER = included in analytics
 * - Even if filter shows only 1-2 check-ins, worker should still be counted
 *   if they have 3+ total historical check-ins
 *
 * Run: npx ts-node test-3checkin-threshold.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { formatLocalDate, getLastNDaysRange } from './src/utils/date-helpers.js';
import { calculateTeamGrade } from './src/utils/team-grades.js';
import { calculateTeamsOverviewOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function main() {
  console.log('='.repeat(80));
  console.log('TEST: 3 CHECK-IN THRESHOLD FOR TEAM GRADES');
  console.log('Verifying threshold uses TOTAL check-ins EVER, not filtered period');
  console.log('='.repeat(80));

  const company = await prisma.company.findFirst();
  if (!company) {
    console.log('No company found!');
    return;
  }

  const team = await prisma.team.findFirst({
    where: { companyId: company.id, isActive: true },
    include: {
      leader: true,
      members: { where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } } }
    }
  });
  if (!team) {
    console.log('No team found!');
    return;
  }

  console.log('\nCompany:', company.name);
  console.log('Team:', team.name, '- Members:', team.members.length);

  // ============================================================
  // SCENARIO 1: Worker with 2 check-ins (below threshold)
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 1: Worker with 2 check-ins (below 3 threshold)');
  console.log('='.repeat(80));

  const twoDaysAgo = DateTime.now().setZone(TIMEZONE).minus({ days: 2 }).startOf('day');
  const yesterday = DateTime.now().setZone(TIMEZONE).minus({ days: 1 }).startOf('day');
  const today = DateTime.now().setZone(TIMEZONE).startOf('day');

  // Create test worker
  const testWorker = await prisma.user.create({
    data: {
      email: 'test.onboarding.' + Date.now() + '@aegira.com',
      firstName: 'Test',
      lastName: 'OnboardingWorker',
      role: 'WORKER',
      companyId: company.id,
      teamId: team.id,
      teamJoinedAt: twoDaysAgo.minus({ days: 5 }).toJSDate(),
      isActive: true,
    }
  });

  console.log('\nCreated test worker:', testWorker.firstName, testWorker.lastName);

  // Create only 2 check-ins (below 3 threshold)
  for (const date of [twoDaysAgo, yesterday]) {
    await prisma.checkin.create({
      data: {
        userId: testWorker.id,
        readinessStatus: 'GREEN',
        readinessScore: 95.0,
        mood: 4,
        stress: 2,
        sleep: 4,
        physicalHealth: 4,
        companyId: company.id,
        createdAt: date.set({ hour: 8, minute: 30 }).toJSDate(),
      }
    });
  }
  // Update totalCheckins to match
  await prisma.user.update({
    where: { id: testWorker.id },
    data: { totalCheckins: 2 }
  });
  console.log('Created 2 check-ins (below 3 threshold)');

  // Test with both functions
  console.log('\n--- Testing calculateTeamGrade (non-optimized) ---');
  const gradeNonOpt = await calculateTeamGrade(team.id, { companyId: company.id, timezone: TIMEZONE, days: 7 });
  console.log('Onboarding Count:', gradeNonOpt?.onboardingCount);
  console.log('Included Members:', gradeNonOpt?.includedMemberCount);

  console.log('\n--- Testing calculateTeamsOverviewOptimized ---');
  const resultOpt = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    timezone: TIMEZONE,
    days: 7,
    teamIds: [team.id],
  });
  const gradeOpt = resultOpt.teams[0];
  console.log('Onboarding Count:', gradeOpt?.onboardingCount);
  console.log('Included Members:', gradeOpt?.includedMemberCount);

  // Verify worker is in onboarding (has < 3 check-ins)
  const totalCheckins2 = await prisma.checkin.count({ where: { userId: testWorker.id } });
  console.log('\nWorker total check-ins:', totalCheckins2);
  console.log('Expected: Worker should be in ONBOARDING (< 3 check-ins)');

  // ============================================================
  // SCENARIO 2: Add 3rd check-in, worker should now be included
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 2: After 3rd check-in, worker should be INCLUDED');
  console.log('='.repeat(80));

  await prisma.checkin.create({
    data: {
      userId: testWorker.id,
      readinessStatus: 'GREEN',
      readinessScore: 95.0,
      mood: 4,
      stress: 2,
      sleep: 4,
      physicalHealth: 4,
      companyId: company.id,
      createdAt: today.set({ hour: 8, minute: 30 }).toJSDate(),
    }
  });
  // Update totalCheckins to match
  await prisma.user.update({
    where: { id: testWorker.id },
    data: { totalCheckins: 3 }
  });
  console.log('Added 3rd check-in');

  const totalCheckins3 = await prisma.checkin.count({ where: { userId: testWorker.id } });
  console.log('Worker total check-ins:', totalCheckins3);

  console.log('\n--- Testing calculateTeamsOverviewOptimized (7-day filter) ---');
  const result3Opt = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    timezone: TIMEZONE,
    days: 7,
    teamIds: [team.id],
  });
  const grade3Opt = result3Opt.teams[0];
  console.log('Onboarding Count:', grade3Opt?.onboardingCount);
  console.log('Included Members:', grade3Opt?.includedMemberCount);

  // ============================================================
  // SCENARIO 3: Worker with 5+ old check-ins, but only 1 in current filter
  // This is the KEY test - filter should NOT affect threshold!
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 3: Worker with 5 TOTAL check-ins, but only 1 in 3-day filter');
  console.log('Expected: Worker should still be INCLUDED (5 >= 3 threshold)');
  console.log('='.repeat(80));

  // Create 2 more old check-ins (total = 5)
  const tenDaysAgo = DateTime.now().setZone(TIMEZONE).minus({ days: 10 }).startOf('day');
  const elevenDaysAgo = DateTime.now().setZone(TIMEZONE).minus({ days: 11 }).startOf('day');

  for (const date of [tenDaysAgo, elevenDaysAgo]) {
    await prisma.checkin.create({
      data: {
        userId: testWorker.id,
        readinessStatus: 'GREEN',
        readinessScore: 95.0,
        mood: 4,
        stress: 2,
        sleep: 4,
        physicalHealth: 4,
        companyId: company.id,
        createdAt: date.set({ hour: 8, minute: 30 }).toJSDate(),
      }
    });
  }
  // Update totalCheckins to match (3 + 2 = 5)
  await prisma.user.update({
    where: { id: testWorker.id },
    data: { totalCheckins: 5 }
  });

  const totalCheckins5 = await prisma.checkin.count({ where: { userId: testWorker.id } });
  console.log('Worker TOTAL check-ins EVER:', totalCheckins5);

  // Check how many check-ins in 3-day window
  const threeDaysAgo = DateTime.now().setZone(TIMEZONE).minus({ days: 3 }).startOf('day');
  const checkinsIn3Days = await prisma.checkin.count({
    where: {
      userId: testWorker.id,
      createdAt: { gte: threeDaysAgo.toJSDate() },
    }
  });
  console.log('Check-ins in last 3 days:', checkinsIn3Days);

  // Now test with VERY short filter (3 days) - should still include worker
  console.log('\n--- Testing with 3-day filter (worker has only 1-2 in this range) ---');
  const result3Days = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    timezone: TIMEZONE,
    days: 3,  // Very short filter
    teamIds: [team.id],
  });
  const grade3Days = result3Days.teams[0];
  console.log('3-day filter - Onboarding Count:', grade3Days?.onboardingCount);
  console.log('3-day filter - Included Members:', grade3Days?.includedMemberCount);

  console.log('\n--- Testing with 30-day filter (worker has 5 in this range) ---');
  const result30Days = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    timezone: TIMEZONE,
    days: 30,
    teamIds: [team.id],
  });
  const grade30Days = result30Days.teams[0];
  console.log('30-day filter - Onboarding Count:', grade30Days?.onboardingCount);
  console.log('30-day filter - Included Members:', grade30Days?.includedMemberCount);

  // ============================================================
  // VERIFICATION
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION');
  console.log('='.repeat(80));

  const onboarding3Day = grade3Days?.onboardingCount ?? -1;
  const onboarding30Day = grade30Days?.onboardingCount ?? -1;

  if (onboarding3Day === onboarding30Day) {
    console.log('✓ PASS: Onboarding count is SAME for both 3-day and 30-day filters!');
    console.log('  This proves threshold uses TOTAL check-ins EVER, not filtered period.');
  } else {
    console.log('✗ FAIL: Onboarding count DIFFERS between filters!');
    console.log(`  3-day filter: ${onboarding3Day} onboarding`);
    console.log(`  30-day filter: ${onboarding30Day} onboarding`);
    console.log('  This means threshold is still using filtered period check-ins!');
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('\n' + '='.repeat(80));
  console.log('CLEANUP');
  console.log('='.repeat(80));

  await prisma.checkin.deleteMany({ where: { userId: testWorker.id } });
  await prisma.user.delete({ where: { id: testWorker.id } });
  console.log('Test worker and check-ins deleted');

  await prisma.$disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
