const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const summaries = await prisma.aISummary.findMany({ take: 10 });
    console.log('Found summaries:', summaries.length);
    summaries.forEach(s => {
      console.log('- ID:', s.id);
      console.log('  TeamId:', s.teamId);
      console.log('  CompanyId:', s.companyId);
      console.log('  Status:', s.overallStatus);
      console.log('  CreatedAt:', s.createdAt);
      console.log('');
    });
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
