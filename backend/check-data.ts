import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('=== CHECKING MOCK DATA ===\n');

  // Get Office team
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Office' } },
    include: {
      members: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          teamJoinedAt: true,
          createdAt: true
        }
      }
    }
  });

  if (!team) {
    console.log('Office team not found!');
    return;
  }

  console.log('Team:', team.name);
  console.log('Team ID:', team.id);
  console.log('\nMembers (' + team.members.length + '):');

  for (const m of team.members) {
    console.log(`  - ${m.firstName} ${m.lastName} (${m.role})`);
    console.log(`    teamJoinedAt: ${m.teamJoinedAt?.toISOString() || 'NULL'}`);
    console.log(`    createdAt: ${m.createdAt.toISOString()}`);
  }

  // Get check-ins for team members
  const memberIds = team.members.map(m => m.id);

  const checkins = await prisma.checkin.findMany({
    where: { userId: { in: memberIds } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { firstName: true } } }
  });

  console.log('\n\nTotal Check-ins for Office team:', checkins.length);

  if (checkins.length > 0) {
    console.log('\nSample check-ins (latest 10):');
    checkins.slice(0, 10).forEach(c => {
      console.log(`  ${c.user.firstName}: ${c.createdAt.toISOString()} - ${c.readinessStatus}`);
    });

    // Date range
    const dates = checkins.map(c => c.createdAt);
    console.log('\nDate range of check-ins:');
    console.log('  Earliest:', new Date(Math.min(...dates.map(d => d.getTime()))).toISOString());
    console.log('  Latest:', new Date(Math.max(...dates.map(d => d.getTime()))).toISOString());
  }

  // Check daily attendance
  const attendance = await prisma.dailyAttendance.findMany({
    where: { userId: { in: memberIds } },
    orderBy: { date: 'desc' }
  });

  console.log('\n\nTotal Daily Attendance records:', attendance.length);

  // Current date info
  console.log('\n\nCurrent Date Info:');
  console.log('  Now:', new Date().toISOString());
  console.log('  Today (local):', new Date().toLocaleDateString());

  await prisma.$disconnect();
}

checkData().catch(console.error);
