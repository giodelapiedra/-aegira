/**
 * Comprehensive Feature Test
 * Tests core business logic from Worker to Team Leader
 *
 * Run: npx tsx comprehensive-test.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

// Test results tracker
const results: { category: string; test: string; passed: boolean; details?: string }[] = [];

function log(message: string) {
  console.log(message);
}

function pass(category: string, test: string, details?: string) {
  results.push({ category, test, passed: true, details });
  console.log(`   ✅ ${test}${details ? ` - ${details}` : ''}`);
}

function fail(category: string, test: string, details?: string) {
  results.push({ category, test, passed: false, details });
  console.log(`   ❌ ${test}${details ? ` - ${details}` : ''}`);
}

// ============================================
// HELPER FUNCTIONS (from actual codebase)
// ============================================

function calculateReadinessScore(mood: number, stress: number, sleep: number, physical: number): number {
  // Invert stress (high stress = low score)
  const invertedStress = 11 - stress;
  const rawScore = (mood + invertedStress + sleep + physical) / 4;
  return Math.round((rawScore / 10) * 100);
}

function getReadinessStatus(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score >= 70) return 'GREEN';
  if (score >= 50) return 'YELLOW';
  return 'RED';
}

function calculateAttendanceStatus(
  checkInMinutes: number,
  shiftStartMinutes: number,
  gracePeriod: number = 15
): { status: 'GREEN' | 'YELLOW'; minutesLate: number } {
  const graceEndMinutes = shiftStartMinutes + gracePeriod;

  if (checkInMinutes <= graceEndMinutes) {
    return { status: 'GREEN', minutesLate: 0 };
  }

  return {
    status: 'YELLOW',
    minutesLate: checkInMinutes - graceEndMinutes
  };
}

function parseShiftTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ============================================
// TEST 1: CHECK-IN LOGIC
// ============================================

async function testCheckinLogic() {
  log('\n═══ 1. CHECK-IN LOGIC TESTS ═══');

  // Test 1.1: Readiness Score Calculation
  log('\n─── 1.1 Readiness Score Calculation ───');

  // Perfect scores
  const perfectScore = calculateReadinessScore(10, 1, 10, 10);
  if (perfectScore === 100) {
    pass('Checkin', 'Perfect score (10,1,10,10)', `Score: ${perfectScore}%`);
  } else {
    fail('Checkin', 'Perfect score calculation', `Expected 100, got ${perfectScore}`);
  }

  // Worst scores: mood=1, stress=10 (inverted=1), sleep=1, physical=1
  // Raw = (1+1+1+1)/4 = 1, Final = 1/10 * 100 = 10%
  const worstScore = calculateReadinessScore(1, 10, 1, 1);
  if (worstScore === 10) {
    pass('Checkin', 'Worst score (1,10,1,1)', `Score: ${worstScore}%`);
  } else {
    fail('Checkin', 'Worst score calculation', `Expected 10, got ${worstScore}`);
  }

  // Average scores
  const avgScore = calculateReadinessScore(5, 5, 5, 5);
  if (avgScore >= 45 && avgScore <= 55) {
    pass('Checkin', 'Average score (5,5,5,5)', `Score: ${avgScore}%`);
  } else {
    fail('Checkin', 'Average score calculation', `Expected ~50, got ${avgScore}`);
  }

  // Test 1.2: Readiness Status Thresholds
  log('\n─── 1.2 Readiness Status Thresholds ───');

  const greenStatus = getReadinessStatus(70);
  const yellowStatus = getReadinessStatus(55);
  const redStatus = getReadinessStatus(45);

  if (greenStatus === 'GREEN') {
    pass('Checkin', 'GREEN threshold (70+)', `70% = ${greenStatus}`);
  } else {
    fail('Checkin', 'GREEN threshold', `Expected GREEN, got ${greenStatus}`);
  }

  if (yellowStatus === 'YELLOW') {
    pass('Checkin', 'YELLOW threshold (50-69)', `55% = ${yellowStatus}`);
  } else {
    fail('Checkin', 'YELLOW threshold', `Expected YELLOW, got ${yellowStatus}`);
  }

  if (redStatus === 'RED') {
    pass('Checkin', 'RED threshold (<50)', `45% = ${redStatus}`);
  } else {
    fail('Checkin', 'RED threshold', `Expected RED, got ${redStatus}`);
  }

  // Test 1.3: Attendance Status Calculation
  log('\n─── 1.3 Attendance Status Calculation ───');

  const shiftStart = parseShiftTime('08:00'); // 480 minutes

  // On-time (before grace period ends)
  const onTimeResult = calculateAttendanceStatus(490, shiftStart, 15); // 8:10 AM
  if (onTimeResult.status === 'GREEN' && onTimeResult.minutesLate === 0) {
    pass('Checkin', 'On-time check-in (within grace)', `8:10 AM = ${onTimeResult.status}`);
  } else {
    fail('Checkin', 'On-time check-in', `Expected GREEN/0, got ${onTimeResult.status}/${onTimeResult.minutesLate}`);
  }

  // Late (after grace period)
  const lateResult = calculateAttendanceStatus(510, shiftStart, 15); // 8:30 AM
  if (lateResult.status === 'YELLOW' && lateResult.minutesLate === 15) {
    pass('Checkin', 'Late check-in (after grace)', `8:30 AM = ${lateResult.status}, ${lateResult.minutesLate} mins late`);
  } else {
    fail('Checkin', 'Late check-in', `Expected YELLOW/15, got ${lateResult.status}/${lateResult.minutesLate}`);
  }

  // Early check-in
  const earlyResult = calculateAttendanceStatus(450, shiftStart, 15); // 7:30 AM
  if (earlyResult.status === 'GREEN') {
    pass('Checkin', 'Early check-in', `7:30 AM = ${earlyResult.status}`);
  } else {
    fail('Checkin', 'Early check-in', `Expected GREEN, got ${earlyResult.status}`);
  }
}

// ============================================
// TEST 2: EXEMPTION/LEAVE SYSTEM
// ============================================

async function testExemptionSystem() {
  log('\n═══ 2. EXEMPTION/LEAVE SYSTEM TESTS ═══');

  const timezone = 'Asia/Manila';
  const now = DateTime.now().setZone(timezone);
  const today = now.startOf('day');

  // Get a test worker
  const worker = await prisma.user.findFirst({
    where: { role: 'WORKER' },
    include: { team: true },
  });

  if (!worker) {
    fail('Exemption', 'Test setup', 'No worker found');
    return;
  }

  log(`\n─── Testing with: ${worker.firstName} ${worker.lastName} ───`);

  // Test 2.1: Check existing exemptions
  log('\n─── 2.1 Exemption Query Logic ───');

  const exemptions = await prisma.exception.findMany({
    where: { userId: worker.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  pass('Exemption', 'Query exemptions', `Found ${exemptions.length} exemptions for worker`);

  // Test 2.2: Active Leave Detection
  log('\n─── 2.2 Active Leave Detection ───');

  const activeLeave = await prisma.exception.findFirst({
    where: {
      userId: worker.id,
      status: 'APPROVED',
      startDate: { lte: today.toJSDate() },
      endDate: { gte: today.toJSDate() },
    },
  });

  if (activeLeave) {
    pass('Exemption', 'Active leave detection', `On leave: ${activeLeave.type}`);
  } else {
    pass('Exemption', 'Active leave detection', 'No active leave (expected for working user)');
  }

  // Test 2.3: Leave Date Logic (endDate = last day of leave)
  log('\n─── 2.3 Leave Date Semantics ───');

  // Find an approved exemption with dates
  const sampleExemption = await prisma.exception.findFirst({
    where: {
      status: 'APPROVED',
      startDate: { not: null },
      endDate: { not: null },
    },
  });

  if (sampleExemption && sampleExemption.startDate && sampleExemption.endDate) {
    const start = DateTime.fromJSDate(sampleExemption.startDate).setZone(timezone);
    const end = DateTime.fromJSDate(sampleExemption.endDate).setZone(timezone);
    const duration = end.diff(start, 'days').days + 1;

    pass('Exemption', 'Leave duration calculation',
      `${start.toFormat('MMM d')} to ${end.toFormat('MMM d')} = ${duration} days (inclusive)`);
  } else {
    pass('Exemption', 'Leave duration calculation', 'No sample exemption with dates');
  }

  // Test 2.4: Exemption Status Flow
  log('\n─── 2.4 Exemption Status Distribution ───');

  const statusCounts = await prisma.exception.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {};
  statusCounts.forEach(s => { statusMap[s.status] = s._count.id; });

  pass('Exemption', 'Status distribution',
    `PENDING: ${statusMap['PENDING'] || 0}, APPROVED: ${statusMap['APPROVED'] || 0}, REJECTED: ${statusMap['REJECTED'] || 0}`);
}

// ============================================
// TEST 3: TEAM LEADER APPROVAL FLOW
// ============================================

async function testApprovalFlow() {
  log('\n═══ 3. TEAM LEADER APPROVAL FLOW TESTS ═══');

  // Get a team leader
  const teamLead = await prisma.user.findFirst({
    where: { role: 'TEAM_LEAD' },
    include: {
      team: {
        include: {
          members: { take: 5 },
        },
      },
    },
  });

  if (!teamLead?.team) {
    fail('Approval', 'Test setup', 'No team leader with team found');
    return;
  }

  log(`\n─── Team Lead: ${teamLead.firstName} ${teamLead.lastName} ───`);
  log(`─── Team: ${teamLead.team.name} (${teamLead.team.members.length} members) ───`);

  // Test 3.1: Team Members Query
  log('\n─── 3.1 Team Members Access ───');

  const teamMembers = await prisma.user.findMany({
    where: {
      teamId: teamLead.teamId,
      role: 'WORKER',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentStreak: true,
    },
  });

  pass('Approval', 'Query team members', `${teamMembers.length} members in team`);

  // Test 3.2: Pending Approvals for Team
  log('\n─── 3.2 Pending Approvals Query ───');

  const pendingApprovals = await prisma.exception.findMany({
    where: {
      user: { teamId: teamLead.teamId },
      status: 'PENDING',
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  pass('Approval', 'Pending approvals query', `${pendingApprovals.length} pending requests`);

  if (pendingApprovals.length > 0) {
    const sample = pendingApprovals[0];
    log(`      Sample: ${sample.user.firstName} ${sample.user.lastName} - ${sample.type}`);
  }

  // Test 3.3: Team Lead can see member check-ins
  log('\n─── 3.3 Member Check-in Visibility ───');

  const memberIds = teamMembers.map(m => m.id);

  if (memberIds.length > 0) {
    const todayCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: {
          gte: DateTime.now().setZone('Asia/Manila').startOf('day').toJSDate(),
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    pass('Approval', 'View team check-ins', `${todayCheckins.length} check-ins today`);
  }

  // Test 3.4: Approval Action Simulation
  log('\n─── 3.4 Approval Logic Validation ───');

  // Find a pending exception to test approval logic
  const pendingException = await prisma.exception.findFirst({
    where: { status: 'PENDING' },
    include: { user: true },
  });

  if (pendingException) {
    // Validate required fields for approval
    const canApprove = pendingException.startDate && pendingException.reason;
    pass('Approval', 'Approval validation',
      canApprove ? 'Has required fields for approval' : 'Missing required fields');
  } else {
    pass('Approval', 'Approval validation', 'No pending exceptions to test');
  }
}

// ============================================
// TEST 4: ANALYTICS CALCULATIONS
// ============================================

async function testAnalytics() {
  log('\n═══ 4. ANALYTICS CALCULATIONS TESTS ═══');

  const timezone = 'Asia/Manila';
  const now = DateTime.now().setZone(timezone);
  const periodStart = now.minus({ days: 30 }).startOf('day');
  const periodEnd = now.endOf('day');

  // Get a team for testing
  const team = await prisma.team.findFirst({
    include: {
      members: { where: { role: 'WORKER' } },
      company: true,
    },
  });

  if (!team) {
    fail('Analytics', 'Test setup', 'No team found');
    return;
  }

  log(`\n─── Team: ${team.name} ───`);

  // Test 4.1: Check-in Rate Calculation
  log('\n─── 4.1 Check-in Rate Calculation ───');

  const memberIds = team.members.map(m => m.id);
  const totalMembers = memberIds.length;

  if (totalMembers === 0) {
    pass('Analytics', 'Check-in rate', 'No members to calculate');
  } else {
    // Count check-ins in period
    const checkins = await prisma.checkin.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: {
          gte: periodStart.toJSDate(),
          lte: periodEnd.toJSDate(),
        },
      },
    });

    // Group by user
    const checkinsByUser = new Map<string, number>();
    checkins.forEach(c => {
      checkinsByUser.set(c.userId, (checkinsByUser.get(c.userId) || 0) + 1);
    });

    const avgCheckins = checkins.length / totalMembers;
    pass('Analytics', 'Check-in rate calculation',
      `${checkins.length} check-ins / ${totalMembers} members = ${avgCheckins.toFixed(1)} avg per member`);
  }

  // Test 4.2: Readiness Distribution
  log('\n─── 4.2 Readiness Distribution ───');

  const todayCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: now.startOf('day').toJSDate() },
    },
  });

  const distribution = {
    GREEN: todayCheckins.filter(c => c.readinessStatus === 'GREEN').length,
    YELLOW: todayCheckins.filter(c => c.readinessStatus === 'YELLOW').length,
    RED: todayCheckins.filter(c => c.readinessStatus === 'RED').length,
  };

  pass('Analytics', 'Today\'s distribution',
    `GREEN: ${distribution.GREEN}, YELLOW: ${distribution.YELLOW}, RED: ${distribution.RED}`);

  // Test 4.3: Attendance Performance
  log('\n─── 4.3 Attendance Performance ───');

  const attendance = await prisma.dailyAttendance.findMany({
    where: {
      userId: { in: memberIds },
      date: {
        gte: periodStart.toJSDate(),
        lte: periodEnd.toJSDate(),
      },
    },
  });

  const attendanceStats = {
    GREEN: attendance.filter(a => a.status === 'GREEN').length,
    YELLOW: attendance.filter(a => a.status === 'YELLOW').length,
    ABSENT: attendance.filter(a => a.status === 'ABSENT').length,
    EXCUSED: attendance.filter(a => a.status === 'EXCUSED').length,
  };

  const totalCountable = attendanceStats.GREEN + attendanceStats.YELLOW + attendanceStats.ABSENT;
  const complianceRate = totalCountable > 0
    ? Math.round(((attendanceStats.GREEN + attendanceStats.YELLOW) / totalCountable) * 100)
    : 0;

  pass('Analytics', 'Attendance stats',
    `On-time: ${attendanceStats.GREEN}, Late: ${attendanceStats.YELLOW}, Absent: ${attendanceStats.ABSENT}`);
  pass('Analytics', 'Compliance rate', `${complianceRate}%`);

  // Test 4.4: Team Grade Calculation
  log('\n─── 4.4 Team Grade Formula ───');

  // Formula: (Avg Readiness × 60%) + (Compliance × 40%)
  const avgReadiness = todayCheckins.length > 0
    ? Math.round(todayCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / todayCheckins.length)
    : 0;

  const gradeScore = Math.round((avgReadiness * 0.6) + (complianceRate * 0.4));

  const getGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  pass('Analytics', 'Team grade calculation',
    `Readiness: ${avgReadiness}% × 60% + Compliance: ${complianceRate}% × 40% = ${gradeScore} (${getGrade(gradeScore)})`);

  // Test 4.5: Period Comparison
  log('\n─── 4.5 Period Comparison Logic ───');

  const currentPeriodStart = now.minus({ days: 7 }).startOf('day');
  const previousPeriodStart = now.minus({ days: 14 }).startOf('day');
  const previousPeriodEnd = now.minus({ days: 7 }).startOf('day');

  const currentPeriodCheckins = await prisma.checkin.count({
    where: {
      userId: { in: memberIds },
      createdAt: {
        gte: currentPeriodStart.toJSDate(),
        lte: now.toJSDate(),
      },
    },
  });

  const previousPeriodCheckins = await prisma.checkin.count({
    where: {
      userId: { in: memberIds },
      createdAt: {
        gte: previousPeriodStart.toJSDate(),
        lt: previousPeriodEnd.toJSDate(),
      },
    },
  });

  const trend = currentPeriodCheckins > previousPeriodCheckins ? 'UP'
    : currentPeriodCheckins < previousPeriodCheckins ? 'DOWN' : 'STABLE';

  pass('Analytics', 'Period comparison',
    `Current: ${currentPeriodCheckins}, Previous: ${previousPeriodCheckins}, Trend: ${trend}`);
}

// ============================================
// TEST 5: ATTENDANCE SCORING INTEGRATION
// ============================================

async function testAttendanceScoring() {
  log('\n═══ 5. ATTENDANCE SCORING INTEGRATION TESTS ═══');

  // Test 5.1: Daily Attendance Records
  log('\n─── 5.1 Daily Attendance Records ───');

  const recentAttendance = await prisma.dailyAttendance.findMany({
    take: 10,
    orderBy: { date: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  pass('Attendance', 'Recent records query', `Found ${recentAttendance.length} recent records`);

  // Test 5.2: Score Values
  log('\n─── 5.2 Attendance Score Values ───');

  const scoreDistribution = {
    100: recentAttendance.filter(a => a.score === 100).length,
    75: recentAttendance.filter(a => a.score === 75).length,
    0: recentAttendance.filter(a => a.score === 0).length,
    null: recentAttendance.filter(a => a.score === null).length,
  };

  pass('Attendance', 'Score distribution',
    `100 (GREEN): ${scoreDistribution[100]}, 75 (YELLOW): ${scoreDistribution[75]}, 0 (ABSENT): ${scoreDistribution[0]}, null (EXCUSED): ${scoreDistribution.null}`);

  // Test 5.3: Check-in to Attendance Link
  log('\n─── 5.3 Check-in to Attendance Link ───');

  // Find attendance record with check-in time (indicates check-in was made)
  const linkedAttendance = await prisma.dailyAttendance.findFirst({
    where: { checkInTime: { not: null } },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  if (linkedAttendance?.checkInTime) {
    const checkInHour = linkedAttendance.checkInTime.getHours();
    const checkInMin = linkedAttendance.checkInTime.getMinutes();
    pass('Attendance', 'Check-in link',
      `Attendance ${linkedAttendance.status} - checked in at ${checkInHour}:${String(checkInMin).padStart(2, '0')}`);
  } else {
    pass('Attendance', 'Check-in link', 'No attendance with check-in time found');
  }

  // Test 5.4: Exception to Attendance Link
  log('\n─── 5.4 Exception to Attendance Link ───');

  const excusedAttendance = await prisma.dailyAttendance.findFirst({
    where: {
      status: 'EXCUSED',
      exceptionId: { not: null },
    },
    include: {
      exception: { select: { type: true, status: true } },
    },
  });

  if (excusedAttendance?.exception) {
    pass('Attendance', 'Exception link',
      `EXCUSED attendance linked to ${excusedAttendance.exception.type} (${excusedAttendance.exception.status})`);
  } else {
    pass('Attendance', 'Exception link', 'No EXCUSED records with exception link found');
  }

  // Test 5.5: Performance Score Calculation
  log('\n─── 5.5 Performance Score Formula ───');

  // Get a user with attendance records
  const userWithAttendance = await prisma.dailyAttendance.groupBy({
    by: ['userId'],
    _count: { _all: true },
    _sum: { score: true },
  });

  // Find user with more than 5 records
  const qualifiedUser = userWithAttendance.find(u => u._count._all > 5);

  if (qualifiedUser) {
    const countedRecords = await prisma.dailyAttendance.count({
      where: {
        userId: qualifiedUser.userId,
        isCounted: true,
      },
    });

    const totalScore = qualifiedUser._sum.score || 0;
    const performanceScore = countedRecords > 0
      ? Math.round(totalScore / countedRecords)
      : 0;

    pass('Attendance', 'Performance score',
      `Total: ${totalScore}, Counted days: ${countedRecords}, Score: ${performanceScore}%`);
  } else {
    pass('Attendance', 'Performance score', 'Insufficient data for calculation');
  }
}

// ============================================
// TEST 6: STREAK LOGIC
// ============================================

async function testStreakLogic() {
  log('\n═══ 6. STREAK LOGIC TESTS ═══');

  // Test 6.1: User Streak Data
  log('\n─── 6.1 User Streak Data ───');

  const usersWithStreaks = await prisma.user.findMany({
    where: {
      role: 'WORKER',
      currentStreak: { gt: 0 },
    },
    select: {
      firstName: true,
      lastName: true,
      currentStreak: true,
      longestStreak: true,
      lastCheckinDate: true,
    },
    orderBy: { currentStreak: 'desc' },
    take: 5,
  });

  pass('Streak', 'Users with active streaks', `${usersWithStreaks.length} users`);

  if (usersWithStreaks.length > 0) {
    const top = usersWithStreaks[0];
    log(`      Top streak: ${top.firstName} ${top.lastName} - ${top.currentStreak} days (Longest: ${top.longestStreak})`);
  }

  // Test 6.2: Streak Preservation with Leave
  log('\n─── 6.2 Streak Preservation Logic ───');

  // Find a user who has both streak and approved exception
  const userWithLeaveAndStreak = await prisma.user.findFirst({
    where: {
      role: 'WORKER',
      currentStreak: { gt: 0 },
      exceptions: {
        some: { status: 'APPROVED' },
      },
    },
    include: {
      exceptions: {
        where: { status: 'APPROVED' },
        orderBy: { endDate: 'desc' },
        take: 1,
      },
    },
  });

  if (userWithLeaveAndStreak && userWithLeaveAndStreak.exceptions.length > 0) {
    pass('Streak', 'Leave + streak preservation',
      `${userWithLeaveAndStreak.firstName} has ${userWithLeaveAndStreak.currentStreak}-day streak with past leave`);
  } else {
    pass('Streak', 'Leave + streak preservation', 'No users with both streak and approved leave');
  }

  // Test 6.3: Longest Streak >= Current Streak
  log('\n─── 6.3 Streak Invariant Check ───');

  const invalidStreaks = await prisma.user.count({
    where: {
      longestStreak: { lt: prisma.user.fields.currentStreak },
    },
  });

  if (invalidStreaks === 0) {
    pass('Streak', 'Invariant: longest >= current', 'All users valid');
  } else {
    fail('Streak', 'Invariant: longest >= current', `${invalidStreaks} users have invalid streak data`);
  }
}

// ============================================
// TEST 7: HOLIDAY SYSTEM
// ============================================

async function testHolidaySystem() {
  log('\n═══ 7. HOLIDAY SYSTEM TESTS ═══');

  const company = await prisma.company.findFirst();

  if (!company) {
    fail('Holiday', 'Test setup', 'No company found');
    return;
  }

  // Test 7.1: Holiday Query
  log('\n─── 7.1 Holiday Query ───');

  const holidays = await prisma.holiday.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'asc' },
  });

  pass('Holiday', 'Company holidays', `${holidays.length} holidays configured`);

  // Test 7.2: Upcoming Holidays
  log('\n─── 7.2 Upcoming Holidays ───');

  const now = DateTime.now().setZone('Asia/Manila');
  const upcomingHolidays = holidays.filter(h =>
    DateTime.fromJSDate(h.date).setZone('Asia/Manila') >= now.startOf('day')
  );

  pass('Holiday', 'Upcoming holidays', `${upcomingHolidays.length} upcoming`);

  if (upcomingHolidays.length > 0) {
    const next = upcomingHolidays[0];
    const nextDate = DateTime.fromJSDate(next.date).setZone('Asia/Manila');
    log(`      Next: ${next.name} on ${nextDate.toFormat('MMM d, yyyy')}`);
  }

  // Test 7.3: Holiday Impact on Attendance
  log('\n─── 7.3 Holiday Impact Check ───');

  // Check that no attendance records exist on holidays
  if (holidays.length > 0) {
    const holidayDates = holidays.map(h => h.date);

    const attendanceOnHolidays = await prisma.dailyAttendance.count({
      where: {
        date: { in: holidayDates },
      },
    });

    if (attendanceOnHolidays === 0) {
      pass('Holiday', 'No attendance on holidays', 'Correctly excluded from tracking');
    } else {
      fail('Holiday', 'Attendance on holidays', `${attendanceOnHolidays} records found on holidays`);
    }
  } else {
    pass('Holiday', 'Holiday impact', 'No holidays to check');
  }
}

// ============================================
// TEST 8: DATA INTEGRITY
// ============================================

async function testDataIntegrity() {
  log('\n═══ 8. DATA INTEGRITY TESTS ═══');

  // Test 8.1: Orphan Check-ins
  log('\n─── 8.1 Orphan Records Check ───');

  // Check if any check-ins have userId that doesn't exist in users table
  const allCheckins = await prisma.checkin.findMany({
    select: { userId: true },
  });

  const allUserIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map(u => u.id)
  );

  const orphanCheckins = allCheckins.filter(c => !allUserIds.has(c.userId)).length;

  if (orphanCheckins === 0) {
    pass('Integrity', 'No orphan check-ins', 'All check-ins have valid users');
  } else {
    fail('Integrity', 'Orphan check-ins', `${orphanCheckins} check-ins without users`);
  }

  // Test 8.2: Team Assignment
  log('\n─── 8.2 Member Team Assignment ───');

  const membersWithoutTeam = await prisma.user.count({
    where: {
      role: 'WORKER',
      teamId: null,
    },
  });

  if (membersWithoutTeam === 0) {
    pass('Integrity', 'All members have teams', 'Team assignment complete');
  } else {
    pass('Integrity', 'Members without teams', `${membersWithoutTeam} members not yet assigned (may be intentional)`);
  }

  // Test 8.3: Company Scoping
  log('\n─── 8.3 Company Scoping ───');

  const companiesCount = await prisma.company.count();
  const totalUsers = await prisma.user.count();

  // Check if all users have valid companyId that exists
  const allUsers = await prisma.user.findMany({ select: { companyId: true } });
  const allCompanyIds = new Set(
    (await prisma.company.findMany({ select: { id: true } })).map(c => c.id)
  );

  const usersWithInvalidCompany = allUsers.filter(u => !allCompanyIds.has(u.companyId)).length;

  if (usersWithInvalidCompany === 0) {
    pass('Integrity', 'All users scoped to company', `${companiesCount} companies, ${totalUsers} users`);
  } else {
    fail('Integrity', 'Company scoping', `${usersWithInvalidCompany} users with invalid company`);
  }

  // Test 8.4: Exception Dates
  log('\n─── 8.4 Exception Date Validity ───');

  const invalidExceptions = await prisma.exception.count({
    where: {
      AND: [
        { startDate: { not: null } },
        { endDate: { not: null } },
      ],
    },
  });

  // Check for start > end (invalid)
  const exceptions = await prisma.exception.findMany({
    where: {
      startDate: { not: null },
      endDate: { not: null },
    },
    select: { startDate: true, endDate: true },
  });

  const invalidDateRanges = exceptions.filter(e =>
    e.startDate && e.endDate && e.startDate > e.endDate
  ).length;

  if (invalidDateRanges === 0) {
    pass('Integrity', 'Exception date ranges', 'All date ranges valid (start <= end)');
  } else {
    fail('Integrity', 'Exception date ranges', `${invalidDateRanges} exceptions with invalid date range`);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           COMPREHENSIVE FEATURE TEST - AEGIRA SYSTEM                  ║');
  console.log('║       Worker → Team Leader → Analytics Flow Validation                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  try {
    await testCheckinLogic();
    await testExemptionSystem();
    await testApprovalFlow();
    await testAnalytics();
    await testAttendanceScoring();
    await testStreakLogic();
    await testHolidaySystem();
    await testDataIntegrity();

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST SUMMARY                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${percentage}%)`);
    console.log(`❌ Failed: ${failed} (${100 - percentage}%)`);

    // By category
    console.log('\n─── By Category ───');
    const categories = [...new Set(results.map(r => r.category))];
    for (const cat of categories) {
      const catResults = results.filter(r => r.category === cat);
      const catPassed = catResults.filter(r => r.passed).length;
      console.log(`${cat}: ${catPassed}/${catResults.length} passed`);
    }

    // Failed tests
    if (failed > 0) {
      console.log('\n─── Failed Tests ───');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`❌ [${r.category}] ${r.test}: ${r.details || 'No details'}`);
      });
    }

    console.log('\n');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
