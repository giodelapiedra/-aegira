import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAnalyticsView() {
  console.log('=== ANALYTICS & TEAM LEADER VIEW TEST ===\n');

  const timezone = 'Asia/Manila';
  const now = new Date();
  const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const todayStr = todayFormatter.format(now);

  // Get worker
  const worker = await prisma.user.findFirst({
    where: {
      email: 'david.gonzales@aegira.com',
    },
    include: {
      team: {
        include: {
          members: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      company: true,
    },
  });

  if (!worker) {
    console.log('Worker not found!');
    return;
  }

  console.log(`Worker: ${worker.firstName} ${worker.lastName}`);
  console.log(`Team: ${worker.team?.name}`);
  console.log(`Team Leader: ${worker.team?.leader?.firstName} ${worker.team?.leader?.lastName} (${worker.team?.leader?.email})`);
  console.log(`Team Members: ${worker.team?.members.length}\n`);

  // ============================================
  // TEAM OVERVIEW DATA (What Team Leader sees)
  // ============================================
  console.log('=== TEAM OVERVIEW (Team Leader View) ===\n');

  // Get team members with today's check-in status
  const teamMembers = await prisma.user.findMany({
    where: {
      teamId: worker.teamId,
      role: { in: ['MEMBER', 'WORKER'] },
    },
    include: {
      checkins: {
        where: {
          createdAt: {
            gte: new Date(todayStr + 'T00:00:00'),
            lte: new Date(todayStr + 'T23:59:59'),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  console.log('Team Members Today:');
  console.log('─'.repeat(60));
  for (const member of teamMembers) {
    const todayCheckin = member.checkins[0];
    const status = todayCheckin
      ? `${todayCheckin.readinessScore}% ${todayCheckin.readinessStatus}`
      : 'NOT CHECKED IN';
    console.log(`${member.firstName} ${member.lastName}: ${status}`);
  }
  console.log('');

  // Get active exemptions for team
  const activeExemptions = await prisma.exception.findMany({
    where: {
      userId: { in: teamMembers.map(m => m.id) },
      status: 'APPROVED',
      startDate: { lte: new Date() },
      endDate: { gte: new Date(todayStr) },
    },
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  console.log('Active Exemptions Today:');
  console.log('─'.repeat(60));
  if (activeExemptions.length === 0) {
    console.log('None - all team members should check in today');
  } else {
    for (const ex of activeExemptions) {
      const endStr = ex.endDate ? todayFormatter.format(ex.endDate) : 'N/A';
      console.log(`${ex.user.firstName} ${ex.user.lastName}: ${ex.type} (until ${endStr})`);
    }
  }
  console.log('');

  // ============================================
  // WORKER HISTORY (AI Insights Detail View)
  // ============================================
  console.log('=== WORKER HISTORY (AI Insights View) ===\n');

  // Get last 7 days of check-ins for this worker
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const workerCheckins = await prisma.checkin.findMany({
    where: {
      userId: worker.id,
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Check-ins (Last 7 days) for ${worker.firstName}:`);
  console.log('─'.repeat(60));
  for (const c of workerCheckins) {
    const dateStr = todayFormatter.format(c.createdAt);
    const time = c.createdAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    });
    console.log(`${dateStr} ${time}: ${c.readinessScore}% ${c.readinessStatus}`);
    console.log(`   Mood: ${c.mood}, Stress: ${c.stress}, Sleep: ${c.sleep}, Physical: ${c.physicalHealth}`);
    if (c.notes) console.log(`   Notes: ${c.notes}`);
  }
  console.log('');

  // Get exemption history
  const workerExemptions = await prisma.exception.findMany({
    where: { userId: worker.id },
    orderBy: { startDate: 'desc' },
  });

  console.log(`Exemption History for ${worker.firstName}:`);
  console.log('─'.repeat(60));
  for (const e of workerExemptions) {
    const startStr = e.startDate ? todayFormatter.format(e.startDate) : 'N/A';
    const endStr = e.endDate ? todayFormatter.format(e.endDate) : 'N/A';
    console.log(`${e.type}: ${startStr} to ${endStr}`);
    console.log(`   Status: ${e.status}`);
    console.log(`   Reason: ${e.reason}`);
  }
  console.log('');

  // ============================================
  // ANALYTICS SUMMARY
  // ============================================
  console.log('=== ANALYTICS SUMMARY ===\n');

  // Calculate averages
  const avgScore = workerCheckins.length > 0
    ? Math.round(workerCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / workerCheckins.length)
    : 0;

  const greenCount = workerCheckins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellowCount = workerCheckins.filter(c => c.readinessStatus === 'YELLOW').length;
  const redCount = workerCheckins.filter(c => c.readinessStatus === 'RED').length;

  // Count exemption days
  let exemptionDays = 0;
  for (const e of workerExemptions) {
    if (e.startDate && e.endDate && e.status === 'APPROVED') {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      exemptionDays += days;
    }
  }

  console.log('Worker Analytics:');
  console.log('─'.repeat(60));
  console.log(`Total Check-ins (7 days): ${workerCheckins.length}`);
  console.log(`Average Readiness: ${avgScore}%`);
  console.log(`Status Breakdown: GREEN=${greenCount}, YELLOW=${yellowCount}, RED=${redCount}`);
  console.log(`Total Exemption Days: ${exemptionDays}`);
  console.log(`Current Streak: ${worker.currentStreak} days`);
  console.log(`Longest Streak: ${worker.longestStreak} days`);
  console.log('');

  // ============================================
  // WEEK STATS (Worker Dashboard)
  // ============================================
  console.log('=== WEEK STATS (Worker Dashboard) ===\n');

  // Get current week's Monday
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekCheckins = await prisma.checkin.findMany({
    where: {
      userId: worker.id,
      createdAt: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { createdAt: 'asc' },
  });

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const workDays = worker.team?.workDays?.split(',').map(d => d.trim().toUpperCase()) || [];

  console.log(`Week: ${todayFormatter.format(weekStart)} to ${todayFormatter.format(weekEnd)}`);
  console.log(`Work Days: ${workDays.join(', ')}`);
  console.log('');
  console.log('Daily Status:');
  console.log('─'.repeat(60));

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateStr = todayFormatter.format(date);
    const dayName = dayNames[date.getDay()];
    const isWorkDay = workDays.includes(dayName);

    const checkin = weekCheckins.find(c => {
      const cDateStr = todayFormatter.format(c.createdAt);
      return cDateStr === dateStr;
    });

    let status = '';
    if (checkin) {
      status = `${checkin.readinessScore}% ${checkin.readinessStatus}`;
    } else if (isWorkDay) {
      // Check if exempted
      const wasExempted = workerExemptions.some(e => {
        if (!e.startDate || !e.endDate || e.status !== 'APPROVED') return false;
        const startStr = todayFormatter.format(e.startDate);
        const endStr = todayFormatter.format(e.endDate);
        return dateStr >= startStr && dateStr <= endStr;
      });
      status = wasExempted ? 'EXEMPTED' : (dateStr <= todayStr ? 'MISSED' : 'UPCOMING');
    } else {
      status = 'OFF DAY';
    }

    const marker = dateStr === todayStr ? ' <-- TODAY' : '';
    console.log(`${dayName} ${dateStr}: ${status}${marker}`);
  }

  console.log('\n=== TEST COMPLETE ===');
}

testAnalyticsView()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
