/**
 * Test Script: Teams Overview API
 *
 * Tests the new teams-overview endpoint and team grade calculation.
 * Run with: npx tsx test-teams-overview.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateTeamsOverview, calculateTeamGrade } from './src/utils/team-grades.js';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('  TEAMS OVERVIEW TEST');
  console.log('==========================================\n');

  // Get a company to test with
  const company = await prisma.company.findFirst({
    select: {
      id: true,
      name: true,
      timezone: true,
    },
  });

  if (!company) {
    console.log('❌ No company found. Please seed the database first.');
    return;
  }

  console.log(`📍 Testing with company: ${company.name}`);
  console.log(`🌐 Timezone: ${company.timezone}\n`);

  // Get teams in this company
  const teams = await prisma.team.findMany({
    where: { companyId: company.id, isActive: true },
    include: {
      leader: { select: { firstName: true, lastName: true } },
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  console.log(`📊 Found ${teams.length} active teams\n`);

  if (teams.length === 0) {
    console.log('❌ No active teams found. Please create some teams first.');
    return;
  }

  // List teams
  console.log('Teams:');
  teams.forEach((team, i) => {
    const leader = team.leader ? `${team.leader.firstName} ${team.leader.lastName}` : 'No leader';
    console.log(`  ${i + 1}. ${team.name} - ${team.members.length} members (Leader: ${leader})`);
  });

  console.log('\n==========================================');
  console.log('  CALCULATING TEAMS OVERVIEW (30 days)');
  console.log('==========================================\n');

  try {
    const result = await calculateTeamsOverview({
      companyId: company.id,
      days: 30,
      timezone: company.timezone,
    });

    // Print Summary
    console.log('📈 SUMMARY:');
    console.log('─'.repeat(40));
    console.log(`  Total Teams:      ${result.summary.totalTeams}`);
    console.log(`  Total Members:    ${result.summary.totalMembers}`);
    console.log(`  Average Score:    ${result.summary.avgScore}`);
    console.log(`  Average Grade:    ${result.summary.avgGrade}`);
    console.log(`  Teams At Risk:    ${result.summary.teamsAtRisk} (C or D)`);
    console.log(`  Teams Critical:   ${result.summary.teamsCritical} (D only)`);
    console.log(`  Teams Improving:  ${result.summary.teamsImproving} ↑`);
    console.log(`  Teams Declining:  ${result.summary.teamsDeclining} ↓`);
    console.log('');

    // Print Period
    console.log('📅 PERIOD:');
    console.log('─'.repeat(40));
    console.log(`  Days:       ${result.period.days}`);
    console.log(`  Start:      ${new Date(result.period.startDate).toLocaleDateString()}`);
    console.log(`  End:        ${new Date(result.period.endDate).toLocaleDateString()}`);
    console.log('');

    // Print Team Details
    console.log('📋 TEAM GRADES (sorted by grade, worst first):');
    console.log('─'.repeat(70));
    console.log(
      '  ' +
      'Team'.padEnd(20) +
      'Grade'.padEnd(8) +
      'Score'.padEnd(8) +
      'Attend%'.padEnd(10) +
      'OnTime%'.padEnd(10) +
      'Trend'.padEnd(10)
    );
    console.log('─'.repeat(70));

    result.teams.forEach((team) => {
      const trendIcon = team.trend === 'up' ? '↑' : team.trend === 'down' ? '↓' : '→';
      const trendLabel = `${trendIcon} ${team.scoreDelta > 0 ? '+' : ''}${team.scoreDelta.toFixed(1)}`;

      console.log(
        '  ' +
        team.name.substring(0, 18).padEnd(20) +
        `${team.grade} (${team.gradeLabel.substring(0, 4)})`.padEnd(8) +
        team.score.toString().padEnd(8) +
        `${team.attendanceRate}%`.padEnd(10) +
        `${team.onTimeRate}%`.padEnd(10) +
        trendLabel.padEnd(10)
      );
    });
    console.log('─'.repeat(70));
    console.log('');

    // Print Detailed Breakdown for each team
    console.log('📊 DETAILED BREAKDOWN:');
    console.log('─'.repeat(70));

    result.teams.forEach((team) => {
      console.log(`\n  📁 ${team.name}`);
      console.log(`     Leader: ${team.leader?.name || 'None'}`);
      console.log(`     Members: ${team.memberCount}`);
      console.log(`     Grade: ${team.grade} (${team.gradeLabel}) - Score: ${team.score}/100`);
      console.log(`     Attendance: ${team.attendanceRate}% | On-time: ${team.onTimeRate}%`);
      console.log(`     Breakdown: 🟢 ${team.breakdown.green} GREEN | 🟡 ${team.breakdown.yellow} YELLOW | 🔴 ${team.breakdown.absent} ABSENT | ⚪ ${team.breakdown.excused} EXCUSED`);
      console.log(`     Trend: ${team.trend === 'up' ? '📈' : team.trend === 'down' ? '📉' : '➡️'} ${team.scoreDelta > 0 ? '+' : ''}${team.scoreDelta.toFixed(1)} vs previous period`);
      if (team.atRiskCount > 0) {
        console.log(`     ⚠️  At Risk Members: ${team.atRiskCount}`);
      }
    });

    console.log('\n==========================================');
    console.log('  TEST SINGLE TEAM GRADE');
    console.log('==========================================\n');

    // Test single team grade
    if (result.teams.length > 0) {
      const firstTeam = result.teams[0];
      console.log(`Testing calculateTeamGrade() for: ${firstTeam.name}`);

      const singleTeamGrade = await calculateTeamGrade(firstTeam.id, {
        companyId: company.id,
        days: 30,
        timezone: company.timezone,
      });

      if (singleTeamGrade) {
        console.log(`  ✅ Grade: ${singleTeamGrade.grade} (${singleTeamGrade.score}/100)`);
        console.log(`  ✅ Matches overview: ${singleTeamGrade.score === firstTeam.score ? 'YES' : 'NO'}`);
      }
    }

    console.log('\n==========================================');
    console.log('  ✅ TEST COMPLETED SUCCESSFULLY');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ Error calculating teams overview:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
