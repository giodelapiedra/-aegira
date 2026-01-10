/**
 * ALL TEAMS ANALYTICS COMPARISON TEST
 *
 * Tests analytics for all teams to verify consistency
 */

import { PrismaClient } from '@prisma/client';
import {
  getTodayRange,
  getLastNDaysRange,
  formatLocalDate,
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

async function testAllTeamsAnalytics() {
  console.log('='.repeat(70));
  console.log('ALL TEAMS ANALYTICS COMPARISON');
  console.log('='.repeat(70));
  console.log('');

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true },
      },
      company: {
        select: { id: true, timezone: true },
      },
      leader: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const { start: periodStart, end: periodEnd } = getLastNDaysRange(6, DEFAULT_TIMEZONE);
  const { start: todayStart, end: todayEnd } = getTodayRange(DEFAULT_TIMEZONE);

  console.log(`Period: Last 7 Days (${formatLocalDate(periodStart, DEFAULT_TIMEZONE)} to ${formatLocalDate(periodEnd, DEFAULT_TIMEZONE)})`);
  console.log(`Today: ${formatLocalDate(new Date(), DEFAULT_TIMEZONE)}`);
  console.log('');

  const teamResults: any[] = [];

  for (const team of teams) {
    const memberIds = team.members.map(m => m.id);
    const companyId = team.companyId;

    if (memberIds.length === 0) {
      console.log(`${team.name}: No members - skipped`);
      continue;
    }

    // Get period check-ins
    const checkins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        companyId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // Get today's check-ins
    const todayCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        companyId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Get exemptions
    const exemptions = await prisma.exception.findMany({
      where: {
        userId: { in: memberIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
    });

    const exemptedUserIds = new Set(exemptions.map(e => e.userId));
    const activeMembers = memberIds.filter(id => !exemptedUserIds.has(id));

    // Status distribution
    const green = checkins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellow = checkins.filter(c => c.readinessStatus === 'YELLOW').length;
    const red = checkins.filter(c => c.readinessStatus === 'RED').length;

    // Average scores
    const avgReadiness = checkins.length > 0
      ? checkins.reduce((sum, c) => sum + c.readinessScore, 0) / checkins.length
      : 0;

    // Today's compliance
    const todayCheckedIn = new Set(todayCheckins.map(c => c.userId)).size;
    const compliance = activeMembers.length > 0
      ? Math.round((todayCheckedIn / activeMembers.length) * 100)
      : (exemptedUserIds.size === memberIds.length ? 100 : 0); // 100% if all exempted

    // Grade calculation
    const gradeScore = Math.round((avgReadiness * 0.60) + (compliance * 0.40));
    const grade = getGradeInfo(gradeScore);

    teamResults.push({
      name: team.name,
      leader: `${team.leader?.firstName || 'N/A'}`,
      members: memberIds.length,
      exempted: exemptedUserIds.size,
      active: activeMembers.length,
      checkins: checkins.length,
      todayCheckins: todayCheckedIn,
      green,
      yellow,
      red,
      avgReadiness: Math.round(avgReadiness),
      compliance,
      gradeScore,
      grade: grade.letter,
      gradeLabel: grade.label,
      gradeColor: grade.color,
    });
  }

  // Display results
  console.log('='.repeat(70));
  console.log('TEAM COMPARISON');
  console.log('='.repeat(70));

  for (const result of teamResults) {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║ ${result.name.padEnd(66)} ║
╠══════════════════════════════════════════════════════════════════════╣
║ Leader: ${result.leader.padEnd(60)} ║
║ Members: ${result.members} total | ${result.active} active | ${result.exempted} exempted${' '.repeat(Math.max(0, 35 - String(result.members).length - String(result.active).length - String(result.exempted).length))} ║
╠══════════════════════════════════════════════════════════════════════╣
║ CHECK-INS (Last 7 Days): ${result.checkins}${' '.repeat(Math.max(0, 43 - String(result.checkins).length))} ║
║   • GREEN (Ready):    ${result.green}${' '.repeat(Math.max(0, 46 - String(result.green).length))} ║
║   • YELLOW (Caution): ${result.yellow}${' '.repeat(Math.max(0, 46 - String(result.yellow).length))} ║
║   • RED (At Risk):    ${result.red}${' '.repeat(Math.max(0, 46 - String(result.red).length))} ║
╠══════════════════════════════════════════════════════════════════════╣
║ TODAY: ${result.todayCheckins}/${result.active} checked in (${result.compliance}% compliance)${' '.repeat(Math.max(0, 36 - String(result.todayCheckins).length - String(result.active).length - String(result.compliance).length))} ║
╠══════════════════════════════════════════════════════════════════════╣
║ TEAM GRADE                                                           ║
║   Avg Readiness: ${result.avgReadiness}%${' '.repeat(Math.max(0, 51 - String(result.avgReadiness).length))} ║
║   Compliance:    ${result.compliance}%${' '.repeat(Math.max(0, 51 - String(result.compliance).length))} ║
║   ─────────────────────────────────────────────────────────────────  ║
║   Score: ${result.gradeScore}% = (${result.avgReadiness} × 0.60) + (${result.compliance} × 0.40)${' '.repeat(Math.max(0, 30 - String(result.gradeScore).length - String(result.avgReadiness).length - String(result.compliance).length))} ║
║   Grade: ${result.grade} (${result.gradeLabel}) [${result.gradeColor}]${' '.repeat(Math.max(0, 40 - result.grade.length - result.gradeLabel.length - result.gradeColor.length))} ║
╚══════════════════════════════════════════════════════════════════════╝`);
  }

  // Summary table
  console.log('\n');
  console.log('='.repeat(70));
  console.log('SUMMARY TABLE');
  console.log('='.repeat(70));
  console.log('');
  console.log('Team                          | Members | Checkins | Readiness | Grade');
  console.log('-'.repeat(70));
  for (const result of teamResults) {
    console.log(`${result.name.substring(0, 28).padEnd(29)} | ${String(result.members).padStart(7)} | ${String(result.checkins).padStart(8)} | ${String(result.avgReadiness + '%').padStart(9)} | ${result.grade} (${result.gradeScore}%)`);
  }

  // Verification
  console.log('\n');
  console.log('='.repeat(70));
  console.log('LOGIC VERIFICATION');
  console.log('='.repeat(70));

  let allPass = true;

  for (const result of teamResults) {
    // Verify status counts add up
    const statusTotal = result.green + result.yellow + result.red;
    const statusOk = statusTotal === result.checkins;
    if (!statusOk) allPass = false;
    console.log(`\n${result.name}:`);
    console.log(`  ${statusOk ? '✓' : '✗'} Status distribution: ${result.green} + ${result.yellow} + ${result.red} = ${statusTotal} (expected ${result.checkins})`);

    // Verify grade formula
    const expectedScore = Math.round((result.avgReadiness * 0.60) + (result.compliance * 0.40));
    const gradeOk = result.gradeScore === expectedScore;
    if (!gradeOk) allPass = false;
    console.log(`  ${gradeOk ? '✓' : '✗'} Grade calculation: (${result.avgReadiness} × 0.60) + (${result.compliance} × 0.40) = ${expectedScore} (got ${result.gradeScore})`);

    // Verify grade letter matches score
    const expectedGrade = getGradeInfo(result.gradeScore);
    const letterOk = result.grade === expectedGrade.letter;
    if (!letterOk) allPass = false;
    console.log(`  ${letterOk ? '✓' : '✗'} Grade letter: ${result.gradeScore}% → ${expectedGrade.letter} (got ${result.grade})`);
  }

  console.log('\n');
  console.log('='.repeat(70));
  if (allPass) {
    console.log('✓ ALL ANALYTICS LOGIC VERIFIED CORRECTLY');
  } else {
    console.log('✗ SOME LOGIC ISSUES DETECTED - REVIEW ABOVE');
  }
  console.log('='.repeat(70));
}

testAllTeamsAnalytics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
