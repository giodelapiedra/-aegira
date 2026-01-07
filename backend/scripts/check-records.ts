import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'member2@gmail.com' },
    select: { id: true, teamId: true, team: { select: { id: true, name: true } } },
  });
  console.log('User:', JSON.stringify(user, null, 2));

  if (user) {
    const checkins = await prisma.checkin.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('\nCheckins found:', checkins.length);
    checkins.forEach(c => {
      console.log('  -', c.createdAt.toISOString(), 'Score:', c.readinessScore, 'Status:', c.readinessStatus);
    });

    const attendance = await prisma.dailyAttendance.findMany({
      where: { userId: user.id },
    });
    console.log('\nDailyAttendance records:', attendance.length);
    attendance.forEach(a => {
      console.log('  -', a.date.toISOString(), 'Status:', a.status);
    });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
