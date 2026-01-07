/**
 * Seed Script - Populates database with realistic test data
 *
 * Usage:
 *   npm run seed         - Add test data
 *   npm run seed:clean   - Remove test data
 *   npm run seed:reset   - Clean + Seed (fresh start)
 */

import { PrismaClient, Role, ReadinessStatus, AttendanceStatus, ExceptionStatus, ExceptionType, IncidentStatus, IncidentSeverity, IncidentType } from '@prisma/client';
import { supabaseAdmin } from '../src/config/supabase.js';

const prisma = new PrismaClient();

// Default password for all test accounts
const TEST_PASSWORD = 'Test123!';

// Test company identifier - used to identify and clean up test data
const TEST_COMPANY_SLUG = 'test-company-aegira';

// Configuration
const CONFIG = {
  daysOfHistory: 400, // How many days of check-in history to generate (back to Jan 2025)
  teamsCount: 4,
  workersPerTeam: { min: 4, max: 7 },
  checkinProbability: 0.85, // 85% chance of checking in on work days
  lateProbability: 0.15, // 15% of check-ins are late
  exceptionProbability: 0.05, // 5% chance of having an exception on a work day
};

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Create user in both Supabase Auth and Prisma
async function createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  companyId: string;
  teamId?: string;
  teamJoinedAt?: Date;
}): Promise<{ id: string; email: string; firstName: string; lastName: string; role: Role; teamId: string | null; teamJoinedAt: Date | null }> {
  // Create in Supabase Auth first
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    throw new Error(`Failed to create Supabase user ${data.email}: ${authError.message}`);
  }

  // Create in Prisma with same ID
  const user = await prisma.user.create({
    data: {
      id: authData.user.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      companyId: data.companyId,
      teamId: data.teamId,
      teamJoinedAt: data.teamJoinedAt,
    }
  });

  return user;
}

// Generate realistic readiness scores based on metrics
function calculateReadiness(mood: number, stress: number, sleep: number, physical: number): { score: number; status: ReadinessStatus } {
  // Invert stress (high stress = low score)
  const stressScore = 10 - stress;
  const score = Math.round(((mood + stressScore + sleep + physical) / 40) * 100);

  let status: ReadinessStatus;
  if (score >= 70) status = ReadinessStatus.GREEN;
  else if (score >= 40) status = ReadinessStatus.YELLOW;
  else status = ReadinessStatus.RED;

  return { score, status };
}

// Check if a date is a work day
function isWorkDay(date: Date, workDays: string): boolean {
  const dayMap: Record<number, string> = {
    0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
  };
  const dayStr = dayMap[date.getDay()];
  return workDays.split(',').map(d => d.trim()).includes(dayStr);
}

// Sample data - PHYSIOWARD worker names
const firstNames = [
  'Physio', 'Ward', 'Theo', 'Rehab', 'Kinetic', 'Flex', 'Motion', 'Vitality',
  'Healer', 'Restore', 'Balance', 'Strength', 'Core', 'Agile', 'Wellness',
  'Recovery', 'Therapy', 'Mobility', 'Active', 'Vital', 'Health', 'Fit',
  'Strong', 'Nimble', 'Swift', 'Steady', 'Power', 'Energy', 'Dynamic', 'Pulse'
];

const lastNames = [
  'PhysioOne', 'WardTwo', 'TherapyPro', 'RehabMax', 'FlexCore', 'MotionPlus',
  'VitalCare', 'HealWell', 'RestoreFit', 'BalanceHub', 'StrengthLab', 'CoreFlex',
  'AgileMed', 'WellnessRx', 'RecoverNow', 'MobilityPro', 'ActiveCare', 'VitalForce',
  'HealthMax', 'FitFirst', 'StrongCore', 'SwiftHeal', 'PowerTherapy', 'EnergyPlus'
];

const teamConfigs = [
  { name: 'Updater Team', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '08:00', shiftEnd: '17:00' },
  { name: 'Beta Team', workDays: 'MON,TUE,WED,THU,FRI', shiftStart: '09:00', shiftEnd: '18:00' },
  { name: 'Gamma Team', workDays: 'TUE,WED,THU,FRI,SAT', shiftStart: '07:00', shiftEnd: '16:00' },
  { name: 'Delta Team', workDays: 'MON,TUE,WED,THU,FRI,SAT', shiftStart: '06:00', shiftEnd: '14:00' },
];

// Worker profiles (determines their check-in patterns)
type WorkerProfile = 'excellent' | 'good' | 'average' | 'poor';

const profileWeights: Record<WorkerProfile, { checkinProb: number; lateProb: number; moodRange: [number, number]; stressRange: [number, number] }> = {
  excellent: { checkinProb: 0.98, lateProb: 0.02, moodRange: [7, 10], stressRange: [1, 4] },
  good: { checkinProb: 0.90, lateProb: 0.10, moodRange: [6, 9], stressRange: [2, 5] },
  average: { checkinProb: 0.75, lateProb: 0.20, moodRange: [4, 8], stressRange: [3, 7] },
  poor: { checkinProb: 0.50, lateProb: 0.35, moodRange: [2, 6], stressRange: [5, 9] },
};

// ============================================
// SEED FUNCTIONS
// ============================================

async function seed() {
  console.log('🌱 Starting seed process...\n');

  // Check if test company already exists
  const existingCompany = await prisma.company.findUnique({
    where: { slug: TEST_COMPANY_SLUG }
  });

  if (existingCompany) {
    console.log('⚠️  Test company already exists. Run "npm run seed:clean" first to remove existing data.\n');
    return;
  }

  // 1. Create Company
  console.log('📦 Creating test company...');
  const company = await prisma.company.create({
    data: {
      name: 'Company',
      slug: TEST_COMPANY_SLUG,
      industry: 'Technology',
      size: '51-200',
      address: '123 Test Street, Manila, Philippines',
      phone: '+63 912 345 6789',
      timezone: 'Asia/Manila',
    }
  });
  console.log(`   ✓ Company created: ${company.name}\n`);

  // 2. Create Executive user
  console.log('👤 Creating executive user...');
  const executive = await createUser({
    email: 'executive@test.aegira.com',
    firstName: 'Test',
    lastName: 'Executive',
    role: Role.EXECUTIVE,
    companyId: company.id,
  });
  console.log(`   ✓ Executive: ${executive.email}\n`);

  // 3. Create Supervisor
  console.log('👤 Creating supervisor...');
  const supervisor = await createUser({
    email: 'supervisor@test.aegira.com',
    firstName: 'Test',
    lastName: 'Supervisor',
    role: Role.SUPERVISOR,
    companyId: company.id,
  });
  console.log(`   ✓ Supervisor: ${supervisor.email}\n`);

  // 4. Create Teams and Team Leaders
  console.log('👥 Creating teams and team leaders...');
  const teams: Array<{ team: any; leader: any; config: typeof teamConfigs[0] }> = [];

  for (let i = 0; i < CONFIG.teamsCount; i++) {
    const config = teamConfigs[i];

    // Create team leader
    const leaderFirstName = randomElement(firstNames);
    const leaderLastName = randomElement(lastNames);
    const leader = await createUser({
      email: `teamlead${i + 1}@test.aegira.com`,
      firstName: leaderFirstName,
      lastName: leaderLastName,
      role: Role.TEAM_LEAD,
      companyId: company.id,
    });

    // Create team with old createdAt date (January 2025) for historical data
    const team = await prisma.team.create({
      data: {
        name: config.name,
        description: `${config.name} - Work schedule: ${config.workDays}`,
        companyId: company.id,
        leaderId: leader.id,
        workDays: config.workDays,
        shiftStart: config.shiftStart,
        shiftEnd: config.shiftEnd,
        createdAt: new Date('2025-01-01'),
      }
    });

    teams.push({ team, leader, config });
    console.log(`   ✓ ${team.name} (Leader: ${leader.firstName} ${leader.lastName})`);
  }
  console.log('');

  // 5. Create Workers and assign to teams
  console.log('👷 Creating workers...');
  const allWorkers: Array<{ user: any; team: any; profile: WorkerProfile }> = [];
  const usedEmails = new Set<string>();

  for (const { team, config } of teams) {
    const workerCount = randomInt(CONFIG.workersPerTeam.min, CONFIG.workersPerTeam.max);

    for (let i = 0; i < workerCount; i++) {
      let firstName: string, lastName: string, email: string;

      // Generate unique email (remove spaces from names)
      do {
        firstName = randomElement(firstNames);
        lastName = randomElement(lastNames);
        const cleanFirstName = firstName.toLowerCase().replace(/\s+/g, '');
        const cleanLastName = lastName.toLowerCase().replace(/\s+/g, '');
        email = `${cleanFirstName}.${cleanLastName}${randomInt(1, 999)}@test.aegira.com`;
      } while (usedEmails.has(email));
      usedEmails.add(email);

      // Assign a profile (determines their check-in patterns)
      const profiles: WorkerProfile[] = ['excellent', 'excellent', 'good', 'good', 'good', 'average', 'average', 'poor'];
      const profile = randomElement(profiles);

      // Set join date to early January 2025 for historical data
      const teamJoinedAt = new Date('2025-01-05');
      // Add some variance (0-10 days) so not everyone joined on the same day
      teamJoinedAt.setDate(teamJoinedAt.getDate() + randomInt(0, 10));

      const worker = await createUser({
        email,
        firstName,
        lastName,
        role: Role.WORKER,
        companyId: company.id,
        teamId: team.id,
        teamJoinedAt,
      });

      allWorkers.push({ user: worker, team, profile });
    }

    console.log(`   ✓ ${team.name}: ${workerCount} workers`);
  }
  console.log(`   Total workers: ${allWorkers.length}\n`);

  // 6. Generate Check-ins and Attendance records
  console.log('📋 Generating check-in history...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalCheckins = 0;
  let totalAttendance = 0;
  let totalExceptions = 0;

  for (const { user, team, profile } of allWorkers) {
    const teamConfig = teams.find(t => t.team.id === team.id)!.config;
    const profileConfig = profileWeights[profile];

    // Get user's join date
    const joinDate = new Date(user.teamJoinedAt || today);
    joinDate.setHours(0, 0, 0, 0);

    // Generate history from join date to yesterday
    const startDate = new Date(Math.max(
      joinDate.getTime(),
      today.getTime() - (CONFIG.daysOfHistory * 24 * 60 * 60 * 1000)
    ));

    let currentStreak = 0;
    let longestStreak = 0;
    let lastCheckinDate: Date | null = null;

    // Include today in the loop (d <= today)
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);

      // Skip if not a work day
      if (!isWorkDay(currentDate, teamConfig.workDays)) {
        continue;
      }

      // Determine if there's an exception
      const hasException = Math.random() < CONFIG.exceptionProbability;

      if (hasException) {
        // Create exception
        const exceptionTypes = [ExceptionType.SICK_LEAVE, ExceptionType.PERSONAL_LEAVE, ExceptionType.MEDICAL_APPOINTMENT];
        const exception = await prisma.exception.create({
          data: {
            userId: user.id,
            companyId: company.id,
            type: randomElement(exceptionTypes),
            reason: 'Auto-generated test exception',
            startDate: currentDate,
            endDate: currentDate,
            status: ExceptionStatus.APPROVED,
            approvedAt: currentDate,
          }
        });

        // Create EXCUSED attendance
        await prisma.dailyAttendance.create({
          data: {
            userId: user.id,
            companyId: company.id,
            teamId: team.id,
            date: currentDate,
            scheduledStart: teamConfig.shiftStart,
            gracePeriodMins: 30,
            status: AttendanceStatus.EXCUSED,
            score: null,
            isCounted: false,
            exceptionId: exception.id,
          }
        });

        totalExceptions++;
        totalAttendance++;
        currentStreak = 0; // Streak broken
        continue;
      }

      // Determine if worker checks in
      const checksIn = Math.random() < profileConfig.checkinProb;

      if (checksIn) {
        // Occasionally create "bad days" for sudden change detection (5% chance)
        // This simulates real-world scenarios where workers have off days
        const isBadDay = Math.random() < 0.05; // 5% chance of bad day
        
        let mood: number;
        let stress: number;
        let sleep: number;
        let physical: number;
        
        if (isBadDay) {
          // Bad day: Low mood, high stress, poor sleep, poor physical
          mood = randomInt(2, 4); // Very low mood
          stress = randomInt(7, 10); // Very high stress
          sleep = randomInt(2, 5); // Poor sleep
          physical = randomInt(2, 5); // Poor physical health
        } else {
          // Normal day: Use profile-based metrics
          mood = randomInt(profileConfig.moodRange[0], profileConfig.moodRange[1]);
          stress = randomInt(profileConfig.stressRange[0], profileConfig.stressRange[1]);
          sleep = randomInt(4, 10);
          physical = randomInt(5, 10);
        }
        
        const { score, status } = calculateReadiness(mood, stress, sleep, physical);

        // Determine if late
        const isLate = Math.random() < profileConfig.lateProb;
        const minutesLate = isLate ? randomInt(5, 60) : 0;

        // Parse shift start time
        const [shiftHour, shiftMin] = teamConfig.shiftStart.split(':').map(Number);

        // Calculate check-in time
        const checkinTime = new Date(currentDate);
        checkinTime.setHours(shiftHour, shiftMin + minutesLate - (isLate ? 0 : randomInt(0, 25)), randomInt(0, 59), 0);

        // Create check-in
        await prisma.checkin.create({
          data: {
            userId: user.id,
            companyId: company.id,
            mood,
            stress,
            sleep,
            physicalHealth: physical,
            readinessStatus: status,
            readinessScore: score,
            createdAt: checkinTime,
          }
        });

        // Create attendance record
        const attendanceStatus = isLate ? AttendanceStatus.YELLOW : AttendanceStatus.GREEN;
        const attendanceScore = isLate ? 75 : 100;

        await prisma.dailyAttendance.create({
          data: {
            userId: user.id,
            companyId: company.id,
            teamId: team.id,
            date: currentDate,
            scheduledStart: teamConfig.shiftStart,
            gracePeriodMins: 30,
            checkInTime: checkinTime,
            minutesLate,
            status: attendanceStatus,
            score: attendanceScore,
            isCounted: true,
          }
        });

        totalCheckins++;
        totalAttendance++;
        currentStreak++;
        lastCheckinDate = currentDate;

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        // Absent - no check-in
        await prisma.dailyAttendance.create({
          data: {
            userId: user.id,
            companyId: company.id,
            teamId: team.id,
            date: currentDate,
            scheduledStart: teamConfig.shiftStart,
            gracePeriodMins: 30,
            status: AttendanceStatus.ABSENT,
            score: 0,
            isCounted: true,
          }
        });

        totalAttendance++;
        currentStreak = 0; // Streak broken
      }
    }

    // Update user streaks
    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentStreak,
        longestStreak,
        lastCheckinDate,
      }
    });
  }

  console.log(`   ✓ Check-ins created: ${totalCheckins}`);
  console.log(`   ✓ Attendance records: ${totalAttendance}`);
  console.log(`   ✓ Exceptions (approved): ${totalExceptions}\n`);

  // 7. Create some incidents
  console.log('🚨 Creating sample incidents...');
  const incidentCount = randomInt(5, 10);

  for (let i = 0; i < incidentCount; i++) {
    const reporter = randomElement(allWorkers).user;
    const team = teams.find(t => t.team.id === reporter.teamId)?.team;
    const daysAgo = randomInt(1, 30);
    const incidentDate = new Date();
    incidentDate.setDate(incidentDate.getDate() - daysAgo);

    const statuses = [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CLOSED];
    const severities = [IncidentSeverity.LOW, IncidentSeverity.MEDIUM, IncidentSeverity.HIGH];
    const types = [IncidentType.INJURY, IncidentType.ILLNESS, IncidentType.MENTAL_HEALTH, IncidentType.EQUIPMENT];

    // Generate case number
    const year = incidentDate.getFullYear();
    const caseNum = String(i + 1).padStart(4, '0');

    await prisma.incident.create({
      data: {
        caseNumber: `INC-${year}-${caseNum}`,
        companyId: company.id,
        type: randomElement(types),
        title: `Test Incident ${i + 1}`,
        description: 'Auto-generated test incident for seed data.',
        severity: randomElement(severities),
        status: randomElement(statuses),
        reportedBy: reporter.id,
        teamId: team?.id,
        incidentDate,
        createdAt: incidentDate,
      }
    });
  }
  console.log(`   ✓ Incidents created: ${incidentCount}\n`);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('✅ Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   • Company: ${company.name}`);
  console.log(`   • Teams: ${teams.length}`);
  console.log(`   • Workers: ${allWorkers.length}`);
  console.log(`   • Check-ins: ${totalCheckins}`);
  console.log(`   • Attendance Records: ${totalAttendance}`);
  console.log(`   • Exceptions: ${totalExceptions}`);
  console.log(`   • Incidents: ${incidentCount}`);
  console.log('');
  console.log('🔑 Test Accounts:');
  console.log(`   • Executive: executive@test.aegira.com`);
  console.log(`   • Supervisor: supervisor@test.aegira.com`);
  console.log(`   • Team Leaders: teamlead1@test.aegira.com, etc.`);
  console.log(`   • Password (all accounts): ${TEST_PASSWORD}`);
  console.log('');
  console.log('💡 To remove test data, run: npm run seed:clean');
  console.log('═══════════════════════════════════════════\n');
}

// ============================================
// CLEANUP FUNCTION
// ============================================

async function clean() {
  console.log('🧹 Starting cleanup process...\n');

  // Find test company
  const company = await prisma.company.findUnique({
    where: { slug: TEST_COMPANY_SLUG }
  });

  if (!company) {
    console.log('⚠️  No test company found. Nothing to clean.\n');
    return;
  }

  console.log(`📦 Found test company: ${company.name}`);
  console.log('   Deleting all related data...\n');

  // Delete in order (respecting foreign key constraints)
  // Most dependent tables first

  const deletedCheckins = await prisma.checkin.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedCheckins.count} check-ins`);

  const deletedAttendance = await prisma.dailyAttendance.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedAttendance.count} attendance records`);

  const deletedIncidentActivities = await prisma.incidentActivity.deleteMany({
    where: { incident: { companyId: company.id } }
  });
  console.log(`   ✓ Deleted ${deletedIncidentActivities.count} incident activities`);

  const deletedIncidents = await prisma.incident.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedIncidents.count} incidents`);

  const deletedExceptions = await prisma.exception.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedExceptions.count} exceptions`);

  const deletedNotifications = await prisma.notification.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedNotifications.count} notifications`);

  const deletedRecognitions = await prisma.recognition.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedRecognitions.count} recognitions`);

  const deletedAlerts = await prisma.alert.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedAlerts.count} alerts`);

  const deletedOneOnOnes = await prisma.oneOnOne.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedOneOnOnes.count} one-on-ones`);

  const deletedSnapshots = await prisma.wellnessSnapshot.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedSnapshots.count} wellness snapshots`);

  const deletedAISummaries = await prisma.aISummary.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedAISummaries.count} AI summaries`);

  const deletedSchedules = await prisma.schedule.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedSchedules.count} schedules`);

  const deletedRehab = await prisma.rehabilitation.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedRehab.count} rehabilitation records`);

  const deletedFilledPdfForms = await prisma.filledPDFForm.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedFilledPdfForms.count} filled PDF forms`);

  // Get all users to delete from Supabase Auth
  const usersToDelete = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true, email: true }
  });

  // Delete users from Supabase Auth
  console.log(`   Deleting ${usersToDelete.length} users from Supabase Auth...`);
  let supabaseDeleteCount = 0;
  for (const user of usersToDelete) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      supabaseDeleteCount++;
    } catch (e) {
      // User might not exist in Supabase, continue
    }
  }
  console.log(`   ✓ Deleted ${supabaseDeleteCount} Supabase Auth users`);

  // Delete users from Prisma (before teams due to leaderId FK)
  const deletedUsers = await prisma.user.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedUsers.count} database users`);

  const deletedTeams = await prisma.team.deleteMany({
    where: { companyId: company.id }
  });
  console.log(`   ✓ Deleted ${deletedTeams.count} teams`);

  // Finally delete the company
  await prisma.company.delete({
    where: { id: company.id }
  });
  console.log(`   ✓ Deleted company: ${company.name}`);

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ Cleanup completed successfully!');
  console.log('═══════════════════════════════════════════\n');
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';

  try {
    switch (command) {
      case 'seed':
        await seed();
        break;
      case 'clean':
        await clean();
        break;
      case 'reset':
        await clean();
        await seed();
        break;
      default:
        console.log('Unknown command. Use: seed, clean, or reset');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
