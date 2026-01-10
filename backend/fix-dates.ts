import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function fixDates() {
  console.log('Fixing dates in database...\n');

  // 1. Update all teams' createdAt to 60 days ago
  const teams = await prisma.team.findMany();
  for (const team of teams) {
    await prisma.team.update({
      where: { id: team.id },
      data: { createdAt: daysAgo(60) },
    });
    console.log(`✅ Team "${team.name}" createdAt set to ${daysAgo(60).toISOString().split('T')[0]}`);
  }

  // 2. Update all users' createdAt to be earlier than their teamJoinedAt
  const users = await prisma.user.findMany({
    where: { teamId: { not: null } }
  });

  for (const user of users) {
    // Set createdAt to 90 days ago (before any teamJoinedAt)
    await prisma.user.update({
      where: { id: user.id },
      data: { createdAt: daysAgo(90) },
    });
  }
  console.log(`✅ Updated ${users.length} users' createdAt to ${daysAgo(90).toISOString().split('T')[0]}`);

  // 3. Set teamJoinedAt for team leaders (they were missing this)
  const teamLeads = await prisma.user.findMany({
    where: { role: 'TEAM_LEAD' }
  });

  for (const tl of teamLeads) {
    if (!tl.teamJoinedAt) {
      await prisma.user.update({
        where: { id: tl.id },
        data: { teamJoinedAt: daysAgo(60) },  // Same as team creation
      });
      console.log(`✅ Team Lead "${tl.firstName} ${tl.lastName}" teamJoinedAt set to ${daysAgo(60).toISOString().split('T')[0]}`);
    }
  }

  // 4. Update company createdAt
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    await prisma.company.update({
      where: { id: company.id },
      data: { createdAt: daysAgo(90) },
    });
    console.log(`✅ Company "${company.name}" createdAt set to ${daysAgo(90).toISOString().split('T')[0]}`);
  }

  console.log('\n✅ All dates fixed!');
  console.log('\nSummary:');
  console.log('- Companies: createdAt = 90 days ago');
  console.log('- Teams: createdAt = 60 days ago');
  console.log('- Users: createdAt = 90 days ago');
  console.log('- Team Leads: teamJoinedAt = 60 days ago (if missing)');

  await prisma.$disconnect();
}

fixDates().catch(console.error);
