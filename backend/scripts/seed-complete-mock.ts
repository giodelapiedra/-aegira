/**
 * Complete Mock Data Seed Script
 *
 * Creates:
 * - 1 Company
 * - 2 Teams with different schedules
 * - 1 Admin, 2 Team Leads, 10 Workers
 * - 2 months of realistic check-in data
 * - Holidays, exemptions, daily summaries
 *
 * Usage: npx tsx scripts/seed-complete-mock.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Default timezone
const TIMEZONE = 'Asia/Manila';

// Helper to generate UUID
function uuid(): string {
  return crypto.randomUUID();
}


// Helper to generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to generate realistic metrics
function generateMetrics() {
  const sleep = randomInRange(3, 10);
  const sleepBonus = sleep >= 7 ? 1 : sleep >= 5 ? 0 : -1;

  const mood = Math.min(10, Math.max(1, randomInRange(4, 9) + sleepBonus));
  const stress = Math.min(10, Math.max(1, randomInRange(2, 8) - sleepBonus));
  const physicalHealth = Math.min(10, Math.max(1, randomInRange(5, 9) + sleepBonus));

  const moodWeight = 0.25;
  const stressWeight = 0.25;
  const sleepWeight = 0.30;
  const physicalWeight = 0.20;

  const normalizedStress = 11 - stress;
  const readinessScore = Math.round(
    (mood * moodWeight + normalizedStress * stressWeight + sleep * sleepWeight + physicalHealth * physicalWeight) * 10
  );

  let readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  if (readinessScore >= 70) {
    readinessStatus = 'GREEN';
  } else if (readinessScore >= 40) {
    readinessStatus = 'YELLOW';
  } else {
    readinessStatus = 'RED';
  }

  return { mood, stress, sleep, physicalHealth, readinessScore, readinessStatus };
}

// Helper to check if date is a work day
function isWorkDay(date: DateTime, workDays: string[]): boolean {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const luxonDay = date.weekday; // 1=Mon, 7=Sun
  const jsDay = luxonDay === 7 ? 0 : luxonDay;
  return workDays.includes(dayNames[jsDay]);
}

async function main() {
  console.log('🚀 Starting complete mock data seed...\n');

  // =============================================
  // 0. CLEANUP EXISTING DATA
  // =============================================
  console.log('🧹 Cleaning up existing data...');

  // Delete in order of dependencies
  await prisma.dailyTeamSummary.deleteMany({});
  await prisma.dailyAttendance.deleteMany({});
  await prisma.checkin.deleteMany({});
  await prisma.exception.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.company.deleteMany({});
  console.log('   ✅ Cleaned up existing data\n');

  // =============================================
  // 1. CREATE COMPANY
  // =============================================
  console.log('📦 Creating company...');
  const companyId = uuid();
  await prisma.company.create({
    data: {
      id: companyId,
      name: 'Aegira Demo Corp',
      slug: 'aegira-demo-corp',
      timezone: TIMEZONE,
      createdAt: DateTime.now().minus({ months: 6 }).toJSDate(),
    },
  });
  console.log(`   ✅ Created company: Aegira Demo Corp\n`);

  // =============================================
  // 2. CREATE USERS
  // =============================================
  console.log('👥 Creating users...');

  // Admin user
  const adminId = uuid();
  await prisma.user.create({
    data: {
      id: adminId,
      email: 'admin@aegira.demo',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      companyId,
      isActive: true,
    },
  });
  console.log('   ✅ Created Admin: admin@aegira.demo');

  // Team Leads
  const teamLeadIds: string[] = [];
  const teamLeadNames = [
    { first: 'Maria', last: 'Santos', email: 'maria.santos@aegira.demo' },
    { first: 'Juan', last: 'Cruz', email: 'juan.cruz@aegira.demo' },
  ];

  for (const tl of teamLeadNames) {
    const id = uuid();
    teamLeadIds.push(id);
    await prisma.user.create({
      data: {
        id,
        email: tl.email,
                firstName: tl.first,
        lastName: tl.last,
        role: 'TEAM_LEAD',
        companyId,
        isActive: true,
      },
    });
    console.log(`   ✅ Created Team Lead: ${tl.first} ${tl.last}`);
  }

  // Workers
  const workerNames = [
    { first: 'Ana', last: 'Garcia' },
    { first: 'Pedro', last: 'Reyes' },
    { first: 'Rosa', last: 'Mendoza' },
    { first: 'Carlos', last: 'Dela Cruz' },
    { first: 'Elena', last: 'Villanueva' },
    { first: 'Miguel', last: 'Ramos' },
    { first: 'Sofia', last: 'Fernandez' },
    { first: 'Antonio', last: 'Lopez' },
    { first: 'Isabella', last: 'Martinez' },
    { first: 'Luis', last: 'Gonzales' },
  ];

  const workerIds: string[] = [];
  for (const w of workerNames) {
    const id = uuid();
    workerIds.push(id);
    await prisma.user.create({
      data: {
        id,
        email: `${w.first.toLowerCase()}.${w.last.toLowerCase()}@aegira.demo`,
                firstName: w.first,
        lastName: w.last,
        role: 'WORKER',
        companyId,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ Created ${workerNames.length} workers\n`);

  // =============================================
  // 3. CREATE TEAMS
  // =============================================
  console.log('🏢 Creating teams...');

  const teamCreatedAt = DateTime.now().minus({ months: 3 }).toJSDate();

  // Team Alpha - Morning shift, Mon-Fri
  const teamAlphaId = uuid();
  await prisma.team.create({
    data: {
      id: teamAlphaId,
      name: 'Team Alpha',
      companyId,
      leaderId: teamLeadIds[0],
      workDays: 'MON,TUE,WED,THU,FRI',
      shiftStart: '08:00',
      shiftEnd: '17:00',
      isActive: true,
      createdAt: teamCreatedAt,
    },
  });
  console.log('   ✅ Created Team Alpha (Mon-Fri, 8AM-5PM)');

  // Team Beta - Afternoon shift, Mon-Sat
  const teamBetaId = uuid();
  await prisma.team.create({
    data: {
      id: teamBetaId,
      name: 'Team Beta',
      companyId,
      leaderId: teamLeadIds[1],
      workDays: 'MON,TUE,WED,THU,FRI,SAT',
      shiftStart: '14:00',
      shiftEnd: '22:00',
      isActive: true,
      createdAt: teamCreatedAt,
    },
  });
  console.log('   ✅ Created Team Beta (Mon-Sat, 2PM-10PM)\n');

  // =============================================
  // 4. ASSIGN WORKERS TO TEAMS
  // =============================================
  console.log('🔗 Assigning workers to teams...');

  const memberJoinedAt = DateTime.now().minus({ months: 2, weeks: 2 }).toJSDate();

  // First 5 workers to Team Alpha
  for (let i = 0; i < 5; i++) {
    await prisma.user.update({
      where: { id: workerIds[i] },
      data: { teamId: teamAlphaId, teamJoinedAt: memberJoinedAt },
    });
  }
  console.log('   ✅ Assigned 5 workers to Team Alpha');

  // Next 5 workers to Team Beta
  for (let i = 5; i < 10; i++) {
    await prisma.user.update({
      where: { id: workerIds[i] },
      data: { teamId: teamBetaId, teamJoinedAt: memberJoinedAt },
    });
  }
  console.log('   ✅ Assigned 5 workers to Team Beta\n');

  // =============================================
  // 5. CREATE HOLIDAYS
  // =============================================
  console.log('🎉 Creating holidays...');

  const holidays = [
    { date: '2024-12-25', name: 'Christmas Day' },
    { date: '2024-12-30', name: 'Rizal Day' },
    { date: '2024-12-31', name: "New Year's Eve" },
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-01-29', name: 'Chinese New Year' },
  ];

  for (const h of holidays) {
    await prisma.holiday.create({
      data: {
        id: uuid(),
        companyId,
        date: DateTime.fromISO(h.date, { zone: TIMEZONE }).set({ hour: 12 }).toJSDate(),
        name: h.name,
        createdBy: adminId,
      },
    });
  }
  console.log(`   ✅ Created ${holidays.length} holidays\n`);

  // =============================================
  // 6. CREATE EXEMPTIONS (Some workers on leave)
  // =============================================
  console.log('📋 Creating exemptions...');

  // One worker from each team with approved leave
  const exemptionStartDate = DateTime.now().minus({ weeks: 1 }).toJSDate();
  const exemptionEndDate = DateTime.now().plus({ days: 3 }).toJSDate();

  await prisma.exception.create({
    data: {
      id: uuid(),
      userId: workerIds[0], // Ana Garcia - Team Alpha
      companyId,
      isExemption: true,
      type: 'PERSONAL_LEAVE',
      status: 'APPROVED',
      reason: 'Family vacation',
      startDate: exemptionStartDate,
      endDate: exemptionEndDate,
      approvedBy: teamLeadIds[0],
      approvedAt: exemptionStartDate,
    },
  });

  await prisma.exception.create({
    data: {
      id: uuid(),
      userId: workerIds[5], // Miguel Ramos - Team Beta
      companyId,
      isExemption: true,
      type: 'MEDICAL_APPOINTMENT',
      status: 'APPROVED',
      reason: 'Medical appointment',
      startDate: DateTime.now().minus({ days: 3 }).toJSDate(),
      endDate: DateTime.now().minus({ days: 1 }).toJSDate(),
      approvedBy: teamLeadIds[1],
      approvedAt: DateTime.now().minus({ days: 3 }).toJSDate(),
    },
  });
  console.log('   ✅ Created 2 approved exemptions\n');

  // =============================================
  // 7. CREATE CHECK-INS (2 months of data)
  // =============================================
  console.log('📝 Creating check-in data (2 months)...');

  const now = DateTime.now().setZone(TIMEZONE);
  const startDate = now.minus({ months: 2 }).startOf('day');
  const endDate = now.startOf('day');

  // Get holiday dates
  const holidayDates = new Set(holidays.map(h => h.date));

  // Get exemptions
  const exemptions = await prisma.exception.findMany({
    where: { status: 'APPROVED' },
    select: { userId: true, startDate: true, endDate: true },
  });

  const isExempted = (userId: string, dateStr: string): boolean => {
    return exemptions.some(ex => {
      if (ex.userId !== userId || !ex.startDate || !ex.endDate) return false;
      const start = DateTime.fromJSDate(ex.startDate).setZone(TIMEZONE).toISODate();
      const end = DateTime.fromJSDate(ex.endDate).setZone(TIMEZONE).toISODate();
      return dateStr >= start! && dateStr <= end!;
    });
  };

  const teams = [
    { id: teamAlphaId, workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], shiftStart: '08:00', workers: workerIds.slice(0, 5) },
    { id: teamBetaId, workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], shiftStart: '14:00', workers: workerIds.slice(5, 10) },
  ];

  let totalCheckins = 0;
  let totalAttendance = 0;

  for (const team of teams) {
    const checkinsToCreate: any[] = [];
    const attendanceToCreate: any[] = [];

    let currentDate = startDate;
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISODate()!;
      const isHoliday = holidayDates.has(dateStr);
      const isWork = isWorkDay(currentDate, team.workDays);

      if (isWork && !isHoliday) {
        for (const workerId of team.workers) {
          // Skip if exempted
          if (isExempted(workerId, dateStr)) continue;

          // 88% chance of checking in
          const checksIn = Math.random() < 0.88;

          if (checksIn) {
            const metrics = generateMetrics();
            const shiftHour = parseInt(team.shiftStart.split(':')[0]);
            const checkinHour = shiftHour + randomInRange(0, 1);
            const checkinMin = randomInRange(0, 45);

            const checkinTime = currentDate.set({
              hour: checkinHour,
              minute: checkinMin,
              second: randomInRange(0, 59),
            });

            checkinsToCreate.push({
              id: uuid(),
              userId: workerId,
              companyId,
              ...metrics,
              createdAt: checkinTime.toJSDate(),
            });

            attendanceToCreate.push({
              id: uuid(),
              userId: workerId,
              teamId: team.id,
              companyId,
              date: currentDate.set({ hour: 12 }).toJSDate(),
              scheduledStart: team.shiftStart,
              checkInTime: checkinTime.toJSDate(),
              status: 'GREEN',
              score: 100,
              isCounted: true,
              createdAt: checkinTime.toJSDate(),
            });
          } else {
            // No check-in = ABSENT
            attendanceToCreate.push({
              id: uuid(),
              userId: workerId,
              teamId: team.id,
              companyId,
              date: currentDate.set({ hour: 12 }).toJSDate(),
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

    // Batch insert
    if (checkinsToCreate.length > 0) {
      await prisma.checkin.createMany({ data: checkinsToCreate });
      totalCheckins += checkinsToCreate.length;
    }

    if (attendanceToCreate.length > 0) {
      await prisma.dailyAttendance.createMany({ data: attendanceToCreate });
      totalAttendance += attendanceToCreate.length;
    }
  }

  console.log(`   ✅ Created ${totalCheckins} check-ins`);
  console.log(`   ✅ Created ${totalAttendance} attendance records\n`);

  // =============================================
  // 8. CREATE DAILY TEAM SUMMARIES
  // =============================================
  console.log('📊 Creating daily team summaries...');

  let totalSummaries = 0;

  for (const team of teams) {
    const summariesToCreate: any[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISODate()!;
      const isHoliday = holidayDates.has(dateStr);
      const isWork = isWorkDay(currentDate, team.workDays);

      // Count check-ins for this date
      const dayStart = currentDate.startOf('day').toJSDate();
      const dayEnd = currentDate.endOf('day').toJSDate();

      const checkins = await prisma.checkin.findMany({
        where: {
          userId: { in: team.workers },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { readinessScore: true, readinessStatus: true },
      });

      const exemptedCount = team.workers.filter(w => isExempted(w, dateStr)).length;
      const totalMembers = team.workers.length;
      const expectedToCheckIn = Math.max(0, totalMembers - exemptedCount);
      const checkedInCount = checkins.length;
      const notCheckedInCount = Math.max(0, expectedToCheckIn - checkedInCount);
      const greenCount = checkins.filter(c => c.readinessStatus === 'GREEN').length;
      const yellowCount = checkins.filter(c => c.readinessStatus === 'YELLOW').length;
      const redCount = checkins.filter(c => c.readinessStatus === 'RED').length;
      const totalScore = checkins.reduce((sum, c) => sum + c.readinessScore, 0);
      const avgScore = checkedInCount > 0 ? Math.round(totalScore / checkedInCount) : null;
      const complianceRate = expectedToCheckIn > 0 ? Math.round((checkedInCount / expectedToCheckIn) * 100) : null;

      summariesToCreate.push({
        id: uuid(),
        teamId: team.id,
        companyId,
        date: currentDate.set({ hour: 12 }).toJSDate(),
        isWorkDay: isWork && !isHoliday,
        isHoliday,
        totalMembers,
        onLeaveCount: exemptedCount,
        expectedToCheckIn,
        checkedInCount,
        notCheckedInCount,
        greenCount,
        yellowCount,
        redCount,
        absentCount: notCheckedInCount,
        excusedCount: exemptedCount,
        avgReadinessScore: avgScore,
        complianceRate,
        createdAt: currentDate.endOf('day').toJSDate(),
      });

      currentDate = currentDate.plus({ days: 1 });
    }

    if (summariesToCreate.length > 0) {
      await prisma.dailyTeamSummary.createMany({ data: summariesToCreate });
      totalSummaries += summariesToCreate.length;
    }
  }

  console.log(`   ✅ Created ${totalSummaries} daily summaries\n`);

  // =============================================
  // SUMMARY
  // =============================================
  console.log('='.repeat(50));
  console.log('📊 SEED COMPLETE!');
  console.log('='.repeat(50));
  console.log('');
  console.log('🏢 Company: Aegira Demo Corp');
  console.log('👥 Users: 1 Admin, 2 Team Leads, 10 Workers');
  console.log('🏢 Teams: Team Alpha (5), Team Beta (5)');
  console.log(`📝 Check-ins: ${totalCheckins}`);
  console.log(`📊 Daily Summaries: ${totalSummaries}`);
  console.log('');
  console.log('🔑 Login credentials:');
  console.log('   Admin: admin@aegira.demo / demo123');
  console.log('   Team Lead: maria.santos@aegira.demo / demo123');
  console.log('   Worker: ana.garcia@aegira.demo / demo123');
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
