import { PrismaClient, Role, ReadinessStatus, AttendanceStatus, ExceptionStatus, ExceptionType, IncidentStatus, IncidentSeverity, IncidentType, LowScoreReason } from '@prisma/client';

const prisma = new PrismaClient();

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

  // Team 1: Day shift (6 AM - 3 PM)
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

  // Team 2: Afternoon shift (2 PM - 11 PM)
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

  // Team 3: Office team (9 AM - 6 PM)
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

  console.log(`✅ Teams created: ${teamAlpha.name}, ${teamBravo.name}, ${teamOffice.name}`);

  // ============================================
  // 3. CREATE USERS
  // ============================================
  console.log('\nCreating users...');

  // Executive
  const executive = await prisma.user.create({
    data: {
      email: 'carlos.reyes@aegira.com',
      firstName: 'Carlos',
      lastName: 'Reyes',
      role: Role.EXECUTIVE,
      companyId: company.id,
      phone: '+63 917 123 4567',
      isActive: true,
    },
  });

  // Supervisor
  const supervisor = await prisma.user.create({
    data: {
      email: 'maria.santos@aegira.com',
      firstName: 'Maria',
      lastName: 'Santos',
      role: Role.SUPERVISOR,
      companyId: company.id,
      phone: '+63 918 234 5678',
      isActive: true,
    },
  });

  // WHS Control
  const whsControl = await prisma.user.create({
    data: {
      email: 'pedro.cruz@aegira.com',
      firstName: 'Pedro',
      lastName: 'Cruz',
      role: Role.WHS_CONTROL,
      companyId: company.id,
      phone: '+63 919 345 6789',
      isActive: true,
    },
  });

  // Clinician
  const clinician = await prisma.user.create({
    data: {
      email: 'anna.garcia@aegira.com',
      firstName: 'Anna',
      lastName: 'Garcia',
      role: Role.CLINICIAN,
      companyId: company.id,
      phone: '+63 920 456 7890',
      isActive: true,
    },
  });

  // Team Lead - Alpha
  const tlAlpha = await prisma.user.create({
    data: {
      email: 'juan.dela.cruz@aegira.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      role: Role.TEAM_LEAD,
      companyId: company.id,
      teamId: teamAlpha.id,
      phone: '+63 921 567 8901',
      isActive: true,
    },
  });

  // Team Lead - Bravo
  const tlBravo = await prisma.user.create({
    data: {
      email: 'rosa.mendoza@aegira.com',
      firstName: 'Rosa',
      lastName: 'Mendoza',
      role: Role.TEAM_LEAD,
      companyId: company.id,
      teamId: teamBravo.id,
      phone: '+63 922 678 9012',
      isActive: true,
    },
  });

  // Team Lead - Office
  const tlOffice = await prisma.user.create({
    data: {
      email: 'marco.villanueva@aegira.com',
      firstName: 'Marco',
      lastName: 'Villanueva',
      role: Role.TEAM_LEAD,
      companyId: company.id,
      teamId: teamOffice.id,
      phone: '+63 923 789 0123',
      isActive: true,
    },
  });

  // Update teams with leaders
  await prisma.team.update({ where: { id: teamAlpha.id }, data: { leaderId: tlAlpha.id } });
  await prisma.team.update({ where: { id: teamBravo.id }, data: { leaderId: tlBravo.id } });
  await prisma.team.update({ where: { id: teamOffice.id }, data: { leaderId: tlOffice.id } });

  // Workers - Alpha Team (5 workers)
  const workersAlpha = await Promise.all([
    prisma.user.create({
      data: {
        email: 'miguel.santos@aegira.com', firstName: 'Miguel', lastName: 'Santos',
        role: Role.WORKER, companyId: company.id, teamId: teamAlpha.id,
        teamJoinedAt: date(60), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'jose.ramos@aegira.com', firstName: 'Jose', lastName: 'Ramos',
        role: Role.WORKER, companyId: company.id, teamId: teamAlpha.id,
        teamJoinedAt: date(45), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'antonio.lopez@aegira.com', firstName: 'Antonio', lastName: 'Lopez',
        role: Role.WORKER, companyId: company.id, teamId: teamAlpha.id,
        teamJoinedAt: date(30), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'roberto.fernandez@aegira.com', firstName: 'Roberto', lastName: 'Fernandez',
        role: Role.WORKER, companyId: company.id, teamId: teamAlpha.id,
        teamJoinedAt: date(90), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'david.gonzales@aegira.com', firstName: 'David', lastName: 'Gonzales',
        role: Role.WORKER, companyId: company.id, teamId: teamAlpha.id,
        teamJoinedAt: date(20), isActive: true,
      },
    }),
  ]);

  // Workers - Bravo Team (4 workers)
  const workersBravo = await Promise.all([
    prisma.user.create({
      data: {
        email: 'luis.martinez@aegira.com', firstName: 'Luis', lastName: 'Martinez',
        role: Role.WORKER, companyId: company.id, teamId: teamBravo.id,
        teamJoinedAt: date(50), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'carlos.rivera@aegira.com', firstName: 'Carlos Jr.', lastName: 'Rivera',
        role: Role.WORKER, companyId: company.id, teamId: teamBravo.id,
        teamJoinedAt: date(40), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'fernando.castro@aegira.com', firstName: 'Fernando', lastName: 'Castro',
        role: Role.WORKER, companyId: company.id, teamId: teamBravo.id,
        teamJoinedAt: date(35), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'ricardo.bautista@aegira.com', firstName: 'Ricardo', lastName: 'Bautista',
        role: Role.WORKER, companyId: company.id, teamId: teamBravo.id,
        teamJoinedAt: date(25), isActive: true,
      },
    }),
  ]);

  // Workers - Office Team (3 workers)
  const workersOffice = await Promise.all([
    prisma.user.create({
      data: {
        email: 'angela.reyes@aegira.com', firstName: 'Angela', lastName: 'Reyes',
        role: Role.WORKER, companyId: company.id, teamId: teamOffice.id,
        teamJoinedAt: date(55), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'christina.tan@aegira.com', firstName: 'Christina', lastName: 'Tan',
        role: Role.WORKER, companyId: company.id, teamId: teamOffice.id,
        teamJoinedAt: date(70), isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'michelle.lim@aegira.com', firstName: 'Michelle', lastName: 'Lim',
        role: Role.WORKER, companyId: company.id, teamId: teamOffice.id,
        teamJoinedAt: date(15), isActive: true,
      },
    }),
  ]);

  console.log(`✅ Users created: 1 Executive, 1 Supervisor, 1 WHS, 1 Clinician, 3 Team Leads, 12 Workers`);

  // ============================================
  // 4. CREATE HOLIDAYS
  // ============================================
  console.log('\nCreating holidays...');

  const holidays = await Promise.all([
    // Past holiday (3 days ago)
    prisma.holiday.create({
      data: {
        companyId: company.id,
        date: dateOnly(3),
        name: 'Company Foundation Day',
        createdBy: executive.id,
      },
    }),
    // Today is NOT a holiday (for testing check-in)
    // Future holiday (in 5 days)
    prisma.holiday.create({
      data: {
        companyId: company.id,
        date: dateOnly(-5),
        name: 'Team Building Day',
        createdBy: executive.id,
      },
    }),
    // Another past holiday (10 days ago)
    prisma.holiday.create({
      data: {
        companyId: company.id,
        date: dateOnly(10),
        name: 'National Heroes Day',
        createdBy: executive.id,
      },
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

  // Create check-ins for the past 14 days (excluding holidays and weekends for some)
  for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
    const checkDate = dateOnly(daysAgo);
    const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    // Check if it's a holiday
    const isHoliday = holidays.some(h => {
      const holidayDate = new Date(h.date);
      return holidayDate.toDateString() === checkDate.toDateString();
    });
    if (isHoliday) continue;

    for (const worker of allWorkers) {
      const teamInfo = teamMap[worker.teamId!];
      if (!teamInfo) continue;

      // Skip Saturdays for teams that don't work on Saturday
      if (dayOfWeek === 6 && worker.teamId !== teamBravo.id) continue;

      // Randomize check-in behavior
      const rand = Math.random();
      const [shiftHour] = teamInfo.shiftStart.split(':').map(Number);

      // 70% on-time, 20% late, 10% absent
      if (rand < 0.10) {
        // ABSENT - no check-in, create attendance record only
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
        // Check-in exists
        const isLate = rand >= 0.70;
        const minutesLate = isLate ? Math.floor(Math.random() * 45) + 16 : Math.floor(Math.random() * 15);
        const checkInHour = shiftHour + Math.floor(minutesLate / 60);
        const checkInMinute = minutesLate % 60;
        const checkInTime = date(daysAgo, checkInHour, checkInMinute);

        // Randomize wellness scores
        const mood = Math.floor(Math.random() * 3) + 3; // 3-5
        const stress = Math.floor(Math.random() * 3) + 1; // 1-3 (low stress is good)
        const sleep = Math.floor(Math.random() * 3) + 3; // 3-5
        const physical = Math.floor(Math.random() * 3) + 3; // 3-5

        // Sometimes create RED check-ins
        let finalMood = mood;
        let finalStress = stress;
        let finalSleep = sleep;
        let finalPhysical = physical;
        let lowScoreReason: LowScoreReason | null = null;

        if (Math.random() < 0.05) {
          // 5% chance of RED check-in
          finalMood = Math.floor(Math.random() * 2) + 1;
          finalStress = Math.floor(Math.random() * 2) + 4;
          finalSleep = Math.floor(Math.random() * 2) + 1;
          finalPhysical = Math.floor(Math.random() * 2) + 1;
          const reasons = [LowScoreReason.POOR_SLEEP, LowScoreReason.HIGH_STRESS, LowScoreReason.ILLNESS_SICKNESS, LowScoreReason.PERSONAL_ISSUES];
          lowScoreReason = reasons[Math.floor(Math.random() * reasons.length)];
        }

        const { score, status } = calculateReadiness(finalMood, finalStress, finalSleep, finalPhysical);

        const checkin = await prisma.checkin.create({
          data: {
            userId: worker.id,
            companyId: company.id,
            mood: finalMood,
            stress: finalStress,
            sleep: finalSleep,
            physicalHealth: finalPhysical,
            readinessStatus: status,
            readinessScore: score,
            lowScoreReason,
            createdAt: checkInTime,
          },
        });
        checkinCount++;

        // Create attendance record
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

  // Approved exception (sick leave) - for worker who was "absent"
  const exceptionApproved = await prisma.exception.create({
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

  // Pending exception
  const exceptionPending = await prisma.exception.create({
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

  // Rejected exception
  const exceptionRejected = await prisma.exception.create({
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

  // Exemption (triggered by RED check-in)
  const exceptionExemption = await prisma.exception.create({
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

  console.log(`✅ Exceptions created: 4 (1 approved, 1 pending, 1 rejected, 1 exemption)`);

  // ============================================
  // 7. CREATE INCIDENTS
  // ============================================
  console.log('\nCreating incidents...');

  // Open incident
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

  // In Progress incident
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

  // Resolved incident
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

  // Closed incident with RTW
  const incidentClosed = await prisma.incident.create({
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

  console.log(`✅ Incidents created: 4 (1 open, 1 in-progress, 1 resolved, 1 closed)`);

  // ============================================
  // 8. CREATE INCIDENT ACTIVITIES
  // ============================================
  console.log('\nCreating incident activities...');

  await prisma.incidentActivity.createMany({
    data: [
      {
        incidentId: incidentInProgress.id,
        userId: tlBravo.id,
        type: 'CREATED',
        newValue: 'OPEN',
        createdAt: date(1, 14, 45),
      },
      {
        incidentId: incidentInProgress.id,
        userId: supervisor.id,
        type: 'STATUS_CHANGED',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        createdAt: date(1, 15, 30),
      },
      {
        incidentId: incidentInProgress.id,
        userId: supervisor.id,
        type: 'ASSIGNED',
        newValue: whsControl.id,
        createdAt: date(1, 15, 32),
      },
      {
        incidentId: incidentInProgress.id,
        userId: whsControl.id,
        type: 'COMMENT',
        comment: 'Inspection scheduled for tomorrow morning. All crane operations remain suspended.',
        createdAt: date(1, 16, 0),
      },
      {
        incidentId: incidentResolved.id,
        userId: tlAlpha.id,
        type: 'CREATED',
        newValue: 'OPEN',
        createdAt: date(8, 9, 0),
      },
      {
        incidentId: incidentResolved.id,
        userId: clinician.id,
        type: 'COMMENT',
        comment: 'Met with worker. Recommended 3 counseling sessions. Worker agreed to participate.',
        createdAt: date(7, 14, 0),
      },
      {
        incidentId: incidentResolved.id,
        userId: clinician.id,
        type: 'RESOLVED',
        oldValue: 'IN_PROGRESS',
        newValue: 'RESOLVED',
        comment: 'Worker completed counseling sessions. Showing significant improvement.',
        createdAt: date(5, 16, 0),
      },
    ],
  });

  console.log(`✅ Incident activities created: 7`);

  // ============================================
  // 9. CREATE NOTIFICATIONS
  // ============================================
  console.log('\nCreating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        userId: tlAlpha.id,
        companyId: company.id,
        title: 'New Exception Request',
        message: `${workersAlpha[0].firstName} ${workersAlpha[0].lastName} has submitted a sick leave request.`,
        type: 'EXCEPTION_REQUEST',
        isRead: true,
        createdAt: date(5, 8, 0),
      },
      {
        userId: tlBravo.id,
        companyId: company.id,
        title: 'New Exception Request',
        message: `${workersBravo[1].firstName} ${workersBravo[1].lastName} has submitted a personal leave request.`,
        type: 'EXCEPTION_REQUEST',
        isRead: false,
        createdAt: date(1, 9, 0),
      },
      {
        userId: workersAlpha[0].id,
        companyId: company.id,
        title: 'Exception Approved',
        message: 'Your sick leave request has been approved by your team leader.',
        type: 'EXCEPTION_APPROVED',
        isRead: true,
        createdAt: date(4, 10, 30),
      },
      {
        userId: workersAlpha[2].id,
        companyId: company.id,
        title: 'Exception Rejected',
        message: 'Your leave request has been rejected. Reason: Not a valid reason for leave.',
        type: 'EXCEPTION_REJECTED',
        isRead: false,
        createdAt: date(2, 14, 0),
      },
      {
        userId: whsControl.id,
        companyId: company.id,
        title: 'Incident Assigned',
        message: 'You have been assigned to incident INC-2026-0002: Crane malfunction reported',
        type: 'INCIDENT_ASSIGNED',
        isRead: true,
        createdAt: date(1, 15, 32),
      },
      {
        userId: supervisor.id,
        companyId: company.id,
        title: 'Critical Incident',
        message: 'A HIGH severity incident has been reported: Crane malfunction reported',
        type: 'INCIDENT_CRITICAL',
        isRead: true,
        createdAt: date(1, 14, 46),
      },
      {
        userId: executive.id,
        companyId: company.id,
        title: 'Weekly Summary',
        message: 'Your weekly wellness summary is ready. Team average readiness: 78%',
        type: 'WEEKLY_SUMMARY',
        isRead: false,
        createdAt: date(0, 8, 0),
      },
    ],
  });

  console.log(`✅ Notifications created: 7`);

  // ============================================
  // 10. UPDATE USER STREAKS
  // ============================================
  console.log('\nUpdating user streaks...');

  // Update some users with streaks
  await prisma.user.update({
    where: { id: workersAlpha[0].id },
    data: { currentStreak: 5, longestStreak: 12, lastCheckinDate: dateOnly(1) },
  });
  await prisma.user.update({
    where: { id: workersAlpha[1].id },
    data: { currentStreak: 10, longestStreak: 10, lastCheckinDate: dateOnly(1) },
  });
  await prisma.user.update({
    where: { id: workersBravo[0].id },
    data: { currentStreak: 3, longestStreak: 8, lastCheckinDate: dateOnly(1) },
  });
  await prisma.user.update({
    where: { id: tlAlpha.id },
    data: { currentStreak: 14, longestStreak: 30, lastCheckinDate: dateOnly(1) },
  });

  console.log(`✅ User streaks updated`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n========================================');
  console.log('🎉 MOCK DATA SEEDING COMPLETE!');
  console.log('========================================\n');
  console.log('Summary:');
  console.log('- 1 Company: Aegira Construction Corp');
  console.log('- 3 Teams: Alpha (Day), Bravo (Afternoon), Office');
  console.log('- 19 Users total:');
  console.log('  • 1 Executive');
  console.log('  • 1 Supervisor');
  console.log('  • 1 WHS Control');
  console.log('  • 1 Clinician');
  console.log('  • 3 Team Leads');
  console.log('  • 12 Workers');
  console.log(`- ${holidays.length} Holidays`);
  console.log(`- ${checkinCount} Check-ins (past 14 days)`);
  console.log(`- ${attendanceCount} Daily attendance records`);
  console.log('- 4 Exceptions (approved, pending, rejected, exemption)');
  console.log('- 4 Incidents (open, in-progress, resolved, closed)');
  console.log('- 7 Notifications');
  console.log('\n📧 Test Login Emails:');
  console.log('  Executive: carlos.reyes@aegira.com');
  console.log('  Supervisor: maria.santos@aegira.com');
  console.log('  WHS Control: pedro.cruz@aegira.com');
  console.log('  Clinician: anna.garcia@aegira.com');
  console.log('  Team Lead (Alpha): juan.dela.cruz@aegira.com');
  console.log('  Team Lead (Bravo): rosa.mendoza@aegira.com');
  console.log('  Team Lead (Office): marco.villanueva@aegira.com');
  console.log('  Worker: miguel.santos@aegira.com');
  console.log('\n');
}

seedMockData()
  .catch((e) => {
    console.error('Error seeding mock data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
