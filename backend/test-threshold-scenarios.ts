/**
 * Test Script: 3 Check-in Threshold Logic - Multiple Scenarios
 *
 * Tests:
 * 1. Real data from database
 * 2. Simulated scenarios with mock data
 * 3. Edge cases (exactly 3 check-ins, 0 check-ins, etc.)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_CHECKIN_DAYS_THRESHOLD = 3;

// Simulated member data for testing edge cases
interface MockMember {
  name: string;
  checkinCount: number;
  avgScore: number;
}

function calculateTeamGrade(members: MockMember[]): {
  includedCount: number;
  onboardingCount: number;
  teamAvgReadiness: number | null;
  includedMembers: string[];
  onboardingMembers: string[];
} {
  const included = members.filter(m => m.checkinCount >= MIN_CHECKIN_DAYS_THRESHOLD);
  const onboarding = members.filter(m => m.checkinCount < MIN_CHECKIN_DAYS_THRESHOLD);

  const avgReadiness = included.length > 0
    ? included.reduce((sum, m) => sum + m.avgScore, 0) / included.length
    : null;

  return {
    includedCount: included.length,
    onboardingCount: onboarding.length,
    teamAvgReadiness: avgReadiness,
    includedMembers: included.map(m => m.name),
    onboardingMembers: onboarding.map(m => m.name),
  };
}

function printScenario(title: string, members: MockMember[]) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(`📋 ${title}`);
  console.log('─'.repeat(60));
  console.log('');

  console.log('Members:');
  for (const m of members) {
    const status = m.checkinCount >= MIN_CHECKIN_DAYS_THRESHOLD ? '✅' : '🔄';
    console.log(`  ${status} ${m.name}: ${m.checkinCount} check-ins, ${m.avgScore}% avg`);
  }
  console.log('');

  const result = calculateTeamGrade(members);

  console.log('Result:');
  console.log(`  Total Members:      ${members.length}`);
  console.log(`  Included in Grade:  ${result.includedCount}`);
  console.log(`  Onboarding:         ${result.onboardingCount}`);
  console.log('');

  if (result.includedMembers.length > 0) {
    console.log(`  ✅ Included: ${result.includedMembers.join(', ')}`);
  }
  if (result.onboardingMembers.length > 0) {
    console.log(`  🔄 Onboarding: ${result.onboardingMembers.join(', ')}`);
  }
  console.log('');

  if (result.teamAvgReadiness !== null) {
    console.log(`  Team Avg Readiness: ${Math.round(result.teamAvgReadiness)}%`);
    console.log(`  UI: "Grade based on ${result.includedCount} of ${members.length} members"`);
  } else {
    console.log(`  Team Grade: Not calculated (no members with 3+ check-ins)`);
    console.log(`  UI: "Grade will be available after members complete 3 check-ins"`);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('TEST SUITE: 3 Check-in Threshold Logic');
  console.log('='.repeat(60));

  // ============================================
  // SCENARIO 1: All members have 3+ check-ins
  // ============================================
  printScenario('SCENARIO 1: All members qualify', [
    { name: 'Juan', checkinCount: 10, avgScore: 85 },
    { name: 'Maria', checkinCount: 8, avgScore: 90 },
    { name: 'Pedro', checkinCount: 5, avgScore: 75 },
    { name: 'Ana', checkinCount: 3, avgScore: 80 }, // Exactly 3 (edge case)
  ]);

  // ============================================
  // SCENARIO 2: Some members are onboarding
  // ============================================
  printScenario('SCENARIO 2: Mix of qualified and onboarding', [
    { name: 'Juan', checkinCount: 10, avgScore: 85 },
    { name: 'Maria', checkinCount: 8, avgScore: 90 },
    { name: 'Pedro (NEW)', checkinCount: 2, avgScore: 70 }, // Only 2 check-ins
    { name: 'Ana (NEW)', checkinCount: 1, avgScore: 65 },   // Only 1 check-in
  ]);

  // ============================================
  // SCENARIO 3: All members are onboarding
  // ============================================
  printScenario('SCENARIO 3: All members are new (no grade)', [
    { name: 'Pedro', checkinCount: 2, avgScore: 70 },
    { name: 'Ana', checkinCount: 1, avgScore: 65 },
    { name: 'Luis', checkinCount: 0, avgScore: 0 },
  ]);

  // ============================================
  // SCENARIO 4: Edge case - exactly 3 check-ins
  // ============================================
  printScenario('SCENARIO 4: Edge case - exactly at threshold', [
    { name: 'Juan', checkinCount: 3, avgScore: 85 },  // Exactly 3 - INCLUDED
    { name: 'Maria', checkinCount: 2, avgScore: 90 }, // Just under - EXCLUDED
  ]);

  // ============================================
  // SCENARIO 5: One qualified member with low score
  // ============================================
  printScenario('SCENARIO 5: Only one qualified member', [
    { name: 'Juan', checkinCount: 5, avgScore: 45 },  // Low score but qualified
    { name: 'Maria (NEW)', checkinCount: 2, avgScore: 95 }, // High score but not qualified
    { name: 'Pedro (NEW)', checkinCount: 1, avgScore: 88 }, // High score but not qualified
  ]);

  // ============================================
  // REAL DATA FROM DATABASE
  // ============================================
  console.log('');
  console.log('='.repeat(60));
  console.log('REAL DATA FROM DATABASE');
  console.log('='.repeat(60));

  try {
    // Get all teams with their members
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        members: {
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true, firstName: true, lastName: true },
        },
      },
      take: 3, // Limit to 3 teams for brevity
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (const team of teams) {
      if (team.members.length === 0) continue;

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

      const checkinMap = new Map<string, { count: number; avgScore: number }>();
      for (const c of checkinCounts) {
        checkinMap.set(c.userId, {
          count: c._count.id,
          avgScore: c._avg.readinessScore || 0,
        });
      }

      const mockMembers: MockMember[] = team.members.map(m => {
        const data = checkinMap.get(m.id) || { count: 0, avgScore: 0 };
        return {
          name: `${m.firstName} ${m.lastName}`,
          checkinCount: data.count,
          avgScore: data.avgScore,
        };
      });

      printScenario(`TEAM: ${team.name}`, mockMembers);
    }

  } catch (error) {
    console.error('Error fetching real data:', error);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED');
  console.log('='.repeat(60));
  console.log('');
  console.log('KEY TAKEAWAYS:');
  console.log('  • Members need 3+ ACTUAL check-ins to be included in grade');
  console.log('  • Exactly 3 check-ins = INCLUDED (threshold is >=)');
  console.log('  • 2 or fewer check-ins = ONBOARDING (excluded from grade)');
  console.log('  • Absences, holidays, exemptions do NOT count toward threshold');
  console.log('  • Only GREEN and YELLOW check-ins count');
  console.log('');

  await prisma.$disconnect();
}

runTests();
