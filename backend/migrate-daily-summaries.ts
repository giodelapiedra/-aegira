/**
 * Migration script to generate DailyTeamSummary for all historical check-in data
 * Run: npx tsx migrate-daily-summaries.ts
 */

import { prisma } from './src/config/prisma.js';
import { recalculateDailyTeamSummary } from './src/utils/daily-summary.js';
import { DEFAULT_TIMEZONE } from './src/utils/date-helpers.js';

async function main() {
  console.log('='.repeat(60));
  console.log('DailyTeamSummary Migration');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // 1. Get all active teams with their companies
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        company: { select: { id: true, timezone: true } },
        members: {
          where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
          select: { id: true },
        },
      },
    });

    console.log(`\nFound ${teams.length} active teams`);

    if (teams.length === 0) {
      console.log('No teams to process.');
      return;
    }

    // 2. Find date range from first check-in to today
    const firstCheckin = await prisma.checkin.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (!firstCheckin) {
      console.log('No check-ins found. Creating summaries for today only.');
    }

    const startDate = firstCheckin
      ? new Date(firstCheckin.createdAt.toISOString().split('T')[0])
      : new Date();
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    console.log(`\nDate range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Calculate total days
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalOperations = teams.length * totalDays;
    console.log(`Total operations: ${teams.length} teams × ${totalDays} days = ${totalOperations}`);

    // 3. Process each team
    let processedCount = 0;
    let errorCount = 0;
    const summariesCreated: { teamName: string; count: number }[] = [];

    for (const team of teams) {
      const timezone = team.company?.timezone || DEFAULT_TIMEZONE;
      const teamSummaries = { teamName: team.name, count: 0 };

      console.log(`\n--- Processing: ${team.name} (${team.members.length} members) ---`);

      // Skip teams with no members
      if (team.members.length === 0) {
        console.log('  Skipping - no active members');
        continue;
      }

      // Iterate through each date
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        try {
          await recalculateDailyTeamSummary(team.id, new Date(currentDate), timezone);
          teamSummaries.count++;
          processedCount++;

          // Progress indicator every 10 summaries
          if (processedCount % 10 === 0) {
            const progress = ((processedCount / totalOperations) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${processedCount}/${totalOperations} (${progress}%)`);
          }
        } catch (error) {
          errorCount++;
          console.error(`\n  Error on ${currentDate.toISOString().split('T')[0]}: ${error}`);
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      summariesCreated.push(teamSummaries);
      console.log(`\n  Created ${teamSummaries.count} summaries`);
    }

    // 4. Show summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Complete!');
    console.log('='.repeat(60));
    console.log(`\nTime elapsed: ${elapsed}s`);
    console.log(`Total summaries created: ${processedCount}`);
    console.log(`Errors: ${errorCount}`);

    console.log('\n--- Summaries per Team ---');
    for (const s of summariesCreated) {
      console.log(`  ${s.teamName}: ${s.count} days`);
    }

    // 5. Verify by showing latest summaries
    console.log('\n--- Latest Summaries (Top 10) ---');
    const latestSummaries = await prisma.dailyTeamSummary.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: { team: { select: { name: true } } },
    });

    for (const s of latestSummaries) {
      const compliance = s.complianceRate !== null ? `${s.complianceRate.toFixed(0)}%` : 'N/A';
      console.log(`  ${s.date.toISOString().split('T')[0]} | ${s.team.name.substring(0, 25).padEnd(25)} | ${s.checkedInCount}/${s.expectedToCheckIn} (${compliance})`);
    }

    // 6. Show database stats
    const totalSummaries = await prisma.dailyTeamSummary.count();
    const summariesWithCheckins = await prisma.dailyTeamSummary.count({
      where: { checkedInCount: { gt: 0 } },
    });

    console.log('\n--- Database Stats ---');
    console.log(`  Total summaries in DB: ${totalSummaries}`);
    console.log(`  Summaries with check-ins: ${summariesWithCheckins}`);
    console.log(`  Work days without check-ins: ${totalSummaries - summariesWithCheckins}`);

  } catch (error) {
    console.error('\nMigration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
