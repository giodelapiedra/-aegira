import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database...\n');

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log('Companies:', companies.length);
  companies.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  const teams = await prisma.team.findMany({
    select: { id: true, name: true, isActive: true, companyId: true }
  });
  console.log('\nTeams:', teams.length);
  teams.forEach(t => console.log(`  - ${t.name} (active: ${t.isActive})`));

  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, role: true, teamId: true, isActive: true }
  });
  console.log('\nUsers:', users.length);
  const roles = [...new Set(users.map(u => u.role))];
  console.log('  Roles:', roles.join(', '));
  const workers = users.filter(u => u.role === 'WORKER');
  console.log('  Workers:', workers.length);
  workers.forEach(w => console.log(`    - ${w.firstName} ${w.lastName} (team: ${w.teamId}, active: ${w.isActive})`));

  await prisma.$disconnect();
}

main().catch(console.error);
