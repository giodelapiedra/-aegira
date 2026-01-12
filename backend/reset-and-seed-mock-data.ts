/**
 * Reset and Seed Mock Data Script
 *
 * This script:
 * 1. Clears all transactional data
 * 2. Creates comprehensive mock data with various scenarios
 *
 * Run with: npx tsx reset-and-seed-mock-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const TIMEZONE = 'Asia/Manila';

// Helper to create date in Manila timezone
function createDate(year: number, month: number, day: number): Date {
  return DateTime.fromObject({ year, month, day }, { zone: TIMEZONE }).toJSDate();
}

// Helper to get today in Manila timezone
function getToday(): DateTime {
  return DateTime.now().setZone(TIMEZONE).startOf('day');
}

async function main() {
  console.log('🗑️  Clearing existing transactional data...\n');

  // Clear transactional data in order (respect foreign keys)
  await prisma.absence.deleteMany({});
  await prisma.dailyAttendance.deleteMany({});
  await prisma.checkin.deleteMany({});
  await prisma.exception.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.oneOnOne.deleteMany({});
  await prisma.recognition.deleteMany({});
  await prisma.aISummary.deleteMany({});
  await prisma.wellnessSnapshot.deleteMany({});
  await prisma.incidentActivity.deleteMany({});
  await prisma.incident.deleteMany({});

  console.log('✅ Cleared: Absences, DailyAttendance, Checkins, Exceptions, Holidays, etc.\n');

  // Get company and team info
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ No company found! Please create a company first.');
    return;
  }
  console.log(`📍 Company: ${company.name} (${company.id})`);

  const team = await prisma.team.findFirst({
    where: { companyId: company.id, isActive: true },
    include: { leader: true }
  });
  if (!team) {
    console.error('❌ No active team found!');
    return;
  }
  console.log(`👥 Team: ${team.name} (${team.id})`);
  console.log(`👤 Team Leader: ${team.leader?.firstName} ${team.leader?.lastName}\n`);

  // Get all workers in the team
  const workers = await prisma.user.findMany({
    where: {
      companyId: company.id,
      teamId: team.id,
      isActive: true,
      role: { in: ['WORKER', 'MEMBER'] }
    },
    orderBy: { firstName: 'asc' }
  });

  if (workers.length < 5) {
    console.error(`❌ Need at least 5 workers for scenarios. Found: ${workers.length}`);
    console.log('Creating additional workers...');

    const workersToCreate = 5 - workers.length;
    const workerNames = [
      { firstName: 'Alice', lastName: 'Perfect' },
      { firstName: 'Bob', lastName: 'Mixed' },
      { firstName: 'Carlos', lastName: 'Excused' },
      { firstName: 'Diana', lastName: 'Unexcused' },
      { firstName: 'Edward', lastName: 'Pending' },
      { firstName: 'Fiona', lastName: 'OnLeave' },
      { firstName: 'George', lastName: 'Complex' }
    ];

    for (let i = 0; i < workersToCreate; i++) {
      const name = workerNames[workers.length + i] || { firstName: `Worker${i}`, lastName: 'Test' };
      await prisma.user.create({
        data: {
          email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@test.com`,
          firstName: name.firstName,
          lastName: name.lastName,
          role: 'WORKER',
          companyId: company.id,
          teamId: team.id,
          teamJoinedAt: createDate(2025, 12, 1) // Joined Dec 1, 2025
        }
      });
    }

    // Re-fetch workers
    const updatedWorkers = await prisma.user.findMany({
      where: {
        companyId: company.id,
        teamId: team.id,
        isActive: true,
        role: { in: ['WORKER', 'MEMBER'] }
      },
      orderBy: { firstName: 'asc' }
    });
    workers.length = 0;
    workers.push(...updatedWorkers);
  }

  console.log(`👷 Found ${workers.length} workers:\n`);
  workers.forEach((w, i) => console.log(`   ${i + 1}. ${w.firstName} ${w.lastName} (${w.id})`));
  console.log('');

  // Define today and create date range (last 14 days)
  const today = getToday();
  const startDate = today.minus({ days: 13 }); // 14 days including today

  console.log(`📅 Date range: ${startDate.toFormat('yyyy-MM-dd')} to ${today.toFormat('yyyy-MM-dd')}\n`);

  // Create holidays (Jan 1 = New Year, Jan 6 = Three Kings Day for testing)
  const holidays = [
    { date: createDate(2026, 1, 1), name: 'New Year\'s Day' },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.create({
      data: {
        companyId: company.id,
        date: holiday.date,
        name: holiday.name,
        createdBy: team.leaderId!
      }
    });
  }
  console.log(`🎉 Created ${holidays.length} holiday(s)\n`);

  // Get work days from team
  const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Helper to check if a date is a work day
  const isWorkDay = (dt: DateTime): boolean => {
    const dayName = dayNames[dt.weekday % 7]; // Luxon: 1=Mon, 7=Sun
    const luxonDayName = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][dt.weekday - 1];
    return workDaysList.includes(luxonDayName);
  };

  // Helper to check if a date is a holiday
  const holidayDates = new Set(holidays.map(h => DateTime.fromJSDate(h.date).toFormat('yyyy-MM-dd')));
  const isHoliday = (dt: DateTime): boolean => holidayDates.has(dt.toFormat('yyyy-MM-dd'));

  // =====================================================
  // SCENARIO DEFINITIONS
  // =====================================================

  interface ScenarioDay {
    status: 'GREEN' | 'YELLOW' | 'ABSENT' | 'EXCUSED_ABSENCE' | 'UNEXCUSED_ABSENCE' | 'PENDING_ABSENCE' | 'EXEMPTION';
    exemptionType?: string;
  }

  const scenarios: Record<string, (dayIndex: number, dt: DateTime) => ScenarioDay> = {
    // Worker 0: Perfect attendance - all GREEN
    'perfect': () => ({ status: 'GREEN' }),

    // Worker 1: Good attendance - mix of GREEN and YELLOW
    'mixed_good': (dayIndex) => {
      if (dayIndex % 3 === 0) return { status: 'YELLOW' };
      return { status: 'GREEN' };
    },

    // Worker 2: Has EXCUSED absences (TL approved) - should NOT count against them
    'excused_absences': (dayIndex, dt) => {
      // Days 3, 7, 10 are EXCUSED absences
      if ([3, 7, 10].includes(dayIndex)) return { status: 'EXCUSED_ABSENCE' };
      if (dayIndex % 4 === 0) return { status: 'YELLOW' };
      return { status: 'GREEN' };
    },

    // Worker 3: Has UNEXCUSED absences - SHOULD count against them (0 points)
    'unexcused_absences': (dayIndex) => {
      // Days 2, 5, 8 are UNEXCUSED absences
      if ([2, 5, 8].includes(dayIndex)) return { status: 'UNEXCUSED_ABSENCE' };
      if (dayIndex % 3 === 0) return { status: 'YELLOW' };
      return { status: 'GREEN' };
    },

    // Worker 4: Has PENDING absences - counting as 0 until resolved
    'pending_absences': (dayIndex) => {
      // Days 4, 9 are PENDING absences
      if ([4, 9].includes(dayIndex)) return { status: 'PENDING_ABSENCE' };
      return { status: 'GREEN' };
    },

    // Worker 5: Has approved leave/exemption (Exception model)
    'on_leave': (dayIndex) => {
      // Days 5-8 are on approved sick leave
      if (dayIndex >= 5 && dayIndex <= 8) return { status: 'EXEMPTION', exemptionType: 'SICK_LEAVE' };
      return { status: 'GREEN' };
    },

    // Worker 6: Complex mix of everything
    'complex': (dayIndex) => {
      if (dayIndex === 2) return { status: 'EXCUSED_ABSENCE' };
      if (dayIndex === 4) return { status: 'UNEXCUSED_ABSENCE' };
      if (dayIndex === 6) return { status: 'PENDING_ABSENCE' };
      if (dayIndex >= 9 && dayIndex <= 10) return { status: 'EXEMPTION', exemptionType: 'PERSONAL_LEAVE' };
      if (dayIndex % 3 === 0) return { status: 'YELLOW' };
      return { status: 'GREEN' };
    }
  };

  const scenarioNames = Object.keys(scenarios);

  // =====================================================
  // CREATE MOCK DATA
  // =====================================================

  let checkinCount = 0;
  let absenceCount = 0;
  let exemptionCount = 0;
  let attendanceCount = 0;

  for (let workerIndex = 0; workerIndex < Math.min(workers.length, scenarioNames.length); workerIndex++) {
    const worker = workers[workerIndex];
    const scenarioName = scenarioNames[workerIndex];
    const scenarioFn = scenarios[scenarioName];

    console.log(`\n📊 Creating data for ${worker.firstName} ${worker.lastName} (${scenarioName}):`);

    // Track exemptions for this worker (to create Exception records)
    const exemptionDays: { start: DateTime; end: DateTime; type: string }[] = [];
    let currentExemption: { start: DateTime; type: string } | null = null;

    // Iterate through each day
    let dayIndex = 0;
    let current = startDate;

    while (current <= today) {
      const dateStr = current.toFormat('yyyy-MM-dd');

      // Skip non-work days and holidays
      if (!isWorkDay(current) || isHoliday(current)) {
        current = current.plus({ days: 1 });
        continue;
      }

      const scenario = scenarioFn(dayIndex, current);
      const checkInDate = current.set({ hour: 8, minute: 0 }).toJSDate();

      // Handle exemptions (track consecutive days)
      if (scenario.status === 'EXEMPTION') {
        if (!currentExemption || currentExemption.type !== scenario.exemptionType) {
          if (currentExemption) {
            exemptionDays.push({
              start: currentExemption.start,
              end: current.minus({ days: 1 }),
              type: currentExemption.type
            });
          }
          currentExemption = { start: current, type: scenario.exemptionType! };
        }
      } else {
        if (currentExemption) {
          exemptionDays.push({
            start: currentExemption.start,
            end: current.minus({ days: 1 }),
            type: currentExemption.type
          });
          currentExemption = null;
        }
      }

      // Create records based on scenario
      switch (scenario.status) {
        case 'GREEN':
        case 'YELLOW': {
          // Create check-in
          const isLate = scenario.status === 'YELLOW';
          const checkinTime = isLate
            ? current.set({ hour: 8, minute: 30 }).toJSDate() // 30 mins late
            : current.set({ hour: 7, minute: 55 }).toJSDate(); // On time

          const readinessScore = isLate ? 68 + Math.random() * 10 : 75 + Math.random() * 15;

          await prisma.checkin.create({
            data: {
              userId: worker.id,
              companyId: company.id,
              mood: Math.floor(6 + Math.random() * 3),
              stress: Math.floor(3 + Math.random() * 3),
              sleep: Math.floor(6 + Math.random() * 3),
              physicalHealth: Math.floor(6 + Math.random() * 3),
              readinessStatus: scenario.status,
              readinessScore: Math.round(readinessScore),
              createdAt: checkinTime
            }
          });
          checkinCount++;

          // Create daily attendance
          await prisma.dailyAttendance.create({
            data: {
              userId: worker.id,
              companyId: company.id,
              teamId: team.id,
              date: current.toJSDate(),
              scheduledStart: team.shiftStart,
              gracePeriodMins: 15,
              checkInTime: checkinTime,
              minutesLate: isLate ? 15 : 0,
              status: scenario.status,
              score: scenario.status === 'GREEN' ? 100 : 75,
              isCounted: true
            }
          });
          attendanceCount++;
          break;
        }

        case 'EXCUSED_ABSENCE': {
          // Create absence record marked as EXCUSED by TL
          await prisma.absence.create({
            data: {
              userId: worker.id,
              teamId: team.id,
              companyId: company.id,
              absenceDate: current.toJSDate(),
              status: 'EXCUSED',
              reasonCategory: ['SICK', 'EMERGENCY', 'PERSONAL'][Math.floor(Math.random() * 3)] as any,
              explanation: 'Legitimate reason - excused by TL',
              justifiedAt: current.plus({ hours: 10 }).toJSDate(),
              reviewedBy: team.leaderId,
              reviewedAt: current.plus({ hours: 12 }).toJSDate(),
              reviewNotes: 'Approved - valid reason'
            }
          });
          absenceCount++;
          console.log(`   📝 ${dateStr}: EXCUSED absence (TL approved, no penalty)`);
          break;
        }

        case 'UNEXCUSED_ABSENCE': {
          // Create absence record marked as UNEXCUSED by TL (0 points)
          await prisma.absence.create({
            data: {
              userId: worker.id,
              teamId: team.id,
              companyId: company.id,
              absenceDate: current.toJSDate(),
              status: 'UNEXCUSED',
              reasonCategory: 'OTHER',
              explanation: 'No valid reason provided',
              justifiedAt: current.plus({ hours: 10 }).toJSDate(),
              reviewedBy: team.leaderId,
              reviewedAt: current.plus({ hours: 12 }).toJSDate(),
              reviewNotes: 'Not approved - invalid reason'
            }
          });
          absenceCount++;
          console.log(`   ❌ ${dateStr}: UNEXCUSED absence (TL rejected, 0 points)`);
          break;
        }

        case 'PENDING_ABSENCE': {
          // Create absence record pending justification
          await prisma.absence.create({
            data: {
              userId: worker.id,
              teamId: team.id,
              companyId: company.id,
              absenceDate: current.toJSDate(),
              status: 'PENDING_JUSTIFICATION',
              // No justification yet
            }
          });
          absenceCount++;
          console.log(`   ⏳ ${dateStr}: PENDING absence (awaiting justification, 0 points until resolved)`);
          break;
        }

        case 'EXEMPTION': {
          // Will create Exception record after processing all days
          console.log(`   🏥 ${dateStr}: On ${scenario.exemptionType} (approved leave)`);
          break;
        }
      }

      dayIndex++;
      current = current.plus({ days: 1 });
    }

    // Close any remaining exemption
    if (currentExemption) {
      exemptionDays.push({
        start: currentExemption.start,
        end: today,
        type: currentExemption.type
      });
    }

    // Create Exception records for exemptions
    for (const exemption of exemptionDays) {
      await prisma.exception.create({
        data: {
          userId: worker.id,
          companyId: company.id,
          type: exemption.type as any,
          reason: `${exemption.type.replace('_', ' ')} from ${exemption.start.toFormat('MMM d')} to ${exemption.end.toFormat('MMM d')}`,
          startDate: exemption.start.toJSDate(),
          endDate: exemption.end.toJSDate(),
          status: 'APPROVED',
          reviewedById: team.leaderId,
          approvedBy: team.leaderId,
          approvedAt: exemption.start.minus({ days: 1 }).toJSDate()
        }
      });
      exemptionCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 MOCK DATA SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Check-ins created: ${checkinCount}`);
  console.log(`✅ Daily attendance records: ${attendanceCount}`);
  console.log(`✅ Absences created: ${absenceCount}`);
  console.log(`✅ Exemptions created: ${exemptionCount}`);
  console.log(`✅ Holidays created: ${holidays.length}`);

  // =====================================================
  // EXPECTED RESULTS ANALYSIS
  // =====================================================

  console.log('\n' + '='.repeat(60));
  console.log('📈 EXPECTED CALCULATION RESULTS');
  console.log('='.repeat(60));

  for (let i = 0; i < Math.min(workers.length, scenarioNames.length); i++) {
    const worker = workers[i];
    const scenarioName = scenarioNames[i];

    // Count work days (excluding holidays)
    let workDaysCount = 0;
    let current = startDate;
    while (current <= today) {
      if (isWorkDay(current) && !isHoliday(current)) {
        workDaysCount++;
      }
      current = current.plus({ days: 1 });
    }

    // Get absences for this worker
    const workerAbsences = await prisma.absence.findMany({
      where: { userId: worker.id }
    });

    const excusedCount = workerAbsences.filter(a => a.status === 'EXCUSED').length;
    const unexcusedCount = workerAbsences.filter(a => a.status === 'UNEXCUSED').length;
    const pendingCount = workerAbsences.filter(a => a.status === 'PENDING_JUSTIFICATION').length;

    // Get exemptions for this worker
    const workerExemptions = await prisma.exception.findMany({
      where: { userId: worker.id, status: 'APPROVED' }
    });

    // Count exemption days
    let exemptionDaysCount = 0;
    for (const ex of workerExemptions) {
      if (!ex.startDate || !ex.endDate) continue;
      let d = DateTime.fromJSDate(ex.startDate);
      const end = DateTime.fromJSDate(ex.endDate);
      while (d <= end) {
        if (isWorkDay(d) && !isHoliday(d)) {
          exemptionDaysCount++;
        }
        d = d.plus({ days: 1 });
      }
    }

    // Get check-ins for this worker
    const workerCheckins = await prisma.checkin.findMany({
      where: { userId: worker.id }
    });

    const greenCount = workerCheckins.filter(c => c.readinessStatus === 'GREEN').length;
    const yellowCount = workerCheckins.filter(c => c.readinessStatus === 'YELLOW').length;

    // Calculate expected metrics
    // Expected work days = Total work days - Holidays - Exemptions - EXCUSED absences
    const expectedWorkDays = workDaysCount - exemptionDaysCount - excusedCount;
    const actualCheckins = greenCount + yellowCount;

    // Score calculation:
    // - GREEN = 100 points, YELLOW = 75 points
    // - UNEXCUSED = 0 points (counted)
    // - PENDING = 0 points (counted until resolved)
    // - EXCUSED = not counted (no penalty)
    const totalScore = (greenCount * 100) + (yellowCount * 75) + (unexcusedCount * 0) + (pendingCount * 0);
    const countedDays = actualCheckins + unexcusedCount + pendingCount;
    const avgScore = countedDays > 0 ? Math.round(totalScore / countedDays) : 0;

    console.log(`\n👤 ${worker.firstName} ${worker.lastName} (${scenarioName}):`);
    console.log(`   Total work days in period: ${workDaysCount}`);
    console.log(`   Exemption days (leave): ${exemptionDaysCount}`);
    console.log(`   EXCUSED absences: ${excusedCount} (no penalty)`);
    console.log(`   UNEXCUSED absences: ${unexcusedCount} (0 points)`);
    console.log(`   PENDING absences: ${pendingCount} (0 points until resolved)`);
    console.log(`   ──────────────────────────────`);
    console.log(`   Expected work days: ${expectedWorkDays} (${workDaysCount} - ${exemptionDaysCount} exemptions - ${excusedCount} excused)`);
    console.log(`   Actual check-ins: ${actualCheckins} (${greenCount} GREEN + ${yellowCount} YELLOW)`);
    console.log(`   Counted days: ${countedDays}`);
    console.log(`   Expected avg score: ${avgScore}%`);
    console.log(`   Check-in rate: ${expectedWorkDays > 0 ? Math.round((actualCheckins / expectedWorkDays) * 100) : 0}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ MOCK DATA SEEDING COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nYou can now test the following:');
  console.log('1. AI Insights - Check if EXCUSED absences are NOT counted against workers');
  console.log('2. Calendar View - Check if EXCUSED absences show as "Exempted"');
  console.log('3. Member Profile - Check 30-day metrics');
  console.log('4. Team Analytics - Check team-wide calculations');
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
