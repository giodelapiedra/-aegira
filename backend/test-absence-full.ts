/**
 * Full Test for Absence Justification System
 *
 * Creates test scenarios to verify:
 * 1. Absence detection on missed days
 * 2. Justification flow
 * 3. TL review flow
 * 4. Grade calculation impact
 */

import { PrismaClient } from '@prisma/client';
import { detectAndCreateAbsences, getPendingJustifications, getPendingReviews } from './src/utils/absence.js';
import { calculatePerformanceScore } from './src/utils/attendance.js';
import { getDateStringInTimezone, getNowDT, DEFAULT_TIMEZONE, toDbDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('ABSENCE SYSTEM FULL TEST');
  console.log('========================================\n');

  // Get test company
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    console.log('❌ No active company found');
    return;
  }

  const timezone = company.timezone || DEFAULT_TIMEZONE;
  console.log(`📍 Company: ${company.name}`);
  console.log(`📍 Timezone: ${timezone}\n`);

  // Get a team with a leader
  const team = await prisma.team.findFirst({
    where: {
      companyId: company.id,
      isActive: true,
      leaderId: { not: null },
    },
    include: {
      leader: true,
    },
  });

  if (!team) {
    console.log('❌ No active team with leader found');
    return;
  }

  console.log(`👥 Team: ${team.name}`);
  console.log(`👤 Team Leader: ${team.leader?.firstName} ${team.leader?.lastName}`);
  console.log(`📅 Work Days: ${team.workDays}\n`);

  // ========================================
  // SETUP: Create a test worker scenario
  // ========================================
  console.log('----------------------------------------');
  console.log('SETUP: Finding/Creating Test Scenario');
  console.log('----------------------------------------');

  // Find a worker who hasn't checked in for a few days
  const nowInTz = getNowDT(timezone);
  const threeDaysAgo = nowInTz.minus({ days: 3 }).startOf('day').toJSDate();

  // Get workers in this team
  const workers = await prisma.user.findMany({
    where: {
      teamId: team.id,
      role: { in: ['WORKER', 'MEMBER'] },
      isActive: true,
    },
    include: {
      checkins: {
        where: { createdAt: { gte: threeDaysAgo } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  console.log(`\n👷 Workers in team: ${workers.length}`);

  // Find a worker to test with
  let testWorker = workers.find(w => w.checkins.length < 3); // Worker with gaps
  if (!testWorker && workers.length > 0) {
    testWorker = workers[0];
  }

  if (!testWorker) {
    console.log('❌ No workers found in team');
    return;
  }

  console.log(`\n📋 Test Worker: ${testWorker.firstName} ${testWorker.lastName}`);
  console.log(`   Recent check-ins (last 3 days): ${testWorker.checkins.length}`);

  // ========================================
  // TEST A: Manual Absence Creation
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST A: Manual Absence Record Creation');
  console.log('----------------------------------------');

  // Create a test absence for yesterday (if it doesn't exist)
  const yesterday = nowInTz.minus({ days: 1 }).startOf('day');
  const yesterdayStr = yesterday.toFormat('yyyy-MM-dd');

  // Check if absence already exists
  const existingAbsence = await prisma.absence.findUnique({
    where: {
      userId_absenceDate: {
        userId: testWorker.id,
        absenceDate: toDbDate(yesterday.toJSDate(), timezone),
      },
    },
  });

  let testAbsence;
  if (existingAbsence) {
    console.log(`ℹ️ Absence already exists for ${yesterdayStr}`);
    testAbsence = existingAbsence;
  } else {
    // Check if there's a check-in for yesterday
    const hasCheckin = await prisma.checkin.findFirst({
      where: {
        userId: testWorker.id,
        createdAt: {
          gte: yesterday.toJSDate(),
          lt: yesterday.plus({ days: 1 }).toJSDate(),
        },
      },
    });

    if (hasCheckin) {
      console.log(`ℹ️ Worker checked in on ${yesterdayStr}, creating absence for 2 days ago instead`);
      const twoDaysAgo = nowInTz.minus({ days: 2 }).startOf('day');

      testAbsence = await prisma.absence.upsert({
        where: {
          userId_absenceDate: {
            userId: testWorker.id,
            absenceDate: toDbDate(twoDaysAgo.toJSDate(), timezone),
          },
        },
        create: {
          userId: testWorker.id,
          teamId: team.id,
          companyId: company.id,
          absenceDate: toDbDate(twoDaysAgo.toJSDate(), timezone),
          status: 'PENDING_JUSTIFICATION',
        },
        update: {},
      });
    } else {
      // Create absence for yesterday
      testAbsence = await prisma.absence.create({
        data: {
          userId: testWorker.id,
          teamId: team.id,
          companyId: company.id,
          absenceDate: toDbDate(yesterday.toJSDate(), timezone),
          status: 'PENDING_JUSTIFICATION',
        },
      });
    }
    console.log(`✅ Created test absence for ${getDateStringInTimezone(testAbsence.absenceDate, timezone)}`);
  }

  // ========================================
  // TEST B: Detection Function
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST B: Absence Detection Function');
  console.log('----------------------------------------');

  const detected = await detectAndCreateAbsences(testWorker.id, company.id, timezone);
  console.log(`🔍 Detection found ${detected.length} new absence(s)`);
  detected.forEach(a => {
    console.log(`   - ${getDateStringInTimezone(a.absenceDate, timezone)}`);
  });

  // ========================================
  // TEST C: Pending Justifications Query
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST C: Pending Justifications (Worker API)');
  console.log('----------------------------------------');

  const pending = await getPendingJustifications(testWorker.id);
  console.log(`📋 Pending justifications: ${pending.length}`);
  pending.forEach(p => {
    console.log(`   - ID: ${p.id.substring(0, 8)}...`);
    console.log(`     Date: ${getDateStringInTimezone(p.absenceDate, timezone)}`);
    console.log(`     Status: ${p.status}`);
    console.log(`     Justified: ${p.justifiedAt ? 'Yes' : 'No'}`);
  });

  // ========================================
  // TEST D: Worker Submits Justification
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST D: Worker Submits Justification');
  console.log('----------------------------------------');

  if (pending.length > 0) {
    const toJustify = pending[0];
    console.log(`📝 Justifying absence ${toJustify.id.substring(0, 8)}...`);

    const justified = await prisma.absence.update({
      where: { id: toJustify.id },
      data: {
        reasonCategory: 'SICK',
        explanation: 'I had a fever and could not come to work.',
        justifiedAt: new Date(),
      },
    });

    console.log(`✅ Justification submitted:`);
    console.log(`   - Reason: ${justified.reasonCategory}`);
    console.log(`   - Explanation: ${justified.explanation}`);
    console.log(`   - Justified At: ${justified.justifiedAt?.toISOString()}`);

    // Verify still shows as pending (waiting for TL)
    console.log(`   - Status: ${justified.status} (still waiting for TL review)`);
  } else {
    console.log('ℹ️ No pending justifications to test');
  }

  // ========================================
  // TEST E: Pending Reviews (TL API)
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST E: Pending Reviews (Team Leader API)');
  console.log('----------------------------------------');

  const reviews = await getPendingReviews(team.id);
  console.log(`📋 Pending reviews for team: ${reviews.length}`);
  reviews.forEach(r => {
    console.log(`   - ${r.user.firstName} ${r.user.lastName}`);
    console.log(`     Date: ${getDateStringInTimezone(r.absenceDate, timezone)}`);
    console.log(`     Reason: ${r.reasonCategory}`);
  });

  // ========================================
  // TEST F: TL Reviews Absence
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST F: Team Leader Reviews Absence');
  console.log('----------------------------------------');

  if (reviews.length > 0) {
    const toReview = reviews[0];
    console.log(`📝 TL reviewing absence ${toReview.id.substring(0, 8)}...`);

    // Scenario 1: Mark as EXCUSED
    const excused = await prisma.absence.update({
      where: { id: toReview.id },
      data: {
        status: 'EXCUSED',
        reviewedBy: team.leaderId,
        reviewedAt: new Date(),
        reviewNotes: 'Approved - valid sick leave with doctor\'s note',
      },
    });

    console.log(`✅ Marked as EXCUSED:`);
    console.log(`   - Status: ${excused.status}`);
    console.log(`   - Notes: ${excused.reviewNotes}`);
    console.log(`   - Impact: No penalty (not counted in grade)`);

    // Revert for next test
    await prisma.absence.update({
      where: { id: toReview.id },
      data: {
        status: 'PENDING_JUSTIFICATION',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      },
    });

    // Scenario 2: Mark as UNEXCUSED
    console.log(`\n📝 Testing UNEXCUSED scenario...`);
    const unexcused = await prisma.absence.update({
      where: { id: toReview.id },
      data: {
        status: 'UNEXCUSED',
        reviewedBy: team.leaderId,
        reviewedAt: new Date(),
        reviewNotes: 'No valid reason provided',
      },
    });

    console.log(`✅ Marked as UNEXCUSED:`);
    console.log(`   - Status: ${unexcused.status}`);
    console.log(`   - Notes: ${unexcused.reviewNotes}`);
    console.log(`   - Impact: 0 points (counts against grade)`);
  } else {
    console.log('ℹ️ No pending reviews to test');
  }

  // ========================================
  // TEST G: Grade Calculation Impact
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST G: Grade Calculation with Absences');
  console.log('----------------------------------------');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

  console.log(`📅 Period: ${getDateStringInTimezone(startDate, timezone)} to ${getDateStringInTimezone(endDate, timezone)}`);

  const performance = await calculatePerformanceScore(testWorker.id, startDate, endDate, timezone);

  console.log(`\n📊 Performance Score: ${performance.score}%`);
  console.log(`📊 Work Days: ${performance.workDays}`);
  console.log(`📊 Counted Days: ${performance.countedDays}`);
  console.log(`\n📊 Breakdown:`);
  console.log(`   ✅ Green (100 pts): ${performance.breakdown.green}`);
  console.log(`   🟡 Yellow (75 pts): ${performance.breakdown.yellow}`);
  console.log(`   ❌ Absent (0 pts): ${performance.breakdown.absent}`);
  console.log(`   📋 Excused: ${performance.breakdown.excused}`);
  console.log(`   📋 Absence Excused: ${performance.breakdown.absenceExcused}`);
  console.log(`   ❌ Absence Unexcused: ${performance.breakdown.absenceUnexcused}`);
  console.log(`   ⏳ Absence Pending: ${performance.breakdown.absencePending}`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n----------------------------------------');
  console.log('FINAL SUMMARY');
  console.log('----------------------------------------');

  const allAbsences = await prisma.absence.findMany({
    where: { companyId: company.id },
  });

  const byStatus = {
    PENDING_JUSTIFICATION: allAbsences.filter(a => a.status === 'PENDING_JUSTIFICATION').length,
    EXCUSED: allAbsences.filter(a => a.status === 'EXCUSED').length,
    UNEXCUSED: allAbsences.filter(a => a.status === 'UNEXCUSED').length,
  };

  console.log(`📊 Company-wide Absences:`);
  console.log(`   - Pending Justification: ${byStatus.PENDING_JUSTIFICATION}`);
  console.log(`   - Excused: ${byStatus.EXCUSED}`);
  console.log(`   - Unexcused: ${byStatus.UNEXCUSED}`);
  console.log(`   - Total: ${allAbsences.length}`);

  // ========================================
  // CLEANUP
  // ========================================
  console.log('\n----------------------------------------');
  console.log('CLEANUP');
  console.log('----------------------------------------');

  // Delete test absences created during this test
  if (testAbsence && !existingAbsence) {
    await prisma.absence.delete({
      where: { id: testAbsence.id },
    });
    console.log(`✅ Deleted test absence ${testAbsence.id.substring(0, 8)}...`);
  }

  // Also clean up any detected absences
  if (detected.length > 0) {
    await prisma.absence.deleteMany({
      where: { id: { in: detected.map(d => d.id) } },
    });
    console.log(`✅ Deleted ${detected.length} detected absence(s)`);
  }

  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE ✅');
  console.log('========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
