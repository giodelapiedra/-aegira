const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // Check all teams
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, companyId: true }
    });
    console.log('All Teams:');
    teams.forEach(t => {
      console.log('- ID:', t.id, '| Name:', t.name, '| CompanyId:', t.companyId);
    });

    console.log('\n---\n');

    // Check users with TEAM_LEAD role
    const teamLeads = await prisma.user.findMany({
      where: { role: 'TEAM_LEAD' },
      select: { id: true, email: true, teamId: true, companyId: true }
    });
    console.log('Team Leads:');
    teamLeads.forEach(u => {
      console.log('- Email:', u.email, '| TeamId:', u.teamId, '| CompanyId:', u.companyId);
    });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
