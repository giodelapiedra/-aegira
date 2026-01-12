/**
 * FULL DATABASE RESET + REALISTIC MOCK DATA
 *
 * Deletes EVERYTHING and creates fresh realistic data
 *
 * Run with: npx tsx full-reset-mock-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

// Helper functions
function createDate(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  // Use noon (12:00) to avoid timezone date shift issues
  // Manila is UTC+8, so noon Manila = 04:00 UTC same day (safe)
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: TIMEZONE }).toJSDate();
}

// For DATE-only fields (like absenceDate), use noon to avoid date shift
function createDateOnly(year: number, month: number, day: number): Date {
  // Store as noon UTC to ensure the date is correct regardless of timezone
  return DateTime.fromObject({ year, month, day, hour: 12 }, { zone: TIMEZONE }).toJSDate();
}

function getToday(): DateTime {
  return DateTime.now().setZone(TIMEZONE).startOf('day');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🗑️  DELETING ALL DATA FROM DATABASE...\n');

  // Delete in correct order (foreign key constraints)
  await prisma.absence.deleteMany({});
  await prisma.dailyAttendance.deleteMany({});
  await prisma.incidentActivity.deleteMany({});
  await prisma.filledPDFForm.deleteMany({});
  await prisma.pDFTemplate.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.checkin.deleteMany({});
  await prisma.exception.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.oneOnOne.deleteMany({});
  await prisma.pulseSurveyResponse.deleteMany({});
  await prisma.pulseSurvey.deleteMany({});
  await prisma.recognition.deleteMany({});
  await prisma.aISummary.deleteMany({});
  await prisma.wellnessSnapshot.deleteMany({});
  await prisma.schedule.deleteMany({});
  await prisma.rehabilitation.deleteMany({});
  await prisma.systemLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.company.deleteMany({});

  console.log('✅ All data deleted!\n');

  // =====================================================
  // CREATE COMPANY
  // =====================================================
  console.log('🏢 Creating company...');

  const company = await prisma.company.create({
    data: {
      name: 'Aegira Construction Corp',
      slug: 'aegira-construction',
      industry: 'Construction',
      size: '51-200',
      address: '123 Makati Ave, Makati City, Metro Manila',
      phone: '+63 2 8888 1234',
      website: 'https://aegira-construction.com',
      timezone: 'Asia/Manila',
      isActive: true,
    }
  });
  console.log(`   ✅ Created: ${company.name}\n`);

  // =====================================================
  // CREATE EXECUTIVE USER
  // =====================================================
  console.log('👔 Creating executive user...');

  const executive = await prisma.user.create({
    data: {
      email: 'admin@aegira.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      role: 'EXECUTIVE',
      companyId: company.id,
      isActive: true,
    }
  });
  console.log(`   ✅ Created: ${executive.firstName} ${executive.lastName} (EXECUTIVE)\n`);

  // =====================================================
  // CREATE TEAMS
  // =====================================================
  console.log('👥 Creating teams...');

  const teamsData = [
    {
      name: 'Alpha Team - Morning Shift',
      workDays: 'MON,TUE,WED,THU,FRI',
      shiftStart: '06:00',
      shiftEnd: '14:00',
      leader: { firstName: 'Roberto', lastName: 'Santos', email: 'roberto.santos@aegira.com' },
      members: [
        { firstName: 'David', lastName: 'Gonzales', email: 'david.gonzales@aegira.com' },
        { firstName: 'Miguel', lastName: 'Reyes', email: 'miguel.reyes@aegira.com' },
        { firstName: 'Jose', lastName: 'Garcia', email: 'jose.garcia@aegira.com' },
        { firstName: 'Antonio', lastName: 'Mendoza', email: 'antonio.mendoza@aegira.com' },
        { firstName: 'Pedro', lastName: 'Villanueva', email: 'pedro.villanueva@aegira.com' },
      ]
    },
    {
      name: 'Bravo Team - Afternoon Shift',
      workDays: 'MON,TUE,WED,THU,FRI',
      shiftStart: '14:00',
      shiftEnd: '22:00',
      leader: { firstName: 'Rosa', lastName: 'Mendoza', email: 'rosa.mendoza@aegira.com' },
      members: [
        { firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.rivera@aegira.com' },
        { firstName: 'Fernando', lastName: 'Castro', email: 'fernando.castro@aegira.com' },
        { firstName: 'Luis', lastName: 'Martinez', email: 'luis.martinez@aegira.com' },
        { firstName: 'Ricardo', lastName: 'Bautista', email: 'ricardo.bautista@aegira.com' },
        { firstName: 'Eduardo', lastName: 'Ramos', email: 'eduardo.ramos@aegira.com' },
      ]
    },
  ];

  const teams: any[] = [];
  const allWorkers: any[] = [];

  for (const teamData of teamsData) {
    // Create team leader
    const leader = await prisma.user.create({
      data: {
        email: teamData.leader.email,
        firstName: teamData.leader.firstName,
        lastName: teamData.leader.lastName,
        role: 'TEAM_LEAD',
        companyId: company.id,
        isActive: true,
      }
    });

    // Create team
    const team = await prisma.team.create({
      data: {
        name: teamData.name,
        companyId: company.id,
        leaderId: leader.id,
        workDays: teamData.workDays,
        shiftStart: teamData.shiftStart,
        shiftEnd: teamData.shiftEnd,
        isActive: true,
        createdAt: createDate(2025, 11, 1), // Team created Nov 1, 2025
      }
    });

    // Update leader's team
    await prisma.user.update({
      where: { id: leader.id },
      data: { teamId: team.id, teamJoinedAt: createDate(2025, 11, 1) }
    });

    // Create team members
    const members: any[] = [];
    for (const memberData of teamData.members) {
      const member = await prisma.user.create({
        data: {
          email: memberData.email,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          role: 'WORKER',
          companyId: company.id,
          teamId: team.id,
          teamJoinedAt: createDate(2025, 11, 15), // Joined Nov 15, 2025
          isActive: true,
        }
      });
      members.push(member);
      allWorkers.push({ ...member, team, leader });
    }

    teams.push({ ...team, leader, members });
    console.log(`   ✅ ${team.name} - Leader: ${leader.firstName}, Members: ${members.length}`);
  }

  console.log('');

  // =====================================================
  // CREATE HOLIDAYS
  // =====================================================
  console.log('🎉 Creating holidays...');

  const holidays = [
    { date: createDate(2025, 12, 25), name: 'Christmas Day' },
    { date: createDate(2025, 12, 30), name: 'Rizal Day' },
    { date: createDate(2025, 12, 31), name: 'New Year\'s Eve' },
    { date: createDate(2026, 1, 1), name: 'New Year\'s Day' },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.create({
      data: {
        companyId: company.id,
        date: holiday.date,
        name: holiday.name,
        createdBy: executive.id,
      }
    });
    console.log(`   ✅ ${holiday.name}`);
  }
  console.log('');

  // =====================================================
  // DEFINE WORKER SCENARIOS
  // =====================================================

  const today = getToday();
  const startDate = DateTime.fromObject({ year: 2025, month: 12, day: 1 }, { zone: TIMEZONE });

  // Scenario definitions for each worker
  const workerScenarios: Record<string, {
    description: string;
    getStatus: (dayIndex: number, dt: DateTime) => {
      type: 'checkin' | 'excused_absence' | 'unexcused_absence' | 'pending_absence' | 'exemption' | 'skip';
      isLate?: boolean;
      readinessStatus?: 'GREEN' | 'YELLOW' | 'RED';
      exemptionType?: string;
      absenceReason?: string;
    };
  }> = {
    // Alpha Team
    'david.gonzales@aegira.com': {
      description: 'Perfect worker - always on time, high scores',
      getStatus: () => ({ type: 'checkin', isLate: false, readinessStatus: 'GREEN' })
    },
    'miguel.reyes@aegira.com': {
      description: 'Good worker - mostly on time, occasional late',
      getStatus: (dayIndex) => ({
        type: 'checkin',
        isLate: dayIndex % 5 === 0,
        readinessStatus: dayIndex % 5 === 0 ? 'YELLOW' : 'GREEN'
      })
    },
    'jose.garcia@aegira.com': {
      description: 'Has approved sick leave (Jan 6-8)',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (dateStr >= '2026-01-06' && dateStr <= '2026-01-08') {
          return { type: 'exemption', exemptionType: 'SICK_LEAVE' };
        }
        return { type: 'checkin', isLate: false, readinessStatus: 'GREEN' };
      }
    },
    'antonio.mendoza@aegira.com': {
      description: 'Has EXCUSED absences (TL approved) - Jan 2, 7',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (['2026-01-02', '2026-01-07'].includes(dateStr)) {
          return { type: 'excused_absence', absenceReason: 'SICK' };
        }
        return { type: 'checkin', isLate: dayIndex % 4 === 0, readinessStatus: dayIndex % 4 === 0 ? 'YELLOW' : 'GREEN' };
      }
    },
    'pedro.villanueva@aegira.com': {
      description: 'Has UNEXCUSED absences - Jan 3, 9',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (['2026-01-03', '2026-01-09'].includes(dateStr)) {
          return { type: 'unexcused_absence', absenceReason: 'OTHER' };
        }
        return { type: 'checkin', isLate: false, readinessStatus: 'GREEN' };
      }
    },

    // Bravo Team
    'carlos.rivera@aegira.com': {
      description: 'Excellent worker - high readiness scores',
      getStatus: () => ({ type: 'checkin', isLate: false, readinessStatus: 'GREEN' })
    },
    'fernando.castro@aegira.com': {
      description: 'Has EXCUSED absences - Dec 20, Jan 5, 10',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (['2025-12-20', '2026-01-05', '2026-01-10'].includes(dateStr)) {
          return { type: 'excused_absence', absenceReason: 'EMERGENCY' };
        }
        return { type: 'checkin', isLate: dayIndex % 3 === 0, readinessStatus: dayIndex % 3 === 0 ? 'YELLOW' : 'GREEN' };
      }
    },
    'luis.martinez@aegira.com': {
      description: 'Has UNEXCUSED and PENDING absences',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (['2025-12-22', '2026-01-06'].includes(dateStr)) {
          return { type: 'unexcused_absence', absenceReason: 'FORGOT_CHECKIN' };
        }
        if (['2026-01-09'].includes(dateStr)) {
          return { type: 'pending_absence' };
        }
        return { type: 'checkin', isLate: dayIndex % 2 === 0, readinessStatus: dayIndex % 2 === 0 ? 'YELLOW' : 'GREEN' };
      }
    },
    'ricardo.bautista@aegira.com': {
      description: 'Has personal leave (Jan 2-3) + PENDING absence',
      getStatus: (dayIndex, dt) => {
        const dateStr = dt.toFormat('yyyy-MM-dd');
        if (dateStr >= '2026-01-02' && dateStr <= '2026-01-03') {
          return { type: 'exemption', exemptionType: 'PERSONAL_LEAVE' };
        }
        if (['2026-01-08'].includes(dateStr)) {
          return { type: 'pending_absence' };
        }
        return { type: 'checkin', isLate: false, readinessStatus: 'GREEN' };
      }
    },
    'eduardo.ramos@aegira.com': {
      description: 'Mixed performance - some late, some yellow readiness',
      getStatus: (dayIndex) => {
        if (dayIndex % 6 === 0) {
          return { type: 'checkin', isLate: true, readinessStatus: 'YELLOW' };
        }
        if (dayIndex % 4 === 0) {
          return { type: 'checkin', isLate: false, readinessStatus: 'YELLOW' };
        }
        return { type: 'checkin', isLate: false, readinessStatus: 'GREEN' };
      }
    },
  };

  // =====================================================
  // CREATE CHECK-INS, ABSENCES, EXEMPTIONS
  // =====================================================
  console.log('📊 Creating attendance data...\n');

  const workDaysList = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const holidayDates = new Set(holidays.map(h => DateTime.fromJSDate(h.date).toFormat('yyyy-MM-dd')));

  const isWorkDay = (dt: DateTime): boolean => {
    const luxonDayName = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][dt.weekday - 1];
    return workDaysList.includes(luxonDayName);
  };

  const isHoliday = (dt: DateTime): boolean => holidayDates.has(dt.toFormat('yyyy-MM-dd'));

  let checkinCount = 0;
  let absenceCount = 0;
  let exemptionCount = 0;

  for (const workerInfo of allWorkers) {
    const scenario = workerScenarios[workerInfo.email];
    if (!scenario) continue;

    console.log(`👤 ${workerInfo.firstName} ${workerInfo.lastName}: ${scenario.description}`);

    // Track exemptions to create exception records
    const exemptionPeriods: { start: DateTime; end: DateTime; type: string }[] = [];
    let currentExemption: { start: DateTime; type: string } | null = null;

    let dayIndex = 0;
    let current = startDate;

    while (current <= today) {
      const dateStr = current.toFormat('yyyy-MM-dd');

      // Skip weekends and holidays
      if (!isWorkDay(current) || isHoliday(current)) {
        current = current.plus({ days: 1 });
        continue;
      }

      const status = scenario.getStatus(dayIndex, current);

      // Handle exemption tracking
      if (status.type === 'exemption') {
        if (!currentExemption || currentExemption.type !== status.exemptionType) {
          if (currentExemption) {
            exemptionPeriods.push({
              start: currentExemption.start,
              end: current.minus({ days: 1 }),
              type: currentExemption.type
            });
          }
          currentExemption = { start: current, type: status.exemptionType! };
        }
      } else {
        if (currentExemption) {
          exemptionPeriods.push({
            start: currentExemption.start,
            end: current.minus({ days: 1 }),
            type: currentExemption.type
          });
          currentExemption = null;
        }
      }

      // Get shift time based on team
      const shiftHour = parseInt(workerInfo.team.shiftStart.split(':')[0]);

      switch (status.type) {
        case 'checkin': {
          const isLate = status.isLate || false;
          const checkinTime = current.set({
            hour: shiftHour + (isLate ? 0 : 0),
            minute: isLate ? randomInt(20, 45) : randomInt(-10, 10)
          }).toJSDate();

          // Generate realistic readiness scores
          let mood: number, stress: number, sleep: number, physical: number;
          if (status.readinessStatus === 'GREEN') {
            mood = randomInt(7, 9);
            stress = randomInt(2, 4);
            sleep = randomInt(7, 9);
            physical = randomInt(7, 9);
          } else if (status.readinessStatus === 'YELLOW') {
            mood = randomInt(5, 7);
            stress = randomInt(4, 6);
            sleep = randomInt(5, 7);
            physical = randomInt(5, 7);
          } else {
            mood = randomInt(3, 5);
            stress = randomInt(6, 8);
            sleep = randomInt(3, 5);
            physical = randomInt(3, 5);
          }

          const readinessScore = Math.round((mood + (10 - stress) + sleep + physical) / 4 * 10);

          await prisma.checkin.create({
            data: {
              userId: workerInfo.id,
              companyId: company.id,
              mood, stress, sleep, physicalHealth: physical,
              readinessStatus: status.readinessStatus!,
              readinessScore,
              createdAt: checkinTime,
            }
          });

          await prisma.dailyAttendance.create({
            data: {
              userId: workerInfo.id,
              companyId: company.id,
              teamId: workerInfo.team.id,
              date: createDateOnly(current.year, current.month, current.day),
              scheduledStart: workerInfo.team.shiftStart,
              gracePeriodMins: 15,
              checkInTime: checkinTime,
              minutesLate: isLate ? randomInt(5, 30) : 0,
              status: isLate ? 'YELLOW' : 'GREEN',
              score: isLate ? 75 : 100,
              isCounted: true,
            }
          });

          checkinCount++;
          break;
        }

        case 'excused_absence': {
          await prisma.absence.create({
            data: {
              userId: workerInfo.id,
              teamId: workerInfo.team.id,
              companyId: company.id,
              absenceDate: createDateOnly(current.year, current.month, current.day),
              status: 'EXCUSED',
              reasonCategory: status.absenceReason as any || 'SICK',
              explanation: 'Valid reason provided and approved by team leader',
              justifiedAt: current.plus({ hours: 9 }).toJSDate(),
              reviewedBy: workerInfo.leader.id,
              reviewedAt: current.plus({ hours: 10 }).toJSDate(),
              reviewNotes: 'Approved - valid reason',
            }
          });
          absenceCount++;
          console.log(`   📝 ${dateStr}: EXCUSED absence`);
          break;
        }

        case 'unexcused_absence': {
          await prisma.absence.create({
            data: {
              userId: workerInfo.id,
              teamId: workerInfo.team.id,
              companyId: company.id,
              absenceDate: createDateOnly(current.year, current.month, current.day),
              status: 'UNEXCUSED',
              reasonCategory: status.absenceReason as any || 'OTHER',
              explanation: 'No valid reason provided',
              justifiedAt: current.plus({ hours: 9 }).toJSDate(),
              reviewedBy: workerInfo.leader.id,
              reviewedAt: current.plus({ hours: 10 }).toJSDate(),
              reviewNotes: 'Not approved - invalid reason',
            }
          });
          absenceCount++;
          console.log(`   ❌ ${dateStr}: UNEXCUSED absence`);
          break;
        }

        case 'pending_absence': {
          await prisma.absence.create({
            data: {
              userId: workerInfo.id,
              teamId: workerInfo.team.id,
              companyId: company.id,
              absenceDate: createDateOnly(current.year, current.month, current.day),
              status: 'PENDING_JUSTIFICATION',
            }
          });
          absenceCount++;
          console.log(`   ⏳ ${dateStr}: PENDING absence`);
          break;
        }

        case 'exemption': {
          console.log(`   🏥 ${dateStr}: On ${status.exemptionType}`);
          break;
        }
      }

      dayIndex++;
      current = current.plus({ days: 1 });
    }

    // Close any remaining exemption
    if (currentExemption) {
      exemptionPeriods.push({
        start: currentExemption.start,
        end: today,
        type: currentExemption.type
      });
    }

    // Create exception records for exemption periods
    for (const period of exemptionPeriods) {
      await prisma.exception.create({
        data: {
          userId: workerInfo.id,
          companyId: company.id,
          type: period.type as any,
          reason: `${period.type.replace('_', ' ')} - ${period.start.toFormat('MMM d')} to ${period.end.toFormat('MMM d, yyyy')}`,
          startDate: period.start.toJSDate(),
          endDate: period.end.toJSDate(),
          status: 'APPROVED',
          reviewedById: workerInfo.leader.id,
          approvedBy: workerInfo.leader.id,
          approvedAt: period.start.minus({ days: 1 }).toJSDate(),
        }
      });
      exemptionCount++;
    }

    console.log('');
  }

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log('='.repeat(70));
  console.log('📊 MOCK DATA CREATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Company: ${company.name}`);
  console.log(`✅ Teams: ${teams.length}`);
  console.log(`✅ Users: 1 Executive + ${teams.length} Team Leads + ${allWorkers.length} Workers`);
  console.log(`✅ Holidays: ${holidays.length}`);
  console.log(`✅ Check-ins: ${checkinCount}`);
  console.log(`✅ Absences: ${absenceCount}`);
  console.log(`✅ Exemptions: ${exemptionCount}`);

  console.log('\n📋 WORKER SCENARIOS:');
  console.log('─'.repeat(70));
  for (const email of Object.keys(workerScenarios)) {
    const worker = allWorkers.find(w => w.email === email);
    if (worker) {
      console.log(`   ${worker.firstName} ${worker.lastName}: ${workerScenarios[email].description}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ MOCK DATA CREATION COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n🔐 Login Credentials:');
  console.log('   Executive: admin@aegira.com');
  console.log('   Team Lead Alpha: roberto.santos@aegira.com');
  console.log('   Team Lead Bravo: rosa.mendoza@aegira.com');
  console.log('   Workers: [firstname].[lastname]@aegira.com');
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
