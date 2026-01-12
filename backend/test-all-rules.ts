/**
 * Comprehensive Rules Verification Test
 *
 * Rules that should EXCLUDE a worker from expected count:
 * 1. Approved Exception (leave request)
 * 2. EXCUSED Absence (TL approved absence)
 * 3. Holiday
 * 4. Not a work day (based on team schedule)
 * 5. Worker not yet started (effective start date)
 */

import { PrismaClient } from '@prisma/client';
import { formatLocalDate, getStartOfDay, getStartOfNextDay } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function verify() {
  console.log('============================================================');
  console.log('COMPREHENSIVE RULES VERIFICATION');
  console.log('============================================================\n');

  const teams = await prisma.team.findMany({
    include: {
      company: true,
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true, createdAt: true, teamJoinedAt: true }
      }
    }
  });

  const holidays = await prisma.holiday.findMany();
  const exceptions = await prisma.exception.findMany({ where: { status: 'APPROVED' } });
  const excusedAbsences = await prisma.absence.findMany({ where: { status: 'EXCUSED' } });
  const summaries = await prisma.dailyTeamSummary.findMany({
    orderBy: { date: 'desc' }
  });

  for (const team of teams) {
    const timezone = team.company.timezone || 'Asia/Manila';
    const workDays = (team.workDays || 'MON,TUE,WED,THU,FRI').split(',');
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Build holiday set
    const holidaySet = new Set(holidays.map(h => formatLocalDate(h.date, timezone)));

    // Build exception map
    const exceptionsMap = new Map<string, typeof exceptions>();
    for (const ex of exceptions) {
      if (!exceptionsMap.has(ex.userId)) exceptionsMap.set(ex.userId, []);
      exceptionsMap.get(ex.userId)!.push(ex);
    }

    // Build absence set
    const absenceMap = new Map<string, Set<string>>();
    for (const a of excusedAbsences) {
      if (!absenceMap.has(a.userId)) absenceMap.set(a.userId, new Set());
      absenceMap.get(a.userId)!.add(formatLocalDate(a.absenceDate, timezone));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEAM: ${team.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Timezone: ${timezone}`);
    console.log(`Work Days: ${workDays.join(', ')}`);
    console.log(`Members: ${team.members.length}`);

    // Get team summaries
    const teamSummaries = summaries
      .filter(s => s.teamId === team.id)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 7);

    console.log('\n--- Day by Day Analysis ---\n');

    for (const summary of teamSummaries.reverse()) {
      const dateStr = formatLocalDate(summary.date, timezone);
      const dayOfWeek = summary.date.getDay();
      const dayName = dayNames[dayOfWeek];

      const isWorkDay = workDays.includes(dayName);
      const isHoliday = holidaySet.has(dateStr);

      if (!isWorkDay) {
        console.log(`${dateStr} (${dayName}): [REST DAY - skipped]`);
        continue;
      }
      if (isHoliday) {
        console.log(`${dateStr} (${dayName}): [HOLIDAY - skipped]`);
        continue;
      }

      // Calculate expected from rules
      let expectedFromRules = 0;
      let exemptedFromRules = 0;
      const exemptedDetails: string[] = [];
      const expectedDetails: string[] = [];

      for (const member of team.members) {
        // Check if member started before this date
        // Use teamJoinedAt or createdAt, with getStartOfNextDay (same as team-grades-optimized.ts)
        const joinDate = member.teamJoinedAt || member.createdAt;
        const memberEffStart = getStartOfNextDay(new Date(joinDate), timezone);
        const currentDayStart = getStartOfDay(summary.date, timezone);
        if (currentDayStart < memberEffStart) {
          exemptedFromRules++;
          exemptedDetails.push(`${member.firstName}(not started)`);
          continue;
        }

        // Check approved exceptions
        const userExceptions = exceptionsMap.get(member.id) || [];
        const hasException = userExceptions.some(ex => {
          const startStr = formatLocalDate(ex.startDate, timezone);
          const endStr = formatLocalDate(ex.endDate, timezone);
          return dateStr >= startStr && dateStr < endStr;
        });

        // Check EXCUSED absences
        const hasExcused = absenceMap.get(member.id)?.has(dateStr) || false;

        if (hasException || hasExcused) {
          exemptedFromRules++;
          exemptedDetails.push(`${member.firstName}${hasException ? '(exc)' : ''}${hasExcused ? '(abs)' : ''}`);
        } else {
          expectedFromRules++;
          expectedDetails.push(member.firstName);
        }
      }

      // Compare with DailyTeamSummary
      // expectedToCheckIn already equals totalMembers - onLeaveCount
      const summaryExpected = summary.expectedToCheckIn;
      const rulesMatch = expectedFromRules === summaryExpected;

      console.log(`${dateStr} (${dayName}):`);
      console.log(`  DailyTeamSummary: ${summary.checkedInCount}/${summaryExpected} (onLeave: ${summary.onLeaveCount}, total: ${summary.totalMembers})`);
      console.log(`  Rules Calculation: expected=${expectedFromRules}, exempted=${exemptedFromRules}`);
      console.log(`  Expected members: ${expectedDetails.join(', ') || 'none'}`);
      console.log(`  Exempted members: ${exemptedDetails.join(', ') || 'none'}`);

      if (!rulesMatch) {
        console.log(`  ❌ MISMATCH! Summary expected=${summaryExpected}, Rules expected=${expectedFromRules}`);
      } else {
        console.log(`  ✓ Match`);
      }
      console.log('');
    }
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
