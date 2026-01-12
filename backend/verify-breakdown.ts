import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== Verifying Teams Overview Breakdown ===\n');

  // Get Bravo team
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Bravo' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true }
      }
    }
  });

  if (!team) return;

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.map(m => m.firstName).join(', ')}\n`);

  // Get last 30 days summaries
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const summaries = await prisma.dailyTeamSummary.findMany({
    where: {
      teamId: team.id,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: 'asc' },
  });

  console.log('=== Day by Day Breakdown ===\n');

  let totalGreen = 0, totalYellow = 0, totalRed = 0;
  let totalCheckins = 0, totalExpected = 0, totalExcused = 0;

  for (const s of summaries) {
    const dateStr = s.date.toISOString().split('T')[0];

    // Skip non-work days
    if (!s.isWorkDay) {
      console.log(`${dateStr}: [REST DAY - skipped]`);
      continue;
    }

    // Skip holidays
    if (s.isHoliday) {
      console.log(`${dateStr}: [HOLIDAY - skipped]`);
      continue;
    }

    const absent = s.expectedToCheckIn - s.checkedInCount;

    console.log(`${dateStr}: Expected=${s.expectedToCheckIn}, CheckedIn=${s.checkedInCount}, Excused=${s.onLeaveCount}`);
    console.log(`         G=${s.greenCount} Y=${s.yellowCount} R=${s.redCount} Absent=${absent}`);

    totalGreen += s.greenCount;
    totalYellow += s.yellowCount;
    totalRed += s.redCount;
    totalCheckins += s.checkedInCount;
    totalExpected += s.expectedToCheckIn;
    totalExcused += s.onLeaveCount;
  }

  const totalAbsent = totalExpected - totalCheckins;

  console.log('\n=== TOTALS (what Teams Overview shows) ===');
  console.log(`Green (On-time): ${totalGreen}`);
  console.log(`Yellow (Late): ${totalYellow}`);
  console.log(`Red: ${totalRed}`);
  console.log(`Absent: ${totalAbsent} (${totalExpected} expected - ${totalCheckins} checked in)`);
  console.log(`Excused: ${totalExcused}`);

  console.log('\n=== VERIFICATION ===');
  console.log(`Green + Yellow + Red = ${totalGreen + totalYellow + totalRed}`);
  console.log(`Total Check-ins = ${totalCheckins}`);
  console.log(`Match: ${totalGreen + totalYellow + totalRed === totalCheckins ? '✓ YES' : '✗ NO'}`);

  // Now let's check if any exempted person is being counted as absent
  console.log('\n=== Checking for exempted members ===');

  const memberIds = team.members.map(m => m.id);

  // Get all exemptions
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
    },
    include: { user: { select: { firstName: true } } }
  });

  const excusedAbsences = await prisma.absence.findMany({
    where: {
      userId: { in: memberIds },
      status: 'EXCUSED',
    },
    include: { user: { select: { firstName: true } } }
  });

  console.log('\nApproved Exemptions:');
  for (const ex of exemptions) {
    const start = ex.startDate?.toISOString().split('T')[0];
    const end = ex.endDate?.toISOString().split('T')[0];
    console.log(`  ${ex.user.firstName}: ${start} to ${end} (exclusive end)`);
  }

  console.log('\nEXCUSED Absences:');
  for (const a of excusedAbsences) {
    const date = a.absenceDate.toISOString().split('T')[0];
    console.log(`  ${a.user.firstName}: ${date}`);
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
