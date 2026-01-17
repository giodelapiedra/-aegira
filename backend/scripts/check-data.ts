import { prisma } from '../src/config/prisma.js';

async function check() {
  // Get recent incidents with exceptions
  const incidents = await prisma.incident.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      exception: {
        select: { id: true, status: true }
      }
    }
  });

  console.log('=== Recent Incidents with Exception Status ===\n');
  for (const i of incidents) {
    const excStatus = i.exception ? i.exception.status : 'NO EXCEPTION';
    console.log(`  ${i.caseNumber}: ${i.type} | Exception: ${excStatus}`);
  }

  // Count pending exceptions from incidents
  const pendingCount = await prisma.exception.count({
    where: {
      linkedIncidentId: { not: null },
      status: 'PENDING'
    }
  });
  console.log(`\n=== Pending Exceptions from Incidents: ${pendingCount} ===`);

  await prisma.$disconnect();
}

check();
