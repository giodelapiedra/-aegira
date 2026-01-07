import { prisma } from '../src/config/prisma.js';

async function checkData() {
  try {
    console.log('🔍 Checking database data...\n');

    // Get all companies
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });
    console.log(`📊 Companies: ${companies.length}`);
    companies.forEach(c => console.log(`   - ${c.name} (${c.id})`));

    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        teamId: true,
        isActive: true,
      },
    });
    console.log(`\n👥 Total Users: ${allUsers.length}`);
    
    // Group by role
    const usersByRole = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   By Role:', usersByRole);

    // Group by company
    const usersByCompany = allUsers.reduce((acc, user) => {
      acc[user.companyId] = (acc[user.companyId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('   By Company:', usersByCompany);

    // Get MEMBER users
    const members = allUsers.filter(u => u.role === 'MEMBER');
    console.log(`\n👤 MEMBER Users: ${members.length}`);
    members.forEach(m => {
      console.log(`   - ${m.firstName} ${m.lastName} (${m.email}) - Company: ${m.companyId}, Team: ${m.teamId || 'None'}`);
    });

    // Get all check-ins
    const allCheckins = await prisma.checkin.findMany({
      select: {
        id: true,
        userId: true,
        companyId: true,
        readinessStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`\n✅ Total Check-ins: ${await prisma.checkin.count()}`);
    console.log(`   Recent (last 10):`);
    allCheckins.forEach(c => {
      const user = allUsers.find(u => u.id === c.userId);
      const date = new Date(c.createdAt).toLocaleString();
      console.log(`   - ${user?.firstName} ${user?.lastName} - ${c.readinessStatus} - ${date}`);
    });

    // Get today's check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayCheckins = await prisma.checkin.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
    });
    console.log(`\n📅 Today's Check-ins: ${todayCheckins.length}`);
    todayCheckins.forEach(c => {
      const user = allUsers.find(u => u.id === c.userId);
      console.log(`   - ${user?.firstName} ${user?.lastName} - ${c.readinessStatus}`);
    });

    // Get teams
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, companyId: true },
    });
    console.log(`\n👥 Teams: ${teams.length}`);
    teams.forEach(t => console.log(`   - ${t.name} (Company: ${t.companyId})`));

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkData();

