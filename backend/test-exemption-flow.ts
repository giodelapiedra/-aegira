import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testExemptionFlow() {
  console.log('=== Testing Exemption Flow ===\n');

  // Get a worker user with a team
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
    console.log('No worker found with a team. Please create one first.');
    return;
  }

  console.log(`Worker: ${worker.firstName} ${worker.lastName} (${worker.email})`);
  console.log(`Team: ${worker.team?.name}`);
  console.log(`Company: ${worker.company?.name}\n`);

  const timezone = worker.company?.timezone || 'Asia/Manila';
  const now = new Date();

  // Get today's date in company timezone
  const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const todayStr = todayFormatter.format(now);
  console.log(`Today (${timezone}): ${todayStr}\n`);

  // Step 1: Clear existing test data
  console.log('Step 1: Clearing existing exemptions and today\'s check-in...');

  await prisma.exception.deleteMany({
    where: { userId: worker.id },
  });

  const todayStart = new Date(todayStr + 'T00:00:00');
  const todayEnd = new Date(todayStr + 'T23:59:59');

  await prisma.checkin.deleteMany({
    where: {
      userId: worker.id,
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  });
  console.log('   Cleared!\n');

  // Step 2: Create a check-in for today
  console.log('Step 2: Creating a check-in for today...');

  const checkin = await prisma.checkin.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      mood: 3,
      stress: 8,
      sleep: 3,
      physicalHealth: 3,
      readinessScore: 35,
      readinessStatus: 'RED',
      notes: 'Test check-in - feeling unwell',
    },
  });
  console.log(`   Created check-in: ${checkin.id}`);
  console.log(`   Score: ${checkin.readinessScore}% (${checkin.readinessStatus})\n`);

  // Step 3: Create an exemption that ends YESTERDAY (so return to work is TODAY)
  console.log('Step 3: Creating an exemption that ended YESTERDAY...');

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = todayFormatter.format(yesterday);

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = todayFormatter.format(threeDaysAgo);

  const exemption1 = await prisma.exception.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'SICK_LEAVE',
      reason: 'Test exemption - was sick',
      status: 'APPROVED',
      startDate: new Date(threeDaysAgoStr),
      endDate: new Date(yesterdayStr),
      approvedBy: worker.id, // self-approved for testing
      approvedAt: new Date(),
    },
  });
  console.log(`   Created exemption: ${exemption1.id}`);
  console.log(`   Period: ${threeDaysAgoStr} to ${yesterdayStr}`);
  console.log(`   Expected return to work: ${todayStr} (today)\n`);

  // Step 4: Check what the logic returns
  console.log('Step 4: Testing the logic...\n');

  // Get active exemptions
  const activeExemptions = await prisma.exception.findMany({
    where: {
      userId: worker.id,
      status: 'APPROVED',
    },
  });

  console.log('   Active exemptions found:', activeExemptions.length);
  for (const ex of activeExemptions) {
    const startStr = todayFormatter.format(new Date(ex.startDate!));
    const endStr = todayFormatter.format(new Date(ex.endDate!));
    console.log(`   - ${ex.type}: ${startStr} to ${endStr}`);

    // Check if today is within exemption period
    const isWithin = todayStr >= startStr && todayStr <= endStr;
    console.log(`     Today (${todayStr}) within period? ${isWithin}`);
  }

  console.log('\n=== Expected Results ===');
  console.log('Since exemption ended yesterday and today is a work day:');
  console.log('- Worker should NOT be shown as "On exemption"');
  console.log('- Worker should see their check-in status (35% RED)');
  console.log('- "Return to work" message should NOT appear\n');

  // Step 5: Create another test - exemption that ends TODAY
  console.log('Step 5: Creating another exemption that ends TODAY...');

  await prisma.exception.deleteMany({
    where: { userId: worker.id },
  });

  const exemption2 = await prisma.exception.create({
    data: {
      userId: worker.id,
      companyId: worker.companyId,
      type: 'PERSONAL_LEAVE',
      reason: 'Test exemption - ends today',
      status: 'APPROVED',
      startDate: new Date(yesterdayStr),
      endDate: new Date(todayStr), // Ends TODAY
      approvedBy: worker.id,
      approvedAt: new Date(),
    },
  });
  console.log(`   Created exemption: ${exemption2.id}`);
  console.log(`   Period: ${yesterdayStr} to ${todayStr}`);

  // Calculate tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = todayFormatter.format(tomorrow);
  console.log(`   Expected return to work: ${tomorrowStr} (tomorrow)\n`);

  console.log('=== Expected Results ===');
  console.log('Since exemption ends TODAY:');
  console.log('- Worker SHOULD be shown as "On exemption"');
  console.log('- Worker should see "Return to work: [tomorrow\'s date]"');
  console.log('- Check-in should NOT be required today\n');

  console.log('=== Test Complete ===');
  console.log('Refresh the worker home page to see the results.');
  console.log(`Login as: ${worker.email}\n`);
}

testExemptionFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
