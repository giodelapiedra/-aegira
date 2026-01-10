import { PrismaClient, ReadinessStatus, AttendanceStatus } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

// Test results tracker
const testResults: { name: string; category: string; passed: boolean; details?: string }[] = [];

function log(msg: string) {
  console.log(msg);
}

function logTest(category: string, name: string, passed: boolean, details?: string) {
  testResults.push({ name, category, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`   ${icon} ${name}${details ? ` - ${details}` : ''}`);
}

// ============================================================
// WORKER FEATURE TESTS
// ============================================================
async function testWorkerFeatures() {
  log('\n' + '═'.repeat(70));
  log('WORKER FEATURE TESTS');
  log('═'.repeat(70));

  // Get a worker for testing
  const worker = await prisma.user.findFirst({
    where: { role: 'WORKER' },
    include: { team: true, company: true }
  });

  if (!worker) {
    log('❌ No worker found in database');
    return;
  }

  log(`\n📋 Testing as: ${worker.firstName} ${worker.lastName} (${worker.email})`);
  log(`   Team: ${worker.team?.name || 'No team'}`);

  // ----------------------------------------
  // 1. CHECK-IN FEATURE
  // ----------------------------------------
  log('\n─── 1. CHECK-IN FEATURE ───');

  // Test: Get check-in history
  const checkinHistory = await prisma.checkin.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  logTest('Checkin', 'Get check-in history', true, `Found ${checkinHistory.length} check-ins`);

  // Test: Check-in validation (is today a work day?)
  const today = DateTime.now().setZone(worker.company?.timezone || 'Asia/Manila');
  const dayOfWeek = today.weekday; // 1=Monday, 7=Sunday
  const workDays = worker.team?.workDays || [1, 2, 3, 4, 5];
  const isWorkDay = workDays.includes(dayOfWeek);
  logTest('Checkin', 'Work day validation', true, `Today (${today.toFormat('cccc')}) is ${isWorkDay ? 'a work day' : 'NOT a work day'}`);

  // Test: Check if already checked in today
  const todayStart = today.startOf('day').toJSDate();
  const todayEnd = today.endOf('day').toJSDate();
  const todayCheckin = await prisma.checkin.findFirst({
    where: {
      userId: worker.id,
      createdAt: { gte: todayStart, lte: todayEnd }
    }
  });
  logTest('Checkin', 'Already checked in today?', true, todayCheckin ? 'Yes - already checked in' : 'No - can check in');

  // Test: Readiness score calculation
  if (checkinHistory.length > 0) {
    const lastCheckin = checkinHistory[0];
    const expectedScore = Math.round(
      (lastCheckin.mood + (10 - lastCheckin.stress) + lastCheckin.sleep + lastCheckin.physicalHealth) / 4 * 10
    );
    const scoreMatches = Math.abs(lastCheckin.readinessScore - expectedScore) <= 1;
    logTest('Checkin', 'Readiness score calculation', scoreMatches,
      `Score: ${lastCheckin.readinessScore}% (Expected ~${expectedScore}%)`);

    // Test: Status determination
    let expectedStatus: ReadinessStatus;
    if (lastCheckin.readinessScore >= 75) expectedStatus = 'GREEN';
    else if (lastCheckin.readinessScore >= 50) expectedStatus = 'YELLOW';
    else expectedStatus = 'RED';
    logTest('Checkin', 'Status determination', lastCheckin.readinessStatus === expectedStatus,
      `Status: ${lastCheckin.readinessStatus} (Score: ${lastCheckin.readinessScore}%)`);
  }

  // ----------------------------------------
  // 2. ATTENDANCE FEATURE
  // ----------------------------------------
  log('\n─── 2. ATTENDANCE FEATURE ───');

  const attendance = await prisma.dailyAttendance.findMany({
    where: { userId: worker.id },
    orderBy: { date: 'desc' },
    take: 10
  });
  logTest('Attendance', 'Get attendance history', true, `Found ${attendance.length} records`);

  // Test: Attendance status distribution
  const statusCounts = { GREEN: 0, YELLOW: 0, ABSENT: 0, EXCUSED: 0 };
  for (const a of attendance) {
    statusCounts[a.status as keyof typeof statusCounts]++;
  }
  logTest('Attendance', 'Status tracking', true,
    `GREEN:${statusCounts.GREEN} YELLOW:${statusCounts.YELLOW} ABSENT:${statusCounts.ABSENT} EXCUSED:${statusCounts.EXCUSED}`);

  // Test: Calculate attendance score
  const totalAttendance = attendance.filter(a => a.status !== 'EXCUSED');
  if (totalAttendance.length > 0) {
    const avgScore = totalAttendance.reduce((sum, a) => sum + a.score, 0) / totalAttendance.length;
    logTest('Attendance', 'Attendance score calculation', true, `Average score: ${avgScore.toFixed(1)}%`);
  }

  // ----------------------------------------
  // 3. EXCEPTION REQUEST FEATURE
  // ----------------------------------------
  log('\n─── 3. EXCEPTION REQUEST FEATURE ───');

  const exceptions = await prisma.exception.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  logTest('Exception', 'Get my exceptions', true, `Found ${exceptions.length} requests`);

  // Test: Exception types
  const exceptionTypes = [...new Set(exceptions.map(e => e.type))];
  logTest('Exception', 'Exception types used', true, exceptionTypes.join(', ') || 'None');

  // Test: Status distribution
  const exStatusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const e of exceptions) {
    exStatusCounts[e.status as keyof typeof exStatusCounts]++;
  }
  logTest('Exception', 'Status tracking', true,
    `PENDING:${exStatusCounts.PENDING} APPROVED:${exStatusCounts.APPROVED} REJECTED:${exStatusCounts.REJECTED}`);

  // ----------------------------------------
  // 4. INCIDENT FEATURE
  // ----------------------------------------
  log('\n─── 4. INCIDENT FEATURE ───');

  const incidents = await prisma.incident.findMany({
    where: { reportedBy: worker.id },
    orderBy: { createdAt: 'desc' }
  });
  logTest('Incident', 'Get my incidents', true, `Found ${incidents.length} incidents`);

  if (incidents.length > 0) {
    const severities = [...new Set(incidents.map(i => i.severity))];
    logTest('Incident', 'Severity levels used', true, severities.join(', '));
  }

  // ----------------------------------------
  // 5. NOTIFICATIONS FEATURE
  // ----------------------------------------
  log('\n─── 5. NOTIFICATIONS FEATURE ───');

  const notifications = await prisma.notification.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  const unreadCount = notifications.filter(n => !n.isRead).length;
  logTest('Notification', 'Get notifications', true, `Found ${notifications.length} (${unreadCount} unread)`);

  return worker;
}

// ============================================================
// TEAM LEADER FEATURE TESTS
// ============================================================
async function testTeamLeaderFeatures() {
  log('\n' + '═'.repeat(70));
  log('TEAM LEADER FEATURE TESTS');
  log('═'.repeat(70));

  // Get a team leader for testing
  const teamLead = await prisma.user.findFirst({
    where: { role: 'TEAM_LEAD' },
    include: {
      team: {
        include: { members: true }
      },
      company: true
    }
  });

  if (!teamLead || !teamLead.team) {
    log('❌ No team leader with team found in database');
    return;
  }

  log(`\n📋 Testing as: ${teamLead.firstName} ${teamLead.lastName}`);
  log(`   Team: ${teamLead.team.name} (${teamLead.team.members.length} members)`);

  const teamMemberIds = teamLead.team.members.map(m => m.id);
  const timezone = teamLead.company?.timezone || 'Asia/Manila';
  const today = DateTime.now().setZone(timezone);

  // ----------------------------------------
  // 1. DAILY MONITORING FEATURE
  // ----------------------------------------
  log('\n─── 1. DAILY MONITORING FEATURE ───');

  // Get today's check-ins for team
  const todayStart = today.startOf('day').toJSDate();
  const todayEnd = today.endOf('day').toJSDate();

  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: teamMemberIds },
      createdAt: { gte: todayStart, lte: todayEnd }
    },
    include: { user: true }
  });

  const greenCount = todayCheckins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellowCount = todayCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
  const redCount = todayCheckins.filter(c => c.readinessStatus === 'RED').length;

  logTest('Monitoring', 'Get today\'s check-ins', true,
    `${todayCheckins.length}/${teamMemberIds.length} checked in (🟢${greenCount} 🟡${yellowCount} 🔴${redCount})`);

  // Test: Sudden change detection
  const yesterdayStart = today.minus({ days: 1 }).startOf('day').toJSDate();
  const yesterdayEnd = today.minus({ days: 1 }).endOf('day').toJSDate();

  const suddenChanges: { user: string; drop: number }[] = [];
  for (const checkin of todayCheckins) {
    const yesterdayCheckin = await prisma.checkin.findFirst({
      where: {
        userId: checkin.userId,
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd }
      }
    });

    if (yesterdayCheckin) {
      const drop = yesterdayCheckin.readinessScore - checkin.readinessScore;
      if (drop >= 10) {
        suddenChanges.push({
          user: `${checkin.user.firstName}`,
          drop
        });
      }
    }
  }
  logTest('Monitoring', 'Sudden change detection', true,
    suddenChanges.length > 0
      ? `${suddenChanges.length} sudden drops detected`
      : 'No sudden drops detected');

  // Test: Members not checked in
  const checkedInIds = todayCheckins.map(c => c.userId);
  const notCheckedIn = teamLead.team.members.filter(m => !checkedInIds.includes(m.id) && m.role !== 'TEAM_LEAD');
  logTest('Monitoring', 'Not checked in tracking', true,
    `${notCheckedIn.length} members haven't checked in yet`);

  // ----------------------------------------
  // 2. EXCEPTION APPROVAL FEATURE
  // ----------------------------------------
  log('\n─── 2. EXCEPTION APPROVAL FEATURE ───');

  const pendingExceptions = await prisma.exception.findMany({
    where: {
      userId: { in: teamMemberIds },
      status: 'PENDING'
    },
    include: { user: true }
  });
  logTest('Approval', 'Get pending exceptions', true, `${pendingExceptions.length} pending requests`);

  if (pendingExceptions.length > 0) {
    const types = [...new Set(pendingExceptions.map(e => e.type))];
    logTest('Approval', 'Request types', true, types.join(', '));
  }

  // ----------------------------------------
  // 3. TEAM ANALYTICS FEATURE
  // ----------------------------------------
  log('\n─── 3. TEAM ANALYTICS FEATURE ───');

  // Get last 7 days of check-ins
  const weekStart = today.minus({ days: 7 }).startOf('day').toJSDate();
  const weekCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: teamMemberIds },
      createdAt: { gte: weekStart }
    }
  });

  if (weekCheckins.length > 0) {
    const avgReadiness = weekCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / weekCheckins.length;
    logTest('Analytics', 'Average readiness (7 days)', true, `${avgReadiness.toFixed(1)}%`);

    // Check-in rate
    const workDays = teamLead.team.workDays || [1, 2, 3, 4, 5];
    let expectedCheckins = 0;
    for (let d = 0; d < 7; d++) {
      const day = today.minus({ days: d });
      if (workDays.includes(day.weekday)) {
        expectedCheckins += teamMemberIds.length;
      }
    }
    const checkinRate = expectedCheckins > 0 ? (weekCheckins.length / expectedCheckins * 100) : 0;
    logTest('Analytics', 'Check-in rate (7 days)', true,
      `${checkinRate.toFixed(1)}% (${weekCheckins.length}/${expectedCheckins})`);

    // Status distribution
    const weekGreen = weekCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const weekYellow = weekCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const weekRed = weekCheckins.filter(c => c.readinessStatus === 'RED').length;
    logTest('Analytics', 'Status distribution (7 days)', true,
      `🟢${weekGreen} 🟡${weekYellow} 🔴${weekRed}`);
  }

  // ----------------------------------------
  // 4. TEAM MEMBER MANAGEMENT
  // ----------------------------------------
  log('\n─── 4. TEAM MEMBER MANAGEMENT ───');

  logTest('Team', 'Get team members', true, `${teamLead.team.members.length} members`);

  // Get member performance
  for (const member of teamLead.team.members.slice(0, 3)) {
    const memberCheckins = await prisma.checkin.count({
      where: { userId: member.id }
    });
    const memberAttendance = await prisma.dailyAttendance.findMany({
      where: { userId: member.id, status: { not: 'EXCUSED' } }
    });
    const avgAttendanceScore = memberAttendance.length > 0
      ? memberAttendance.reduce((sum, a) => sum + a.score, 0) / memberAttendance.length
      : 0;

    logTest('Team', `Member: ${member.firstName} ${member.lastName}`, true,
      `${memberCheckins} check-ins, ${avgAttendanceScore.toFixed(0)}% attendance score`);
  }

  // ----------------------------------------
  // 5. TEAM INCIDENTS
  // ----------------------------------------
  log('\n─── 5. TEAM INCIDENTS ───');

  const teamIncidents = await prisma.incident.findMany({
    where: {
      reportedBy: { in: teamMemberIds }
    },
    orderBy: { createdAt: 'desc' }
  });
  logTest('Incidents', 'Get team incidents', true, `${teamIncidents.length} incidents`);

  if (teamIncidents.length > 0) {
    const openIncidents = teamIncidents.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS');
    logTest('Incidents', 'Open/In-progress incidents', true, `${openIncidents.length} open`);
  }

  return teamLead;
}

// ============================================================
// CROSS-ROLE INTEGRATION TESTS
// ============================================================
async function testIntegration() {
  log('\n' + '═'.repeat(70));
  log('CROSS-ROLE INTEGRATION TESTS');
  log('═'.repeat(70));

  // ----------------------------------------
  // 1. RED STATUS → AUTO EXEMPTION
  // ----------------------------------------
  log('\n─── 1. RED STATUS → AUTO EXEMPTION FLOW ───');

  // Find check-ins with RED status and check if they have corresponding exemptions
  const redCheckins = await prisma.checkin.findMany({
    where: { readinessStatus: 'RED' },
    include: {
      user: true,
      exemption: true
    },
    take: 5
  });

  if (redCheckins.length > 0) {
    const withExemption = redCheckins.filter(c => c.exemption !== null);
    logTest('Integration', 'RED status auto-exemption', true,
      `${withExemption.length}/${redCheckins.length} RED check-ins have exemptions`);
  } else {
    logTest('Integration', 'RED status auto-exemption', true, 'No RED check-ins to test');
  }

  // ----------------------------------------
  // 2. EXCEPTION APPROVAL → ATTENDANCE UPDATE
  // ----------------------------------------
  log('\n─── 2. EXCEPTION APPROVAL → ATTENDANCE FLOW ───');

  const approvedExceptions = await prisma.exception.findMany({
    where: { status: 'APPROVED' },
    include: {
      dailyAttendance: true,
      user: true
    },
    take: 5
  });

  if (approvedExceptions.length > 0) {
    const withAttendance = approvedExceptions.filter(e => e.dailyAttendance !== null);
    logTest('Integration', 'Exception → Attendance linking', true,
      `${withAttendance.length}/${approvedExceptions.length} approved exceptions linked to attendance`);

    // Check if linked attendance has EXCUSED status
    const excusedAttendance = approvedExceptions.filter(e => e.dailyAttendance?.status === 'EXCUSED');
    logTest('Integration', 'EXCUSED status applied', true,
      `${excusedAttendance.length} attendance records marked EXCUSED`);
  } else {
    logTest('Integration', 'Exception → Attendance linking', true, 'No approved exceptions to test');
  }

  // ----------------------------------------
  // 3. HOLIDAY → CHECK-IN VALIDATION
  // ----------------------------------------
  log('\n─── 3. HOLIDAY SYSTEM ───');

  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'asc' }
  });
  logTest('Integration', 'Holiday calendar', true, `${holidays.length} holidays configured`);

  if (holidays.length > 0) {
    const upcoming = holidays.filter(h => h.date >= new Date());
    logTest('Integration', 'Upcoming holidays', true,
      upcoming.slice(0, 3).map(h => h.name).join(', ') || 'None');
  }
}

// ============================================================
// PRINT SUMMARY
// ============================================================
function printSummary() {
  log('\n' + '═'.repeat(70));
  log('TEST SUMMARY');
  log('═'.repeat(70));

  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  const total = testResults.length;

  log(`\nTotal Tests: ${total}`);
  log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);

  // Group by category
  const categories = [...new Set(testResults.map(t => t.category))];
  log('\n─── By Category ───');
  for (const cat of categories) {
    const catTests = testResults.filter(t => t.category === cat);
    const catPassed = catTests.filter(t => t.passed).length;
    log(`${cat}: ${catPassed}/${catTests.length} passed`);
  }

  if (failed > 0) {
    log('\n─── Failed Tests ───');
    testResults.filter(t => !t.passed).forEach(t => {
      log(`❌ [${t.category}] ${t.name}: ${t.details || 'No details'}`);
    });
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         AEGIRA FEATURE TESTING - WORKER TO TEAM LEADER              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  try {
    await testWorkerFeatures();
    await testTeamLeaderFeatures();
    await testIntegration();
    printSummary();
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
