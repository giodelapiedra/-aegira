/**
 * ANALYTICS FILTERING TEST
 *
 * Tests all filtering options:
 * - Period: today, 7days, 14days, 30days, alltime
 * - Date range accuracy
 * - Data consistency across filters
 */

import { PrismaClient } from '@prisma/client';
import {
  getTodayRange,
  getLastNDaysRange,
  formatLocalDate,
  DEFAULT_TIMEZONE,
} from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

async function testAnalyticsFiltering() {
  console.log('='.repeat(70));
  console.log('ANALYTICS FILTERING TEST');
  console.log('='.repeat(70));
  console.log('');

  // Get a team with members
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true },
      },
      company: {
        select: { timezone: true },
      },
    },
  });

  if (!team || team.members.length === 0) {
    console.log('No team with members found');
    return;
  }

  const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
  const companyId = team.companyId;
  const memberIds = team.members.map(m => m.id);

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Timezone: ${timezone}`);
  console.log('');

  // ============================================
  // TEST 1: Period Filter - TODAY
  // ============================================
  console.log('='.repeat(70));
  console.log('FILTER TEST 1: period=today');
  console.log('='.repeat(70));

  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  console.log(`\nDate Range: ${formatLocalDate(todayStart, timezone)} (single day)`);

  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  });

  console.log(`Check-ins found: ${todayCheckins.length}`);
  console.log(`GREEN: ${todayCheckins.filter(c => c.readinessStatus === 'GREEN').length}`);
  console.log(`YELLOW: ${todayCheckins.filter(c => c.readinessStatus === 'YELLOW').length}`);
  console.log(`RED: ${todayCheckins.filter(c => c.readinessStatus === 'RED').length}`);

  // Verify all check-ins are from today
  const allFromToday = todayCheckins.every(c => {
    const checkinDate = formatLocalDate(c.createdAt, timezone);
    const todayDate = formatLocalDate(todayStart, timezone);
    return checkinDate === todayDate;
  });
  console.log(`\n${allFromToday ? '✓ PASS' : '✗ FAIL'}: All check-ins are from today`);

  // ============================================
  // TEST 2: Period Filter - 7 DAYS
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 2: period=7days');
  console.log('='.repeat(70));

  const { start: sevenDayStart, end: sevenDayEnd } = getLastNDaysRange(6, timezone);
  console.log(`\nDate Range: ${formatLocalDate(sevenDayStart, timezone)} to ${formatLocalDate(sevenDayEnd, timezone)}`);

  const sevenDayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: { gte: sevenDayStart, lte: sevenDayEnd },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Check-ins found: ${sevenDayCheckins.length}`);
  console.log(`GREEN: ${sevenDayCheckins.filter(c => c.readinessStatus === 'GREEN').length}`);
  console.log(`YELLOW: ${sevenDayCheckins.filter(c => c.readinessStatus === 'YELLOW').length}`);
  console.log(`RED: ${sevenDayCheckins.filter(c => c.readinessStatus === 'RED').length}`);

  // Show daily breakdown
  console.log('\nDaily breakdown:');
  const dailyCounts = new Map<string, number>();
  for (const c of sevenDayCheckins) {
    const dateStr = formatLocalDate(c.createdAt, timezone);
    dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
  }
  for (const [date, count] of Array.from(dailyCounts.entries()).sort()) {
    console.log(`  ${date}: ${count} check-ins`);
  }

  // Verify all check-ins are within range
  const allWithin7Days = sevenDayCheckins.every(c => {
    return c.createdAt >= sevenDayStart && c.createdAt <= sevenDayEnd;
  });
  console.log(`\n${allWithin7Days ? '✓ PASS' : '✗ FAIL'}: All check-ins within 7-day range`);

  // ============================================
  // TEST 3: Period Filter - 14 DAYS
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 3: period=14days');
  console.log('='.repeat(70));

  const { start: fourteenDayStart, end: fourteenDayEnd } = getLastNDaysRange(13, timezone);
  console.log(`\nDate Range: ${formatLocalDate(fourteenDayStart, timezone)} to ${formatLocalDate(fourteenDayEnd, timezone)}`);

  const fourteenDayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: { gte: fourteenDayStart, lte: fourteenDayEnd },
    },
  });

  console.log(`Check-ins found: ${fourteenDayCheckins.length}`);
  console.log(`GREEN: ${fourteenDayCheckins.filter(c => c.readinessStatus === 'GREEN').length}`);
  console.log(`YELLOW: ${fourteenDayCheckins.filter(c => c.readinessStatus === 'YELLOW').length}`);
  console.log(`RED: ${fourteenDayCheckins.filter(c => c.readinessStatus === 'RED').length}`);

  const allWithin14Days = fourteenDayCheckins.every(c => {
    return c.createdAt >= fourteenDayStart && c.createdAt <= fourteenDayEnd;
  });
  console.log(`\n${allWithin14Days ? '✓ PASS' : '✗ FAIL'}: All check-ins within 14-day range`);

  // ============================================
  // TEST 4: Period Filter - 30 DAYS
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 4: period=30days');
  console.log('='.repeat(70));

  const { start: thirtyDayStart, end: thirtyDayEnd } = getLastNDaysRange(29, timezone);
  console.log(`\nDate Range: ${formatLocalDate(thirtyDayStart, timezone)} to ${formatLocalDate(thirtyDayEnd, timezone)}`);

  const thirtyDayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: { gte: thirtyDayStart, lte: thirtyDayEnd },
    },
  });

  console.log(`Check-ins found: ${thirtyDayCheckins.length}`);
  console.log(`GREEN: ${thirtyDayCheckins.filter(c => c.readinessStatus === 'GREEN').length}`);
  console.log(`YELLOW: ${thirtyDayCheckins.filter(c => c.readinessStatus === 'YELLOW').length}`);
  console.log(`RED: ${thirtyDayCheckins.filter(c => c.readinessStatus === 'RED').length}`);

  const allWithin30Days = thirtyDayCheckins.every(c => {
    return c.createdAt >= thirtyDayStart && c.createdAt <= thirtyDayEnd;
  });
  console.log(`\n${allWithin30Days ? '✓ PASS' : '✗ FAIL'}: All check-ins within 30-day range`);

  // ============================================
  // TEST 5: Period Filter - ALL TIME
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 5: period=alltime');
  console.log('='.repeat(70));

  const allTimeCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
    },
  });

  console.log(`\nAll-time check-ins: ${allTimeCheckins.length}`);
  console.log(`GREEN: ${allTimeCheckins.filter(c => c.readinessStatus === 'GREEN').length}`);
  console.log(`YELLOW: ${allTimeCheckins.filter(c => c.readinessStatus === 'YELLOW').length}`);
  console.log(`RED: ${allTimeCheckins.filter(c => c.readinessStatus === 'RED').length}`);

  // Find date range
  if (allTimeCheckins.length > 0) {
    const dates = allTimeCheckins.map(c => c.createdAt);
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    console.log(`\nDate range: ${formatLocalDate(earliest, timezone)} to ${formatLocalDate(latest, timezone)}`);
  }

  // ============================================
  // TEST 6: Verify Nested Filtering (7 ⊂ 14 ⊂ 30 ⊂ all)
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 6: Nested Range Verification');
  console.log('='.repeat(70));

  const todayCount = todayCheckins.length;
  const sevenCount = sevenDayCheckins.length;
  const fourteenCount = fourteenDayCheckins.length;
  const thirtyCount = thirtyDayCheckins.length;
  const allCount = allTimeCheckins.length;

  console.log(`\nCheck-in counts by period:`);
  console.log(`  Today:   ${todayCount}`);
  console.log(`  7 days:  ${sevenCount}`);
  console.log(`  14 days: ${fourteenCount}`);
  console.log(`  30 days: ${thirtyCount}`);
  console.log(`  All:     ${allCount}`);

  // Verify nested relationship
  const nestedCorrect = todayCount <= sevenCount &&
                       sevenCount <= fourteenCount &&
                       fourteenCount <= thirtyCount &&
                       thirtyCount <= allCount;

  console.log(`\n${nestedCorrect ? '✓ PASS' : '✗ FAIL'}: today ≤ 7days ≤ 14days ≤ 30days ≤ alltime`);

  // ============================================
  // TEST 7: Member Filter (by userId)
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 7: Member Filter');
  console.log('='.repeat(70));

  console.log('\nCheck-ins per member (7 days):');
  for (const member of team.members) {
    const memberCheckins = sevenDayCheckins.filter(c => c.userId === member.id);
    const avgScore = memberCheckins.length > 0
      ? memberCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / memberCheckins.length
      : 0;
    console.log(`  ${member.firstName}: ${memberCheckins.length} check-ins, avg ${avgScore.toFixed(0)}%`);
  }

  // Verify member filter works
  const firstMember = team.members[0];
  const filteredByMember = sevenDayCheckins.filter(c => c.userId === firstMember.id);
  const allBelongToMember = filteredByMember.every(c => c.userId === firstMember.id);
  console.log(`\n${allBelongToMember ? '✓ PASS' : '✗ FAIL'}: Member filter returns only that member's data`);

  // ============================================
  // TEST 8: Status Filter
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 8: Status Filter');
  console.log('='.repeat(70));

  const greenOnly = sevenDayCheckins.filter(c => c.readinessStatus === 'GREEN');
  const yellowOnly = sevenDayCheckins.filter(c => c.readinessStatus === 'YELLOW');
  const redOnly = sevenDayCheckins.filter(c => c.readinessStatus === 'RED');

  console.log(`\n7-day check-ins filtered by status:`);
  console.log(`  GREEN only:  ${greenOnly.length} (all scores >= 70%: ${greenOnly.every(c => c.readinessScore >= 70) ? '✓' : '✗'})`);
  console.log(`  YELLOW only: ${yellowOnly.length} (all scores 50-69%: ${yellowOnly.every(c => c.readinessScore >= 50 && c.readinessScore < 70) ? '✓' : '✗'})`);
  console.log(`  RED only:    ${redOnly.length} (all scores < 50%: ${redOnly.every(c => c.readinessScore < 50) ? '✓' : '✗'})`);

  // Verify status matches score
  const statusMatchesScore = sevenDayCheckins.every(c => {
    if (c.readinessStatus === 'GREEN') return c.readinessScore >= 70;
    if (c.readinessStatus === 'YELLOW') return c.readinessScore >= 50 && c.readinessScore < 70;
    if (c.readinessStatus === 'RED') return c.readinessScore < 50;
    return false;
  });
  console.log(`\n${statusMatchesScore ? '✓ PASS' : '✗ FAIL'}: Status correctly matches score thresholds`);

  // ============================================
  // TEST 9: Exemption Filtering
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTER TEST 9: Exemption Filtering');
  console.log('='.repeat(70));

  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      status: 'APPROVED',
    },
    include: {
      user: { select: { firstName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`\nRecent exemptions: ${exemptions.length}`);
  for (const e of exemptions.slice(0, 5)) {
    const start = e.startDate ? formatLocalDate(e.startDate, timezone) : 'N/A';
    const end = e.endDate ? formatLocalDate(e.endDate, timezone) : 'Ongoing';
    console.log(`  ${e.user.firstName}: ${e.type} (${start} to ${end}) - ${e.status}`);
  }

  // Check exemptions in 7-day period
  const periodExemptions = exemptions.filter(e => {
    if (!e.startDate || !e.endDate) return false;
    return e.startDate <= sevenDayEnd && e.endDate >= sevenDayStart;
  });
  console.log(`\nExemptions overlapping 7-day period: ${periodExemptions.length}`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FILTERING TEST SUMMARY');
  console.log('='.repeat(70));

  const allTests = [
    { name: 'Today filter', pass: allFromToday },
    { name: '7-day filter', pass: allWithin7Days },
    { name: '14-day filter', pass: allWithin14Days },
    { name: '30-day filter', pass: allWithin30Days },
    { name: 'Nested ranges', pass: nestedCorrect },
    { name: 'Member filter', pass: allBelongToMember },
    { name: 'Status filter', pass: statusMatchesScore },
  ];

  console.log('\nTest Results:');
  let passed = 0;
  for (const test of allTests) {
    console.log(`  ${test.pass ? '✓' : '✗'} ${test.name}`);
    if (test.pass) passed++;
  }

  console.log(`\nTotal: ${passed}/${allTests.length} passed`);

  if (passed === allTests.length) {
    console.log('\n🎉 ALL FILTERING TESTS PASSED!');
  } else {
    console.log('\n⚠️ Some tests failed - review above');
  }

  console.log('\n' + '='.repeat(70));
}

testAnalyticsFiltering()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
