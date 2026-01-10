import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const DEMO_COMPANY_NAME = 'DEMO_PhilHealth';

async function testDemoAnalytics() {
  console.log('='.repeat(70));
  console.log('DEMO COMPANY ANALYTICS');
  console.log('='.repeat(70));

  const timezone = 'Asia/Manila';
  const now = DateTime.now().setZone(timezone);

  // Get demo company
  const company = await prisma.company.findFirst({
    where: { name: DEMO_COMPANY_NAME },
  });

  if (!company) {
    console.log('❌ Demo company not found!');
    return;
  }

  console.log(`\n📍 Company: ${company.name}`);
  console.log(`📍 ID: ${company.id}`);

  // ============================================================
  // 1. USER COUNTS BY ROLE
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('1. USER COUNTS BY ROLE');
  console.log('─'.repeat(70));

  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    where: { companyId: company.id },
    _count: { id: true },
  });

  for (const r of usersByRole) {
    console.log(`   ${r.role}: ${r._count.id}`);
  }

  // ============================================================
  // 2. TEAM SUMMARY
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('2. TEAM SUMMARY');
  console.log('─'.repeat(70));

  const teams = await prisma.team.findMany({
    where: { companyId: company.id },
    include: {
      leader: true,
      members: true,
    },
  });

  for (const team of teams) {
    console.log(`\n   📋 ${team.name}`);
    console.log(`      Leader: ${team.leader?.firstName} ${team.leader?.lastName}`);
    console.log(`      Members: ${team.members.length}`);
    console.log(`      Work Days: ${team.workDays}`);
    console.log(`      Shift: ${team.shiftStart} - ${team.shiftEnd}`);
  }

  // ============================================================
  // 3. CHECK-IN ANALYTICS (Last 7 days)
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('3. CHECK-IN ANALYTICS (Last 7 days)');
  console.log('─'.repeat(70));

  const sevenDaysAgo = now.minus({ days: 7 }).startOf('day').toJSDate();

  const checkins = await prisma.checkin.findMany({
    where: {
      companyId: company.id,
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      user: true,
    },
  });

  const statusCounts = { GREEN: 0, YELLOW: 0, RED: 0 };
  let totalScore = 0;

  for (const c of checkins) {
    statusCounts[c.readinessStatus as keyof typeof statusCounts]++;
    totalScore += c.readinessScore;
  }

  const avgScore = checkins.length > 0 ? (totalScore / checkins.length).toFixed(1) : 0;

  console.log(`   Total Check-ins: ${checkins.length}`);
  console.log(`   Average Readiness Score: ${avgScore}%`);
  console.log(`   🟢 GREEN: ${statusCounts.GREEN} (${((statusCounts.GREEN / checkins.length) * 100).toFixed(1)}%)`);
  console.log(`   🟡 YELLOW: ${statusCounts.YELLOW} (${((statusCounts.YELLOW / checkins.length) * 100).toFixed(1)}%)`);
  console.log(`   🔴 RED: ${statusCounts.RED} (${((statusCounts.RED / checkins.length) * 100).toFixed(1)}%)`);

  // ============================================================
  // 4. TEAM READINESS COMPARISON
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('4. TEAM READINESS COMPARISON');
  console.log('─'.repeat(70));

  for (const team of teams) {
    const teamMemberIds = team.members.map(m => m.id);
    const teamCheckins = checkins.filter(c => teamMemberIds.includes(c.userId));

    if (teamCheckins.length === 0) {
      console.log(`\n   📋 ${team.name}: No check-ins`);
      continue;
    }

    const teamAvg = teamCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / teamCheckins.length;
    const teamGreen = teamCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const teamYellow = teamCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
    const teamRed = teamCheckins.filter(c => c.readinessStatus === 'RED').length;

    console.log(`\n   📋 ${team.name}`);
    console.log(`      Average Score: ${teamAvg.toFixed(1)}%`);
    console.log(`      Check-ins: ${teamCheckins.length} (🟢${teamGreen} 🟡${teamYellow} 🔴${teamRed})`);
  }

  // ============================================================
  // 5. LEAVE REQUESTS STATUS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('5. LEAVE REQUESTS STATUS');
  console.log('─'.repeat(70));

  const leaves = await prisma.exception.findMany({
    where: { companyId: company.id },
    include: { user: true },
  });

  const leavesByStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const l of leaves) {
    leavesByStatus[l.status as keyof typeof leavesByStatus]++;
  }

  console.log(`   Total: ${leaves.length}`);
  console.log(`   ⏳ PENDING: ${leavesByStatus.PENDING}`);
  console.log(`   ✅ APPROVED: ${leavesByStatus.APPROVED}`);
  console.log(`   ❌ REJECTED: ${leavesByStatus.REJECTED}`);

  console.log('\n   Recent Leaves:');
  for (const l of leaves.slice(0, 5)) {
    console.log(`      - ${l.user.firstName} ${l.user.lastName}: ${l.type} (${l.status})`);
  }

  // ============================================================
  // 6. INCIDENTS SUMMARY
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('6. INCIDENTS SUMMARY');
  console.log('─'.repeat(70));

  const incidents = await prisma.incident.findMany({
    where: { companyId: company.id },
    include: { reporter: true },
  });

  const incidentsByStatus = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
  const incidentsBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

  for (const i of incidents) {
    incidentsByStatus[i.status as keyof typeof incidentsByStatus]++;
    incidentsBySeverity[i.severity as keyof typeof incidentsBySeverity]++;
  }

  console.log(`   Total: ${incidents.length}`);
  console.log(`   By Status: 🔴OPEN(${incidentsByStatus.OPEN}) 🟡IN_PROGRESS(${incidentsByStatus.IN_PROGRESS}) 🟢RESOLVED(${incidentsByStatus.RESOLVED})`);
  console.log(`   By Severity: LOW(${incidentsBySeverity.LOW}) MEDIUM(${incidentsBySeverity.MEDIUM}) HIGH(${incidentsBySeverity.HIGH}) CRITICAL(${incidentsBySeverity.CRITICAL})`);

  console.log('\n   Recent Incidents:');
  for (const i of incidents) {
    console.log(`      - ${i.caseNumber}: ${i.title} (${i.severity}/${i.status})`);
  }

  // ============================================================
  // 7. HOLIDAYS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('7. HOLIDAYS');
  console.log('─'.repeat(70));

  const holidays = await prisma.holiday.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'asc' },
  });

  for (const h of holidays) {
    const hDate = DateTime.fromJSDate(h.date).setZone(timezone);
    const isPast = hDate < now.startOf('day');
    console.log(`   ${isPast ? '✓' : '📅'} ${h.name}: ${hDate.toFormat('yyyy-MM-dd')} ${isPast ? '(past)' : ''}`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('EXECUTIVE DASHBOARD SUMMARY');
  console.log('='.repeat(70));

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ COMPANY: ${company.name.padEnd(59)}│
├─────────────────────────────────────────────────────────────────────┤
│ WORKFORCE STATUS:                                                   │
│   Total Users: ${(usersByRole.reduce((sum, r) => sum + r._count.id, 0)).toString().padEnd(53)}│
│   Teams: ${teams.length.toString().padEnd(59)}│
│   Avg Readiness: ${avgScore.toString().padEnd(50)}%│
├─────────────────────────────────────────────────────────────────────┤
│ ALERTS:                                                             │
│   Pending Leave Requests: ${leavesByStatus.PENDING.toString().padEnd(42)}│
│   Open Incidents: ${(incidentsByStatus.OPEN + incidentsByStatus.IN_PROGRESS).toString().padEnd(50)}│
│   RED Status Workers (7d): ${statusCounts.RED.toString().padEnd(41)}│
└─────────────────────────────────────────────────────────────────────┘
`);
}

testDemoAnalytics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
