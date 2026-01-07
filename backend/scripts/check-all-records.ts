import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all users with recent check-ins
  const recentCheckins = await prisma.checkin.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { email: true, firstName: true, teamId: true } }
    }
  });
  console.log('Recent check-ins:');
  if (recentCheckins.length === 0) {
    console.log('  (none)');
  }
  recentCheckins.forEach(c => {
    console.log('  -', c.createdAt.toISOString().split('T')[0], c.user.email, 'Score:', c.readinessScore, 'TeamId:', c.user.teamId);
  });

  // Find all daily attendance records
  const allAttendance = await prisma.dailyAttendance.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    include: { user: { select: { email: true } } }
  });
  console.log('\nRecent dailyAttendance:');
  if (allAttendance.length === 0) {
    console.log('  (none)');
  }
  allAttendance.forEach(a => {
    console.log('  -', a.date.toISOString().split('T')[0], a.user?.email, 'Status:', a.status);
  });

  // Find all users with teams
  const usersWithTeams = await prisma.user.findMany({
    where: { teamId: { not: null } },
    select: { email: true, firstName: true, teamId: true, role: true },
  });
  console.log('\nUsers with teams:');
  usersWithTeams.forEach(u => {
    console.log('  -', u.email, 'Role:', u.role, 'TeamId:', u.teamId);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
