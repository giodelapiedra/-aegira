import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFullFlow() {
  console.log('=== FULL EXEMPTION & ANALYTICS TEST ===\n');

  const timezone = 'Asia/Manila';
  const now = new Date();
  const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const todayStr = todayFormatter.format(now);

  console.log(`Today: ${todayStr}\n`);

  // Get worker
  const worker = await prisma.user.findFirst({
    where: {
      role: { in: ['MEMBER', 'WORKER'] },
      teamId: { not: null },
    },
    include: {
      team: true,
      company: true,
    },
  });

  if (!worker) {
    console.log('No worker found!');
    return;
  }

  console.log(`Worker: ${worker.firstName} ${worker.lastName}`);
  console.log(`Email: ${worker.email}`);
  console.log(`Team: ${worker.team?.name}\n`);

  // Calculate dates
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = todayFormatter.format(yesterday);

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = todayFormatter.format(threeDaysAgo);

  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const fourDaysAgoStr = todayFormatter.format(fourDaysAgo);

  // ============================================
  // SCENARIO: Exemption ended yesterday, worker returned today
  // ============================================
  console.log('=== SCENARIO: Worker returned from exemption ===\n');

  // Clear existing data
  console.log('1. Clearing existing test data...');
  await prisma.exception.deleteMany({ where: { userId: worker.id } });
  await prisma.checkin.deleteMany({ where: { userId: worker.id } });
  await prisma.dailyAttendance.deleteMany({ where: { userId: worker.id } });
  console.log('   Done!\n');

  // Create check-in BEFORE exemption (4 days ago)
  console.log('2. Creating check-in BEFORE exemption (4 days ago)...');
  const checkin1 = await prisma.checkin.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      mood: 8,
      stress: 3,
      sleep: 8,
      physicalHealth: 8,
      readinessScore: 85,
      readinessStatus: 'GREEN',
      createdAt: new Date(fourDaysAgoStr + 'T08:00:00'),
    },
  });
  console.log(`   Check-in: ${fourDaysAgoStr} - 85% GREEN\n`);

  // Create exemption (3 days ago to yesterday)
  console.log('3. Creating APPROVED exemption (ended yesterday)...');
  const exemption = await prisma.exception.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'SICK_LEAVE',
      reason: 'Flu - needed rest',
      status: 'APPROVED',
      startDate: new Date(threeDaysAgoStr),
      endDate: new Date(yesterdayStr), // Ended YESTERDAY
      approvedBy: worker.id,
      approvedAt: new Date(threeDaysAgoStr),
    },
  });
  console.log(`   Exemption: ${threeDaysAgoStr} to ${yesterdayStr}`);
  console.log(`   Type: SICK_LEAVE`);
  console.log(`   Status: APPROVED\n`);

  // Create check-in TODAY (returning from exemption)
  console.log('4. Creating check-in TODAY (returning from exemption)...');
  const checkin2 = await prisma.checkin.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      mood: 6,
      stress: 4,
      sleep: 7,
      physicalHealth: 6,
      readinessScore: 65,
      readinessStatus: 'YELLOW',
      notes: 'Feeling better but still recovering',
      createdAt: new Date(),
    },
  });
  console.log(`   Check-in: ${todayStr} - 65% YELLOW\n`);

  // Update user streak
  await prisma.user.update({
    where: { id: worker.id },
    data: {
      currentStreak: 2, // Continued streak (exemption preserved it)
      longestStreak: 10,
      lastCheckinDate: new Date(),
    },
  });

  // ============================================
  // CHECK ANALYTICS DATA
  // ============================================
  console.log('=== CHECKING ANALYTICS DATA ===\n');

  // Get all check-ins
  const allCheckins = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log('5. All Check-ins:');
  for (const c of allCheckins) {
    const dateStr = todayFormatter.format(c.createdAt);
    console.log(`   ${dateStr}: ${c.readinessScore}% ${c.readinessStatus}`);
  }
  console.log('');

  // Get exemptions
  const allExemptions = await prisma.exception.findMany({
    where: { userId: worker.id },
    orderBy: { startDate: 'desc' },
  });
  console.log('6. All Exemptions:');
  for (const e of allExemptions) {
    const startStr = e.startDate ? todayFormatter.format(e.startDate) : 'N/A';
    const endStr = e.endDate ? todayFormatter.format(e.endDate) : 'N/A';
    console.log(`   ${e.type}: ${startStr} to ${endStr} (${e.status})`);
  }
  console.log('');

  // Get user stats
  const userStats = await prisma.user.findUnique({
    where: { id: worker.id },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastCheckinDate: true,
    },
  });
  console.log('7. User Stats:');
  console.log(`   Current Streak: ${userStats?.currentStreak} days`);
  console.log(`   Longest Streak: ${userStats?.longestStreak} days`);
  console.log(`   Last Check-in: ${userStats?.lastCheckinDate ? todayFormatter.format(userStats.lastCheckinDate) : 'N/A'}`);
  console.log('');

  // ============================================
  // TEST LOGIC VALIDATION
  // ============================================
  console.log('=== LOGIC VALIDATION ===\n');

  // Check if today is within exemption period
  const activeExemption = allExemptions.find(e => {
    if (!e.startDate || !e.endDate) return false;
    const startStr = todayFormatter.format(e.startDate);
    const endStr = todayFormatter.format(e.endDate);
    return todayStr >= startStr && todayStr <= endStr;
  });

  console.log('8. Is worker currently on exemption?');
  if (activeExemption) {
    console.log(`   YES - Exemption ends ${todayFormatter.format(activeExemption.endDate!)}`);

    // Calculate return date (endDate + 1)
    const endDate = new Date(activeExemption.endDate!);
    const returnDate = new Date(endDate);
    returnDate.setDate(returnDate.getDate() + 1);
    const returnStr = todayFormatter.format(returnDate);
    console.log(`   Return to work: ${returnStr}`);
  } else {
    console.log(`   NO - Exemption ended ${yesterdayStr}`);
    console.log(`   Worker has RETURNED to work today`);
  }
  console.log('');

  // Check today's check-in
  const todayCheckin = allCheckins.find(c => {
    const dateStr = todayFormatter.format(c.createdAt);
    return dateStr === todayStr;
  });

  console.log('9. Today\'s Check-in Status:');
  if (todayCheckin) {
    console.log(`   Checked in: YES`);
    console.log(`   Score: ${todayCheckin.readinessScore}% (${todayCheckin.readinessStatus})`);
    console.log(`   Notes: ${todayCheckin.notes || 'None'}`);
  } else {
    console.log(`   Checked in: NO`);
  }
  console.log('');

  // ============================================
  // EXPECTED UI STATE
  // ============================================
  console.log('=== EXPECTED UI STATE ===\n');
  console.log('Worker Home Page should show:');
  console.log('- Status Card: 65% YELLOW "Limited Readiness"');
  console.log('- NOT showing "On exemption" (exemption ended yesterday)');
  console.log('- May show "Welcome back" banner (isReturning = true)');
  console.log('- Streak: 2 days');
  console.log('');
  console.log('Worker Check-in Page should show:');
  console.log('- "Check-in Complete" with today\'s status');
  console.log('- This Week stats with daily breakdown');
  console.log('');
  console.log('Analytics should show:');
  console.log('- 2 check-ins total');
  console.log('- 1 exemption (SICK_LEAVE, 3 days)');
  console.log('- Average readiness: (85 + 65) / 2 = 75%');

  console.log('\n=== TEST COMPLETE ===');
  console.log(`Login as: ${worker.email}`);
  console.log('Password: (use your test password)');
}

testFullFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
