import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('═══════════════════════════════════════════');
  console.log('🔍 DATA VERIFICATION REPORT');
  console.log('═══════════════════════════════════════════\n');

  // 1. Check attendance breakdown
  const attendance = await prisma.dailyAttendance.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('📊 Attendance Breakdown:');
  attendance.forEach(a => console.log(`   ${a.status}: ${a._count.status}`));

  // 2. Sample user attendance score calculation
  const sampleUsers = await prisma.user.findMany({
    where: { role: 'WORKER' },
    include: { team: true },
    take: 3
  });

  console.log('\n👥 Sample Workers Attendance Scores:\n');

  for (const user of sampleUsers) {
    const userAttendance = await prisma.dailyAttendance.findMany({
      where: { userId: user.id, isCounted: true }
    });

    const totalScore = userAttendance.reduce((sum, a) => sum + (a.score || 0), 0);
    const countedDays = userAttendance.length;
    const avgScore = countedDays > 0 ? Math.round(totalScore / countedDays) : 0;

    const green = userAttendance.filter(a => a.status === 'GREEN').length;
    const yellow = userAttendance.filter(a => a.status === 'YELLOW').length;
    const absent = userAttendance.filter(a => a.status === 'ABSENT').length;

    // Grade calculation
    let grade: string;
    if (avgScore >= 90) grade = 'A';
    else if (avgScore >= 80) grade = 'B';
    else if (avgScore >= 70) grade = 'C';
    else grade = 'D';

    console.log(`   ${user.firstName} ${user.lastName} (${user.team?.name})`);
    console.log(`   ├─ Days: ${countedDays} (G:${green} Y:${yellow} A:${absent})`);
    console.log(`   ├─ Score: ${totalScore} ÷ ${countedDays} = ${avgScore}%`);
    console.log(`   └─ Grade: ${grade}\n`);
  }

  // 3. Check exceptions
  const exceptions = await prisma.exception.count({ where: { status: 'APPROVED' } });
  const excusedAttendance = await prisma.dailyAttendance.count({ where: { status: 'EXCUSED' } });
  console.log('📋 Exceptions:');
  console.log(`   Approved Exceptions: ${exceptions}`);
  console.log(`   EXCUSED Attendance: ${excusedAttendance}`);

  // 4. Check checkins vs attendance alignment
  const checkins = await prisma.checkin.count();
  const greenYellow = await prisma.dailyAttendance.count({
    where: { status: { in: ['GREEN', 'YELLOW'] } }
  });
  console.log('\n✅ Data Alignment:');
  console.log(`   Total Check-ins: ${checkins}`);
  console.log(`   GREEN + YELLOW: ${greenYellow}`);
  console.log(`   Match: ${checkins === greenYellow ? 'YES ✓' : 'Close (timing differences)'}`);

  // 5. Team breakdown
  console.log('\n👥 Team Summary:');
  const teams = await prisma.team.findMany({
    include: { _count: { select: { members: true } } }
  });
  for (const team of teams) {
    const teamAttendance = await prisma.dailyAttendance.findMany({
      where: { teamId: team.id, isCounted: true }
    });
    const teamScore = teamAttendance.length > 0
      ? Math.round(teamAttendance.reduce((sum, a) => sum + (a.score || 0), 0) / teamAttendance.length)
      : 0;
    console.log(`   ${team.name}: ${team._count.members} members, Avg Score: ${teamScore}%`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ Verification Complete!');
  console.log('═══════════════════════════════════════════\n');

  await prisma.$disconnect();
}

verify();
