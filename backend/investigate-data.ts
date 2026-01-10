import { PrismaClient } from '@prisma/client';
import { calculateReadiness } from './src/utils/readiness.js';

const prisma = new PrismaClient();

async function investigate() {
  console.log('=== INVESTIGATING DATA ISSUES ===\n');

  // Get the worker David Gonzales
  const worker = await prisma.user.findFirst({
    where: { email: 'david.gonzales@aegira.com' },
    include: { team: true }
  });

  if (!worker) {
    console.log('Worker not found');
    return;
  }

  console.log(`Worker: ${worker.firstName} ${worker.lastName}\n`);

  // Get all check-ins for this worker
  const checkins = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' }
  });

  console.log('CHECK-INS:');
  for (const c of checkins) {
    const recalc = calculateReadiness({
      mood: c.mood,
      stress: c.stress,
      sleep: c.sleep,
      physicalHealth: c.physicalHealth
    });

    console.log(`Date: ${c.createdAt.toISOString()}`);
    console.log(`  Input: mood=${c.mood}, stress=${c.stress}, sleep=${c.sleep}, health=${c.physicalHealth}`);
    console.log(`  Stored:       score=${c.readinessScore}, status=${c.readinessStatus}`);
    console.log(`  Recalculated: score=${recalc.score}, status=${recalc.status}`);
    console.log(`  Match: ${c.readinessScore === recalc.score && c.readinessStatus === recalc.status ? 'YES ✓' : 'NO ✗ MISMATCH!'}`);
    console.log('');
  }

  // Check daily attendance
  const attendance = await prisma.dailyAttendance.findMany({
    where: { userId: worker.id }
  });
  console.log(`\nDAILY ATTENDANCE RECORDS: ${attendance.length}`);
  if (attendance.length > 0) {
    for (const a of attendance) {
      console.log(`  ${a.date.toISOString().split('T')[0]}: ${a.status} (score: ${a.score})`);
    }
  }

  // Check exemptions
  const exemptions = await prisma.exception.findMany({
    where: { userId: worker.id }
  });
  console.log(`\nEXEMPTIONS: ${exemptions.length}`);
  for (const e of exemptions) {
    console.log(`  ${e.type}: ${e.startDate?.toISOString().split('T')[0]} to ${e.endDate?.toISOString().split('T')[0]} (${e.status})`);
  }

  // Check all workers' check-ins for mismatches
  console.log('\n=== CHECKING ALL WORKERS FOR SCORE MISMATCHES ===\n');

  const allCheckins = await prisma.checkin.findMany({
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  let mismatchCount = 0;
  for (const c of allCheckins) {
    const recalc = calculateReadiness({
      mood: c.mood,
      stress: c.stress,
      sleep: c.sleep,
      physicalHealth: c.physicalHealth
    });

    if (c.readinessScore !== recalc.score || c.readinessStatus !== recalc.status) {
      mismatchCount++;
      console.log(`MISMATCH: ${c.user.firstName} ${c.user.lastName}`);
      console.log(`  Input: mood=${c.mood}, stress=${c.stress}, sleep=${c.sleep}, health=${c.physicalHealth}`);
      console.log(`  Stored: ${c.readinessScore}% ${c.readinessStatus} | Recalc: ${recalc.score}% ${recalc.status}`);
      console.log('');
    }
  }

  console.log(`Total mismatches found: ${mismatchCount} out of ${allCheckins.length} check-ins`);
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
