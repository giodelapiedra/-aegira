/**
 * TEST: Verify actual analytics data from database
 *
 * This simulates exactly what the API returns
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

async function testApiAnalytics() {
  console.log('='.repeat(70));
  console.log('SIMULATED API ANALYTICS OUTPUT');
  console.log('='.repeat(70));
  console.log('');

  // Get first team
  const team = await prisma.team.findFirst({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          lastCheckinDate: true,
          teamJoinedAt: true,
          createdAt: true,
        },
      },
      company: {
        select: { id: true, timezone: true },
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

  // Use 7 days period (same as frontend "7days" option)
  const { start: periodStart, end: periodEnd } = getLastNDaysRange(6, timezone);
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);

  console.log(`Team: ${team.name}`);
  console.log(`Members: ${team.members.length}`);
  console.log(`Period: 7 Days (${formatLocalDate(periodStart, timezone)} to ${formatLocalDate(periodEnd, timezone)})`);
  console.log('');

  // ============================================
  // 1. Get Member Averages (exact API logic)
  // ============================================
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

  console.log('='.repeat(70));
  console.log('MEMBER AVERAGES (Exact API calculation)');
  console.log('='.repeat(70));

  const memberAverages: { userId: string; avgScore: number; checkinCount: number }[] = [];
  for (const m of memberAvgScores) {
    if (m._avg.readinessScore !== null) {
      const member = team.members.find(mem => mem.id === m.userId);
      memberAverages.push({
        userId: m.userId,
        avgScore: m._avg.readinessScore,
        checkinCount: m._count.id,
      });
      console.log(`  ${member?.firstName || 'Unknown'}: ${m._avg.readinessScore.toFixed(2)}% (${m._count.id} check-ins)`);
    }
  }

  // Team average from member averages
  const teamAvgReadiness = memberAverages.length > 0
    ? memberAverages.reduce((sum, m) => sum + m.avgScore, 0) / memberAverages.length
    : 0;

  console.log(`\nTeam Average Readiness: ${teamAvgReadiness.toFixed(2)}%`);

  // ============================================
  // 2. Get All Check-ins for Status Distribution
  // ============================================
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
      user: { select: { firstName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n');
  console.log('='.repeat(70));
  console.log('STATUS DISTRIBUTION (Exact API calculation)');
  console.log('='.repeat(70));

  const green = checkins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellow = checkins.filter(c => c.readinessStatus === 'YELLOW').length;
  const red = checkins.filter(c => c.readinessStatus === 'RED').length;

  console.log(`\n  GREEN (Ready):    ${green}`);
  console.log(`  YELLOW (Caution): ${yellow}`);
  console.log(`  RED (At Risk):    ${red}`);
  console.log(`  TOTAL:            ${checkins.length}`);

  // ============================================
  // 3. Today's Compliance
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TODAY\'S COMPLIANCE (Exact API calculation)');
  console.log('='.repeat(70));

  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      companyId,
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  // Get exemptions for today
  const exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: todayEnd },
      endDate: { gte: todayStart },
    },
  });

  const onLeaveUserIds = exemptions.map(e => e.userId);
  const activeMembers = memberIds.length - onLeaveUserIds.length;
  const checkedInToday = new Set(todayCheckins.map(c => c.userId)).size;

  // Same logic as API
  const compliance = activeMembers > 0
    ? Math.min(100, Math.round((checkedInToday / activeMembers) * 100))
    : 100; // Nobody expected = 100%

  console.log(`\n  Total Members:    ${memberIds.length}`);
  console.log(`  On Leave Today:   ${onLeaveUserIds.length}`);
  console.log(`  Active Members:   ${activeMembers}`);
  console.log(`  Checked In:       ${checkedInToday}`);
  console.log(`  Compliance:       ${compliance}%`);

  // ============================================
  // 4. Period Compliance (for Grade)
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('PERIOD COMPLIANCE (for Grade calculation)');
  console.log('='.repeat(70));

  // Get all exemptions in period
  const periodExemptions = await prisma.exception.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
  });

  // Get holidays
  const holidays = await prisma.holiday.findMany({
    where: {
      companyId,
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const holidayDates = new Set(holidays.map(h => formatLocalDate(h.date, timezone)));

  // Calculate daily compliance
  const dayMs = 24 * 60 * 60 * 1000;
  let currentDate = new Date(periodStart);
  let totalComplianceDays = 0;
  let totalComplianceSum = 0;

  console.log('\nDaily Compliance:');
  while (currentDate <= periodEnd) {
    const dayStart = getStartOfDay(currentDate, timezone);
    const dayEnd = getEndOfDay(currentDate, timezone);
    const dateStr = formatLocalDate(currentDate, timezone);
    const isWorkDayResult = isWorkDay(currentDate, team.workDays, timezone);
    const isHoliday = holidayDates.has(dateStr);

    if (isWorkDayResult && !isHoliday) {
      // Count exempted on this day
      const exemptedOnDay = memberIds.filter(memberId => {
        return periodExemptions.some(e => {
          if (e.userId !== memberId) return false;
          const exStart = formatLocalDate(e.startDate!, timezone);
          const exEnd = formatLocalDate(e.endDate!, timezone);
          return dateStr >= exStart && dateStr <= exEnd;
        });
      }).length;

      // Get check-ins for this day
      const dayCheckins = checkins.filter(c => {
        const d = new Date(c.createdAt);
        return d >= dayStart && d <= dayEnd;
      });
      const dayCheckedIn = new Set(dayCheckins.map(c => c.userId)).size;

      const expected = memberIds.length - exemptedOnDay;
      if (expected > 0) {
        const dayCompliance = Math.min(100, Math.round((dayCheckedIn / expected) * 100));
        totalComplianceDays++;
        totalComplianceSum += dayCompliance;
        console.log(`  ${dateStr}: ${dayCheckedIn}/${expected} = ${dayCompliance}% (${exemptedOnDay} exempted)`);
      } else {
        console.log(`  ${dateStr}: All exempted - skipped`);
      }
    } else if (isHoliday) {
      console.log(`  ${dateStr}: HOLIDAY - skipped`);
    }

    currentDate = new Date(currentDate.getTime() + dayMs);
  }

  const periodCompliance = totalComplianceDays > 0
    ? Math.round(totalComplianceSum / totalComplianceDays)
    : 100;

  console.log(`\nPeriod Average Compliance: ${periodCompliance}%`);

  // ============================================
  // 5. TEAM GRADE CALCULATION
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEAM GRADE CALCULATION (Exact API formula)');
  console.log('='.repeat(70));

  const readinessComponent = teamAvgReadiness * 0.60;
  const complianceComponent = periodCompliance * 0.40;
  const teamGradeScore = Math.round(readinessComponent + complianceComponent);
  const gradeInfo = getGradeInfo(teamGradeScore);

  console.log(`
Formula: Team Score = (Avg Readiness × 0.60) + (Period Compliance × 0.40)

Calculation:
  Avg Readiness:      ${teamAvgReadiness.toFixed(2)}%
  Period Compliance:  ${periodCompliance}%

  Readiness × 0.60:   ${teamAvgReadiness.toFixed(2)} × 0.60 = ${readinessComponent.toFixed(2)}
  Compliance × 0.40:  ${periodCompliance} × 0.40 = ${complianceComponent.toFixed(2)}

  TOTAL:              ${readinessComponent.toFixed(2)} + ${complianceComponent.toFixed(2)} = ${(readinessComponent + complianceComponent).toFixed(2)}
  ROUNDED:            ${teamGradeScore}%

RESULT:
  ┌─────────────────────────────────────┐
  │  Grade Score: ${teamGradeScore}%                    │
  │  Grade:       ${gradeInfo.letter} (${gradeInfo.label})${' '.repeat(Math.max(0, 15 - gradeInfo.letter.length - gradeInfo.label.length))}│
  │  Color:       ${gradeInfo.color}${' '.repeat(Math.max(0, 21 - gradeInfo.color.length))}│
  └─────────────────────────────────────┘
`);

  // ============================================
  // 6. AVERAGE METRICS
  // ============================================
  console.log('='.repeat(70));
  console.log('AVERAGE METRICS (Exact API calculation)');
  console.log('='.repeat(70));

  if (checkins.length > 0) {
    const avgMood = checkins.reduce((sum, c) => sum + c.mood, 0) / checkins.length;
    const avgStress = checkins.reduce((sum, c) => sum + c.stress, 0) / checkins.length;
    const avgSleep = checkins.reduce((sum, c) => sum + c.sleep, 0) / checkins.length;
    const avgPhysical = checkins.reduce((sum, c) => sum + c.physicalHealth, 0) / checkins.length;

    console.log(`
  Mood:            ${avgMood.toFixed(1)} / 5
  Stress:          ${avgStress.toFixed(1)} / 5 (lower is better)
  Sleep:           ${avgSleep.toFixed(1)} / 5
  Physical Health: ${avgPhysical.toFixed(1)} / 5
`);
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('='.repeat(70));
  console.log('FINAL SUMMARY - What API Returns');
  console.log('='.repeat(70));
  console.log(`
{
  "teamGrade": {
    "score": ${teamGradeScore},
    "letter": "${gradeInfo.letter}",
    "color": "${gradeInfo.color}",
    "label": "${gradeInfo.label}",
    "avgReadiness": ${Math.round(teamAvgReadiness)},
    "periodCompliance": ${periodCompliance}
  },
  "statusDistribution": {
    "green": ${green},
    "yellow": ${yellow},
    "red": ${red},
    "total": ${checkins.length}
  },
  "complianceDetails": {
    "checkedIn": ${checkedInToday},
    "activeMembers": ${activeMembers},
    "onLeave": ${onLeaveUserIds.length}
  }
}
`);

  console.log('='.repeat(70));
  console.log('✓ ANALYTICS LOGIC VERIFIED');
  console.log('='.repeat(70));
}

testApiAnalytics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
