import { createClient } from '@supabase/supabase-js';
import { PrismaClient, Role, ReadinessStatus, AttendanceStatus, ExceptionStatus, ExceptionType, IncidentStatus, IncidentSeverity, IncidentType, LowScoreReason } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default password for all test users
const TEST_PASSWORD = 'Test@123456';

// Helper to create dates
function date(daysAgo: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dateOnly(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Calculate readiness score
function calculateReadiness(mood: number, stress: number, sleep: number, physical: number): { score: number; status: ReadinessStatus } {
  const score = (mood + (6 - stress) + sleep + physical) / 4 * 20;
  let status: ReadinessStatus;
  if (score >= 70) status = 'GREEN';
  else if (score >= 40) status = 'YELLOW';
  else status = 'RED';
  return { score, status };
}

// Create Supabase Auth user and return the ID
async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  }

  return data.user.id;
}

async function clearAll() {
  console.log('🧹 Clearing all data...\n');

  // Clear Prisma first
  console.log('Clearing Prisma database...');
  await prisma.pulseSurveyResponse.deleteMany();
  await prisma.pulseSurvey.deleteMany();
  await prisma.recognition.deleteMany();
  await prisma.oneOnOne.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.wellnessSnapshot.deleteMany();
  await prisma.aISummary.deleteMany();
  await prisma.systemLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.filledPDFForm.deleteMany();
  await prisma.pDFTemplate.deleteMany();
  await prisma.incidentActivity.deleteMany();
  await prisma.dailyAttendance.deleteMany();
  await prisma.exception.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.rehabilitation.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.company.deleteMany();
  console.log('✅ Prisma database cleared');

  // Clear Supabase Auth users
  console.log('Clearing Supabase Auth users...');
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  if (authUsers?.users) {
    for (const user of authUsers.users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
    console.log(`✅ Deleted ${authUsers.users.length} Supabase Auth users`);
  }

  console.log('');
}

async function seedMockData() {
  console.log('🌱 Seeding mock data for Aegira...\n');

  // ============================================
  // 1. CREATE COMPANY
  // ============================================
  console.log('Creating company...');
  const company = await prisma.company.create({
    data: {
      name: 'Aegira Construction Corp',
      slug: 'aegira-construction',
      industry: 'Construction',
      size: '51-200',
      address: '123 EDSA, Makati City',
      phone: '+63 2 8888 1234',
      timezone: 'Asia/Manila',
      isActive: true,
    },
  });
  console.log(`✅ Company created: ${company.name}`);

  // ============================================
  // 2. CREATE TEAMS
  // ============================================
  console.log('\nCreating teams...');

  const teamAlpha = await prisma.team.create({
    data: {
      name: 'Alpha Team - Day Shift',
      description: 'Primary construction crew - morning operations',
      companyId: company.id,
      workDays: 'MON,TUE,WED,THU,FRI',
      shiftStart: '06:00',
      shiftEnd: '15:00',
      isActive: true,
    },
  });

  const teamBravo = await prisma.team.create({
    data: {
      name: 'Bravo Team - Afternoon Shift',
      description: 'Secondary construction crew - afternoon operations',
      companyId: company.id,
      workDays: 'MON,TUE,WED,THU,FRI,SAT',
      shiftStart: '14:00',
      shiftEnd: '23:00',
      isActive: true,
    },
  });

  const teamOffice = await prisma.team.create({
    data: {
      name: 'Office & Admin Team',
      description: 'Administrative and office personnel',
      companyId: company.id,
      workDays: 'MON,TUE,WED,THU,FRI',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      isActive: true,
    },
  });

  console.log(`✅ Teams created: 3`);

  // ============================================
  // 3. CREATE USERS (Auth + Prisma)
  // ============================================
  console.log('\nCreating users (Supabase Auth + Prisma)...');

  // Define all users
  const userDefs = [
    { email: 'carlos.reyes@aegira.com', firstName: 'Carlos', lastName: 'Reyes', role: Role.EXECUTIVE, teamId: null },
    { email: 'maria.santos@aegira.com', firstName: 'Maria', lastName: 'Santos', role: Role.SUPERVISOR, teamId: null },
    { email: 'pedro.cruz@aegira.com', firstName: 'Pedro', lastName: 'Cruz', role: Role.WHS_CONTROL, teamId: null },
    { email: 'anna.garcia@aegira.com', firstName: 'Anna', lastName: 'Garcia', role: Role.CLINICIAN, teamId: null },
    { email: 'juan.dela.cruz@aegira.com', firstName: 'Juan', lastName: 'Dela Cruz', role: Role.TEAM_LEAD, teamId: teamAlpha.id },
    { email: 'rosa.mendoza@aegira.com', firstName: 'Rosa', lastName: 'Mendoza', role: Role.TEAM_LEAD, teamId: teamBravo.id },
    { email: 'marco.villanueva@aegira.com', firstName: 'Marco', lastName: 'Villanueva', role: Role.TEAM_LEAD, teamId: teamOffice.id },
    // Alpha workers
    { email: 'miguel.santos@aegira.com', firstName: 'Miguel', lastName: 'Santos', role: Role.WORKER, teamId: teamAlpha.id, joinedDays: 60 },
    { email: 'jose.ramos@aegira.com', firstName: 'Jose', lastName: 'Ramos', role: Role.WORKER, teamId: teamAlpha.id, joinedDays: 45 },
    { email: 'antonio.lopez@aegira.com', firstName: 'Antonio', lastName: 'Lopez', role: Role.WORKER, teamId: teamAlpha.id, joinedDays: 30 },
    { email: 'roberto.fernandez@aegira.com', firstName: 'Roberto', lastName: 'Fernandez', role: Role.WORKER, teamId: teamAlpha.id, joinedDays: 90 },
    { email: 'david.gonzales@aegira.com', firstName: 'David', lastName: 'Gonzales', role: Role.WORKER, teamId: teamAlpha.id, joinedDays: 20 },
    // Bravo workers
    { email: 'luis.martinez@aegira.com', firstName: 'Luis', lastName: 'Martinez', role: Role.WORKER, teamId: teamBravo.id, joinedDays: 50 },
    { email: 'carlos.rivera@aegira.com', firstName: 'Carlos Jr.', lastName: 'Rivera', role: Role.WORKER, teamId: teamBravo.id, joinedDays: 40 },
    { email: 'fernando.castro@aegira.com', firstName: 'Fernando', lastName: 'Castro', role: Role.WORKER, teamId: teamBravo.id, joinedDays: 35 },
    { email: 'ricardo.bautista@aegira.com', firstName: 'Ricardo', lastName: 'Bautista', role: Role.WORKER, teamId: teamBravo.id, joinedDays: 25 },
    // Office workers
    { email: 'angela.reyes@aegira.com', firstName: 'Angela', lastName: 'Reyes', role: Role.WORKER, teamId: teamOffice.id, joinedDays: 55 },
    { email: 'christina.tan@aegira.com', firstName: 'Christina', lastName: 'Tan', role: Role.WORKER, teamId: teamOffice.id, joinedDays: 70 },
    { email: 'michelle.lim@aegira.com', firstName: 'Michelle', lastName: 'Lim', role: Role.WORKER, teamId: teamOffice.id, joinedDays: 15 },
  ];

  const users: { [key: string]: any } = {};

  for (const def of userDefs) {
    try {
      const authId = await createAuthUser(def.email);
      const user = await prisma.user.create({
        data: {
          id: authId,
          email: def.email,
          firstName: def.firstName,
          lastName: def.lastName,
          role: def.role,
          companyId: company.id,
          teamId: def.teamId,
          teamJoinedAt: (def as any).joinedDays ? date((def as any).joinedDays) : undefined,
          isActive: true,
        },
      });
      users[def.email] = user;
      console.log(`  ✅ ${def.role.padEnd(12)} ${def.firstName} ${def.lastName}`);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${def.email} - ${error.message}`);
    }
  }

  // Update teams with leaders
  await prisma.team.update({ where: { id: teamAlpha.id }, data: { leaderId: users['juan.dela.cruz@aegira.com'].id } });
  await prisma.team.update({ where: { id: teamBravo.id }, data: { leaderId: users['rosa.mendoza@aegira.com'].id } });
  await prisma.team.update({ where: { id: teamOffice.id }, data: { leaderId: users['marco.villanueva@aegira.com'].id } });

  console.log(`✅ Users created: ${Object.keys(users).length}`);

  // Get user references
  const executive = users['carlos.reyes@aegira.com'];
  const supervisor = users['maria.santos@aegira.com'];
  const whsControl = users['pedro.cruz@aegira.com'];
  const clinician = users['anna.garcia@aegira.com'];
  const tlAlpha = users['juan.dela.cruz@aegira.com'];
  const tlBravo = users['rosa.mendoza@aegira.com'];
  const tlOffice = users['marco.villanueva@aegira.com'];

  const workersAlpha = [
    users['miguel.santos@aegira.com'],
    users['jose.ramos@aegira.com'],
    users['antonio.lopez@aegira.com'],
    users['roberto.fernandez@aegira.com'],
    users['david.gonzales@aegira.com'],
  ];

  const workersBravo = [
    users['luis.martinez@aegira.com'],
    users['carlos.rivera@aegira.com'],
    users['fernando.castro@aegira.com'],
    users['ricardo.bautista@aegira.com'],
  ];

  const workersOffice = [
    users['angela.reyes@aegira.com'],
    users['christina.tan@aegira.com'],
    users['michelle.lim@aegira.com'],
  ];

  // ============================================
  // 4. CREATE HOLIDAYS
  // ============================================
  console.log('\nCreating holidays...');

  const holidays = await Promise.all([
    prisma.holiday.create({
      data: { companyId: company.id, date: dateOnly(3), name: 'Company Foundation Day', createdBy: executive.id },
    }),
    prisma.holiday.create({
      data: { companyId: company.id, date: dateOnly(-5), name: 'Team Building Day', createdBy: executive.id },
    }),
    prisma.holiday.create({
      data: { companyId: company.id, date: dateOnly(10), name: 'National Heroes Day', createdBy: executive.id },
    }),
  ]);
  console.log(`✅ Holidays created: ${holidays.length}`);

  // ============================================
  // 5. CREATE CHECK-INS & DAILY ATTENDANCE
  // ============================================
  console.log('\nCreating check-ins and daily attendance...');

  const allWorkers = [...workersAlpha, ...workersBravo, ...workersOffice, tlAlpha, tlBravo, tlOffice];
  const teamMap: { [key: string]: { id: string; shiftStart: string } } = {
    [teamAlpha.id]: { id: teamAlpha.id, shiftStart: '06:00' },
    [teamBravo.id]: { id: teamBravo.id, shiftStart: '14:00' },
    [teamOffice.id]: { id: teamOffice.id, shiftStart: '09:00' },
  };

  let checkinCount = 0;
  let attendanceCount = 0;

  for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
    const checkDate = dateOnly(daysAgo);
    const dayOfWeek = checkDate.getDay();

    if (dayOfWeek === 0) continue;

    const isHoliday = holidays.some(h => {
      const holidayDate = new Date(h.date);
      return holidayDate.toDateString() === checkDate.toDateString();
    });
    if (isHoliday) continue;

    for (const worker of allWorkers) {
      if (!worker) continue;
      const teamInfo = teamMap[worker.teamId!];
      if (!teamInfo) continue;

      if (dayOfWeek === 6 && worker.teamId !== teamBravo.id) continue;

      const rand = Math.random();
      const [shiftHour] = teamInfo.shiftStart.split(':').map(Number);

      if (rand < 0.10) {
        await prisma.dailyAttendance.create({
          data: {
            userId: worker.id,
            companyId: company.id,
            teamId: worker.teamId!,
            date: checkDate,
            scheduledStart: teamInfo.shiftStart,
            gracePeriodMins: 15,
            checkInTime: null,
            minutesLate: 0,
            status: AttendanceStatus.ABSENT,
            score: 0,
            isCounted: true,
          },
        });
        attendanceCount++;
      } else {
        const isLate = rand >= 0.70;
        const minutesLate = isLate ? Math.floor(Math.random() * 45) + 16 : Math.floor(Math.random() * 15);
        const checkInHour = shiftHour + Math.floor(minutesLate / 60);
        const checkInMinute = minutesLate % 60;
        const checkInTime = date(daysAgo, checkInHour, checkInMinute);

        let mood = Math.floor(Math.random() * 3) + 3;
        let stress = Math.floor(Math.random() * 3) + 1;
        let sleep = Math.floor(Math.random() * 3) + 3;
        let physical = Math.floor(Math.random() * 3) + 3;
        let lowScoreReason: LowScoreReason | null = null;

        if (Math.random() < 0.05) {
          mood = Math.floor(Math.random() * 2) + 1;
          stress = Math.floor(Math.random() * 2) + 4;
          sleep = Math.floor(Math.random() * 2) + 1;
          physical = Math.floor(Math.random() * 2) + 1;
          const reasons = [LowScoreReason.POOR_SLEEP, LowScoreReason.HIGH_STRESS, LowScoreReason.ILLNESS_SICKNESS, LowScoreReason.PERSONAL_ISSUES];
          lowScoreReason = reasons[Math.floor(Math.random() * reasons.length)];
        }

        const { score, status } = calculateReadiness(mood, stress, sleep, physical);

        await prisma.checkin.create({
          data: {
            userId: worker.id,
            companyId: company.id,
            mood,
            stress,
            sleep,
            physicalHealth: physical,
            readinessStatus: status,
            readinessScore: score,
            lowScoreReason,
            createdAt: checkInTime,
          },
        });
        checkinCount++;

        const attendanceStatus = isLate ? AttendanceStatus.YELLOW : AttendanceStatus.GREEN;
        const attendanceScore = isLate ? 75 : 100;

        await prisma.dailyAttendance.create({
          data: {
            userId: worker.id,
            companyId: company.id,
            teamId: worker.teamId!,
            date: checkDate,
            scheduledStart: teamInfo.shiftStart,
            gracePeriodMins: 15,
            checkInTime,
            minutesLate: isLate ? minutesLate : 0,
            status: attendanceStatus,
            score: attendanceScore,
            isCounted: true,
          },
        });
        attendanceCount++;
      }
    }
  }
  console.log(`✅ Check-ins created: ${checkinCount}`);
  console.log(`✅ Daily attendance records created: ${attendanceCount}`);

  // ============================================
  // 6. CREATE EXCEPTIONS
  // ============================================
  console.log('\nCreating exceptions...');

  await prisma.exception.create({
    data: {
      userId: workersAlpha[0].id,
      companyId: company.id,
      type: ExceptionType.SICK_LEAVE,
      reason: 'Flu symptoms, need to rest at home',
      startDate: dateOnly(5),
      endDate: dateOnly(4),
      status: ExceptionStatus.APPROVED,
      reviewedById: tlAlpha.id,
      reviewNote: 'Approved. Get well soon!',
      approvedBy: tlAlpha.firstName + ' ' + tlAlpha.lastName,
      approvedAt: date(4, 10, 30),
      isExemption: false,
    },
  });

  await prisma.exception.create({
    data: {
      userId: workersBravo[1].id,
      companyId: company.id,
      type: ExceptionType.PERSONAL_LEAVE,
      reason: 'Need to attend family reunion in province',
      startDate: dateOnly(-2),
      endDate: dateOnly(-3),
      status: ExceptionStatus.PENDING,
      isExemption: false,
    },
  });

  await prisma.exception.create({
    data: {
      userId: workersAlpha[2].id,
      companyId: company.id,
      type: ExceptionType.OTHER,
      reason: 'Want to watch basketball game',
      startDate: dateOnly(2),
      endDate: dateOnly(2),
      status: ExceptionStatus.REJECTED,
      reviewedById: tlAlpha.id,
      reviewNote: 'Not a valid reason for leave. Please reschedule personal activities.',
      rejectedBy: tlAlpha.firstName + ' ' + tlAlpha.lastName,
      rejectedAt: date(2, 14, 0),
      isExemption: false,
    },
  });

  await prisma.exception.create({
    data: {
      userId: workersOffice[0].id,
      companyId: company.id,
      type: ExceptionType.SICK_LEAVE,
      reason: 'Feeling unwell after check-in, requested to go home',
      status: ExceptionStatus.APPROVED,
      reviewedById: tlOffice.id,
      reviewNote: 'Approved exemption due to low readiness score',
      approvedBy: tlOffice.firstName + ' ' + tlOffice.lastName,
      approvedAt: date(6, 11, 0),
      isExemption: true,
      scoreAtRequest: 35.5,
      startDate: dateOnly(6),
      endDate: dateOnly(6),
    },
  });

  console.log(`✅ Exceptions created: 4`);

  // ============================================
  // 7. CREATE INCIDENTS
  // ============================================
  console.log('\nCreating incidents...');

  const incidentOpen = await prisma.incident.create({
    data: {
      caseNumber: 'INC-2026-0001',
      companyId: company.id,
      type: IncidentType.INJURY,
      title: 'Minor hand injury from equipment',
      description: 'Worker sustained a small cut on left hand while handling steel beams. First aid was administered immediately.',
      severity: IncidentSeverity.LOW,
      status: IncidentStatus.OPEN,
      location: 'Site A - Building 3',
      reportedBy: workersAlpha[3].id,
      teamId: teamAlpha.id,
      incidentDate: date(2, 10, 30),
    },
  });

  const incidentInProgress = await prisma.incident.create({
    data: {
      caseNumber: 'INC-2026-0002',
      companyId: company.id,
      type: IncidentType.EQUIPMENT,
      title: 'Crane malfunction reported',
      description: 'Tower crane showing unusual vibration during operation. Halted all crane operations pending inspection.',
      severity: IncidentSeverity.HIGH,
      status: IncidentStatus.IN_PROGRESS,
      location: 'Site B - Main Tower',
      reportedBy: tlBravo.id,
      assignedTo: whsControl.id,
      teamId: teamBravo.id,
      incidentDate: date(1, 14, 45),
    },
  });

  const incidentResolved = await prisma.incident.create({
    data: {
      caseNumber: 'INC-2026-0003',
      companyId: company.id,
      type: IncidentType.MENTAL_HEALTH,
      title: 'Worker showing signs of stress',
      description: 'Team lead noticed worker showing signs of severe stress and anxiety. Referred to company clinician.',
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.RESOLVED,
      reportedBy: tlAlpha.id,
      assignedTo: clinician.id,
      teamId: teamAlpha.id,
      incidentDate: date(8, 9, 0),
      resolvedAt: date(5, 16, 0),
    },
  });

  await prisma.incident.create({
    data: {
      caseNumber: 'INC-2025-0045',
      companyId: company.id,
      type: IncidentType.ILLNESS,
      title: 'Worker hospitalized due to dehydration',
      description: 'Worker collapsed due to severe dehydration during hot afternoon shift. Rushed to nearby hospital.',
      severity: IncidentSeverity.HIGH,
      status: IncidentStatus.CLOSED,
      location: 'Site A - Outdoor Area',
      reportedBy: workersBravo[0].id,
      assignedTo: clinician.id,
      teamId: teamBravo.id,
      incidentDate: date(20, 15, 30),
      resolvedAt: date(12, 10, 0),
      rtwCertificateUrl: '/uploads/rtw/rtw-cert-0045.pdf',
      rtwCertDate: dateOnly(12),
      rtwUploadedAt: date(12, 10, 0),
      rtwUploadedBy: clinician.id,
      rtwNotes: 'Worker cleared for full duty. Advised to maintain proper hydration.',
    },
  });

  console.log(`✅ Incidents created: 4`);

  // ============================================
  // 8. CREATE INCIDENT ACTIVITIES
  // ============================================
  console.log('\nCreating incident activities...');

  await prisma.incidentActivity.createMany({
    data: [
      { incidentId: incidentInProgress.id, userId: tlBravo.id, type: 'CREATED', newValue: 'OPEN', createdAt: date(1, 14, 45) },
      { incidentId: incidentInProgress.id, userId: supervisor.id, type: 'STATUS_CHANGED', oldValue: 'OPEN', newValue: 'IN_PROGRESS', createdAt: date(1, 15, 30) },
      { incidentId: incidentInProgress.id, userId: supervisor.id, type: 'ASSIGNED', newValue: whsControl.id, createdAt: date(1, 15, 32) },
      { incidentId: incidentInProgress.id, userId: whsControl.id, type: 'COMMENT', comment: 'Inspection scheduled for tomorrow morning. All crane operations remain suspended.', createdAt: date(1, 16, 0) },
      { incidentId: incidentResolved.id, userId: tlAlpha.id, type: 'CREATED', newValue: 'OPEN', createdAt: date(8, 9, 0) },
      { incidentId: incidentResolved.id, userId: clinician.id, type: 'COMMENT', comment: 'Met with worker. Recommended 3 counseling sessions. Worker agreed to participate.', createdAt: date(7, 14, 0) },
      { incidentId: incidentResolved.id, userId: clinician.id, type: 'RESOLVED', oldValue: 'IN_PROGRESS', newValue: 'RESOLVED', comment: 'Worker completed counseling sessions. Showing significant improvement.', createdAt: date(5, 16, 0) },
    ],
  });

  console.log(`✅ Incident activities created: 7`);

  // ============================================
  // 9. CREATE NOTIFICATIONS
  // ============================================
  console.log('\nCreating notifications...');

  await prisma.notification.createMany({
    data: [
      { userId: tlAlpha.id, companyId: company.id, title: 'New Exception Request', message: `${workersAlpha[0].firstName} ${workersAlpha[0].lastName} has submitted a sick leave request.`, type: 'EXCEPTION_REQUEST', isRead: true, createdAt: date(5, 8, 0) },
      { userId: tlBravo.id, companyId: company.id, title: 'New Exception Request', message: `${workersBravo[1].firstName} ${workersBravo[1].lastName} has submitted a personal leave request.`, type: 'EXCEPTION_REQUEST', isRead: false, createdAt: date(1, 9, 0) },
      { userId: workersAlpha[0].id, companyId: company.id, title: 'Exception Approved', message: 'Your sick leave request has been approved by your team leader.', type: 'EXCEPTION_APPROVED', isRead: true, createdAt: date(4, 10, 30) },
      { userId: workersAlpha[2].id, companyId: company.id, title: 'Exception Rejected', message: 'Your leave request has been rejected. Reason: Not a valid reason for leave.', type: 'EXCEPTION_REJECTED', isRead: false, createdAt: date(2, 14, 0) },
      { userId: whsControl.id, companyId: company.id, title: 'Incident Assigned', message: 'You have been assigned to incident INC-2026-0002: Crane malfunction reported', type: 'INCIDENT_ASSIGNED', isRead: true, createdAt: date(1, 15, 32) },
      { userId: supervisor.id, companyId: company.id, title: 'Critical Incident', message: 'A HIGH severity incident has been reported: Crane malfunction reported', type: 'INCIDENT_CRITICAL', isRead: true, createdAt: date(1, 14, 46) },
      { userId: executive.id, companyId: company.id, title: 'Weekly Summary', message: 'Your weekly wellness summary is ready. Team average readiness: 78%', type: 'WEEKLY_SUMMARY', isRead: false, createdAt: date(0, 8, 0) },
    ],
  });

  console.log(`✅ Notifications created: 7`);

  // ============================================
  // 10. UPDATE USER STREAKS
  // ============================================
  console.log('\nUpdating user streaks...');

  await prisma.user.update({ where: { id: workersAlpha[0].id }, data: { currentStreak: 5, longestStreak: 12, lastCheckinDate: dateOnly(1) } });
  await prisma.user.update({ where: { id: workersAlpha[1].id }, data: { currentStreak: 10, longestStreak: 10, lastCheckinDate: dateOnly(1) } });
  await prisma.user.update({ where: { id: workersBravo[0].id }, data: { currentStreak: 3, longestStreak: 8, lastCheckinDate: dateOnly(1) } });
  await prisma.user.update({ where: { id: tlAlpha.id }, data: { currentStreak: 14, longestStreak: 30, lastCheckinDate: dateOnly(1) } });

  console.log(`✅ User streaks updated`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 MOCK DATA SEEDING COMPLETE!');
  console.log('='.repeat(50));
  console.log(`
📊 Summary:
  • 1 Company: Aegira Construction Corp
  • 3 Teams (Day/Afternoon/Office shifts)
  • 19 Users (Executive, Supervisor, WHS, Clinician, 3 TLs, 12 Workers)
  • 3 Holidays
  • ${checkinCount} Check-ins
  • ${attendanceCount} Daily attendance records
  • 4 Exceptions
  • 4 Incidents
  • 7 Notifications

🔑 LOGIN CREDENTIALS:
  Password for ALL users: ${TEST_PASSWORD}

📧 Test Accounts:
  EXECUTIVE     carlos.reyes@aegira.com
  SUPERVISOR    maria.santos@aegira.com
  WHS_CONTROL   pedro.cruz@aegira.com
  CLINICIAN     anna.garcia@aegira.com
  TEAM_LEAD     juan.dela.cruz@aegira.com
  TEAM_LEAD     rosa.mendoza@aegira.com
  TEAM_LEAD     marco.villanueva@aegira.com
  WORKER        miguel.santos@aegira.com
`);
}

async function main() {
  await clearAll();
  await seedMockData();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
