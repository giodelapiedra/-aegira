import { PrismaClient } from '@prisma/client';
import { toDbDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function check() {
  // Get ALL Antonio's absences
  const allAbsences = await prisma.absence.findMany({
    where: { user: { firstName: 'Antonio' } },
    select: { absenceDate: true, status: true },
  });

  console.log('All absences for Antonio:');
  allAbsences.forEach(a => {
    console.log(`  ${a.absenceDate.toISOString()} - ${a.status}`);
  });

  // Get Antonio's EXCUSED absences
  const excusedAbsences = await prisma.absence.findMany({
    where: {
      user: { firstName: 'Antonio' },
      status: 'EXCUSED'
    },
  });

  console.log('\nEXCUSED absences for Antonio:');
  excusedAbsences.forEach(a => {
    console.log(`  ${a.absenceDate.toISOString()}`);
  });

  // Check the dbDate format we're using in DailyTeamSummary
  const targetDate = new Date('2026-01-07T00:00:00+08:00'); // Jan 7 in Manila timezone
  const dbDate = toDbDate(targetDate, 'Asia/Manila');
  console.log('\ntoDbDate result:', dbDate.toISOString());

  // Direct comparison
  if (absence) {
    console.log('\nDirect date comparison:');
    console.log('  absence.absenceDate.getTime():', absence.absenceDate.getTime());
    console.log('  dbDate.getTime():', dbDate.getTime());
    console.log('  Equal?', absence.absenceDate.getTime() === dbDate.getTime());

    // Query test
    const count = await prisma.absence.count({
      where: {
        user: { firstName: 'Antonio' },
        status: 'EXCUSED',
        absenceDate: dbDate,
      },
    });
    console.log('\nQuery with dbDate finds:', count, 'records');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
