import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const roles = await prisma.user.groupBy({ by: ['role'], _count: true });
  console.log('User roles:', JSON.stringify(roles, null, 2));

  // Check team members
  const teams = await prisma.team.findMany({
    include: {
      members: { select: { id: true, role: true, firstName: true } },
    },
  });

  console.log('\nTeams and members:');
  for (const team of teams) {
    console.log(`\n${team.name}:`);
    for (const m of team.members) {
      console.log(`  - ${m.firstName} (${m.role})`);
    }
  }

  await prisma.$disconnect();
}

check();
