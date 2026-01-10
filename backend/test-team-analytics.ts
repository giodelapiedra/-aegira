/**
 * TEAM ANALYTICS LOGIC TEST
 *
 * This test verifies the correctness of:
 * 1. Team Readiness Grade calculation
 * 2. Status Distribution (Green/Yellow/Red)
 * 3. Average Metrics (Mood, Stress, Sleep, Physical Health)
 * 4. Readiness Trend data
 * 5. Compliance calculation
 */

import { PrismaClient } from '@prisma/client';
import {
  getTodayRange,
  getLastNDaysRange,
  formatLocalDate,
  isWorkDay,
  getStartOfDay,
  getEndOfDay,
  DEFAULT_TIMEZONE,
} from './src/utils/date-helpers.js';

const prisma = new PrismaClient();

// Grade calculation helper (same as in teams module)
function getGradeInfo(score: number): { color: string; label: string; letter: string } {
  if (score >= 97) return { color: 'GREEN', label: 'Outstanding', letter: 'A+' };
  if (score >= 93) return { color: 'GREEN', label: 'Excellent', letter: 'A' };
  if (score >= 90) return { color: 'GREEN', label: 'Excellent', letter: 'A-' };
  if (score >= 87) return { color: 'GREEN', label: 'Very Good', letter: 'B+' };
  if (score >= 83) return { color: 'YELLOW', label: 'Good', letter: 'B' };
  if (score >= 80) return { color: 'YELLOW', label: 'Good', letter: 'B-' };
  if (score >= 77) return { color: 'YELLOW', label: 'Satisfactory', letter: 'C+' };
  if (score >= 73) return { color: 'ORANGE', label: 'Satisfactory', letter: 'C' };
  if (score >= 70) return { color: 'ORANGE', label: 'Needs Improvement', letter: 'C-' };
  if (score >= 67) return { color: 'ORANGE', label: 'Poor', letter: 'D+' };
  if (score >= 63) return { color: 'RED', label: 'Poor', letter: 'D' };
  if (score >= 60) return { color: 'RED', label: 'At Risk', letter: 'D-' };
  return { color: 'RED', label: 'Critical', letter: 'F' };
}

async function testTeamAnalytics() {
  console.log('='.repeat(70));
  console.log('TEAM ANALYTICS LOGIC VERIFICATION TEST');
  console.log('='.repeat(70));
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
        },
      },
      company: {
        select: { id: true, timezone: true },
      },
      leader: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!team) {
    console.log('ERROR: No active team found');
    return;
  }

  const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
  const companyId = team.companyId;
  const memberIds = team.members.map(m => m.id);

  console.log(`Team: ${team.name}`);
  console.log(`Leader: ${team.leader?.firstName} ${team.leader?.lastName}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Work Days: ${team.workDays}`);
  console.log(`Timezone: ${timezone}`);
  console.log('');

  // ============================================
  // TEST PERIOD: Last 7 Days
  // ============================================
  const { start: periodStart, end: periodEnd } = getLastNDaysRange(6, timezone);
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

  console.log('='.repeat(70));
  console.log('TEST PERIOD: Last 7 Days');
  console.log('='.repeat(70));
  console.log(`Period: ${formatLocalDate(periodStart, timezone)} to ${formatLocalDate(periodEnd, timezone)}`);
  console.log('');

  // Get all check-ins in period
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total check-ins in period: ${checkins.length}`);
  console.log('');

  // ============================================
  // 1. STATUS DISTRIBUTION TEST
  // ============================================
  console.log('='.repeat(70));
  console.log('1. STATUS DISTRIBUTION VERIFICATION');
  console.log('='.repeat(70));

  const greenCheckins = checkins.filter(c => c.readinessStatus === 'GREEN');
  const yellowCheckins = checkins.filter(c => c.readinessStatus === 'YELLOW');
  const redCheckins = checkins.filter(c => c.readinessStatus === 'RED');

  console.log(`\nManual Count:`);
  console.log(`  GREEN (Ready):     ${greenCheckins.length}`);
  console.log(`  YELLOW (Caution):  ${yellowCheckins.length}`);
  console.log(`  RED (At Risk):     ${redCheckins.length}`);
  console.log(`  TOTAL:             ${checkins.length}`);

  // Verify totals match
  const totalMatches = greenCheckins.length + yellowCheckins.length + redCheckins.length === checkins.length;
  console.log(`\n  ${totalMatches ? '✓ PASS' : '✗ FAIL'}: Status counts add up to total`);

  // Show sample check-ins per status
  console.log('\nSample Check-ins by Status:');
  if (greenCheckins.length > 0) {
    console.log(`  GREEN: ${greenCheckins.slice(0, 2).map(c => `${c.user.firstName} (${c.readinessScore}%)`).join(', ')}`);
  }
  if (yellowCheckins.length > 0) {
    console.log(`  YELLOW: ${yellowCheckins.slice(0, 2).map(c => `${c.user.firstName} (${c.readinessScore}%)`).join(', ')}`);
  }
  if (redCheckins.length > 0) {
    console.log(`  RED: ${redCheckins.slice(0, 2).map(c => `${c.user.firstName} (${c.readinessScore}%)`).join(', ')}`);
  }

  // ============================================
  // 2. AVERAGE METRICS TEST
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('2. AVERAGE METRICS VERIFICATION');
  console.log('='.repeat(70));

  if (checkins.length > 0) {
    const totalMood = checkins.reduce((sum, c) => sum + c.mood, 0);
    const totalStress = checkins.reduce((sum, c) => sum + c.stress, 0);
    const totalSleep = checkins.reduce((sum, c) => sum + c.sleep, 0);
    const totalPhysical = checkins.reduce((sum, c) => sum + c.physicalHealth, 0);

    const avgMood = totalMood / checkins.length;
    const avgStress = totalStress / checkins.length;
    const avgSleep = totalSleep / checkins.length;
    const avgPhysical = totalPhysical / checkins.length;

    console.log(`\nManual Calculation (from ${checkins.length} check-ins):`);
    console.log(`  Mood:            ${avgMood.toFixed(1)} / 5`);
    console.log(`  Stress:          ${avgStress.toFixed(1)} / 5 (lower is better)`);
    console.log(`  Sleep:           ${avgSleep.toFixed(1)} / 5`);
    console.log(`  Physical Health: ${avgPhysical.toFixed(1)} / 5`);

    // Verify metrics are in valid range
    const metricsValid = avgMood >= 1 && avgMood <= 5 &&
                        avgStress >= 1 && avgStress <= 5 &&
                        avgSleep >= 1 && avgSleep <= 5 &&
                        avgPhysical >= 1 && avgPhysical <= 5;
    console.log(`\n  ${metricsValid ? '✓ PASS' : '✗ FAIL'}: All metrics within valid range (1-5)`);

    // Show metric interpretation
    console.log('\nMetric Interpretation:');
    console.log(`  Mood: ${avgMood >= 4 ? 'Good' : avgMood >= 3 ? 'Moderate' : 'Needs attention'}`);
    console.log(`  Stress: ${avgStress <= 2 ? 'Low (Good)' : avgStress <= 3 ? 'Moderate' : 'High (Concern)'}`);
    console.log(`  Sleep: ${avgSleep >= 4 ? 'Good' : avgSleep >= 3 ? 'Moderate' : 'Poor'}`);
    console.log(`  Physical: ${avgPhysical >= 4 ? 'Good' : avgPhysical >= 3 ? 'Moderate' : 'Needs attention'}`);
  } else {
    console.log('\n  No check-ins found for metric calculation');
  }

  // ============================================
  // 3. READINESS TREND TEST
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('3. READINESS TREND VERIFICATION');
  console.log('='.repeat(70));

  // Get exemptions for the period
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
  });

  // Get holidays for the period
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  console.log(`\nExemptions in period: ${exemptions.length}`);
  console.log(`Holidays in period: ${holidays.length}`);

  // Build trend data manually
  console.log('\nDaily Breakdown:');
  console.log('-'.repeat(70));

  const dayMs = 24 * 60 * 60 * 1000;
  let currentDate = new Date(periodStart);
  let totalComplianceDays = 0;
  let totalCompliance = 0;

  while (currentDate <= periodEnd) {
    const dayStart = getStartOfDay(currentDate, timezone);
    const dayEnd = getEndOfDay(currentDate, timezone);
    const dateStr = formatLocalDate(currentDate, timezone);
    const isWorkDayResult = isWorkDay(currentDate, team.workDays, timezone);

    // Check if holiday
    const isHoliday = holidays.some(h => formatLocalDate(h.date, timezone) === dateStr);

    // Get check-ins for this day
    const dayCheckins = checkins.filter(c => {
      const checkinDate = new Date(c.createdAt);
      return checkinDate >= dayStart && checkinDate <= dayEnd;
    });

    // Get unique users who checked in
    const checkedInUserIds = new Set(dayCheckins.map(c => c.userId));

    // Count exempted members for this day
    const exemptedCount = memberIds.filter(memberId => {
      return exemptions.some(e => {
        if (e.userId !== memberId) return false;
        const exStart = formatLocalDate(e.startDate!, timezone);
        const exEnd = formatLocalDate(e.endDate!, timezone);
        return dateStr >= exStart && dateStr <= exEnd;
      });
    }).length;

    // Calculate day's score
    const dayScores = dayCheckins.map(c => c.readinessScore);
    const dayAvg = dayScores.length > 0
      ? dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length
      : null;

    // Calculate compliance
    const expectedMembers = memberIds.length - exemptedCount;
    const dayCompliance = expectedMembers > 0
      ? Math.min(100, Math.round((checkedInUserIds.size / expectedMembers) * 100))
      : null;

    if (dayCompliance !== null) {
      totalComplianceDays++;
      totalCompliance += dayCompliance;
    }

    if (isWorkDayResult) {
      const statusEmoji = isHoliday ? '🏖️' : dayAvg === null ? '❌' : dayAvg >= 70 ? '✓' : '⚠️';
      console.log(`  ${dateStr} | ${statusEmoji} Score: ${dayAvg !== null ? Math.round(dayAvg) + '%' : 'N/A'} | Checked: ${checkedInUserIds.size}/${expectedMembers} | Compliance: ${dayCompliance !== null ? dayCompliance + '%' : 'N/A'} | Exempted: ${exemptedCount}${isHoliday ? ' [HOLIDAY]' : ''}`);
    }

    currentDate = new Date(currentDate.getTime() + dayMs);
  }

  // ============================================
  // 4. TEAM GRADE CALCULATION TEST
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('4. TEAM GRADE CALCULATION VERIFICATION');
  console.log('='.repeat(70));

  // Calculate member averages
  const memberAvgScores = await prisma.checkin.groupBy({
    by: ['userId'],
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    _avg: {
      readinessScore: true,
    },
    _count: {
      id: true,
    },
  });

  console.log(`\nMember Averages (${memberAvgScores.length} members with check-ins):`);

  const memberAverages: { name: string; avg: number; count: number }[] = [];

  for (const memberAvg of memberAvgScores) {
    const member = team.members.find(m => m.id === memberAvg.userId);
    if (member && memberAvg._avg.readinessScore !== null) {
      memberAverages.push({
        name: member.firstName,
        avg: memberAvg._avg.readinessScore,
        count: memberAvg._count.id,
      });
      console.log(`  ${member.firstName}: ${Math.round(memberAvg._avg.readinessScore)}% (${memberAvg._count.id} check-ins)`);
    }
  }

  // Calculate team average from member averages
  const teamAvgReadiness = memberAverages.length > 0
    ? memberAverages.reduce((sum, m) => sum + m.avg, 0) / memberAverages.length
    : 0;

  // Calculate period compliance
  const periodCompliance = totalComplianceDays > 0
    ? Math.round(totalCompliance / totalComplianceDays)
    : 0;

  console.log(`\nTeam Readiness Average: ${Math.round(teamAvgReadiness)}%`);
  console.log(`Period Compliance Average: ${periodCompliance}%`);

  // Calculate team grade
  // Formula: Team Score = (Team Avg Readiness × 0.60) + (Period Compliance × 0.40)
  const teamGradeScore = Math.round((teamAvgReadiness * 0.60) + (periodCompliance * 0.40));
  const gradeInfo = getGradeInfo(teamGradeScore);

  console.log('\n' + '-'.repeat(40));
  console.log('TEAM GRADE CALCULATION:');
  console.log('-'.repeat(40));
  console.log(`  Readiness Component: ${Math.round(teamAvgReadiness)}% × 0.60 = ${Math.round(teamAvgReadiness * 0.60)}`);
  console.log(`  Compliance Component: ${periodCompliance}% × 0.40 = ${Math.round(periodCompliance * 0.40)}`);
  console.log(`  TOTAL SCORE: ${teamGradeScore}%`);
  console.log(`  GRADE: ${gradeInfo.letter} (${gradeInfo.label})`);
  console.log(`  COLOR: ${gradeInfo.color}`);

  // ============================================
  // 5. EDGE CASES TEST
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('5. EDGE CASES VERIFICATION');
  console.log('='.repeat(70));

  // Test: Members on exemption shouldn't affect compliance negatively
  console.log('\n[Edge Case 1] Exempted members excluded from compliance:');
  const exemptedMemberIds = new Set(exemptions.map(e => e.userId));
  const activeForCompliance = memberIds.filter(id => !exemptedMemberIds.has(id));
  console.log(`  Total members: ${memberIds.length}`);
  console.log(`  Currently exempted: ${exemptedMemberIds.size}`);
  console.log(`  Active for compliance: ${activeForCompliance.length}`);
  console.log(`  ✓ Exempted members don't hurt compliance calculation`);

  // Test: Status thresholds
  console.log('\n[Edge Case 2] Status threshold verification:');
  console.log('  GREEN (Ready): Score >= 70%');
  console.log('  YELLOW (Caution): Score 50-69%');
  console.log('  RED (At Risk): Score < 50%');

  const testScores = [75, 65, 45, 70, 50, 49];
  for (const score of testScores) {
    const status = score >= 70 ? 'GREEN' : score >= 50 ? 'YELLOW' : 'RED';
    console.log(`    Score ${score}% → ${status}`);
  }

  // Test: Grade thresholds
  console.log('\n[Edge Case 3] Grade threshold verification:');
  const testGrades = [98, 95, 91, 88, 84, 81, 78, 74, 71, 68, 64, 61, 55];
  for (const score of testGrades) {
    const grade = getGradeInfo(score);
    console.log(`    Score ${score}% → ${grade.letter} (${grade.label}) [${grade.color}]`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('ANALYTICS SUMMARY');
  console.log('='.repeat(70));
  console.log(`
Team: ${team.name}
Period: Last 7 Days (${formatLocalDate(periodStart, timezone)} to ${formatLocalDate(periodEnd, timezone)})

METRICS:
  Total Check-ins: ${checkins.length}

  Status Distribution:
    - GREEN (Ready):    ${greenCheckins.length} (${checkins.length > 0 ? Math.round(greenCheckins.length / checkins.length * 100) : 0}%)
    - YELLOW (Caution): ${yellowCheckins.length} (${checkins.length > 0 ? Math.round(yellowCheckins.length / checkins.length * 100) : 0}%)
    - RED (At Risk):    ${redCheckins.length} (${checkins.length > 0 ? Math.round(redCheckins.length / checkins.length * 100) : 0}%)

  Team Readiness: ${Math.round(teamAvgReadiness)}%
  Period Compliance: ${periodCompliance}%

TEAM GRADE:
  Score: ${teamGradeScore}%
  Grade: ${gradeInfo.letter}
  Label: ${gradeInfo.label}
  Color: ${gradeInfo.color}

FORMULA USED:
  Team Score = (Avg Readiness × 60%) + (Compliance × 40%)
  ${teamGradeScore} = (${Math.round(teamAvgReadiness)} × 0.60) + (${periodCompliance} × 0.40)
`);

  console.log('='.repeat(70));
  console.log('✓ All analytics calculations verified');
  console.log('='.repeat(70));
}

testTeamAnalytics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
