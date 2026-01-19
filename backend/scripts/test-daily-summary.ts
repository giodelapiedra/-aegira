/**
 * Test Script: Daily Summary Counts
 *
 * Verifies that absentCount, excusedCount, and onLeaveCount are calculated correctly
 * with NO DUPLICATION.
 *
 * Usage: npx tsx scripts/test-daily-summary.ts
 */

import { PrismaClient } from '@prisma/client';
import { recalculateDailyTeamSummary } from '../src/utils/daily-summary.js';
import { toDbDate, getNowDT } from '../src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   DAILY SUMMARY COUNT TEST');
  console.log('═══════════════════════════════════════════════════\n');

  // Get first active team
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      company: { select: { timezone: true } },
      members: { where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } } },
    },
  });

  if (!team) {
    console.log('❌ No active team found');
    return;
  }

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log('');

  const tz = team.company?.timezone || TIMEZONE;
  const now = getNowDT(tz);
  const todayDate = toDbDate(now.toJSDate(), tz);

  // Get current counts from different sources
  const memberIds = team.members.map(m => m.id);

  // Exception APPROVED (planned leave)
  const exceptionCount = await prisma.exception.count({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
    },
  });

  // DailyAttendance ABSENT
  const absentDA = await prisma.dailyAttendance.count({
    where: {
      userId: { in: memberIds },
      date: todayDate,
      status: 'ABSENT',
    },
  });

  // DailyAttendance EXCUSED
  const excusedDA = await prisma.dailyAttendance.count({
    where: {
      userId: { in: memberIds },
      date: todayDate,
      status: 'EXCUSED',
    },
  });

  // DailyAttendance GREEN (checked in)
  const checkedInDA = await prisma.dailyAttendance.count({
    where: {
      userId: { in: memberIds },
      date: todayDate,
      status: 'GREEN',
    },
  });

  console.log('Raw Counts from DB:');
  console.log('─────────────────────────────────────────');
  console.log(`  Exception APPROVED (planned leave): ${exceptionCount}`);
  console.log(`  DailyAttendance ABSENT:             ${absentDA}`);
  console.log(`  DailyAttendance EXCUSED:            ${excusedDA}`);
  console.log(`  DailyAttendance GREEN:              ${checkedInDA}`);
  console.log('');

  // Now recalculate and check
  console.log('Running recalculateDailyTeamSummary()...\n');

  try {
    const summary = await recalculateDailyTeamSummary(team.id, todayDate, tz);

    console.log('Summary Result:');
    console.log('─────────────────────────────────────────');
    console.log(`  totalMembers:      ${summary.totalMembers}`);
    console.log(`  onLeaveCount:      ${summary.onLeaveCount} (Exception APPROVED only)`);
    console.log(`  excusedCount:      ${summary.excusedCount} (TL approved absence)`);
    console.log(`  absentCount:       ${summary.absentCount} (penalized, 0 pts)`);
    console.log(`  checkedInCount:    ${summary.checkedInCount}`);
    console.log(`  expectedToCheckIn: ${summary.expectedToCheckIn}`);
    console.log(`  notCheckedInCount: ${summary.notCheckedInCount} (legacy)`);
    console.log(`  complianceRate:    ${summary.complianceRate?.toFixed(1)}%`);
    console.log('');

    // Verify no duplication
    console.log('Verification:');
    console.log('─────────────────────────────────────────');

    const total = summary.onLeaveCount + summary.excusedCount + summary.absentCount + summary.checkedInCount;
    const notAccountedFor = summary.totalMembers - total;

    console.log(`  onLeave + excused + absent + checkedIn = ${total}`);
    console.log(`  totalMembers = ${summary.totalMembers}`);
    console.log(`  Not accounted for (shift ongoing?): ${notAccountedFor}`);
    console.log('');

    // Check for duplication
    const noDuplication =
      summary.onLeaveCount === exceptionCount && // onLeave should match Exception only
      summary.absentCount === absentDA &&        // absent should match DA ABSENT
      summary.excusedCount === excusedDA;        // excused should match DA EXCUSED

    if (noDuplication) {
      console.log('✅ NO DUPLICATION - Counts match source tables');
    } else {
      console.log('❌ POSSIBLE DUPLICATION DETECTED');
      console.log(`   onLeaveCount ${summary.onLeaveCount} vs Exception ${exceptionCount}`);
      console.log(`   absentCount ${summary.absentCount} vs DA ABSENT ${absentDA}`);
      console.log(`   excusedCount ${summary.excusedCount} vs DA EXCUSED ${excusedDA}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n═══════════════════════════════════════════════════');
  await prisma.$disconnect();
}

main();
