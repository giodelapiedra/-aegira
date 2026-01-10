import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const DEMO_WORKER_EMAIL = 'demo.worker@aegira.test';

async function addDemoWorkerData() {
  console.log('='.repeat(70));
  console.log('ADDING CHECK-IN DATA FOR DEMO WORKER');
  console.log('='.repeat(70));

  const timezone = 'Asia/Manila';
  const now = DateTime.now().setZone(timezone);

  // Get demo worker
  const worker = await prisma.user.findFirst({
    where: { email: DEMO_WORKER_EMAIL },
    include: { company: true, team: true },
  });

  if (!worker) {
    console.log(`❌ Demo worker not found: ${DEMO_WORKER_EMAIL}`);
    return;
  }

  console.log(`\n👷 Worker: ${worker.firstName} ${worker.lastName}`);
  console.log(`📍 Company: ${worker.company?.name}`);
  console.log(`📋 Team: ${worker.team?.name}`);

  // Check existing check-ins
  const existingCheckins = await prisma.checkin.count({
    where: { userId: worker.id },
  });

  if (existingCheckins > 0) {
    console.log(`\n⚠️ Worker already has ${existingCheckins} check-ins`);
    return;
  }

  // Create check-ins for the past 14 days
  console.log('\n📋 Creating check-in history...');

  const workDays = worker.team?.workDays?.split(',') || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  let created = 0;

  // Realistic check-in pattern for demo
  const checkinPattern = [
    // daysAgo: { mood, stress, sleep, physical } - realistic work week pattern
    { daysAgo: 1, mood: 8, stress: 4, sleep: 7, physical: 8 },   // Yesterday - good
    { daysAgo: 2, mood: 7, stress: 5, sleep: 6, physical: 7 },   // 2 days ago
    { daysAgo: 3, mood: 6, stress: 7, sleep: 5, physical: 6 },   // Mid-week stress
    { daysAgo: 4, mood: 7, stress: 6, sleep: 7, physical: 7 },
    { daysAgo: 5, mood: 8, stress: 4, sleep: 8, physical: 8 },   // Start of week - fresh
    { daysAgo: 6, mood: 9, stress: 3, sleep: 9, physical: 9 },   // Weekend rest
    { daysAgo: 7, mood: 8, stress: 3, sleep: 8, physical: 8 },
    { daysAgo: 8, mood: 7, stress: 5, sleep: 7, physical: 7 },
    { daysAgo: 9, mood: 5, stress: 8, sleep: 4, physical: 5 },   // Bad day - will be YELLOW
    { daysAgo: 10, mood: 6, stress: 6, sleep: 6, physical: 6 },
    { daysAgo: 11, mood: 7, stress: 5, sleep: 7, physical: 7 },
    { daysAgo: 12, mood: 8, stress: 4, sleep: 8, physical: 8 },
    { daysAgo: 13, mood: 4, stress: 9, sleep: 3, physical: 4 },  // Very bad day - will be RED
    { daysAgo: 14, mood: 7, stress: 5, sleep: 7, physical: 7 },
  ];

  for (const pattern of checkinPattern) {
    const checkDate = now.minus({ days: pattern.daysAgo });
    const dayAbbr = checkDate.toFormat('EEE').toUpperCase().substring(0, 3);

    // Skip if not a work day
    if (!workDays.includes(dayAbbr)) continue;

    const readinessScore = Math.round(
      (pattern.mood + (10 - pattern.stress) + pattern.sleep + pattern.physical) / 4 * 10
    );
    const readinessStatus = readinessScore >= 70 ? 'GREEN' : readinessScore >= 50 ? 'YELLOW' : 'RED';
    const lowScoreReason = readinessStatus === 'RED' ? 'PERSONAL_STRESS' :
                          readinessStatus === 'YELLOW' ? 'WORK_FATIGUE' : null;

    await prisma.checkin.create({
      data: {
        userId: worker.id,
        companyId: worker.companyId,
        mood: pattern.mood,
        stress: pattern.stress,
        sleep: pattern.sleep,
        physicalHealth: pattern.physical,
        readinessScore,
        readinessStatus,
        lowScoreReason,
        createdAt: checkDate.set({ hour: 7, minute: 30 }).toJSDate(),
      },
    });

    const statusIcon = readinessStatus === 'GREEN' ? '🟢' : readinessStatus === 'YELLOW' ? '🟡' : '🔴';
    console.log(`   ${statusIcon} ${checkDate.toFormat('yyyy-MM-dd')} (${dayAbbr}): Score ${readinessScore}% - ${readinessStatus}`);
    created++;
  }

  console.log(`\n✅ Created ${created} check-ins for demo worker`);

  // Create a pending leave request for the demo worker
  console.log('\n📝 Creating pending leave request...');

  const futureDate = now.plus({ days: 5 }).startOf('day');
  await prisma.exception.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'PERSONAL_LEAVE',
      reason: 'Family gathering - need 2 days off',
      status: 'PENDING',
      startDate: futureDate.toJSDate(),
      endDate: futureDate.plus({ days: 1 }).toJSDate(),
    },
  });

  console.log(`   ✅ Pending leave request created for ${futureDate.toFormat('yyyy-MM-dd')}`);

  // Summary
  const allCheckins = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
  });

  const green = allCheckins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellow = allCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
  const red = allCheckins.filter(c => c.readinessStatus === 'RED').length;
  const avgScore = allCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / allCheckins.length;

  console.log('\n' + '='.repeat(70));
  console.log('DEMO WORKER DATA SUMMARY');
  console.log('='.repeat(70));

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ DEMO WORKER: ${worker.firstName} ${worker.lastName}                                          │
├─────────────────────────────────────────────────────────────────────┤
│ CHECK-IN STATS (Last 14 days):                                      │
│   Total Check-ins: ${allCheckins.length.toString().padEnd(48)}│
│   Average Score: ${avgScore.toFixed(1).padEnd(50)}%│
│   🟢 GREEN: ${green.toString().padEnd(56)}│
│   🟡 YELLOW: ${yellow.toString().padEnd(55)}│
│   🔴 RED: ${red.toString().padEnd(58)}│
├─────────────────────────────────────────────────────────────────────┤
│ PENDING REQUESTS: 1 (Personal Leave)                                │
└─────────────────────────────────────────────────────────────────────┘
`);
}

addDemoWorkerData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
