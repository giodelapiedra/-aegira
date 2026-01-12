/**
 * Migration Script: Populate totalCheckins for existing users
 *
 * This script counts all existing check-ins for each user and updates
 * their totalCheckins field. Run this ONCE after adding the field to schema.
 *
 * Run: npx tsx migrate-total-checkins.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Populate totalCheckins for existing users');
  console.log('='.repeat(60));
  console.log('');

  // Get all check-in counts grouped by userId
  console.log('Counting check-ins per user...');
  const checkinCounts = await prisma.checkin.groupBy({
    by: ['userId'],
    _count: { id: true },
  });

  console.log(`Found ${checkinCounts.length} users with check-ins`);
  console.log('');

  // Update each user's totalCheckins
  console.log('Updating users...');
  let updated = 0;
  let errors = 0;

  for (const { userId, _count } of checkinCounts) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { totalCheckins: _count.id },
      });
      updated++;

      // Progress indicator
      if (updated % 50 === 0) {
        console.log(`  Updated ${updated}/${checkinCounts.length} users...`);
      }
    } catch (error) {
      // User might have been deleted
      console.log(`  Warning: Could not update user ${userId} - may be deleted`);
      errors++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Users updated: ${updated}`);
  console.log(`  Errors/Skipped: ${errors}`);
  console.log('');

  // Verify a few random users
  console.log('Verification (sample of 5 users):');
  const sampleUsers = await prisma.user.findMany({
    where: { totalCheckins: { gt: 0 } },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      totalCheckins: true,
    },
  });

  for (const user of sampleUsers) {
    const actualCount = await prisma.checkin.count({ where: { userId: user.id } });
    const match = user.totalCheckins === actualCount ? '✓' : '✗';
    console.log(`  ${match} ${user.firstName} ${user.lastName}: totalCheckins=${user.totalCheckins}, actual=${actualCount}`);
  }

  await prisma.$disconnect();
  console.log('');
  console.log('Done!');
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
