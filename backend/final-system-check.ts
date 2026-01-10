/**
 * FINAL SYSTEM CHECK - Complete verification
 */

import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import 'dotenv/config';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
const API_BASE = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;
const issues: string[] = [];

async function generateToken(userId: string, companyId: string, role: string) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ companyId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(secret);
}

async function apiCall(endpoint: string, token: string, method = 'GET', body?: any) {
  const options: RequestInit = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  return { status: response.status, data: await response.json(), ok: response.ok };
}

function test(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`);
    failed++;
    issues.push(name);
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              FINAL SYSTEM CHECK                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Get test users - find leader first, then find worker in SAME team
  const leader = await prisma.user.findFirst({
    where: { role: 'TEAM_LEAD', isActive: true },
    include: { team: true },
  });
  const worker = await prisma.user.findFirst({
    where: { role: 'WORKER', isActive: true, teamId: leader?.teamId },
    include: { team: true },
  });
  const exec = await prisma.user.findFirst({
    where: { role: 'EXECUTIVE', isActive: true },
  });

  if (!worker || !leader || !exec) {
    console.log('❌ Missing required users');
    return;
  }

  const workerToken = await generateToken(worker.id, worker.companyId, worker.role);
  const leaderToken = await generateToken(leader.id, leader.companyId, leader.role);
  const execToken = await generateToken(exec.id, exec.companyId, exec.role);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. DATABASE INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('─── 1. DATABASE INTEGRITY ───\n');

  // Check for bad exemption dates
  const badExemptions = await prisma.exception.findMany({
    where: { startDate: { not: null }, endDate: { not: null } },
  });
  const invalidDates = badExemptions.filter(e => e.startDate! > e.endDate!);
  test('No exemptions with startDate > endDate', invalidDates.length === 0, `Found ${invalidDates.length}`);

  // Check all workers have teams
  const workersNoTeam = await prisma.user.count({
    where: { role: 'WORKER', isActive: true, teamId: null },
  });
  test('All workers have teams', workersNoTeam === 0, `${workersNoTeam} without team`);

  // Check all teams have leaders
  const teamsNoLeader = await prisma.team.count({
    where: { isActive: true, leaderId: null },
  });
  test('All teams have leaders', teamsNoLeader === 0, `${teamsNoLeader} without leader`);

  // Check check-in scores are valid
  const invalidScores = await prisma.checkin.count({
    where: { OR: [{ readinessScore: { lt: 0 } }, { readinessScore: { gt: 100 } }] },
  });
  test('All check-in scores valid (0-100)', invalidScores === 0, `${invalidScores} invalid`);

  // ═══════════════════════════════════════════════════════════════════════
  // 2. WORKER FLOW
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 2. WORKER FLOW ───\n');

  const profile = await apiCall('/users/me', workerToken);
  test('Worker can get profile', profile.ok && profile.data.id === worker.id);

  const leaveStatus = await apiCall('/checkins/leave-status', workerToken);
  test('Worker can check leave status', leaveStatus.ok);

  const myCheckins = await apiCall('/checkins/my?limit=5', workerToken);
  test('Worker can get check-in history', myCheckins.ok);

  const myCalendar = await apiCall('/calendar/my?year=2026&month=1', workerToken);
  test('Worker can get calendar', myCalendar.ok && myCalendar.data.days?.length > 0);

  const performance = await apiCall('/checkins/attendance/performance?days=30', workerToken);
  test('Worker can get performance score', performance.ok && typeof performance.data.score === 'number');

  const myExemptions = await apiCall('/exceptions/my', workerToken);
  test('Worker can get exemptions', myExemptions.ok);

  // ═══════════════════════════════════════════════════════════════════════
  // 3. TEAM LEADER FLOW
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 3. TEAM LEADER FLOW ───\n');

  const myTeam = await apiCall('/teams/my', leaderToken);
  test('Leader can get team info', myTeam.ok);

  const teamCalendar = await apiCall('/calendar/team?year=2026&month=1', leaderToken);
  test('Leader can get team calendar', teamCalendar.ok);

  const pending = await apiCall('/exceptions/pending', leaderToken);
  test('Leader can get pending exemptions', pending.ok);

  const teamAnalytics = await apiCall(`/analytics/team/${leader.teamId}`, leaderToken);
  test('Leader can get team analytics', teamAnalytics.ok);

  // ═══════════════════════════════════════════════════════════════════════
  // 4. EXECUTIVE FLOW
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 4. EXECUTIVE FLOW ───\n');

  const dashboard = await apiCall('/analytics/dashboard', execToken);
  test('Executive can get dashboard', dashboard.ok);
  test('Dashboard has correct structure',
    dashboard.data.totalMembers !== undefined &&
    dashboard.data.checkinRate !== undefined &&
    dashboard.data.pendingExceptions !== undefined
  );

  const allUsers = await apiCall('/users?limit=50', execToken);
  test('Executive can list users', allUsers.ok && allUsers.data.data?.length > 0);

  const allTeams = await apiCall('/teams', execToken);
  test('Executive can list teams', allTeams.ok);

  const allIncidents = await apiCall('/incidents?limit=10', execToken);
  test('Executive can list incidents', allIncidents.ok);

  const holidays = await apiCall('/holidays?year=2026', execToken);
  test('Executive can list holidays', holidays.ok);

  const trends = await apiCall('/analytics/trends?days=30', execToken);
  test('Executive can get trends', trends.ok);

  const exportData = await apiCall('/analytics/export?limit=50', execToken);
  test('Executive can export data', exportData.ok && exportData.data.data?.length >= 0);

  // ═══════════════════════════════════════════════════════════════════════
  // 5. ANALYTICS ACCURACY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 5. ANALYTICS ACCURACY ───\n');

  // Verify dashboard numbers
  const actualWorkers = await prisma.user.count({
    where: { role: { in: ['MEMBER', 'WORKER'] }, isActive: true, teamId: { not: null } },
  });
  test('Dashboard worker count matches DB', dashboard.data.totalMembers === actualWorkers,
    `API: ${dashboard.data.totalMembers}, DB: ${actualWorkers}`);

  // Verify today's check-ins
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const actualCheckins = await prisma.checkin.count({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      user: { teamId: { not: null }, role: { in: ['MEMBER', 'WORKER'] }, isActive: true },
    },
  });
  const dashboardCheckins = dashboard.data.greenCount + dashboard.data.yellowCount + dashboard.data.redCount;
  test('Dashboard check-in count matches DB', dashboardCheckins === actualCheckins,
    `API: ${dashboardCheckins}, DB: ${actualCheckins}`);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. EXEMPTION FLOW (Full cycle test)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 6. EXEMPTION FLOW ───\n');

  // Create test exemption
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const endDate = new Date(futureDate);
  endDate.setDate(futureDate.getDate() + 2);

  const createExemption = await apiCall('/exceptions', workerToken, 'POST', {
    type: 'PERSONAL_LEAVE',
    reason: '[TEST] Will be deleted',
    startDate: futureDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });
  test('Worker can create exemption', createExemption.status === 201);

  if (createExemption.status === 201) {
    const exId = createExemption.data.id;

    // Check it appears in pending
    const pendingCheck = await apiCall('/exceptions/pending', leaderToken);
    const inPending = pendingCheck.data?.some((e: any) => e.id === exId);
    test('Exemption appears in pending list', inPending);

    // Approve it
    const approve = await apiCall(`/exceptions/${exId}/approve`, leaderToken, 'PATCH', {
      notes: '[TEST] Approved',
    });
    test('Leader can approve exemption', approve.ok && approve.data.status === 'APPROVED');

    // Clean up
    await prisma.exception.delete({ where: { id: exId } });
    console.log('  (Test exemption cleaned up)');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. CALENDAR ACCURACY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 7. CALENDAR ACCURACY ───\n');

  // Check worker calendar has correct summary
  const workerCal = await apiCall('/calendar/my?year=2026&month=1', workerToken);
  test('Calendar has summary', workerCal.data.summary !== undefined);
  test('Calendar has days array', Array.isArray(workerCal.data.days) && workerCal.data.days.length > 0);
  test('Calendar has holidays', Array.isArray(workerCal.data.holidays));

  // Verify work days calculation (max 27 if Saturday is a work day)
  const workDaysCount = workerCal.data.days?.filter((d: any) => d.isWorkDay && !d.isHoliday).length || 0;
  test('Work days calculated correctly', workDaysCount > 0 && workDaysCount <= 27,
    `Found ${workDaysCount} work days`);

  // ═══════════════════════════════════════════════════════════════════════
  // 8. READINESS CALCULATION
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n─── 8. READINESS CALCULATION ───\n');

  // Verify readiness scores are calculated correctly
  const sampleCheckins = await prisma.checkin.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { mood: true, stress: true, sleep: true, physicalHealth: true, readinessScore: true, readinessStatus: true },
  });

  let readinessCorrect = true;
  for (const c of sampleCheckins) {
    const expectedScore = Math.round(
      ((c.mood / 10) * 100 + ((10 - c.stress) / 10) * 100 + (c.sleep / 10) * 100 + (c.physicalHealth / 10) * 100) / 4
    );
    const expectedStatus = expectedScore >= 70 ? 'GREEN' : expectedScore >= 40 ? 'YELLOW' : 'RED';

    if (c.readinessScore !== expectedScore || c.readinessStatus !== expectedStatus) {
      readinessCorrect = false;
      break;
    }
  }
  test('Readiness scores calculated correctly', readinessCorrect);

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL REPORT                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Total Tests: ${passed + failed}`);
  console.log(`  ✓ Passed: ${passed}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (issues.length > 0) {
    console.log('\n  Issues Found:');
    issues.forEach(i => console.log(`    - ${i}`));
  }

  console.log(`\n  ${failed === 0 ? '✅ ALL SYSTEMS WORKING!' : '⚠️ SOME ISSUES NEED FIXING'}\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
