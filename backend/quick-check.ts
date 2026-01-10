import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const companies = await prisma.company.findMany();
  console.log('=== COMPANIES ===');
  for (const c of companies) {
    console.log(`  ID: ${c.id}`);
    console.log(`  Name: ${c.name}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, companyId: true }
  });
  console.log('\n=== USERS ===');
  for (const u of users) {
    console.log(`  ${u.email} - ${u.firstName} ${u.lastName} (${u.role})`);
  }

  const teams = await prisma.team.findMany({
    include: { leader: true, members: true }
  });
  console.log('\n=== TEAMS ===');
  for (const t of teams) {
    console.log(`  ${t.name} - Leader: ${t.leader?.firstName || 'None'} - Members: ${t.members.length}`);
  }

  await prisma.$disconnect();
}
check().catch(console.error);
