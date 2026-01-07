/**
 * Fix dailyAttendance date for records affected by timezone bug
 *
 * Run with: npx tsx scripts/fix-attendance-date.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'member2@gmail.com';

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    console.log(`User with email ${email} not found`);
    return;
  }

  console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`);

  // Find all dailyAttendance records for this user
  const records = await prisma.dailyAttendance.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
  });

  console.log(`\nFound ${records.length} attendance record(s):`);
  for (const record of records) {
    console.log(`  - Date: ${record.date.toISOString().split('T')[0]}, Status: ${record.status}, Score: ${record.score}`);
  }

  // Check if there's a record with the wrong date (Jan 6 instead of Jan 7)
  const wrongDateRecord = records.find(r => {
    const dateStr = r.date.toISOString().split('T')[0];
    return dateStr === '2026-01-06';
  });

  if (wrongDateRecord) {
    console.log(`\nFound record with wrong date (2026-01-06). Fixing to 2026-01-07...`);

    // Update to correct date (Jan 7 at noon UTC)
    const correctDate = new Date(Date.UTC(2026, 0, 7, 12, 0, 0, 0));

    await prisma.dailyAttendance.update({
      where: { id: wrongDateRecord.id },
      data: { date: correctDate },
    });

    console.log(`✅ Fixed! Record updated to 2026-01-07`);
  } else {
    console.log(`\nNo record found with wrong date (2026-01-06).`);

    // Check if there's a Jan 7 record
    const correctRecord = records.find(r => {
      const dateStr = r.date.toISOString().split('T')[0];
      return dateStr === '2026-01-07';
    });

    if (correctRecord) {
      console.log(`Record for 2026-01-07 already exists. No fix needed.`);
    }
  }

  // Show final state
  console.log(`\n--- Final State ---`);
  const finalRecords = await prisma.dailyAttendance.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
  });
  for (const record of finalRecords) {
    console.log(`  - Date: ${record.date.toISOString().split('T')[0]}, Status: ${record.status}, Score: ${record.score}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
