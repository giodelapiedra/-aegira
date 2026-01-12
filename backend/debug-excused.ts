import { PrismaClient } from '@prisma/client';
import { toDbDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function debug() {
  console.log('=== Debug EXCUSED Absence Date Matching ===\n');

  // Get Fernando's EXCUSED absence
  const absence = await prisma.absence.findFirst({
    where: {
      status: 'EXCUSED',
      user: { firstName: 'Fernando' }
    },
    include: { user: { select: { firstName: true } } }
  });

  if (!absence) {
    console.log('No EXCUSED absence found');
    return;
  }

  console.log('EXCUSED Absence:');
  console.log('  User:', absence.user.firstName);
  console.log('  absenceDate raw:', absence.absenceDate);
  console.log('  absenceDate ISO:', absence.absenceDate.toISOString());
  console.log('  absenceDate UTC hours:', absence.absenceDate.getUTCHours());

  // Now simulate what the daily-summary query does
  const jan5 = new Date('2026-01-05');
  const dbDate = toDbDate(jan5, TIMEZONE);
  console.log('\nJan 5 toDbDate:');
  console.log('  dbDate:', dbDate);
  console.log('  dbDate ISO:', dbDate.toISOString());
  console.log('  dbDate UTC hours:', dbDate.getUTCHours());

  // Create the absenceQueryDate like daily-summary does
  const absenceQueryDate = new Date(dbDate);
  absenceQueryDate.setUTCHours(0, 0, 0, 0);
  console.log('\nAbsence query date (midnight UTC):');
  console.log('  absenceQueryDate:', absenceQueryDate);
  console.log('  absenceQueryDate ISO:', absenceQueryDate.toISOString());

  // Check if they match
  console.log('\nComparison:');
  console.log('  absence.absenceDate.getTime():', absence.absenceDate.getTime());
  console.log('  absenceQueryDate.getTime():', absenceQueryDate.getTime());
  console.log('  Match:', absence.absenceDate.getTime() === absenceQueryDate.getTime() ? 'YES' : 'NO');

  // Try the actual query
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Bravo' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true }
      }
    }
  });

  if (team) {
    const memberIds = team.members.map(m => m.id);

    // Count with the query date
    const count1 = await prisma.absence.count({
      where: {
        userId: { in: memberIds },
        status: 'EXCUSED',
        absenceDate: absenceQueryDate,
      },
    });
    console.log('\nQuery with absenceQueryDate:', count1);

    // Count with the raw absence date
    const count2 = await prisma.absence.count({
      where: {
        userId: { in: memberIds },
        status: 'EXCUSED',
        absenceDate: absence.absenceDate,
      },
    });
    console.log('Query with absence.absenceDate:', count2);

    // Try direct date string comparison
    const allExcused = await prisma.absence.findMany({
      where: {
        userId: { in: memberIds },
        status: 'EXCUSED',
      },
    });
    console.log('\nAll EXCUSED absences for team:');
    for (const a of allExcused) {
      console.log('  ', a.absenceDate.toISOString());
    }
  }

  await prisma.$disconnect();
}

debug().catch(console.error);
