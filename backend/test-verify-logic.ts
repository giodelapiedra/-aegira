import { PrismaClient } from '@prisma/client';
import { formatLocalDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function verify() {
  console.log('============================================================');
  console.log('VERIFICATION: Team Schedules, Holidays, Exemptions');
  console.log('============================================================\n');

  // 1. Check company timezone
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, timezone: true }
  });

  console.log('=== Company Timezone ===');
  companies.forEach(c => {
    console.log(`  ${c.name}: ${c.timezone || 'NOT SET (will use Asia/Manila)'}`);
  });

  // 2. Check team schedules
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      workDays: true,
      companyId: true,
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true }
      }
    }
  });

  console.log('\n=== Team Work Schedules ===');
  teams.forEach(t => {
    console.log(`  ${t.name}:`);
    console.log(`    Work Days: ${t.workDays || 'NOT SET (default MON-FRI)'}`);
    console.log(`    Active Members: ${t.members.length}`);
  });

  // 3. Check holidays
  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'asc' },
  });

  console.log('\n=== Holidays ===');
  if (holidays.length === 0) {
    console.log('  No holidays configured');
  } else {
    holidays.forEach(h => {
      const dateStr = h.date.toISOString().split('T')[0];
      console.log(`  ${dateStr}: ${h.name}`);
    });
  }

  // 4. Check approved exceptions (exemptions)
  const exceptions = await prisma.exception.findMany({
    where: { status: 'APPROVED' },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { startDate: 'desc' },
  });

  console.log('\n=== Approved Exceptions (Exemptions) ===');
  if (exceptions.length === 0) {
    console.log('  No approved exceptions');
  } else {
    exceptions.forEach(ex => {
      const startStr = formatLocalDate(ex.startDate, 'Asia/Manila');
      const endStr = formatLocalDate(ex.endDate, 'Asia/Manila');
      console.log(`  ${ex.user.firstName} ${ex.user.lastName}: ${startStr} to ${endStr} (${ex.type})`);
      console.log(`    Raw: ${ex.startDate.toISOString()} to ${ex.endDate.toISOString()}`);
    });
  }

  // 5. Check EXCUSED absences
  const absences = await prisma.absence.findMany({
    where: { status: 'EXCUSED' },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { absenceDate: 'desc' },
  });

  console.log('\n=== EXCUSED Absences ===');
  if (absences.length === 0) {
    console.log('  No EXCUSED absences');
  } else {
    absences.forEach(a => {
      const dateStr = formatLocalDate(a.absenceDate, 'Asia/Manila');
      console.log(`  ${a.user.firstName} ${a.user.lastName}: ${dateStr}`);
      console.log(`    Raw: ${a.absenceDate.toISOString()}`);
    });
  }

  // 6. Verify expected counts per day for Alpha Team
  console.log('\n============================================================');
  console.log('ALPHA TEAM - Day by Day Verification (Jan 6-12, 2026)');
  console.log('============================================================');

  const alphaTeam = teams.find(t => t.name.includes('Alpha'));
  if (!alphaTeam) {
    console.log('Alpha team not found');
    await prisma.$disconnect();
    return;
  }

  const workDays = (alphaTeam.workDays || 'MON,TUE,WED,THU,FRI').split(',');
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const timezone = 'Asia/Manila';

  // Get holidays as set
  const holidaySet = new Set(holidays.map(h => formatLocalDate(h.date, timezone)));

  // Get exceptions for alpha members
  const memberIds = alphaTeam.members.map(m => m.id);
  const memberExceptions = exceptions.filter(ex => memberIds.includes(ex.userId));
  const memberAbsences = absences.filter(a => memberIds.includes(a.userId));

  const testDates = [
    new Date('2026-01-06'),
    new Date('2026-01-07'),
    new Date('2026-01-08'),
    new Date('2026-01-09'),
    new Date('2026-01-10'),
    new Date('2026-01-11'),
    new Date('2026-01-12'),
  ];

  console.log(`\nTeam: ${alphaTeam.name}`);
  console.log(`Work Days: ${workDays.join(', ')}`);
  console.log(`Members: ${alphaTeam.members.map(m => m.firstName).join(', ')}`);
  console.log('');

  for (const date of testDates) {
    const dateStr = formatLocalDate(date, timezone);
    const dayOfWeek = date.getDay();
    const dayName = dayNames[dayOfWeek];

    // Check if work day
    const isWorkDay = workDays.includes(dayName);
    const isHoliday = holidaySet.has(dateStr);

    if (!isWorkDay) {
      console.log(`${dateStr} (${dayName}): REST DAY - skipped`);
      continue;
    }

    if (isHoliday) {
      console.log(`${dateStr} (${dayName}): HOLIDAY - skipped`);
      continue;
    }

    // Count exempted members
    const exemptedMembers: string[] = [];
    const expectedMembers: string[] = [];

    for (const member of alphaTeam.members) {
      // Check exception
      const hasException = memberExceptions.some(ex => {
        if (ex.userId !== member.id) return false;
        const startStr = formatLocalDate(ex.startDate, timezone);
        const endStr = formatLocalDate(ex.endDate, timezone);
        // EXCLUSIVE end date
        return dateStr >= startStr && dateStr < endStr;
      });

      // Check EXCUSED absence
      const hasExcused = memberAbsences.some(a => {
        if (a.userId !== member.id) return false;
        return formatLocalDate(a.absenceDate, timezone) === dateStr;
      });

      if (hasException || hasExcused) {
        exemptedMembers.push(`${member.firstName}${hasException ? '(exc)' : ''}${hasExcused ? '(abs)' : ''}`);
      } else {
        expectedMembers.push(member.firstName);
      }
    }

    console.log(`${dateStr} (${dayName}):`);
    console.log(`  Expected (${expectedMembers.length}): ${expectedMembers.join(', ') || 'none'}`);
    console.log(`  Exempted (${exemptedMembers.length}): ${exemptedMembers.join(', ') || 'none'}`);
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
