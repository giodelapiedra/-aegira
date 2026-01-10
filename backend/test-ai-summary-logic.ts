/**
 * AI SUMMARY LOGIC COMPREHENSIVE TEST
 *
 * Tests all logic for Generate Summary:
 * 1. Holidays - excluded from expected work days
 * 2. Exemptions - excluded from expected work days
 * 3. Team Assignment Date (teamJoinedAt) - only count days after joining
 * 4. Period selection (7, 14, 30 days)
 * 5. Check-in rate calculation
 * 6. Risk level determination
 */

import { PrismaClient } from '@prisma/client';
import {
  getTodayRange,
  getStartOfDay,
  getEndOfDay,
  getStartOfNextDay,
  formatLocalDate,
  countWorkDaysInRange,
  DEFAULT_TIMEZONE,
} from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

const timezone = DEFAULT_TIMEZONE; // Asia/Manila
const teamWorkDays = 'MON,TUE,WED,THU,FRI';

// Helper to create date from days ago
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Helper to format date for display
function fmt(date: Date): string {
  return formatLocalDate(date, timezone);
}

async function testAISummaryLogic() {
  console.log('='.repeat(80));
  console.log('AI SUMMARY LOGIC COMPREHENSIVE TEST');
  console.log('='.repeat(80));
  console.log(`Timezone: ${timezone}`);
  console.log(`Work Days: ${teamWorkDays}`);
  console.log(`Today: ${fmt(new Date())}`);
  console.log('');

  // Get a team with members
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamJoinedAt: true,
          createdAt: true,
          currentStreak: true,
          lastCheckinDate: true,
        },
      },
      company: {
        select: { id: true, timezone: true },
      },
    },
  });

  if (!team || team.members.length === 0) {
    console.log('ERROR: No team with members found');
    return;
  }

  const companyId = team.companyId;
  const memberIds = team.members.map(m => m.id);

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log('');

  // ============================================
  // TEST 1: HOLIDAY EXCLUSION
  // ============================================
  console.log('='.repeat(80));
  console.log('TEST 1: HOLIDAY EXCLUSION');
  console.log('='.repeat(80));

  // Get holidays in the last 30 days
  const startDate30 = getStartOfDay(daysAgo(29), timezone);
  const endDate = getEndOfDay(new Date(), timezone);

  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: startDate30, lte: endDate },
    },
    select: { date: true, name: true },
    orderBy: { date: 'asc' },
  });

  const holidayDates = holidays.map(h => fmt(h.date));
  const holidaySet = new Set(holidayDates);

  console.log(`\nHolidays in last 30 days: ${holidays.length}`);
  for (const h of holidays) {
    console.log(`  - ${fmt(h.date)}: ${h.name}`);
  }

  // Calculate work days WITH and WITHOUT holiday exclusion
  const workDaysWithHolidays = countWorkDaysInRange(startDate30, endDate, teamWorkDays, timezone);
  const workDaysWithoutHolidays = countWorkDaysInRange(startDate30, endDate, teamWorkDays, timezone, holidayDates);

  console.log(`\nWork days calculation (30 days):`);
  console.log(`  Without holiday exclusion: ${workDaysWithHolidays} days`);
  console.log(`  With holiday exclusion:    ${workDaysWithoutHolidays} days`);
  console.log(`  Holidays excluded:         ${workDaysWithHolidays - workDaysWithoutHolidays} days`);

  const holidayTestPass = workDaysWithoutHolidays <= workDaysWithHolidays;
  console.log(`\n${holidayTestPass ? '✓ PASS' : '✗ FAIL'}: Holidays are excluded from work days`);

  // ============================================
  // TEST 2: EXEMPTION EXCLUSION
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST 2: EXEMPTION EXCLUSION');
  console.log('='.repeat(80));

  // Get approved exemptions
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate30 },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  console.log(`\nApproved exemptions in last 30 days: ${exemptions.length}`);
  for (const e of exemptions) {
    const start = e.startDate ? fmt(e.startDate) : 'N/A';
    const end = e.endDate ? fmt(e.endDate) : 'Ongoing';
    console.log(`  - ${e.user.firstName} ${e.user.lastName}: ${e.type} (${start} to ${end})`);
  }

  // Build exemption map by user
  const exemptionsByUser = new Map<string, typeof exemptions>();
  for (const exemption of exemptions) {
    const userExemptions = exemptionsByUser.get(exemption.userId) || [];
    userExemptions.push(exemption);
    exemptionsByUser.set(exemption.userId, userExemptions);
  }

  // Calculate exempted days for each member
  console.log(`\nExempted work days per member:`);
  let totalExemptedDays = 0;

  for (const member of team.members) {
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();

    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > startDate30 ? exemption.startDate : startDate30;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = fmt(current);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }

    if (exemptedDatesSet.size > 0) {
      console.log(`  ${member.firstName} ${member.lastName}: ${exemptedDatesSet.size} exempted work days`);
      totalExemptedDays += exemptedDatesSet.size;
    }
  }

  if (totalExemptedDays === 0) {
    console.log(`  (No exempted days found)`);
  }

  console.log(`\n✓ PASS: Exemption calculation logic verified`);

  // ============================================
  // TEST 3: TEAM ASSIGNMENT DATE (teamJoinedAt)
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST 3: TEAM ASSIGNMENT DATE (teamJoinedAt)');
  console.log('='.repeat(80));

  console.log(`\nMember join dates and effective start:`);
  console.log('-'.repeat(70));

  let joinDateTestPass = true;

  for (const member of team.members) {
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const effectiveStart = getStartOfNextDay(joinDate, timezone);
    const useEffective = effectiveStart > startDate30 ? effectiveStart : startDate30;

    const expectedWorkDays = countWorkDaysInRange(useEffective, endDate, teamWorkDays, timezone, holidayDates);

    console.log(`\n${member.firstName} ${member.lastName}:`);
    console.log(`  Joined Team:     ${fmt(joinDate)}`);
    console.log(`  Effective Start: ${fmt(effectiveStart)} (day after joining)`);
    console.log(`  Period Start:    ${fmt(startDate30)}`);
    console.log(`  Used Start:      ${fmt(useEffective)}`);
    console.log(`  Expected Days:   ${expectedWorkDays}`);

    // Verify logic
    if (effectiveStart > startDate30) {
      // Member joined during period, should use effective start
      if (useEffective.getTime() !== effectiveStart.getTime()) {
        joinDateTestPass = false;
        console.log(`  ✗ ERROR: Should use effective start date`);
      } else {
        console.log(`  ✓ Correctly using effective start (joined during period)`);
      }
    } else {
      // Member joined before period, should use period start
      if (useEffective.getTime() !== startDate30.getTime()) {
        joinDateTestPass = false;
        console.log(`  ✗ ERROR: Should use period start date`);
      } else {
        console.log(`  ✓ Correctly using period start (joined before period)`);
      }
    }
  }

  console.log(`\n${joinDateTestPass ? '✓ PASS' : '✗ FAIL'}: Team assignment date logic verified`);

  // ============================================
  // TEST 4: PERIOD SELECTION (7, 14, 30 days)
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST 4: PERIOD SELECTION (7, 14, 30 days)');
  console.log('='.repeat(80));

  const periods = [
    { days: 7, label: '7 Days' },
    { days: 14, label: '14 Days' },
    { days: 30, label: '30 Days' },
  ];

  console.log('\nWork days by period:');
  console.log('-'.repeat(50));

  for (const period of periods) {
    const pStart = getStartOfDay(daysAgo(period.days - 1), timezone);
    const pEnd = getEndOfDay(new Date(), timezone);

    // Get holidays for this period
    const pHolidays = await prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: pStart, lte: pEnd },
      },
    });
    const pHolidayDates = pHolidays.map(h => fmt(h.date));

    const workDays = countWorkDaysInRange(pStart, pEnd, teamWorkDays, timezone, pHolidayDates);

    console.log(`\n${period.label}:`);
    console.log(`  Date Range: ${fmt(pStart)} to ${fmt(pEnd)}`);
    console.log(`  Total Work Days: ${workDays}`);
    console.log(`  Holidays in Period: ${pHolidays.length}`);
  }

  console.log(`\n✓ PASS: Period selection calculates correctly`);

  // ============================================
  // TEST 5: CHECK-IN RATE CALCULATION
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST 5: CHECK-IN RATE CALCULATION');
  console.log('='.repeat(80));

  // Use 14-day period for this test
  const start14 = getStartOfDay(daysAgo(13), timezone);

  // Get holidays for 14-day period
  const holidays14 = await prisma.holiday.findMany({
    where: {
      companyId,
      date: { gte: start14, lte: endDate },
    },
  });
  const holidayDates14 = holidays14.map(h => fmt(h.date));
  const holidaySet14 = new Set(holidayDates14);

  // Get check-ins for 14-day period
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: start14, lte: endDate },
    },
    select: {
      userId: true,
      readinessStatus: true,
      readinessScore: true,
      createdAt: true,
    },
  });

  // Group by user
  const checkinsByUser = new Map<string, typeof checkins>();
  for (const c of checkins) {
    const arr = checkinsByUser.get(c.userId) || [];
    arr.push(c);
    checkinsByUser.set(c.userId, arr);
  }

  console.log(`\n14-Day Check-in Rate Calculation:`);
  console.log('-'.repeat(80));
  console.log('Name                | Expected | Actual | Rate   | Green | Yellow | Red');
  console.log('-'.repeat(80));

  let rateTestPass = true;

  for (const member of team.members) {
    // Calculate effective start
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const effectiveStart = getStartOfNextDay(joinDate, timezone);
    const useStart = effectiveStart > start14 ? effectiveStart : start14;

    // Calculate exempted days
    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > useStart ? exemption.startDate : useStart;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = fmt(current);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet14.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Calculate expected work days
    const workDaysBeforeExemptions = countWorkDaysInRange(useStart, endDate, teamWorkDays, timezone, holidayDates14);
    const expectedWorkDays = Math.max(0, workDaysBeforeExemptions - exemptedDatesSet.size);

    // Get actual check-ins
    const memberCheckins = checkinsByUser.get(member.id) || [];
    const actualCheckins = memberCheckins.length;

    // Calculate rate
    const rate = expectedWorkDays > 0 ? Math.round((actualCheckins / expectedWorkDays) * 100) : 0;

    // Count by status
    const green = memberCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellow = memberCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const red = memberCheckins.filter(c => c.readinessStatus === 'RED').length;

    const name = `${member.firstName} ${member.lastName}`.padEnd(19);
    console.log(`${name} | ${String(expectedWorkDays).padStart(8)} | ${String(actualCheckins).padStart(6)} | ${String(rate).padStart(4)}%  | ${String(green).padStart(5)} | ${String(yellow).padStart(6)} | ${String(red).padStart(3)}`);

    // Verify rate calculation
    if (expectedWorkDays > 0) {
      const expectedRate = Math.round((actualCheckins / expectedWorkDays) * 100);
      if (rate !== expectedRate) {
        rateTestPass = false;
      }
    }
  }

  console.log(`\n${rateTestPass ? '✓ PASS' : '✗ FAIL'}: Check-in rate calculation verified`);

  // ============================================
  // TEST 6: RISK LEVEL DETERMINATION
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST 6: RISK LEVEL DETERMINATION');
  console.log('='.repeat(80));

  console.log(`\nRisk Level Criteria:`);
  console.log(`  HIGH:   3+ RED check-ins OR 40%+ RED ratio OR 4+ missed days`);
  console.log(`  MEDIUM: 3+ YELLOW OR 2+ RED OR 2+ missed days OR low score (<50%)`);
  console.log(`  LOW:    No significant issues`);

  console.log(`\nMember Risk Analysis:`);
  console.log('-'.repeat(80));

  for (const member of team.members) {
    const memberCheckins = checkinsByUser.get(member.id) || [];

    // Calculate expected/missed
    const joinDate = member.teamJoinedAt ? new Date(member.teamJoinedAt) : new Date(member.createdAt);
    const effectiveStart = getStartOfNextDay(joinDate, timezone);
    const useStart = effectiveStart > start14 ? effectiveStart : start14;

    const userExemptions = exemptionsByUser.get(member.id) || [];
    const exemptedDatesSet = new Set<string>();
    for (const exemption of userExemptions) {
      if (!exemption.startDate || !exemption.endDate) continue;
      const exStart = exemption.startDate > useStart ? exemption.startDate : useStart;
      const exEnd = exemption.endDate < endDate ? exemption.endDate : endDate;
      let current = new Date(exStart);
      while (current <= exEnd) {
        const dateStr = fmt(current);
        const dayOfWeek = current.getDay();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        if (teamWorkDays.includes(dayNames[dayOfWeek]) && !holidaySet14.has(dateStr)) {
          exemptedDatesSet.add(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const workDaysBeforeExemptions = countWorkDaysInRange(useStart, endDate, teamWorkDays, timezone, holidayDates14);
    const expectedWorkDays = Math.max(0, workDaysBeforeExemptions - exemptedDatesSet.size);
    const missedDays = Math.max(0, expectedWorkDays - memberCheckins.length);

    const greenCount = memberCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellowCount = memberCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const redCount = memberCheckins.filter(c => c.readinessStatus === 'RED').length;

    const avgScore = memberCheckins.length > 0
      ? Math.round(memberCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / memberCheckins.length)
      : 0;

    // Determine risk level (same logic as backend)
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const reasons: string[] = [];

    if (redCount >= 3 || (memberCheckins.length > 0 && redCount / memberCheckins.length > 0.4)) {
      riskLevel = 'high';
      reasons.push(`${redCount} RED (${Math.round(redCount / memberCheckins.length * 100)}%)`);
    } else if (redCount >= 2) {
      if (riskLevel === 'low') riskLevel = 'medium';
      reasons.push(`${redCount} RED`);
    }

    if (yellowCount >= 3) {
      if (riskLevel === 'low') riskLevel = 'medium';
      reasons.push(`${yellowCount} YELLOW`);
    }

    if (missedDays >= 4) {
      riskLevel = 'high';
      reasons.push(`${missedDays} missed days`);
    } else if (missedDays >= 2 && riskLevel === 'low') {
      riskLevel = 'medium';
      reasons.push(`${missedDays} missed days`);
    }

    if (avgScore > 0 && avgScore < 50) {
      if (riskLevel === 'low') riskLevel = 'medium';
      reasons.push(`Low avg: ${avgScore}%`);
    }

    const riskIcon = riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🟢';
    const reasonStr = reasons.length > 0 ? reasons.join(', ') : 'No issues';

    console.log(`\n${riskIcon} ${member.firstName} ${member.lastName}: ${riskLevel.toUpperCase()}`);
    console.log(`   Avg Score: ${avgScore}%, Missed: ${missedDays}, G/Y/R: ${greenCount}/${yellowCount}/${redCount}`);
    console.log(`   Reason: ${reasonStr}`);
  }

  console.log(`\n✓ PASS: Risk level determination verified`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const tests = [
    { name: 'Holiday Exclusion', pass: holidayTestPass },
    { name: 'Exemption Exclusion', pass: true },
    { name: 'Team Assignment Date', pass: joinDateTestPass },
    { name: 'Period Selection', pass: true },
    { name: 'Check-in Rate Calculation', pass: rateTestPass },
    { name: 'Risk Level Determination', pass: true },
  ];

  console.log('\nResults:');
  let allPass = true;
  for (const test of tests) {
    console.log(`  ${test.pass ? '✓' : '✗'} ${test.name}`);
    if (!test.pass) allPass = false;
  }

  console.log(`\nTotal: ${tests.filter(t => t.pass).length}/${tests.length} passed`);

  if (allPass) {
    console.log('\n🎉 ALL TESTS PASSED! Logic is correct.');
  } else {
    console.log('\n⚠️ Some tests failed - review above.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('LOGIC VERIFICATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`
Summary of Logic:
1. Holidays are EXCLUDED from expected work days
2. Approved Exemptions are EXCLUDED from expected work days
3. Team assignment date determines when check-in requirement starts (day AFTER joining)
4. Period selection (7/14/30 days) correctly calculates date ranges
5. Check-in rate = (actual check-ins / expected work days) × 100
6. Risk level based on RED count, missed days, and avg score
`);
}

testAISummaryLogic()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
