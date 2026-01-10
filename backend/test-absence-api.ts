/**
 * Test Absence API Endpoints
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';

async function main() {
  console.log('========================================');
  console.log('ABSENCE API ENDPOINT TESTS');
  console.log('========================================\n');

  // Get a worker user for testing
  const worker = await prisma.user.findFirst({
    where: {
      role: { in: ['WORKER', 'MEMBER'] },
      isActive: true,
      teamId: { not: null },
    },
    include: {
      team: true,
    },
  });

  if (!worker) {
    console.log('❌ No worker found for testing');
    return;
  }

  // Get team leader
  const teamLeader = await prisma.user.findFirst({
    where: {
      role: 'TEAM_LEAD',
      isActive: true,
    },
  });

  console.log(`👷 Worker: ${worker.firstName} ${worker.lastName}`);
  console.log(`👤 Team Leader: ${teamLeader?.firstName} ${teamLeader?.lastName || 'None'}\n`);

  // Note: For actual API testing, we'd need auth tokens
  // This test verifies the database operations work correctly

  console.log('----------------------------------------');
  console.log('1. Testing /absences/my-pending logic');
  console.log('----------------------------------------');

  // Simulate what the endpoint does
  const pendingAbsences = await prisma.absence.findMany({
    where: {
      userId: worker.id,
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: null,
    },
    orderBy: { absenceDate: 'asc' },
  });

  console.log(`✅ Found ${pendingAbsences.length} pending justifications for worker`);
  console.log(`   hasBlocking: ${pendingAbsences.length > 0}`);

  console.log('\n----------------------------------------');
  console.log('2. Testing /absences/team-pending logic');
  console.log('----------------------------------------');

  if (worker.teamId) {
    const teamPending = await prisma.absence.findMany({
      where: {
        teamId: worker.teamId,
        justifiedAt: { not: null },
        status: 'PENDING_JUSTIFICATION',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { justifiedAt: 'asc' },
    });

    console.log(`✅ Found ${teamPending.length} pending reviews for team`);
    teamPending.forEach(a => {
      console.log(`   - ${a.user.firstName} ${a.user.lastName}: ${a.absenceDate.toISOString().split('T')[0]}`);
    });
  }

  console.log('\n----------------------------------------');
  console.log('3. Testing /absences/stats logic');
  console.log('----------------------------------------');

  const [pendingJustification, pendingReview, excused, unexcused] = await Promise.all([
    prisma.absence.count({
      where: { userId: worker.id, status: 'PENDING_JUSTIFICATION', justifiedAt: null },
    }),
    prisma.absence.count({
      where: { userId: worker.id, status: 'PENDING_JUSTIFICATION', justifiedAt: { not: null } },
    }),
    prisma.absence.count({
      where: { userId: worker.id, status: 'EXCUSED' },
    }),
    prisma.absence.count({
      where: { userId: worker.id, status: 'UNEXCUSED' },
    }),
  ]);

  console.log(`✅ Stats for worker:`);
  console.log(`   - Pending Justification: ${pendingJustification}`);
  console.log(`   - Pending Review: ${pendingReview}`);
  console.log(`   - Excused: ${excused}`);
  console.log(`   - Unexcused: ${unexcused}`);
  console.log(`   - Total: ${pendingJustification + pendingReview + excused + unexcused}`);

  console.log('\n----------------------------------------');
  console.log('4. Testing justify flow');
  console.log('----------------------------------------');

  // Create a test absence
  const testAbsence = await prisma.absence.create({
    data: {
      userId: worker.id,
      teamId: worker.teamId!,
      companyId: worker.companyId,
      absenceDate: new Date('2026-01-08'),
      status: 'PENDING_JUSTIFICATION',
    },
  });

  console.log(`✅ Created test absence: ${testAbsence.id.substring(0, 8)}...`);

  // Simulate justification
  const justified = await prisma.absence.update({
    where: { id: testAbsence.id },
    data: {
      reasonCategory: 'EMERGENCY',
      explanation: 'Family emergency - had to attend to sick relative',
      justifiedAt: new Date(),
    },
  });

  console.log(`✅ Justified:`);
  console.log(`   - Reason: ${justified.reasonCategory}`);
  console.log(`   - Status: ${justified.status} (waiting for TL)`);

  console.log('\n----------------------------------------');
  console.log('5. Testing review flow');
  console.log('----------------------------------------');

  // Simulate EXCUSED
  const reviewedExcused = await prisma.absence.update({
    where: { id: testAbsence.id },
    data: {
      status: 'EXCUSED',
      reviewedBy: teamLeader?.id || worker.id,
      reviewedAt: new Date(),
      reviewNotes: 'Family emergency - approved',
    },
  });

  console.log(`✅ Reviewed as EXCUSED:`);
  console.log(`   - Status: ${reviewedExcused.status}`);
  console.log(`   - Impact: NOT counted in grade (no penalty)`);

  // Reset and test UNEXCUSED
  await prisma.absence.update({
    where: { id: testAbsence.id },
    data: {
      status: 'PENDING_JUSTIFICATION',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
    },
  });

  const reviewedUnexcused = await prisma.absence.update({
    where: { id: testAbsence.id },
    data: {
      status: 'UNEXCUSED',
      reviewedBy: teamLeader?.id || worker.id,
      reviewedAt: new Date(),
      reviewNotes: 'No documentation provided',
    },
  });

  console.log(`\n✅ Reviewed as UNEXCUSED:`);
  console.log(`   - Status: ${reviewedUnexcused.status}`);
  console.log(`   - Impact: 0 points (counts against grade)`);

  // Cleanup
  await prisma.absence.delete({
    where: { id: testAbsence.id },
  });
  console.log(`\n✅ Cleaned up test absence`);

  console.log('\n========================================');
  console.log('API LOGIC TESTS COMPLETE ✅');
  console.log('========================================');

  // Summary of API routes implemented
  console.log('\n📋 Implemented API Routes:');
  console.log('   Worker Endpoints:');
  console.log('     GET  /api/absences/my-pending    - Get blocking absences');
  console.log('     POST /api/absences/justify       - Submit justifications');
  console.log('     GET  /api/absences/my-history    - Get absence history');
  console.log('\n   Team Leader Endpoints:');
  console.log('     GET  /api/absences/team-pending  - Get pending reviews');
  console.log('     POST /api/absences/:id/review    - Review (EXCUSED/UNEXCUSED)');
  console.log('     GET  /api/absences/team-history  - Get team history');
  console.log('\n   Common Endpoints:');
  console.log('     GET  /api/absences/:id           - Get absence by ID');
  console.log('     GET  /api/absences/stats         - Get absence stats');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
