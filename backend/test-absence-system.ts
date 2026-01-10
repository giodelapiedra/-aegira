/**
 * Test Script for Absence Justification System
 *
 * Tests:
 * 1. Absence detection logic
 * 2. API endpoints
 * 3. Grade calculation with absences
 */

import { PrismaClient } from '@prisma/client';
import { detectAndCreateAbsences, getPendingJustifications, getPendingReviews } from './src/utils/absence.js';
import { calculatePerformanceScore } from './src/utils/attendance.js';
import { getDateStringInTimezone, getNowDT, DEFAULT_TIMEZONE } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('ABSENCE JUSTIFICATION SYSTEM TEST');
  console.log('========================================\n');

  // Get a test company
  const company = await prisma.company.findFirst({
    where: { isActive: true },
  });

  if (!company) {
    console.log('❌ No active company found');
    return;
  }

  console.log(`📍 Company: ${company.name}`);
  console.log(`📍 Timezone: ${company.timezone || DEFAULT_TIMEZONE}\n`);

  const timezone = company.timezone || DEFAULT_TIMEZONE;

  // Get a worker with a team
  const worker = await prisma.user.findFirst({
    where: {
      companyId: company.id,
      role: { in: ['WORKER', 'MEMBER'] },
      teamId: { not: null },
      isActive: true,
    },
    include: {
      team: true,
    },
  });

  if (!worker) {
    console.log('❌ No active worker with team found');
    return;
  }

  console.log(`👷 Worker: ${worker.firstName} ${worker.lastName}`);
  console.log(`👥 Team: ${worker.team?.name}`);
  console.log(`📅 Team Work Days: ${worker.team?.workDays}`);
  console.log(`📅 Team Joined: ${worker.teamJoinedAt?.toISOString() || 'N/A'}`);
  console.log(`📅 Created At: ${worker.createdAt.toISOString()}\n`);

  // ========================================
  // TEST 1: Check existing data
  // ========================================
  console.log('----------------------------------------');
  console.log('TEST 1: Existing Data Check');
  console.log('----------------------------------------');

  const existingAbsences = await prisma.absence.findMany({
    where: { userId: worker.id },
    orderBy: { absenceDate: 'desc' },
    take: 5,
  });

  console.log(`📊 Existing absences for this worker: ${existingAbsences.length}`);
  if (existingAbsences.length > 0) {
    existingAbsences.forEach((a) => {
      console.log(`   - ${getDateStringInTimezone(a.absenceDate, timezone)}: ${a.status} (${a.reasonCategory || 'no reason'})`);
    });
  }

  const checkins = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log(`\n📊 Recent check-ins: ${checkins.length}`);
  if (checkins.length > 0) {
    checkins.forEach((c) => {
      console.log(`   - ${getDateStringInTimezone(c.createdAt, timezone)}: Score ${c.readinessScore}%`);
    });
  }

  // ========================================
  // TEST 2: Absence Detection
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 2: Absence Detection');
  console.log('----------------------------------------');

  const nowInTz = getNowDT(timezone);
  const todayStr = nowInTz.toFormat('yyyy-MM-dd');
  const yesterdayStr = nowInTz.minus({ days: 1 }).toFormat('yyyy-MM-dd');

  console.log(`📅 Today (${timezone}): ${todayStr}`);
  console.log(`📅 Yesterday: ${yesterdayStr}`);

  // Run detection
  console.log('\n🔍 Running absence detection...');
  const newAbsences = await detectAndCreateAbsences(worker.id, company.id, timezone);
  console.log(`✅ Created ${newAbsences.length} new absence record(s)`);

  if (newAbsences.length > 0) {
    newAbsences.forEach((a) => {
      console.log(`   - ${getDateStringInTimezone(a.absenceDate, timezone)}: ${a.status}`);
    });
  }

  // ========================================
  // TEST 3: Pending Justifications
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 3: Pending Justifications (Worker View)');
  console.log('----------------------------------------');

  const pendingJustifications = await getPendingJustifications(worker.id);
  console.log(`📋 Pending justifications: ${pendingJustifications.length}`);

  if (pendingJustifications.length > 0) {
    pendingJustifications.forEach((a) => {
      console.log(`   - ${getDateStringInTimezone(a.absenceDate, timezone)}: ${a.status} (justifiedAt: ${a.justifiedAt || 'null'})`);
    });
  }

  // ========================================
  // TEST 4: Simulate Worker Justification
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 4: Simulate Worker Justification');
  console.log('----------------------------------------');

  if (pendingJustifications.length > 0) {
    const absenceToJustify = pendingJustifications[0];
    console.log(`📝 Justifying absence: ${getDateStringInTimezone(absenceToJustify.absenceDate, timezone)}`);

    // Simulate worker submitting justification
    const justified = await prisma.absence.update({
      where: { id: absenceToJustify.id },
      data: {
        reasonCategory: 'SICK',
        explanation: 'I was sick and could not come to work.',
        justifiedAt: new Date(),
      },
    });

    console.log(`✅ Justification submitted:`);
    console.log(`   - Reason: ${justified.reasonCategory}`);
    console.log(`   - Explanation: ${justified.explanation}`);
    console.log(`   - Justified At: ${justified.justifiedAt?.toISOString()}`);
    console.log(`   - Status: ${justified.status} (still pending TL review)`);
  } else {
    console.log('ℹ️ No pending justifications to test');
  }

  // ========================================
  // TEST 5: Pending Reviews (TL View)
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 5: Pending Reviews (Team Leader View)');
  console.log('----------------------------------------');

  if (worker.teamId) {
    const pendingReviews = await getPendingReviews(worker.teamId);
    console.log(`📋 Pending reviews for team: ${pendingReviews.length}`);

    if (pendingReviews.length > 0) {
      pendingReviews.forEach((a) => {
        console.log(`   - ${a.user.firstName} ${a.user.lastName}: ${getDateStringInTimezone(a.absenceDate, timezone)}`);
        console.log(`     Reason: ${a.reasonCategory}, Justified: ${a.justifiedAt?.toISOString()}`);
      });
    }
  }

  // ========================================
  // TEST 6: Simulate TL Review
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 6: Simulate TL Review');
  console.log('----------------------------------------');

  // Get an absence that's been justified but not reviewed
  const toReview = await prisma.absence.findFirst({
    where: {
      userId: worker.id,
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: { not: null },
    },
  });

  if (toReview) {
    console.log(`📝 Reviewing absence: ${getDateStringInTimezone(toReview.absenceDate, timezone)}`);

    // Get team leader
    const teamLeader = worker.team?.leaderId
      ? await prisma.user.findUnique({ where: { id: worker.team.leaderId } })
      : null;

    // Simulate TL marking as EXCUSED
    const reviewed = await prisma.absence.update({
      where: { id: toReview.id },
      data: {
        status: 'EXCUSED',
        reviewedBy: teamLeader?.id || worker.id, // Use TL or fallback
        reviewedAt: new Date(),
        reviewNotes: 'Approved - valid sick leave',
      },
    });

    console.log(`✅ Review completed:`);
    console.log(`   - Status: ${reviewed.status}`);
    console.log(`   - Reviewed At: ${reviewed.reviewedAt?.toISOString()}`);
    console.log(`   - Notes: ${reviewed.reviewNotes}`);
  } else {
    console.log('ℹ️ No absences to review (need justified but not reviewed)');
  }

  // ========================================
  // TEST 7: Grade Calculation with Absences
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 7: Grade Calculation with Absences');
  console.log('----------------------------------------');

  // Calculate last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  console.log(`📅 Period: ${getDateStringInTimezone(startDate, timezone)} to ${getDateStringInTimezone(endDate, timezone)}`);

  const performance = await calculatePerformanceScore(worker.id, startDate, endDate, timezone);

  console.log(`\n📊 Performance Score: ${performance.score}%`);
  console.log(`📊 Total Work Days: ${performance.workDays}`);
  console.log(`📊 Counted Days: ${performance.countedDays}`);
  console.log(`\n📊 Breakdown:`);
  console.log(`   - Green (100 pts): ${performance.breakdown.green}`);
  console.log(`   - Yellow (75 pts): ${performance.breakdown.yellow}`);
  console.log(`   - Absent (0 pts): ${performance.breakdown.absent}`);
  console.log(`   - Excused (not counted): ${performance.breakdown.excused}`);
  console.log(`   - Absence Excused (not counted): ${performance.breakdown.absenceExcused}`);
  console.log(`   - Absence Unexcused (0 pts): ${performance.breakdown.absenceUnexcused}`);
  console.log(`   - Absence Pending (0 pts): ${performance.breakdown.absencePending}`);

  // ========================================
  // TEST 8: Database State Summary
  // ========================================
  console.log('\n----------------------------------------');
  console.log('TEST 8: Database State Summary');
  console.log('----------------------------------------');

  const absenceCounts = await prisma.absence.groupBy({
    by: ['status'],
    where: { companyId: company.id },
    _count: true,
  });

  console.log('📊 Absences by status (company-wide):');
  absenceCounts.forEach((c) => {
    console.log(`   - ${c.status}: ${c._count}`);
  });

  const totalAbsences = await prisma.absence.count({
    where: { companyId: company.id },
  });
  console.log(`   Total: ${totalAbsences}`);

  // ========================================
  // CLEANUP (Optional)
  // ========================================
  console.log('\n----------------------------------------');
  console.log('CLEANUP');
  console.log('----------------------------------------');

  // Revert the test data (optional - comment out to keep test data)
  if (toReview) {
    await prisma.absence.update({
      where: { id: toReview.id },
      data: {
        status: 'PENDING_JUSTIFICATION',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
      },
    });
    console.log('✅ Reverted TL review (back to PENDING_JUSTIFICATION)');
  }

  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
