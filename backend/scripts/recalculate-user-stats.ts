/**
 * Script to recalculate User stats from actual Checkin records
 * Fixes totalCheckins, avgReadinessScore, lastReadinessStatus, streaks for all users
 *
 * Run: npx tsx scripts/recalculate-user-stats.ts
 */

import { prisma } from '../src/config/prisma.js';

// Calculate streaks from check-in dates
function calculateStreaks(checkinDates: Date[]): { current: number; longest: number } {
  if (checkinDates.length === 0) return { current: 0, longest: 0 };

  // Sort by date ascending
  const sorted = [...checkinDates].sort((a, b) => a.getTime() - b.getTime());

  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1]);
    const currDate = new Date(sorted[i]);

    // Normalize to date only (ignore time)
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Same day, don't count
      continue;
    } else if (daysDiff === 1) {
      // Consecutive day
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      // Gap - streak broken
      tempStreak = 1;
    }
  }

  // Check if last check-in was today or yesterday for current streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastCheckin = new Date(sorted[sorted.length - 1]);
  lastCheckin.setHours(0, 0, 0, 0);
  const daysSinceLast = Math.round((today.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24));

  currentStreak = daysSinceLast <= 1 ? tempStreak : 0;

  return { current: currentStreak, longest: longestStreak };
}

async function main() {
  console.log('Starting user stats recalculation...\n');

  // Get all users with WORKER/MEMBER role
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['WORKER', 'MEMBER'] },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      totalCheckins: true,
    },
  });

  console.log(`Found ${users.length} active workers/members\n`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    // Get actual check-in stats from Checkin table
    const stats = await prisma.checkin.aggregate({
      where: { userId: user.id },
      _count: { id: true },
      _avg: { readinessScore: true },
    });

    // Get all check-in dates for streak calculation
    const checkins = await prisma.checkin.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, readinessStatus: true },
    });

    const actualCount = stats._count.id;
    const actualAvg = stats._avg.readinessScore;

    // Calculate streaks
    const checkinDates = checkins.map(c => c.createdAt);
    const { current: currentStreak, longest: longestStreak } = calculateStreaks(checkinDates);

    // Get last check-in
    const lastCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : null;

    // Update user if counts don't match
    if (actualCount !== user.totalCheckins || actualCount > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalCheckins: actualCount,
          avgReadinessScore: actualAvg ? Math.round(actualAvg * 100) / 100 : null,
          lastReadinessStatus: lastCheckin?.readinessStatus || null,
          lastCheckinDate: lastCheckin?.createdAt || null,
          currentStreak,
          longestStreak,
        },
      });

      console.log(`Updated ${user.firstName} ${user.lastName}: ${actualCount} check-ins, streak=${longestStreak}`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log('\n========================================');
  console.log('Recalculation complete!');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already correct): ${skipped}`);
  console.log('========================================\n');

  // Show sample of updated data
  const sample = await prisma.user.findMany({
    where: {
      role: { in: ['WORKER', 'MEMBER'] },
      totalCheckins: { gt: 0 },
    },
    select: {
      firstName: true,
      lastName: true,
      totalCheckins: true,
      avgReadinessScore: true,
      lastReadinessStatus: true,
    },
    take: 5,
  });

  if (sample.length > 0) {
    console.log('Sample updated users:');
    for (const u of sample) {
      console.log(`  ${u.firstName} ${u.lastName}: ${u.totalCheckins} check-ins, avg ${u.avgReadinessScore}%, last ${u.lastReadinessStatus}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
