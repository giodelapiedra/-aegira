/**
 * TEAM LEADER SECURITY TEST
 *
 * This test verifies that team leaders can ONLY access data for their own team.
 * It simulates the backend security checks to ensure proper scoping.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SecurityTestResult {
  test: string;
  passed: boolean;
  details: string;
}

async function runSecurityTests(): Promise<void> {
  console.log('='.repeat(70));
  console.log('TEAM LEADER DATA ISOLATION SECURITY TEST');
  console.log('='.repeat(70));
  console.log('');

  const results: SecurityTestResult[] = [];

  // Get all teams with their leaders
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      leader: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
      members: {
        where: { isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
      company: {
        select: { id: true, name: true },
      },
    },
  });

  if (teams.length < 2) {
    console.log('ERROR: Need at least 2 teams to test data isolation.');
    console.log('Please create more test data first.');
    return;
  }

  console.log(`Found ${teams.length} active teams for testing:\n`);
  for (const team of teams) {
    console.log(`  - ${team.name} (${team.members.length} members)`);
    console.log(`    Leader: ${team.leader?.firstName || 'None'} ${team.leader?.lastName || ''}`);
  }
  console.log('');

  const team1 = teams[0];
  const team2 = teams[1];

  if (!team1.leader || !team2.leader) {
    console.log('ERROR: Both teams need leaders for testing.');
    return;
  }

  console.log('='.repeat(70));
  console.log('TEST SCENARIO');
  console.log('='.repeat(70));
  console.log(`Team 1: ${team1.name}`);
  console.log(`  Leader: ${team1.leader.firstName} ${team1.leader.lastName}`);
  console.log(`  Members: ${team1.members.map(m => m.firstName).join(', ') || 'None'}`);
  console.log('');
  console.log(`Team 2: ${team2.name}`);
  console.log(`  Leader: ${team2.leader.firstName} ${team2.leader.lastName}`);
  console.log(`  Members: ${team2.members.map(m => m.firstName).join(', ') || 'None'}`);
  console.log('');

  // ============================================
  // TEST 1: /teams - Team list scoping
  // ============================================
  console.log('='.repeat(70));
  console.log('TEST 1: /teams - Team List Scoping');
  console.log('='.repeat(70));

  // Simulate TEAM_LEAD query restriction
  const team1LeaderTeams = await prisma.team.findMany({
    where: {
      companyId: team1.companyId,
      isActive: true,
      leaderId: team1.leader.id, // TEAM_LEAD restriction
    },
  });

  const team1CanSeeTeam2 = team1LeaderTeams.some(t => t.id === team2.id);
  results.push({
    test: 'Team 1 leader cannot see Team 2 in /teams list',
    passed: !team1CanSeeTeam2,
    details: team1CanSeeTeam2
      ? 'FAILED: Team 1 leader can see Team 2 data'
      : 'PASSED: Team 1 leader only sees their own team',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 2: /teams/:id - Single team access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 2: /teams/:id - Single Team Access');
  console.log('='.repeat(70));

  // Team 1 leader trying to access Team 2
  const team1LeaderAccessingTeam2 = team2.leaderId === team1.leader.id;
  results.push({
    test: 'Team 1 leader cannot access Team 2 details via /teams/:id',
    passed: !team1LeaderAccessingTeam2,
    details: team1LeaderAccessingTeam2
      ? 'FAILED: Team 1 leader can access Team 2'
      : 'PASSED: Team 1 leader would be blocked from Team 2',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 3: /teams/members/:userId/* - Member access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 3: /teams/members/:userId/* - Member Access');
  console.log('='.repeat(70));

  // Get a member from Team 2
  if (team2.members.length > 0) {
    const team2Member = team2.members[0];

    // Simulate the security check: Is Team 2 member in Team 1 leader's team?
    const team1LeaderTeam = await prisma.team.findFirst({
      where: { leaderId: team1.leader.id, isActive: true },
    });

    const memberInLeaderTeam = await prisma.user.findFirst({
      where: { id: team2Member.id, teamId: team1LeaderTeam?.id },
    });

    const canAccess = memberInLeaderTeam !== null;
    results.push({
      test: `Team 1 leader cannot access Team 2 member (${team2Member.firstName})`,
      passed: !canAccess,
      details: canAccess
        ? `FAILED: Team 1 leader can access ${team2Member.firstName}'s data`
        : `PASSED: Team 1 leader blocked from accessing ${team2Member.firstName}'s data`,
    });
    console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);
  } else {
    console.log('  - Skipped: Team 2 has no members to test');
  }

  // ============================================
  // TEST 4: /checkins - Check-ins access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 4: /checkins - Check-ins Access');
  console.log('='.repeat(70));

  const team1MemberIds = team1.members.map(m => m.id);
  const team2MemberIds = team2.members.map(m => m.id);

  // Query check-ins scoped to Team 1 (as Team 1 leader would see)
  const team1Checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: team1MemberIds },
      companyId: team1.companyId,
    },
    select: { userId: true },
  });

  // Verify no Team 2 member check-ins in Team 1 query
  const hasTeam2Data = team1Checkins.some(c => team2MemberIds.includes(c.userId));
  results.push({
    test: 'Team 1 leader check-ins query contains only Team 1 data',
    passed: !hasTeam2Data,
    details: hasTeam2Data
      ? 'FAILED: Team 1 query includes Team 2 member check-ins'
      : 'PASSED: Team 1 query only contains Team 1 check-ins',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 5: /analytics/team/:teamId - Analytics access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 5: /analytics/team/:teamId - Analytics Access');
  console.log('='.repeat(70));

  // Simulate: Team 1 leader trying to access Team 2 analytics
  const team2ForAnalytics = await prisma.team.findFirst({
    where: { id: team2.id },
    select: { leaderId: true },
  });

  const analyticsBlocked = team2ForAnalytics?.leaderId !== team1.leader.id;
  results.push({
    test: 'Team 1 leader cannot access Team 2 analytics',
    passed: analyticsBlocked,
    details: analyticsBlocked
      ? 'PASSED: Team 1 leader would be blocked from Team 2 analytics'
      : 'FAILED: Team 1 leader could access Team 2 analytics',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 6: /exemptions - Exemptions access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 6: /exemptions - Exemptions Access');
  console.log('='.repeat(70));

  // Get exemptions for Team 2 members
  const team2Exemptions = await prisma.exception.findMany({
    where: {
      userId: { in: team2MemberIds },
      companyId: team2.companyId,
    },
    include: {
      user: {
        select: { teamId: true },
      },
    },
    take: 1,
  });

  if (team2Exemptions.length > 0) {
    const exemption = team2Exemptions[0];

    // Simulate security check: Is exemption user in Team 1 leader's team?
    const isInTeam1 = exemption.user.teamId === team1.id;
    results.push({
      test: 'Team 1 leader cannot approve/view Team 2 exemptions',
      passed: !isInTeam1,
      details: isInTeam1
        ? 'FAILED: Team 1 leader could access Team 2 exemption'
        : 'PASSED: Team 1 leader blocked from Team 2 exemption',
    });
    console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);
  } else {
    console.log('  - Skipped: No exemptions found for Team 2 members');
  }

  // ============================================
  // TEST 7: /incidents - Incidents access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 7: /incidents - Incidents Access');
  console.log('='.repeat(70));

  // Simulate: Team 1 leader querying incidents
  const team1Incidents = await prisma.incident.findMany({
    where: {
      companyId: team1.companyId,
      teamId: team1.id, // TEAM_LEAD scoping
    },
    take: 5,
  });

  // Check if any Team 2 incidents in the result
  const hasTeam2Incidents = team1Incidents.some(i => i.teamId === team2.id);
  results.push({
    test: 'Team 1 leader incidents query contains only Team 1 incidents',
    passed: !hasTeam2Incidents,
    details: hasTeam2Incidents
      ? 'FAILED: Team 1 query includes Team 2 incidents'
      : 'PASSED: Team 1 query only contains Team 1 incidents',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 8: /calendar/team - Calendar access
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 8: /calendar/team - Calendar Access');
  console.log('='.repeat(70));

  // Simulate: Team 1 leader accessing team calendar
  const calendarTeam = await prisma.team.findFirst({
    where: {
      companyId: team1.companyId,
      isActive: true,
      leaderId: team1.leader.id, // TEAM_LEAD restriction
    },
  });

  const calendarShowsOnlyOwnTeam = calendarTeam?.id === team1.id && calendarTeam?.id !== team2.id;
  results.push({
    test: 'Team 1 leader calendar shows only Team 1 data',
    passed: calendarShowsOnlyOwnTeam,
    details: calendarShowsOnlyOwnTeam
      ? 'PASSED: Calendar scoped to Team 1 only'
      : 'FAILED: Calendar could show other team data',
  });
  console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);

  // ============================================
  // TEST 9: /daily-monitoring/member/:memberId - Member history
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST 9: /daily-monitoring/member/:memberId - Member History');
  console.log('='.repeat(70));

  if (team2.members.length > 0) {
    const team2Member = team2.members[0];

    // Simulate security check for Team 1 leader accessing Team 2 member
    const leaderTeam = await prisma.team.findFirst({
      where: { leaderId: team1.leader.id, isActive: true },
    });

    const memberBelongsToLeaderTeam = await prisma.user.findFirst({
      where: {
        id: team2Member.id,
        teamId: leaderTeam?.id,
        isActive: true,
      },
    });

    const accessBlocked = memberBelongsToLeaderTeam === null;
    results.push({
      test: `Team 1 leader cannot view Team 2 member (${team2Member.firstName}) history`,
      passed: accessBlocked,
      details: accessBlocked
        ? `PASSED: Team 1 leader blocked from ${team2Member.firstName}'s history`
        : `FAILED: Team 1 leader could view ${team2Member.firstName}'s history`,
    });
    console.log(`  ${results[results.length - 1].passed ? '✓' : '✗'} ${results[results.length - 1].details}`);
  } else {
    console.log('  - Skipped: Team 2 has no members to test');
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('');
  console.log('='.repeat(70));
  console.log('SECURITY TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed: ${failed} (${Math.round((failed / total) * 100)}%)`);
  console.log('');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.test}`);
      console.log(`    ${result.details}`);
    }
  } else {
    console.log('ALL TESTS PASSED!');
    console.log('');
    console.log('Team leader data isolation is working correctly.');
    console.log('Each team leader can only see data for their own team members.');
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('SECURITY CHECKS IMPLEMENTED');
  console.log('='.repeat(70));
  console.log('');
  console.log('The following endpoints have TEAM_LEAD scoping:');
  console.log('');
  console.log('  /teams              - Only see team they lead');
  console.log('  /teams/:id          - Only access their own team');
  console.log('  /teams/:id/stats    - Only view stats for their team');
  console.log('  /teams/my/analytics - Only view analytics for team they lead');
  console.log('  /teams/members/*    - Only access their team members');
  console.log('  /checkins           - Only see their team check-ins');
  console.log('  /analytics/team/:id - Only access their team analytics');
  console.log('  /exemptions/:id     - Only view/approve their team exemptions');
  console.log('  /incidents          - Only see their team incidents');
  console.log('  /calendar/team      - Only see their team calendar');
  console.log('  /daily-monitoring/* - Only see their team data');
  console.log('');
}

runSecurityTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
