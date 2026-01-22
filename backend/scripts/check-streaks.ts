import { prisma } from '../src/config/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['WORKER', 'MEMBER'] }, isActive: true },
    select: { 
      firstName: true, 
      lastName: true, 
      currentStreak: true, 
      longestStreak: true,
      totalCheckins: true 
    }
  });
  
  console.log('Current User Streaks:');
  for (const u of users) {
    console.log(`  ${u.firstName} ${u.lastName}: current=${u.currentStreak}, best=${u.longestStreak}, total=${u.totalCheckins}`);
  }
}

main().finally(() => prisma.$disconnect());
