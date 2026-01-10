import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

// Demo company name - change this to create new demo company
const DEMO_COMPANY_NAME = 'DEMO_PhilHealth';

async function createDemoData() {
  console.log('='.repeat(70));
  console.log('CREATING COMPLETE DEMO DATA');
  console.log('='.repeat(70));

  const timezone = 'Asia/Manila';
  const now = DateTime.now().setZone(timezone);
  const today = now.toFormat('yyyy-MM-dd');

  console.log(`\n📍 Timezone: ${timezone}`);
  console.log(`📍 Today: ${today}`);

  // Check if demo company already exists
  const existing = await prisma.company.findFirst({
    where: { name: DEMO_COMPANY_NAME },
  });

  if (existing) {
    console.log(`\n⚠️ Demo company "${DEMO_COMPANY_NAME}" already exists!`);
    console.log('   Delete it first or change DEMO_COMPANY_NAME in the script.');
    return;
  }

  // ============================================================
  // 1. CREATE COMPANY
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 1: Creating Company');
  console.log('─'.repeat(70));

  const company = await prisma.company.create({
    data: {
      name: DEMO_COMPANY_NAME,
      slug: 'demo-philhealth-' + Math.random().toString(36).substring(2, 8),
      timezone: timezone,
      industry: 'Healthcare',
      size: 'MEDIUM',
    },
  });

  console.log(`   ✅ Company: ${company.name}`);
  console.log(`   📍 ID: ${company.id}`);

  // ============================================================
  // 2. CREATE EXECUTIVE
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 2: Creating Executive');
  console.log('─'.repeat(70));

  const executive = await prisma.user.create({
    data: {
      id: `demo-exec-${Date.now()}`,
      email: `executive@${DEMO_COMPANY_NAME.toLowerCase()}.demo`,
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'EXECUTIVE',
      companyId: company.id,
      isActive: true,
    },
  });

  console.log(`   ✅ Executive: ${executive.firstName} ${executive.lastName}`);
  console.log(`   📧 Email: ${executive.email}`);

  // ============================================================
  // 3. CREATE TEAMS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 3: Creating Teams');
  console.log('─'.repeat(70));

  const teamsData = [
    { name: 'Operations Team', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' },
    { name: 'Night Shift Team', workDays: 'MON,TUE,WED,THU,FRI,SAT', shiftStart: '22:00', shiftEnd: '06:00' },
    { name: 'Weekend Support', workDays: 'SAT,SUN', shiftStart: '09:00', shiftEnd: '18:00' },
  ];

  const teams: any[] = [];

  for (const td of teamsData) {
    const team = await prisma.team.create({
      data: {
        name: td.name,
        companyId: company.id,
        workDays: td.workDays,
        shiftStart: td.shiftStart,
        shiftEnd: td.shiftEnd,
        isActive: true,
      },
    });
    teams.push(team);
    console.log(`   ✅ Team: ${team.name} (${td.workDays})`);
  }

  // ============================================================
  // 4. CREATE TEAM LEADS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 4: Creating Team Leads');
  console.log('─'.repeat(70));

  const teamLeadsData = [
    { firstName: 'Juan', lastName: 'Dela Cruz', teamIndex: 0 },
    { firstName: 'Pedro', lastName: 'Reyes', teamIndex: 1 },
    { firstName: 'Ana', lastName: 'Garcia', teamIndex: 2 },
  ];

  const teamLeads: any[] = [];

  for (const tld of teamLeadsData) {
    const team = teams[tld.teamIndex];
    const teamLead = await prisma.user.create({
      data: {
        id: `demo-tl-${Date.now()}-${tld.teamIndex}`,
        email: `${tld.firstName.toLowerCase()}.${tld.lastName.toLowerCase()}@${DEMO_COMPANY_NAME.toLowerCase()}.demo`,
        firstName: tld.firstName,
        lastName: tld.lastName,
        role: 'TEAM_LEAD',
        companyId: company.id,
        teamId: team.id,
        isActive: true,
      },
    });

    // Update team with leader
    await prisma.team.update({
      where: { id: team.id },
      data: { leaderId: teamLead.id },
    });

    teamLeads.push(teamLead);
    console.log(`   ✅ Team Lead: ${teamLead.firstName} ${teamLead.lastName} → ${team.name}`);
  }

  // ============================================================
  // 5. CREATE WORKERS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 5: Creating Workers');
  console.log('─'.repeat(70));

  const workersData = [
    // Operations Team (5 workers)
    { firstName: 'Carlo', lastName: 'Mendoza', teamIndex: 0 },
    { firstName: 'Jose', lastName: 'Bautista', teamIndex: 0 },
    { firstName: 'Elena', lastName: 'Cruz', teamIndex: 0 },
    { firstName: 'Miguel', lastName: 'Ramos', teamIndex: 0 },
    { firstName: 'Rosa', lastName: 'Fernandez', teamIndex: 0 },
    // Night Shift Team (4 workers)
    { firstName: 'Antonio', lastName: 'Lopez', teamIndex: 1 },
    { firstName: 'Carmen', lastName: 'Torres', teamIndex: 1 },
    { firstName: 'Diego', lastName: 'Villanueva', teamIndex: 1 },
    { firstName: 'Isabel', lastName: 'Aquino', teamIndex: 1 },
    // Weekend Support (3 workers)
    { firstName: 'Paolo', lastName: 'Santos', teamIndex: 2 },
    { firstName: 'Lucia', lastName: 'Gonzales', teamIndex: 2 },
    { firstName: 'Ramon', lastName: 'Marquez', teamIndex: 2 },
  ];

  const workers: any[] = [];

  for (let i = 0; i < workersData.length; i++) {
    const wd = workersData[i];
    const team = teams[wd.teamIndex];
    const worker = await prisma.user.create({
      data: {
        id: `demo-worker-${Date.now()}-${i}`,
        email: `${wd.firstName.toLowerCase()}.${wd.lastName.toLowerCase()}@${DEMO_COMPANY_NAME.toLowerCase()}.demo`,
        firstName: wd.firstName,
        lastName: wd.lastName,
        role: 'WORKER',
        companyId: company.id,
        teamId: team.id,
        teamJoinedAt: now.minus({ days: 60 }).toJSDate(),
        isActive: true,
      },
    });
    workers.push({ ...worker, teamIndex: wd.teamIndex });
    console.log(`   ✅ Worker: ${worker.firstName} ${worker.lastName} → ${team.name}`);
  }

  // ============================================================
  // 6. CREATE SUPERVISOR
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 6: Creating Supervisor');
  console.log('─'.repeat(70));

  const supervisor = await prisma.user.create({
    data: {
      id: `demo-supervisor-${Date.now()}`,
      email: `supervisor@${DEMO_COMPANY_NAME.toLowerCase()}.demo`,
      firstName: 'Roberto',
      lastName: 'Villanueva',
      role: 'SUPERVISOR',
      companyId: company.id,
      isActive: true,
    },
  });

  console.log(`   ✅ Supervisor: ${supervisor.firstName} ${supervisor.lastName}`);

  // ============================================================
  // 7. CREATE HOLIDAYS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 7: Creating Holidays');
  console.log('─'.repeat(70));

  const holidaysData = [
    { name: 'New Year', daysFromNow: -7 },
    { name: 'Company Anniversary', daysFromNow: 7 },
    { name: 'Independence Day', daysFromNow: 14 },
  ];

  for (const hd of holidaysData) {
    const holidayDate = now.plus({ days: hd.daysFromNow }).startOf('day').toJSDate();
    await prisma.holiday.create({
      data: {
        companyId: company.id,
        name: hd.name,
        date: holidayDate,
        createdBy: executive.id,
      },
    });
    console.log(`   ✅ Holiday: ${hd.name} (${now.plus({ days: hd.daysFromNow }).toFormat('yyyy-MM-dd')})`);
  }

  // ============================================================
  // 8. CREATE CHECK-INS (Last 14 days)
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 8: Creating Check-ins (Last 14 days)');
  console.log('─'.repeat(70));

  let totalCheckins = 0;
  let greenCount = 0, yellowCount = 0, redCount = 0;

  // For each worker, create check-ins for the past 14 days
  for (const worker of workers) {
    const team = teams[worker.teamIndex];
    const workDays = team.workDays.split(',');

    for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
      const checkDate = now.minus({ days: daysAgo });
      const dayAbbr = checkDate.toFormat('EEE').toUpperCase().substring(0, 3);

      // Skip if not a work day for this team
      if (!workDays.includes(dayAbbr)) continue;

      // Random chance to skip (simulate absence) - 10% chance
      if (Math.random() < 0.1) continue;

      // Generate random scores
      const mood = Math.floor(Math.random() * 5) + 5; // 5-10
      const stress = Math.floor(Math.random() * 6) + 3; // 3-8
      const sleep = Math.floor(Math.random() * 5) + 5; // 5-10
      const physical = Math.floor(Math.random() * 5) + 5; // 5-10

      const readinessScore = Math.round((mood + (10 - stress) + sleep + physical) / 4 * 10);
      const readinessStatus = readinessScore >= 70 ? 'GREEN' : readinessScore >= 50 ? 'YELLOW' : 'RED';

      // Random low score reason for RED
      const lowScoreReason = readinessStatus === 'RED' ? 'ILLNESS_SICKNESS' : null;

      await prisma.checkin.create({
        data: {
          userId: worker.id,
          companyId: company.id,
          mood,
          stress,
          sleep,
          physicalHealth: physical,
          readinessScore,
          readinessStatus,
          lowScoreReason,
          createdAt: checkDate.set({ hour: 7, minute: Math.floor(Math.random() * 60) }).toJSDate(),
        },
      });

      totalCheckins++;
      if (readinessStatus === 'GREEN') greenCount++;
      else if (readinessStatus === 'YELLOW') yellowCount++;
      else redCount++;
    }
  }

  console.log(`   ✅ Created ${totalCheckins} check-ins`);
  console.log(`      🟢 GREEN: ${greenCount}`);
  console.log(`      🟡 YELLOW: ${yellowCount}`);
  console.log(`      🔴 RED: ${redCount}`);

  // ============================================================
  // 9. CREATE EXEMPTIONS/LEAVES
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 9: Creating Leave Requests');
  console.log('─'.repeat(70));

  const leavesData = [
    { workerIndex: 0, type: 'SICK_LEAVE', status: 'APPROVED', daysAgo: 3, duration: 2 },
    { workerIndex: 3, type: 'PERSONAL_LEAVE', status: 'APPROVED', daysAgo: 5, duration: 1 },
    { workerIndex: 6, type: 'MEDICAL_APPOINTMENT', status: 'PENDING', daysAgo: 0, duration: 1 },
    { workerIndex: 9, type: 'FAMILY_EMERGENCY', status: 'APPROVED', daysAgo: 2, duration: 3 },
  ];

  for (const ld of leavesData) {
    const worker = workers[ld.workerIndex];
    const startDate = now.minus({ days: ld.daysAgo }).startOf('day').toJSDate();
    const endDate = now.minus({ days: ld.daysAgo - ld.duration + 1 }).endOf('day').toJSDate();

    const teamLead = teamLeads[worker.teamIndex];

    await prisma.exception.create({
      data: {
        userId: worker.id,
        companyId: company.id,
        type: ld.type as any,
        reason: `${ld.type.replace('_', ' ')} request`,
        status: ld.status as any,
        startDate: ld.status === 'APPROVED' ? startDate : null,
        endDate: ld.status === 'APPROVED' ? endDate : null,
        reviewedById: ld.status === 'APPROVED' ? teamLead.id : null,
        approvedAt: ld.status === 'APPROVED' ? new Date() : null,
        reviewNote: ld.status === 'APPROVED' ? 'Approved by Team Lead' : null,
      },
    });

    console.log(`   ✅ ${ld.status}: ${worker.firstName} ${worker.lastName} - ${ld.type}`);
  }

  // ============================================================
  // 10. CREATE INCIDENTS
  // ============================================================
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 10: Creating Incidents');
  console.log('─'.repeat(70));

  const incidentsData = [
    { workerIndex: 1, type: 'INJURY', severity: 'HIGH', status: 'OPEN', title: 'Slip and fall in hallway' },
    { workerIndex: 4, type: 'ILLNESS', severity: 'MEDIUM', status: 'IN_PROGRESS', title: 'Flu symptoms reported' },
    { workerIndex: 7, type: 'EQUIPMENT', severity: 'LOW', status: 'RESOLVED', title: 'Computer malfunction' },
  ];

  for (let i = 0; i < incidentsData.length; i++) {
    const id = incidentsData[i];
    const worker = workers[id.workerIndex];
    const caseNumber = `INC-${now.year}-DEMO${i + 1}`;

    await prisma.incident.create({
      data: {
        companyId: company.id,
        reportedBy: worker.id,
        teamId: teams[worker.teamIndex].id,
        caseNumber,
        title: id.title,
        description: `${id.title} - Details pending investigation.`,
        type: id.type as any,
        severity: id.severity as any,
        status: id.status as any,
        incidentDate: now.minus({ days: Math.floor(Math.random() * 7) }).toJSDate(),
        resolvedAt: id.status === 'RESOLVED' ? new Date() : null,
      },
    });

    console.log(`   ✅ ${caseNumber}: ${id.title} (${id.severity})`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('DEMO DATA CREATED SUCCESSFULLY');
  console.log('='.repeat(70));

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ DEMO COMPANY: ${DEMO_COMPANY_NAME.padEnd(54)}│
├─────────────────────────────────────────────────────────────────────┤
│ USERS CREATED:                                                      │
│   👔 Executive: 1 (Maria Santos)                                    │
│   👁️  Supervisor: 1 (Roberto Villanueva)                            │
│   👤 Team Leads: 3                                                  │
│   👷 Workers: 12                                                    │
│   📊 Total: 17 users                                                │
├─────────────────────────────────────────────────────────────────────┤
│ TEAMS:                                                              │
│   1. Operations Team (MON-FRI, 08:00-17:00) - 5 workers             │
│   2. Night Shift Team (MON-SAT, 22:00-06:00) - 4 workers            │
│   3. Weekend Support (SAT-SUN, 09:00-18:00) - 3 workers             │
├─────────────────────────────────────────────────────────────────────┤
│ DATA:                                                               │
│   📋 Check-ins: ${totalCheckins.toString().padEnd(52)}│
│   🎉 Holidays: 3                                                    │
│   📝 Leave Requests: 4                                              │
│   🚨 Incidents: 3                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ LOGIN CREDENTIALS (for testing):                                    │
│   Note: These are demo accounts without Supabase auth               │
│   Use the existing auth flow or create real users                   │
└─────────────────────────────────────────────────────────────────────┘

📧 Demo Emails:
   Executive: executive@demo_philhealth.demo
   Supervisor: supervisor@demo_philhealth.demo
   Team Leads: juan.delacruz@demo_philhealth.demo
               pedro.reyes@demo_philhealth.demo
               ana.garcia@demo_philhealth.demo
`);
}

createDemoData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
