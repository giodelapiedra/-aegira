const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // Check the team that has AI summaries
    const targetTeamId = 'e36c7835-c660-4ff0-889c-5204a0135d3b';

    const team = await prisma.team.findUnique({
      where: { id: targetTeamId },
      select: {
        id: true,
        name: true,
        leaderId: true,
        isActive: true,
        companyId: true
      }
    });

    console.log('Team with AI summaries:');
    console.log('- ID:', team?.id);
    console.log('- Name:', team?.name);
    console.log('- LeaderId:', team?.leaderId);
    console.log('- IsActive:', team?.isActive);
    console.log('- CompanyId:', team?.companyId);

    // Check the team lead user
    const teamLead = await prisma.user.findFirst({
      where: { role: 'TEAM_LEAD' },
      select: { id: true, email: true, teamId: true, companyId: true }
    });

    console.log('\nTeam Lead user:');
    console.log('- ID:', teamLead?.id);
    console.log('- Email:', teamLead?.email);
    console.log('- CompanyId:', teamLead?.companyId);

    // Check if they match
    console.log('\n--- Match Check ---');
    console.log('Team leaderId matches Team Lead user ID:', team?.leaderId === teamLead?.id);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
