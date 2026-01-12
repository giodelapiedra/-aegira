import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check ALL EXCUSED absences in the date range
  const allAbsences = await prisma.absence.findMany({
    where: {
      status: 'EXCUSED',
      absenceDate: {
        gte: new Date('2026-01-06T00:00:00Z'),
        lte: new Date('2026-01-12T23:59:59Z')
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true, team: { select: { name: true } } } }
    },
  });

  console.log('All EXCUSED Absences (Jan 6-12):');
  if (allAbsences.length === 0) {
    console.log('  None');
  } else {
    allAbsences.forEach(a => {
      console.log(`  ${a.user.firstName} ${a.user.lastName} (${a.user.team?.name || 'No team'}): ${a.absenceDate.toISOString().split('T')[0]}`);
    });
  }
  console.log('Total:', allAbsences.length);

  // Also check all approved exceptions
  const exceptions = await prisma.exception.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: new Date('2026-01-12') },
      endDate: { gte: new Date('2026-01-06') },
    },
    include: {
      user: { select: { firstName: true, lastName: true, team: { select: { name: true } } } }
    },
  });

  console.log('\nAll Approved Exceptions overlapping Jan 6-12:');
  if (exceptions.length === 0) {
    console.log('  None');
  } else {
    exceptions.forEach(e => {
      console.log(`  ${e.user.firstName} ${e.user.lastName} (${e.user.team?.name || 'No team'}): ${e.startDate.toISOString().split('T')[0]} to ${e.endDate.toISOString().split('T')[0]}`);
    });
  }

  await prisma.$disconnect();
}

check();
