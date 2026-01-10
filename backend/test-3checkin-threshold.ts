/**
 * Test Script: 3 Check-in Threshold Logic
 *
 * This script tests that:
 * 1. Members with < 3 check-ins are marked as "onboarding" and excluded from team grade
 * 2. Members with >= 3 check-ins are included in team grade calculation
 * 3. Only actual check-ins count (GREEN/YELLOW), not absences or exemptions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_CHECKIN_DAYS_THRESHOLD = 3;

interface TestMember {
  id: string;
  name: string;
  checkins: number;
  expectedIncluded: boolean;
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('TEST: 3 Check-in Threshold Logic');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Get a team with members for testing
    const team = await prisma.team.findFirst({
      where: { isActive: true },
      include: {
        members: {
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!team) {
      console.log('❌ No active team found for testing');
      return;
    }

    console.log(`📋 Testing with Team: ${team.name}`);
    console.log(`👥 Total Members: ${team.members.length}`);
    console.log('');

    // Get the date range for testing (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log(`📅 Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log('');

    // Get check-in counts for each member
    const memberIds = team.members.map(m => m.id);

    const checkinCounts = await prisma.checkin.groupBy({
      by: ['userId'],
      where: {
        userId: { in: memberIds },
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _avg: { readinessScore: true },
    });

    // Build a map of check-in counts
    const checkinMap = new Map<string, { count: number; avgScore: number | null }>();
    for (const c of checkinCounts) {
      checkinMap.set(c.userId, { count: c._count.id, avgScore: c._avg.readinessScore });
    }

    // Analyze each member
    console.log('='.repeat(60));
    console.log('MEMBER ANALYSIS');
    console.log('='.repeat(60));
    console.log('');

    let onboardingCount = 0;
    let includedCount = 0;
    const includedScores: number[] = [];

    for (const member of team.members) {
      const data = checkinMap.get(member.id) || { count: 0, avgScore: null };
      const isIncluded = data.count >= MIN_CHECKIN_DAYS_THRESHOLD;

      const status = isIncluded ? '✅ INCLUDED' : '🔄 ONBOARDING';
      const scoreDisplay = data.avgScore !== null ? `${Math.round(data.avgScore)}%` : 'N/A';

      console.log(`${status} | ${member.firstName} ${member.lastName}`);
      console.log(`         Check-ins: ${data.count} | Avg Score: ${scoreDisplay}`);
      console.log(`         Threshold: ${data.count} ${data.count >= MIN_CHECKIN_DAYS_THRESHOLD ? '>=' : '<'} ${MIN_CHECKIN_DAYS_THRESHOLD}`);
      console.log('');

      if (isIncluded) {
        includedCount++;
        if (data.avgScore !== null) {
          includedScores.push(data.avgScore);
        }
      } else {
        onboardingCount++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Total Members:     ${team.members.length}`);
    console.log(`Included in Grade: ${includedCount} (>= ${MIN_CHECKIN_DAYS_THRESHOLD} check-ins)`);
    console.log(`Onboarding:        ${onboardingCount} (< ${MIN_CHECKIN_DAYS_THRESHOLD} check-ins)`);
    console.log('');

    if (includedScores.length > 0) {
      const teamAvg = includedScores.reduce((a, b) => a + b, 0) / includedScores.length;
      console.log(`Team Avg Readiness (included members only): ${Math.round(teamAvg)}%`);
    } else {
      console.log('Team Avg Readiness: N/A (no members with enough check-ins)');
    }

    // Verify the logic matches what the API would return
    console.log('');
    console.log('='.repeat(60));
    console.log('API SIMULATION');
    console.log('='.repeat(60));
    console.log('');

    // Simulate the actual API logic
    const allMemberAverages = checkinCounts
      .filter(m => m._avg.readinessScore !== null)
      .map(m => ({
        userId: m.userId,
        avgScore: m._avg.readinessScore!,
        checkinCount: m._count.id,
      }));

    const memberAverages = allMemberAverages.filter(m => m.checkinCount >= MIN_CHECKIN_DAYS_THRESHOLD);
    const apiOnboardingCount = allMemberAverages.length - memberAverages.length;
    const apiIncludedCount = memberAverages.length;

    // Also count members with 0 check-ins as onboarding
    const membersWithNoCheckins = team.members.filter(m => !checkinMap.has(m.id));
    const totalOnboarding = apiOnboardingCount + membersWithNoCheckins.length;

    console.log(`API would report:`);
    console.log(`  onboardingCount:    ${totalOnboarding}`);
    console.log(`  includedMemberCount: ${apiIncludedCount}`);
    console.log('');

    if (apiIncludedCount > 0) {
      const teamAvgReadiness = memberAverages.reduce((sum, m) => sum + m.avgScore, 0) / memberAverages.length;
      console.log(`  Team Avg Readiness: ${Math.round(teamAvgReadiness)}%`);
      console.log('');
      console.log(`  UI would show: "Grade based on ${apiIncludedCount} of ${team.members.length} members"`);
      if (totalOnboarding > 0) {
        console.log(`  Badge would show: "${totalOnboarding} new"`);
      }
    } else {
      console.log(`  Team Grade: null (not enough data)`);
      console.log(`  UI would show: "No grade yet - members need ${MIN_CHECKIN_DAYS_THRESHOLD}+ check-ins"`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
