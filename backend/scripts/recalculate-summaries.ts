/**
 * Script to recalculate all DailyTeamSummary records
 * This populates the new wellness metrics (avgMood, avgStress, avgSleep, avgPhysical)
 */

import { prisma } from '../src/config/prisma.js';
import { recalculateDailyTeamSummary } from '../src/utils/daily-summary.js';

async function main() {
  console.log('Starting summary recalculation...\n');

  // Get all teams
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      company: { select: { timezone: true } }
    },
  });

  console.log(`Found ${teams.length} active teams\n`);

  // Get all existing summaries to know which dates to recalculate
  const existingSummaries = await prisma.dailyTeamSummary.findMany({
    select: {
      teamId: true,
      date: true,
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${existingSummaries.length} existing summaries to recalculate\n`);

  let processed = 0;
  let errors = 0;

  for (const summary of existingSummaries) {
    try {
      const team = teams.find(t => t.id === summary.teamId);
      const timezone = team?.company?.timezone || 'Australia/Sydney';

      await recalculateDailyTeamSummary(summary.teamId, summary.date, timezone);
      processed++;

      if (processed % 50 === 0) {
        console.log(`Processed ${processed}/${existingSummaries.length} summaries...`);
      }
    } catch (error) {
      errors++;
      console.error(`Error recalculating summary for team ${summary.teamId} on ${summary.date}:`, error);
    }
  }

  console.log('\n========================================');
  console.log(`Recalculation complete!`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log('========================================\n');

  // Verify by checking a random summary
  const sample = await prisma.dailyTeamSummary.findFirst({
    where: {
      avgMood: { not: null },
    },
    orderBy: { date: 'desc' },
  });

  if (sample) {
    console.log('Sample updated summary:');
    console.log(`  Date: ${sample.date}`);
    console.log(`  Avg Readiness: ${sample.avgReadinessScore}`);
    console.log(`  Avg Mood: ${sample.avgMood}`);
    console.log(`  Avg Stress: ${sample.avgStress}`);
    console.log(`  Avg Sleep: ${sample.avgSleep}`);
    console.log(`  Avg Physical: ${sample.avgPhysical}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
