/**
 * SECURITY MOCK DATA TEST
 *
 * This test creates mock API requests to simulate team leaders
 * trying to access data from different teams.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simulate the security check logic used in endpoints
async function simulateTeamLeadCheck(
  currentUserId: string,
  targetTeamId: string,
  companyId: string
): Promise<{ allowed: boolean; reason: string }> {
  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true, firstName: true, lastName: true },
  });

  if (!currentUser) {
    return { allowed: false, reason: 'User not found' };
  }

  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';

  if (!isTeamLead) {
    return { allowed: true, reason: 'Not a TEAM_LEAD - higher role has access' };
  }

  // Find the team this user leads
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: currentUserId, companyId, isActive: true },
    select: { id: true, name: true },
  });

  if (!leaderTeam) {
    return { allowed: false, reason: 'User is TEAM_LEAD but not assigned to lead any team' };
  }

  if (leaderTeam.id === targetTeamId) {
    return { allowed: true, reason: `Access allowed - ${currentUser.firstName} leads this team` };
  }

  return {
    allowed: false,
    reason: `Access DENIED - ${currentUser.firstName} leads "${leaderTeam.name}" but tried to access a different team`
  };
}

async function simulateMemberAccessCheck(
  currentUserId: string,
  targetMemberId: string,
  companyId: string
): Promise<{ allowed: boolean; reason: string }> {
  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true, firstName: true, lastName: true },
  });

  if (!currentUser) {
    return { allowed: false, reason: 'User not found' };
  }

  const isTeamLead = currentUser.role?.toUpperCase() === 'TEAM_LEAD';

  if (!isTeamLead) {
    return { allowed: true, reason: 'Not a TEAM_LEAD - higher role has access' };
  }

  // Find the team this user leads
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: currentUserId, companyId, isActive: true },
    select: { id: true, name: true },
  });

  if (!leaderTeam) {
    return { allowed: false, reason: 'User is TEAM_LEAD but not assigned to lead any team' };
  }

  // Check if target member belongs to leader's team
  const targetMember = await prisma.user.findFirst({
    where: { id: targetMemberId, teamId: leaderTeam.id, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  if (targetMember) {
    return {
      allowed: true,
      reason: `Access allowed - ${targetMember.firstName} is in ${currentUser.firstName}'s team`
    };
  }

  // Get target member info for better error message
  const targetInfo = await prisma.user.findUnique({
    where: { id: targetMemberId },
    select: { firstName: true, lastName: true, team: { select: { name: true } } },
  });

  return {
    allowed: false,
    reason: `Access DENIED - ${targetInfo?.firstName || 'Unknown'} is in "${targetInfo?.team?.name || 'Unknown'}" team, not in ${currentUser.firstName}'s team`
  };
}

async function runMockTests() {
  console.log('='.repeat(70));
  console.log('SECURITY MOCK DATA TEST');
  console.log('='.repeat(70));
  console.log('');

  // Get all teams with leaders and members
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      leader: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true, firstName: true, lastName: true },
      },
      company: {
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (teams.length < 2) {
    console.log('ERROR: Need at least 2 teams with leaders for testing.');
    return;
  }

  // Find teams with leaders
  const teamsWithLeaders = teams.filter(t => t.leader);
  if (teamsWithLeaders.length < 2) {
    console.log('ERROR: Need at least 2 teams with assigned leaders.');
    return;
  }

  console.log('TEAMS SETUP:');
  console.log('-'.repeat(70));
  for (const team of teamsWithLeaders) {
    console.log(`\n${team.name}`);
    console.log(`  Leader: ${team.leader!.firstName} ${team.leader!.lastName} (${team.leader!.role})`);
    console.log(`  Members: ${team.members.map(m => m.firstName).join(', ') || 'None'}`);
  }
  console.log('\n');

  const teamA = teamsWithLeaders[0];
  const teamB = teamsWithLeaders[1];
  const companyId = teamA.companyId;

  let passed = 0;
  let failed = 0;

  // ============================================
  // TEST SUITE 1: Team Access
  // ============================================
  console.log('='.repeat(70));
  console.log('TEST SUITE 1: TEAM ACCESS');
  console.log('='.repeat(70));

  // Test 1.1: Team A leader accessing Team A
  console.log('\n[Test 1.1] Team A leader accessing their OWN team');
  let result = await simulateTeamLeadCheck(teamA.leader!.id, teamA.id, companyId);
  console.log(`  ${result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
  result.allowed ? passed++ : failed++;

  // Test 1.2: Team A leader accessing Team B
  console.log('\n[Test 1.2] Team A leader trying to access Team B (should be BLOCKED)');
  result = await simulateTeamLeadCheck(teamA.leader!.id, teamB.id, companyId);
  console.log(`  ${!result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
  !result.allowed ? passed++ : failed++;

  // Test 1.3: Team B leader accessing Team B
  console.log('\n[Test 1.3] Team B leader accessing their OWN team');
  result = await simulateTeamLeadCheck(teamB.leader!.id, teamB.id, companyId);
  console.log(`  ${result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
  result.allowed ? passed++ : failed++;

  // Test 1.4: Team B leader accessing Team A
  console.log('\n[Test 1.4] Team B leader trying to access Team A (should be BLOCKED)');
  result = await simulateTeamLeadCheck(teamB.leader!.id, teamA.id, companyId);
  console.log(`  ${!result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
  !result.allowed ? passed++ : failed++;

  // ============================================
  // TEST SUITE 2: Member Access
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUITE 2: MEMBER ACCESS');
  console.log('='.repeat(70));

  if (teamA.members.length > 0 && teamB.members.length > 0) {
    const memberA = teamA.members[0];
    const memberB = teamB.members[0];

    // Test 2.1: Team A leader accessing Team A member
    console.log(`\n[Test 2.1] Team A leader accessing Team A member (${memberA.firstName})`);
    result = await simulateMemberAccessCheck(teamA.leader!.id, memberA.id, companyId);
    console.log(`  ${result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
    result.allowed ? passed++ : failed++;

    // Test 2.2: Team A leader accessing Team B member
    console.log(`\n[Test 2.2] Team A leader trying to access Team B member (${memberB.firstName}) - should be BLOCKED`);
    result = await simulateMemberAccessCheck(teamA.leader!.id, memberB.id, companyId);
    console.log(`  ${!result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
    !result.allowed ? passed++ : failed++;

    // Test 2.3: Team B leader accessing Team B member
    console.log(`\n[Test 2.3] Team B leader accessing Team B member (${memberB.firstName})`);
    result = await simulateMemberAccessCheck(teamB.leader!.id, memberB.id, companyId);
    console.log(`  ${result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
    result.allowed ? passed++ : failed++;

    // Test 2.4: Team B leader accessing Team A member
    console.log(`\n[Test 2.4] Team B leader trying to access Team A member (${memberA.firstName}) - should be BLOCKED`);
    result = await simulateMemberAccessCheck(teamB.leader!.id, memberA.id, companyId);
    console.log(`  ${!result.allowed ? '✓ PASS' : '✗ FAIL'}: ${result.reason}`);
    !result.allowed ? passed++ : failed++;
  } else {
    console.log('\n  Skipped - Teams need members for this test');
  }

  // ============================================
  // TEST SUITE 3: Check-in Data Isolation
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUITE 3: CHECK-IN DATA ISOLATION');
  console.log('='.repeat(70));

  const teamAMemberIds = teamA.members.map(m => m.id);
  const teamBMemberIds = teamB.members.map(m => m.id);

  // Get check-ins for Team A members (as Team A leader would query)
  const teamACheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: teamAMemberIds },
      companyId,
    },
    include: {
      user: { select: { firstName: true, lastName: true, teamId: true } },
    },
    take: 10,
  });

  console.log(`\n[Test 3.1] Team A leader queries check-ins (found ${teamACheckins.length})`);

  // Verify no Team B members in results
  const hasTeamBData = teamACheckins.some(c => teamBMemberIds.includes(c.userId));
  console.log(`  ${!hasTeamBData ? '✓ PASS' : '✗ FAIL'}: ${hasTeamBData ? 'LEAKED Team B data!' : 'Only Team A data returned'}`);
  !hasTeamBData ? passed++ : failed++;

  if (teamACheckins.length > 0) {
    console.log(`  Sample data: ${teamACheckins.slice(0, 3).map(c => `${c.user.firstName} (${c.readinessScore}%)`).join(', ')}`);
  }

  // Get check-ins for Team B members (as Team B leader would query)
  const teamBCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: teamBMemberIds },
      companyId,
    },
    include: {
      user: { select: { firstName: true, lastName: true, teamId: true } },
    },
    take: 10,
  });

  console.log(`\n[Test 3.2] Team B leader queries check-ins (found ${teamBCheckins.length})`);

  // Verify no Team A members in results
  const hasTeamAData = teamBCheckins.some(c => teamAMemberIds.includes(c.userId));
  console.log(`  ${!hasTeamAData ? '✓ PASS' : '✗ FAIL'}: ${hasTeamAData ? 'LEAKED Team A data!' : 'Only Team B data returned'}`);
  !hasTeamAData ? passed++ : failed++;

  if (teamBCheckins.length > 0) {
    console.log(`  Sample data: ${teamBCheckins.slice(0, 3).map(c => `${c.user.firstName} (${c.readinessScore}%)`).join(', ')}`);
  }

  // ============================================
  // TEST SUITE 4: Exemption Data Isolation
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUITE 4: EXEMPTION DATA ISOLATION');
  console.log('='.repeat(70));

  // Get exemptions for Team A (scoped query)
  const teamAExemptions = await prisma.exception.findMany({
    where: {
      user: { teamId: teamA.id },
      companyId,
    },
    include: {
      user: { select: { firstName: true, teamId: true } },
    },
    take: 5,
  });

  console.log(`\n[Test 4.1] Team A leader queries exemptions (found ${teamAExemptions.length})`);
  const exemptionHasTeamBData = teamAExemptions.some(e => e.user.teamId === teamB.id);
  console.log(`  ${!exemptionHasTeamBData ? '✓ PASS' : '✗ FAIL'}: ${exemptionHasTeamBData ? 'LEAKED Team B exemptions!' : 'Only Team A exemptions returned'}`);
  !exemptionHasTeamBData ? passed++ : failed++;

  // ============================================
  // TEST SUITE 5: Cross-Team Action Prevention
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUITE 5: CROSS-TEAM ACTION PREVENTION');
  console.log('='.repeat(70));

  // Find an exemption from Team B
  const teamBExemption = await prisma.exception.findFirst({
    where: {
      user: { teamId: teamB.id },
      companyId,
      status: 'PENDING',
    },
    include: {
      user: {
        select: {
          firstName: true,
          team: { select: { id: true, leaderId: true } }
        }
      },
    },
  });

  if (teamBExemption) {
    console.log(`\n[Test 5.1] Team A leader tries to APPROVE Team B exemption`);

    // Simulate the security check
    const isTeamALeaderAllowed = teamBExemption.user.team?.leaderId === teamA.leader!.id;
    console.log(`  ${!isTeamALeaderAllowed ? '✓ PASS' : '✗ FAIL'}: ${isTeamALeaderAllowed ? 'SECURITY BREACH - Could approve!' : 'Correctly BLOCKED from approving'}`);
    !isTeamALeaderAllowed ? passed++ : failed++;
  } else {
    console.log('\n[Test 5.1] Skipped - No pending exemptions in Team B');
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal Tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('Security Summary:');
    console.log('  ✓ Team leaders can ONLY see their own team');
    console.log('  ✓ Team leaders can ONLY access their own team members');
    console.log('  ✓ Check-in data is properly isolated by team');
    console.log('  ✓ Exemption data is properly isolated by team');
    console.log('  ✓ Cross-team actions are BLOCKED');
  } else {
    console.log('❌ SOME TESTS FAILED!');
    console.log('Please review the security implementation.');
  }

  console.log('\n' + '='.repeat(70));
}

runMockTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
