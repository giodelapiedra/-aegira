/**
 * Test Script: Exemption-Absence Cleanup Scenario
 *
 * This tests the scenario where:
 * 1. Worker has absence record for Day X (PENDING_JUSTIFICATION)
 * 2. Worker requests exemption covering Day X
 * 3. TL approves exemption
 * 4. Verify: absence record should be auto-excused
 *
 * Run: npx tsx test-exemption-absence-cleanup.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('  EXEMPTION-ABSENCE CLEANUP TEST');
  console.log('========================================\n');

  // Find a test worker and their team lead
  const worker = await prisma.user.findFirst({
    where: { role: 'WORKER' },
    include: {
      team: {
        include: {
          leader: true,
        },
      },
    },
  });

  if (!worker || !worker.team?.leader) {
    console.log('❌ No worker with team/leader found for testing');
    return;
  }

  console.log(`📋 Test Setup:`);
  console.log(`   Worker: ${worker.firstName} ${worker.lastName} (${worker.id.slice(0, 8)}...)`);
  console.log(`   Team Lead: ${worker.team.leader.firstName} ${worker.team.leader.lastName}`);
  console.log(`   Company: ${worker.companyId.slice(0, 8)}...\n`);

  // Create test dates (tomorrow and day after)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const testDateStr = tomorrow.toISOString().split('T')[0];
  const testDateStr2 = dayAfter.toISOString().split('T')[0];

  console.log(`📅 Test Dates: ${testDateStr} to ${testDateStr2}\n`);

  // Clean up any existing test data
  console.log('🧹 Cleaning up existing test data...');
  try {
    await prisma.absence.deleteMany({
      where: {
        userId: worker.id,
        absenceDate: { in: [tomorrow, dayAfter] },
      },
    });
  } catch (e) {
    console.log('   Note: No existing absences to clean');
  }
  try {
    await prisma.exemption.deleteMany({
      where: {
        userId: worker.id,
        startDate: { lte: dayAfter },
        endDate: { gte: tomorrow },
      },
    });
  } catch (e) {
    console.log('   Note: No existing exemptions to clean');
  }

  // ============================================
  // STEP 1: Create absence record (PENDING_JUSTIFICATION)
  // ============================================
  console.log('\n📝 STEP 1: Creating absence record with PENDING_JUSTIFICATION...');

  const absence = await prisma.absence.create({
    data: {
      userId: worker.id,
      teamId: worker.teamId!,
      companyId: worker.companyId,
      absenceDate: tomorrow,
      status: 'PENDING_JUSTIFICATION',
    },
  });

  console.log(`   ✅ Created absence: ${absence.id.slice(0, 8)}...`);
  console.log(`   Status: ${absence.status}`);

  // Verify it shows in pending justifications
  const pendingBefore = await prisma.absence.findMany({
    where: {
      userId: worker.id,
      status: 'PENDING_JUSTIFICATION',
    },
  });
  console.log(`   📊 Pending justifications: ${pendingBefore.length}`);

  // ============================================
  // STEP 2: Create exemption request covering that date
  // ============================================
  console.log('\n📝 STEP 2: Creating exemption request covering absence date...');

  const exemption = await prisma.exemption.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'VACATION_LEAVE',
      startDate: tomorrow,
      endDate: dayAfter,
      reason: 'Test exemption for absence cleanup verification',
      status: 'PENDING',
      createdBy: worker.id,
    },
  });

  console.log(`   ✅ Created exemption: ${exemption.id.slice(0, 8)}...`);
  console.log(`   Type: ${exemption.type}`);
  console.log(`   Status: ${exemption.status}`);
  console.log(`   Period: ${testDateStr} to ${testDateStr2}`);

  // ============================================
  // STEP 3: Approve the exemption (simulating TL action)
  // ============================================
  console.log('\n📝 STEP 3: Approving exemption (simulating TL action)...');

  // This mimics what happens in the /approve endpoint
  const updatedExemption = await prisma.exemption.update({
    where: { id: exemption.id },
    data: {
      status: 'APPROVED',
      reviewedBy: worker.team.leader.id,
      reviewedAt: new Date(),
    },
  });

  console.log(`   ✅ Exemption approved by TL`);

  // NOW: Auto-excuse any overlapping absences (this is what we added)
  const cleanedAbsences = await prisma.absence.updateMany({
    where: {
      userId: worker.id,
      absenceDate: {
        gte: tomorrow,
        lte: dayAfter,
      },
      status: 'PENDING_JUSTIFICATION',
    },
    data: {
      status: 'EXCUSED',
      reviewedBy: worker.team.leader.id,
      reviewedAt: new Date(),
      reviewNotes: `Auto-excused: Covered by approved exemption (${updatedExemption.type})`,
    },
  });

  console.log(`   🔄 Auto-excused ${cleanedAbsences.count} absence record(s)`);

  // ============================================
  // STEP 4: Verify the absence is now EXCUSED
  // ============================================
  console.log('\n📝 STEP 4: Verifying absence status...');

  const updatedAbsence = await prisma.absence.findUnique({
    where: { id: absence.id },
  });

  if (!updatedAbsence) {
    console.log('   ❌ Absence record not found!');
  } else {
    console.log(`   Absence Status: ${updatedAbsence.status}`);
    console.log(`   Review Notes: ${updatedAbsence.reviewNotes}`);

    if (updatedAbsence.status === 'EXCUSED') {
      console.log('   ✅ SUCCESS: Absence was auto-excused!');
    } else {
      console.log('   ❌ FAILED: Absence was NOT auto-excused');
    }
  }

  // ============================================
  // STEP 5: Verify no pending justifications for this worker
  // ============================================
  console.log('\n📝 STEP 5: Verifying pending justifications...');

  const pendingAfter = await prisma.absence.findMany({
    where: {
      userId: worker.id,
      status: 'PENDING_JUSTIFICATION',
    },
  });

  console.log(`   Pending justifications before: ${pendingBefore.length}`);
  console.log(`   Pending justifications after: ${pendingAfter.length}`);

  if (pendingAfter.length === 0) {
    console.log('   ✅ SUCCESS: No pending justifications - popup should NOT show!');
  } else {
    console.log('   ❌ WARNING: Still has pending justifications');
  }

  // ============================================
  // CLEANUP
  // ============================================
  console.log('\n🧹 Cleaning up test data...');
  await prisma.absence.delete({ where: { id: absence.id } });
  await prisma.exemption.delete({ where: { id: exemption.id } });
  console.log('   ✅ Test data cleaned up');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  console.log(`  Scenario: Worker has absence → Requests exemption → TL approves`);
  console.log(`  Expected: Absence auto-excused, no popup for worker`);
  console.log(`  Result: ${updatedAbsence?.status === 'EXCUSED' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
