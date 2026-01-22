/**
 * Seed Mock Check-in Data Script
 *
 * Creates 2 months of realistic check-in data for testing the metrics-only system.
 *
 * Usage: npx tsx scripts/seed-mock-checkins.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

// Default timezone
const TIMEZONE = 'Asia/Manila';

// Helper to generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to generate realistic metrics
function generateMetrics() {
  // Generate correlated metrics (sleep affects other metrics)
  const sleep = randomInRange(3, 10);
  const sleepBonus = sleep >= 7 ? 1 : sleep >= 5 ? 0 : -1;

  const mood = Math.min(10, Math.max(1, randomInRange(4, 9) + sleepBonus));
  const stress = Math.min(10, Math.max(1, randomInRange(2, 8) - sleepBonus)); // Lower is better
  const physicalHealth = Math.min(10, Math.max(1, randomInRange(5, 9) + sleepBonus));

  // Calculate readiness score (weighted average)
  const moodWeight = 0.25;
  const stressWeight = 0.25;
  const sleepWeight = 0.30;
  const physicalWeight = 0.20;

  const normalizedStress = 11 - stress; // Invert stress (10 becomes 1, 1 becomes 10)
  const readinessScore = Math.round(
    (mood * moodWeight + normalizedStress * stressWeight + sleep * sleepWeight + physicalHealth * physicalWeight) * 10
  );

  // Determine status based on score
  let readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  if (readinessScore >= 70) {
    readinessStatus = 'GREEN';
  } else if (readinessScore >= 40) {
    readinessStatus = 'YELLOW';
  } else {
    readinessStatus = 'RED';
  }

  return {
    mood,
    stress,
    sleep,
    physicalHealth,
    readinessScore,
    readinessStatus,
  };
}

// Helper to check if date is a work day
function isWorkDay(date: DateTime, workDays: string[]): boolean {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[date.weekday % 7]; // Luxon weekday: 1=Mon, 7=Sun
  const adjustedDayName = dayNames[date.weekday === 7 ? 0 : date.weekday];
  return workDays.includes(adjustedDayName);
}

async function main() {
  console.log('🚀 Starting mock check-in data seed...\n');

  // Get all active teams with their members
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true, role: 'WORKER' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          teamJoinedAt: true,
          createdAt: true,
        },
      },
      company: {
        select: {
          timezone: true,
        },
      },
    },
  });

  if (teams.length === 0) {
    console.log('❌ No active teams found. Please create teams first.');
    return;
  }

  console.log(`📋 Found ${teams.length} active teams\n`);

  // Calculate date range (2 months back to today)
  const now = DateTime.now().setZone(TIMEZONE);
  const startDate = now.minus({ months: 2 }).startOf('day');
  const endDate = now.startOf('day');

  console.log(`📅 Date range: ${startDate.toISODate()} to ${endDate.toISODate()}\n`);

  let totalCheckinsCreated = 0;
  let totalAttendanceCreated = 0;
  let totalSummariesCreated = 0;

  for (const team of teams) {
    const timezone = team.company?.timezone || TIMEZONE;
    const workDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

    console.log(`\n👥 Processing team: ${team.name}`);
    console.log(`   Work days: ${workDays.join(', ')}`);
    console.log(`   Members: ${team.members.length}`);

    if (team.members.length === 0) {
      console.log('   ⚠️ No workers in this team, skipping...');
      continue;
    }

    // Get existing check-ins to avoid duplicates
    const existingCheckins = await prisma.checkin.findMany({
      where: {
        userId: { in: team.members.map(m => m.id) },
        createdAt: { gte: startDate.toJSDate(), lte: endDate.toJSDate() },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    });

    // Build set of existing checkin dates per user
    const existingCheckinDates = new Map<string, Set<string>>();
    for (const checkin of existingCheckins) {
      const dateStr = DateTime.fromJSDate(checkin.createdAt).setZone(timezone).toISODate();
      if (!existingCheckinDates.has(checkin.userId)) {
        existingCheckinDates.set(checkin.userId, new Set());
      }
      existingCheckinDates.get(checkin.userId)!.add(dateStr!);
    }

    // Get holidays for the company
    const holidays = await prisma.holiday.findMany({
      where: {
        companyId: team.companyId,
        date: { gte: startDate.toJSDate(), lte: endDate.toJSDate() },
      },
      select: { date: true },
    });
    const holidayDates = new Set(holidays.map(h => DateTime.fromJSDate(h.date).setZone(timezone).toISODate()));

    // Get exemptions for team members
    const exemptions = await prisma.exception.findMany({
      where: {
        userId: { in: team.members.map(m => m.id) },
        status: 'APPROVED',
        startDate: { lte: endDate.toJSDate() },
        endDate: { gte: startDate.toJSDate() },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
      },
    });

    // Build exemption map
    const userExemptions = new Map<string, Array<{ start: string; end: string }>>();
    for (const ex of exemptions) {
      if (!ex.startDate || !ex.endDate) continue;
      const exStart = DateTime.fromJSDate(ex.startDate).setZone(timezone).toISODate()!;
      const exEnd = DateTime.fromJSDate(ex.endDate).setZone(timezone).toISODate()!;
      if (!userExemptions.has(ex.userId)) {
        userExemptions.set(ex.userId, []);
      }
      userExemptions.get(ex.userId)!.push({ start: exStart, end: exEnd });
    }

    // Helper to check if date is exempted for user
    const isExempted = (userId: string, dateStr: string): boolean => {
      const exempts = userExemptions.get(userId) || [];
      return exempts.some(ex => dateStr >= ex.start && dateStr <= ex.end);
    };

    // Process each day in the range
    let currentDate = startDate;
    const checkinsToCreate: any[] = [];
    const attendanceToCreate: any[] = [];
    const dailySummaryData = new Map<string, {
      checkedIn: number;
      notCheckedIn: number;
      greenCount: number;
      yellowCount: number;
      redCount: number;
      totalScore: number;
      onLeave: number;
    }>();

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISODate()!;
      const isHoliday = holidayDates.has(dateStr);
      const isWork = isWorkDay(currentDate, workDays);

      if (!dailySummaryData.has(dateStr)) {
        dailySummaryData.set(dateStr, {
          checkedIn: 0,
          notCheckedIn: 0,
          greenCount: 0,
          yellowCount: 0,
          redCount: 0,
          totalScore: 0,
          onLeave: 0,
        });
      }

      if (isWork && !isHoliday) {
        for (const member of team.members) {
          // Check if member had joined by this date
          const memberJoinDate = member.teamJoinedAt || member.createdAt;
          const joinDateStr = DateTime.fromJSDate(memberJoinDate).setZone(timezone).toISODate()!;
          if (dateStr < joinDateStr) continue;

          // Check if already has check-in for this date
          const userDates = existingCheckinDates.get(member.id) || new Set();
          if (userDates.has(dateStr)) continue;

          // Check if exempted
          if (isExempted(member.id, dateStr)) {
            dailySummaryData.get(dateStr)!.onLeave++;
            continue;
          }

          // Random chance of checking in (90% on weekdays, higher reliability for better data)
          const checksIn = Math.random() < 0.90;

          if (checksIn) {
            const metrics = generateMetrics();

            // Generate check-in time within shift hours (add some variance)
            const shiftStartHour = parseInt(team.shiftStart.split(':')[0]);
            const shiftStartMin = parseInt(team.shiftStart.split(':')[1]);
            const checkinHour = shiftStartHour + randomInRange(0, 2);
            const checkinMin = randomInRange(0, 59);

            const checkinTime = currentDate.set({
              hour: checkinHour,
              minute: checkinMin,
              second: randomInRange(0, 59),
            });

            checkinsToCreate.push({
              userId: member.id,
              companyId: team.companyId,
              ...metrics,
              notes: null,
              lowScoreReason: metrics.readinessScore < 50 ? 'POOR_SLEEP' : null,
              lowScoreDetails: metrics.readinessScore < 50 ? 'Feeling tired today' : null,
              createdAt: checkinTime.toJSDate(),
            });

            // Update summary data
            const summary = dailySummaryData.get(dateStr)!;
            summary.checkedIn++;
            summary.totalScore += metrics.readinessScore;
            if (metrics.readinessStatus === 'GREEN') summary.greenCount++;
            else if (metrics.readinessStatus === 'YELLOW') summary.yellowCount++;
            else summary.redCount++;

            // Create attendance record
            attendanceToCreate.push({
              userId: member.id,
              teamId: team.id,
              companyId: team.companyId,
              date: currentDate.toJSDate(),
              scheduledStart: team.shiftStart,
              checkInTime: checkinTime.toJSDate(),
              status: 'GREEN',
              score: 100,
              isCounted: true,
              createdAt: checkinTime.toJSDate(),
            });
          } else {
            // No check-in = ABSENT
            dailySummaryData.get(dateStr)!.notCheckedIn++;

            attendanceToCreate.push({
              userId: member.id,
              teamId: team.id,
              companyId: team.companyId,
              date: currentDate.toJSDate(),
              scheduledStart: team.shiftStart,
              checkInTime: null,
              status: 'ABSENT',
              score: 0,
              isCounted: true,
              createdAt: currentDate.set({ hour: 23, minute: 59 }).toJSDate(),
            });
          }
        }
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    // Batch insert check-ins
    if (checkinsToCreate.length > 0) {
      await prisma.checkin.createMany({
        data: checkinsToCreate,
        skipDuplicates: true,
      });
      totalCheckinsCreated += checkinsToCreate.length;
      console.log(`   ✅ Created ${checkinsToCreate.length} check-ins`);
    }

    // Batch insert attendance records (skip duplicates based on unique constraint)
    if (attendanceToCreate.length > 0) {
      try {
        await prisma.dailyAttendance.createMany({
          data: attendanceToCreate,
          skipDuplicates: true,
        });
        totalAttendanceCreated += attendanceToCreate.length;
        console.log(`   ✅ Created ${attendanceToCreate.length} attendance records`);
      } catch (e) {
        console.log(`   ⚠️ Some attendance records already exist, skipping duplicates`);
      }
    }

    // Create daily team summaries
    const summariesToCreate: any[] = [];
    for (const [dateStr, data] of dailySummaryData) {
      const date = DateTime.fromISO(dateStr, { zone: timezone });
      const isHoliday = holidayDates.has(dateStr);
      const isWork = isWorkDay(date, workDays);

      const totalMembers = team.members.length;
      const expectedToCheckIn = Math.max(0, totalMembers - data.onLeave);
      const avgScore = data.checkedIn > 0 ? Math.round(data.totalScore / data.checkedIn) : null;
      const complianceRate = expectedToCheckIn > 0 ? Math.round((data.checkedIn / expectedToCheckIn) * 100) : null;

      summariesToCreate.push({
        teamId: team.id,
        companyId: team.companyId,
        date: date.set({ hour: 12 }).toJSDate(), // Noon UTC for DB date
        isWorkDay: isWork,
        isHoliday,
        totalMembers,
        onLeaveCount: data.onLeave,
        expectedToCheckIn,
        checkedInCount: data.checkedIn,
        notCheckedInCount: data.notCheckedIn,
        greenCount: data.greenCount,
        yellowCount: data.yellowCount,
        redCount: data.redCount,
        absentCount: data.notCheckedIn,
        excusedCount: data.onLeave,
        avgReadinessScore: avgScore,
        complianceRate,
        createdAt: date.endOf('day').toJSDate(),
      });
    }

    if (summariesToCreate.length > 0) {
      try {
        await prisma.dailyTeamSummary.createMany({
          data: summariesToCreate,
          skipDuplicates: true,
        });
        totalSummariesCreated += summariesToCreate.length;
        console.log(`   ✅ Created ${summariesToCreate.length} daily summaries`);
      } catch (e) {
        console.log(`   ⚠️ Some summaries already exist, skipping duplicates`);
      }
    }
  }

  // =============================================
  // UPDATE USER STATS FROM CHECKIN DATA
  // =============================================
  console.log('\n📊 Updating user stats from check-in data...');

  // Get all workers that had check-ins created
  const allMemberIds = teams.flatMap(t => t.members.map(m => m.id));
  const uniqueMemberIds = [...new Set(allMemberIds)];

  let usersUpdated = 0;
  for (const userId of uniqueMemberIds) {
    // Get actual check-in stats from Checkin table
    const stats = await prisma.checkin.aggregate({
      where: { userId },
      _count: { id: true },
      _avg: { readinessScore: true },
    });

    // Get last check-in for lastReadinessStatus
    const lastCheckin = await prisma.checkin.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { readinessStatus: true, createdAt: true },
    });

    if (stats._count.id > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalCheckins: stats._count.id,
          avgReadinessScore: stats._avg.readinessScore
            ? Math.round(stats._avg.readinessScore * 100) / 100
            : null,
          lastReadinessStatus: lastCheckin?.readinessStatus || null,
          lastCheckinDate: lastCheckin?.createdAt || null,
        },
      });
      usersUpdated++;
    }
  }

  console.log(`   ✅ Updated stats for ${usersUpdated} users`);

  console.log('\n' + '='.repeat(50));
  console.log('📊 SEED COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Total check-ins created: ${totalCheckinsCreated}`);
  console.log(`✅ Total attendance records: ${totalAttendanceCreated}`);
  console.log(`✅ Total daily summaries: ${totalSummariesCreated}`);
  console.log(`✅ Total user stats updated: ${usersUpdated}`);
  console.log('='.repeat(50) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
