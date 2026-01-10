import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTeamGrade() {
  console.log('=== TEAM GRADE & EXEMPTION TEST ===\n');

  const timezone = 'Asia/Manila';
  const now = new Date();
  const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const todayStr = todayFormatter.format(now);

  // Get team with members
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } },
    include: {
      members: {
        where: { role: { in: ['MEMBER', 'WORKER'] } },
      },
      company: true,
    },
  });

  if (!team || team.members.length < 2) {
    console.log('Need at least 2 team members!');
    return;
  }

  console.log(`Team: ${team.name}`);
  console.log(`Work Days: ${team.workDays}`);
  console.log(`Members: ${team.members.length}\n`);

  // Get 2 workers for testing
  const worker1 = team.members[0]; // Will have exemption
  const worker2 = team.members[1]; // No exemption

  console.log(`Worker 1 (with exemption): ${worker1.firstName} ${worker1.lastName}`);
  console.log(`Worker 2 (no exemption): ${worker2.firstName} ${worker2.lastName}\n`);

  // Calculate dates for this week
  const workDays = team.workDays.split(',').map(d => d.trim().toUpperCase());

  // Get this week's dates
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const weekDates: { date: Date; dateStr: string; dayName: string; isWorkDay: boolean }[] = [];
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = todayFormatter.format(date);
    const dayName = dayNames[date.getDay()];
    weekDates.push({
      date,
      dateStr,
      dayName,
      isWorkDay: workDays.includes(dayName),
    });
  }

  // Count work days this week up to today
  const workDaysThisWeek = weekDates.filter(d => d.isWorkDay && d.dateStr <= todayStr);
  console.log(`Work days this week (up to today): ${workDaysThisWeek.length}`);
  console.log('');

  // ============================================
  // CLEAR & SETUP TEST DATA
  // ============================================
  console.log('Setting up test data...\n');

  // Clear existing data for both workers
  for (const worker of [worker1, worker2]) {
    await prisma.exception.deleteMany({ where: { userId: worker.id } });
    await prisma.checkin.deleteMany({ where: { userId: worker.id } });
  }

  // WORKER 1: Was exempted Tue-Thu, checked in Mon and Fri
  console.log(`--- ${worker1.firstName} (WITH exemption) ---`);

  // Create exemption for Tue-Thu
  const tuesday = weekDates.find(d => d.dayName === 'TUE')!;
  const thursday = weekDates.find(d => d.dayName === 'THU')!;

  const exemption = await prisma.exception.create({
    data: {
      userId: worker1.id,
      companyId: team.companyId,
      type: 'SICK_LEAVE',
      reason: 'Flu',
      status: 'APPROVED',
      startDate: new Date(tuesday.dateStr),
      endDate: new Date(thursday.dateStr),
      approvedBy: worker1.id,
      approvedAt: new Date(),
    },
  });
  console.log(`Exemption: ${tuesday.dateStr} to ${thursday.dateStr} (3 days)`);

  // Create check-ins for Mon and Fri (the days not exempted)
  const mondayDate = weekDates.find(d => d.dayName === 'MON')!;
  const fridayDate = weekDates.find(d => d.dayName === 'FRI')!;

  if (mondayDate.dateStr <= todayStr) {
    await prisma.checkin.create({
      data: {
        userId: worker1.id,
        companyId: team.companyId,
        mood: 8, stress: 3, sleep: 8, physicalHealth: 8,
        readinessScore: 85,
        readinessStatus: 'GREEN',
        createdAt: new Date(mondayDate.dateStr + 'T08:00:00'),
      },
    });
    console.log(`Check-in MON ${mondayDate.dateStr}: 85% GREEN`);
  }

  if (fridayDate.dateStr <= todayStr) {
    await prisma.checkin.create({
      data: {
        userId: worker1.id,
        companyId: team.companyId,
        mood: 7, stress: 4, sleep: 7, physicalHealth: 7,
        readinessScore: 70,
        readinessStatus: 'GREEN',
        createdAt: new Date(fridayDate.dateStr + 'T08:00:00'),
      },
    });
    console.log(`Check-in FRI ${fridayDate.dateStr}: 70% GREEN`);
  }

  console.log('');

  // WORKER 2: No exemption, checked in every work day
  console.log(`--- ${worker2.firstName} (NO exemption) ---`);

  for (const day of workDaysThisWeek) {
    await prisma.checkin.create({
      data: {
        userId: worker2.id,
        companyId: team.companyId,
        mood: 7, stress: 4, sleep: 7, physicalHealth: 7,
        readinessScore: 75,
        readinessStatus: 'GREEN',
        createdAt: new Date(day.dateStr + 'T08:00:00'),
      },
    });
    console.log(`Check-in ${day.dayName} ${day.dateStr}: 75% GREEN`);
  }

  console.log('\n');

  // ============================================
  // CALCULATE TEAM GRADE
  // ============================================
  console.log('=== TEAM GRADE CALCULATION ===\n');

  // Worker 1 calculation
  const worker1WorkDays = workDaysThisWeek.length; // 5 (Mon-Fri)
  const worker1ExemptionDays = 3; // Tue-Thu
  const worker1ExpectedDays = worker1WorkDays - worker1ExemptionDays; // 5 - 3 = 2
  const worker1ActualCheckins = fridayDate.dateStr <= todayStr ? 2 : 1; // Mon + Fri (if Fri has passed)
  const worker1Rate = (worker1ActualCheckins / worker1ExpectedDays) * 100;

  console.log(`${worker1.firstName}:`);
  console.log(`  Total work days: ${worker1WorkDays}`);
  console.log(`  Exemption days: ${worker1ExemptionDays} (Tue-Thu)`);
  console.log(`  Expected check-ins: ${worker1ExpectedDays} (Mon + Fri only)`);
  console.log(`  Actual check-ins: ${worker1ActualCheckins}`);
  console.log(`  Check-in rate: ${worker1Rate.toFixed(0)}%`);
  console.log('');

  // Worker 2 calculation
  const worker2WorkDays = workDaysThisWeek.length;
  const worker2ExemptionDays = 0;
  const worker2ExpectedDays = worker2WorkDays - worker2ExemptionDays;
  const worker2ActualCheckins = workDaysThisWeek.length;
  const worker2Rate = (worker2ActualCheckins / worker2ExpectedDays) * 100;

  console.log(`${worker2.firstName}:`);
  console.log(`  Total work days: ${worker2WorkDays}`);
  console.log(`  Exemption days: ${worker2ExemptionDays}`);
  console.log(`  Expected check-ins: ${worker2ExpectedDays}`);
  console.log(`  Actual check-ins: ${worker2ActualCheckins}`);
  console.log(`  Check-in rate: ${worker2Rate.toFixed(0)}%`);
  console.log('');

  // Team totals
  const totalExpected = worker1ExpectedDays + worker2ExpectedDays;
  const totalActual = worker1ActualCheckins + worker2ActualCheckins;
  const teamRate = (totalActual / totalExpected) * 100;

  console.log('=== TEAM TOTALS ===');
  console.log(`Total expected check-ins: ${totalExpected}`);
  console.log(`Total actual check-ins: ${totalActual}`);
  console.log(`Team check-in rate: ${teamRate.toFixed(0)}%`);
  console.log('');

  // ============================================
  // KEY INSIGHT
  // ============================================
  console.log('=== KEY INSIGHT ===\n');
  console.log('WITHOUT exemption handling:');
  console.log(`  Worker 1 would be: ${worker1ActualCheckins}/${worker1WorkDays} = ${((worker1ActualCheckins/worker1WorkDays)*100).toFixed(0)}% (UNFAIR!)`);
  console.log('');
  console.log('WITH exemption handling (correct):');
  console.log(`  Worker 1 is: ${worker1ActualCheckins}/${worker1ExpectedDays} = ${worker1Rate.toFixed(0)}% (FAIR!)`);
  console.log('');
  console.log('Exempted days do NOT count against the worker or team grade!');

  console.log('\n=== TEST COMPLETE ===');
}

testTeamGrade()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
