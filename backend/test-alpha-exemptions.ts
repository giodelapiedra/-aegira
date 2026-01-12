import { PrismaClient } from '@prisma/client';
import { formatLocalDate, getStartOfDay } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function check() {
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!team) {
    console.log('Team not found');
    return;
  }

  const memberIds = team.members.map(m => m.id);
  const memberNames = new Map(team.members.map(m => [m.id, `${m.firstName} ${m.lastName}`]));

  console.log('Alpha Team Members:');
  team.members.forEach(m => console.log(`  ${m.firstName} ${m.lastName} (${m.id})`));

  // Get all approved exceptions for team members
  const exceptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
    },
    orderBy: { startDate: 'desc' },
  });

  console.log('\nAll Approved Exceptions:');
  exceptions.forEach(e => {
    const name = memberNames.get(e.userId) || 'Unknown';
    console.log(`  ${name}: ${e.startDate.toISOString().split('T')[0]} to ${e.endDate.toISOString().split('T')[0]} (${e.type})`);
  });

  // Get all EXCUSED absences for team members
  const absences = await prisma.absence.findMany({
    where: {
      userId: { in: memberIds },
      status: 'EXCUSED',
    },
    orderBy: { absenceDate: 'desc' },
  });

  console.log('\nAll EXCUSED Absences:');
  absences.forEach(a => {
    const name = memberNames.get(a.userId) || 'Unknown';
    const dateStr = formatLocalDate(a.absenceDate, TIMEZONE);
    console.log(`  ${name}: ${dateStr} (stored as ${a.absenceDate.toISOString()})`);
  });

  // Check what Team Analytics would count for each day in range
  console.log('\n--- Team Analytics Exemption Count by Day (Jan 6-12) ---');
  const days = ['Jan 6', 'Jan 7', 'Jan 8', 'Jan 9', 'Jan 10', 'Jan 11', 'Jan 12'];
  const dates = [
    new Date('2026-01-06'),
    new Date('2026-01-07'),
    new Date('2026-01-08'),
    new Date('2026-01-09'),
    new Date('2026-01-10'),
    new Date('2026-01-11'),
    new Date('2026-01-12'),
  ];

  for (let i = 0; i < dates.length; i++) {
    const currentDay = dates[i];
    const dateStr = formatLocalDate(currentDay, TIMEZONE);
    const currentDayStart = getStartOfDay(currentDay, TIMEZONE);

    let exemptedCount = 0;
    const exemptedNames: string[] = [];

    for (const member of team.members) {
      // Check approved exceptions (using date string comparison with EXCLUSIVE end date)
      const hasException = exceptions.some(ex => {
        if (ex.userId !== member.id) return false;
        const exemptStartStr = formatLocalDate(ex.startDate, TIMEZONE);
        const exemptEndStr = formatLocalDate(ex.endDate, TIMEZONE);
        return dateStr >= exemptStartStr && dateStr < exemptEndStr;
      });

      // Check EXCUSED absences
      const hasExcused = absences.some(a => {
        if (a.userId !== member.id) return false;
        const absDateStr = formatLocalDate(a.absenceDate, TIMEZONE);
        return absDateStr === dateStr;
      });

      if (hasException || hasExcused) {
        exemptedCount++;
        exemptedNames.push(`${member.firstName}${hasException ? '(exc)' : ''}${hasExcused ? '(abs)' : ''}`);
      }
    }

    console.log(`  ${days[i]} (${dateStr}): ${exemptedCount} exempted [${exemptedNames.join(', ')}]`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
