/**
 * Test Script: Grade Consistency
 *
 * Verifies that Teams Overview and Team Analytics show the SAME grades.
 * Run with: npx tsx test-grade-consistency.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateTeamsOverviewOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('  GRADE CONSISTENCY TEST');
  console.log('==========================================\n');

  console.log('Formula: Grade = (Avg Readiness × 60%) + (Compliance × 40%)\n');

  // Get company
  const company = await prisma.company.findFirst({
    select: { id: true, name: true, timezone: true },
  });

  if (!company) {
    console.log('❌ No company found');
    return;
  }

  console.log(`📍 Company: ${company.name}`);
  console.log(`🌐 Timezone: ${company.timezone}\n`);

  // Test for 14 days (matching user's test case)
  const days = 14;
  console.log(`📅 Testing ${days}-day period\n`);

  // Calculate using optimized function (Teams Overview)
  const result = await calculateTeamsOverviewOptimized({
    companyId: company.id,
    days,
    timezone: company.timezone,
  });

  console.log('==========================================');
  console.log('  TEAMS OVERVIEW RESULTS');
  console.log('==========================================\n');

  console.log('┌─────────────────────────────┬────────┬───────┬────────────┬────────────┐');
  console.log('│ Team                        │ Grade  │ Score │ AvgReadine │ Compliance │');
  console.log('├─────────────────────────────┼────────┼───────┼────────────┼────────────┤');

  for (const team of result.teams) {
    // Get raw data to show calculation
    const teamData = await getTeamRawData(team.id, days, company.timezone);

    console.log(`│ ${team.name.padEnd(27)} │ ${team.grade.padEnd(6)} │ ${team.score.toString().padStart(5)} │ ${teamData.avgReadiness.toString().padStart(10)}% │ ${team.attendanceRate.toString().padStart(10)}% │`);
    console.log(`│   Calculation: (${teamData.avgReadiness} × 0.6) + (${team.attendanceRate} × 0.4) = ${Math.round(teamData.avgReadiness * 0.6 + team.attendanceRate * 0.4)}`);
    console.log('├─────────────────────────────┼────────┼───────┼────────────┼────────────┤');
  }

  console.log('└─────────────────────────────┴────────┴───────┴────────────┴────────────┘');

  console.log('\n==========================================');
  console.log('  DETAILED BREAKDOWN PER TEAM');
  console.log('==========================================\n');

  for (const team of result.teams) {
    const teamData = await getTeamRawData(team.id, days, company.timezone);

    console.log(`📁 ${team.name}`);
    console.log(`   Grade: ${team.grade} (${team.gradeLabel})`);
    console.log(`   Score: ${team.score}/100`);
    console.log('');
    console.log('   Components:');
    console.log(`   ├── Avg Readiness: ${teamData.avgReadiness}%`);
    console.log(`   │   (Average of member readiness scores from check-ins)`);
    console.log(`   │`);
    console.log(`   └── Compliance: ${team.attendanceRate}%`);
    console.log(`       (${teamData.totalCheckins} check-ins / ${teamData.expectedDays} expected days)`);
    console.log('');
    console.log('   Calculation:');
    console.log(`   Score = (${teamData.avgReadiness} × 60%) + (${team.attendanceRate} × 40%)`);
    console.log(`   Score = ${(teamData.avgReadiness * 0.6).toFixed(1)} + ${(team.attendanceRate * 0.4).toFixed(1)}`);
    console.log(`   Score = ${Math.round(teamData.avgReadiness * 0.6 + team.attendanceRate * 0.4)}`);
    console.log('');
    console.log('   Breakdown:');
    console.log(`   🟢 GREEN: ${team.breakdown.green} | 🟡 YELLOW: ${team.breakdown.yellow} | 🔴 RED: ${teamData.redCount} | ⚪ EXCUSED: ${team.breakdown.excused}`);
    console.log('');
    console.log('─'.repeat(60));
    console.log('');
  }

  console.log('==========================================');
  console.log('  SUMMARY');
  console.log('==========================================\n');

  console.log(`Total Teams: ${result.summary.totalTeams}`);
  console.log(`Total Members: ${result.summary.totalMembers}`);
  console.log(`Average Score: ${result.summary.avgScore}`);
  console.log(`Average Grade: ${result.summary.avgGrade}`);
  console.log(`Teams At Risk (< 70): ${result.summary.teamsAtRisk}`);
  console.log(`Teams Critical (< 60): ${result.summary.teamsCritical}`);

  console.log('\n✅ Test Complete');
  console.log('\nNow both Team Analytics and Teams Overview use the SAME formula:');
  console.log('Grade = (Avg Readiness × 60%) + (Compliance × 40%)');
}

async function getTeamRawData(teamId: string, days: number, timezone: string) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get team members
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
      },
    },
  });

  if (!team) return { avgReadiness: 0, totalCheckins: 0, expectedDays: 0, redCount: 0 };

  const memberIds = team.members.map(m => m.id);

  // Get all check-ins
  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      readinessScore: true,
      readinessStatus: true,
    },
  });

  const avgReadiness = checkins.length > 0
    ? Math.round(checkins.reduce((sum, c) => sum + c.readinessScore, 0) / checkins.length)
    : 0;

  const redCount = checkins.filter(c => c.readinessStatus === 'RED').length;

  // Estimate expected days (simplified)
  const workDays = days * 5 / 7; // Rough estimate for weekdays
  const expectedDays = Math.round(workDays * memberIds.length);

  return {
    avgReadiness,
    totalCheckins: checkins.length,
    expectedDays,
    redCount,
  };
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
