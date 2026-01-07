import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'member24@gmail.com' },
    select: { id: true, email: true }
  });

  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User:', user.email);

  // Find the wrong record (Jan 6)
  const wrongRecord = await prisma.dailyAttendance.findFirst({
    where: {
      userId: user.id,
      date: new Date('2026-01-06')
    }
  });

  if (wrongRecord) {
    console.log('Found wrong record:', wrongRecord.id);
    console.log('Current date:', wrongRecord.date.toISOString());

    // Fix to correct date (Jan 7 at noon UTC)
    const correctDate = new Date(Date.UTC(2026, 0, 7, 12, 0, 0, 0));

    await prisma.dailyAttendance.update({
      where: { id: wrongRecord.id },
      data: { date: correctDate }
    });

    console.log('✅ Fixed! New date:', correctDate.toISOString());
  } else {
    console.log('No record found with date 2026-01-06');

    // Check what records exist
    const existing = await prisma.dailyAttendance.findMany({
      where: { userId: user.id }
    });
    console.log('Existing records:', existing.length);
    existing.forEach(r => console.log('  -', r.date.toISOString()));
  }

  // Verify final state
  const final = await prisma.dailyAttendance.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' }
  });
  console.log('\nFinal records:');
  final.forEach(r => console.log('  -', r.date.toISOString().split('T')[0], r.status, 'Score:', r.score));
}

main().catch(console.error).finally(() => prisma.$disconnect());
