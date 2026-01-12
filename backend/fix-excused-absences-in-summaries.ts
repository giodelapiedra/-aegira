/**
 * Migration Script: Fix DailyTeamSummary for EXCUSED Absences
 *
 * This script recalculates DailyTeamSummary records for all dates where
 * EXCUSED absences exist but may not have been properly counted.
 *
 * The bug: When an absence was marked as EXCUSED, the DailyTeamSummary
 * was not recalculated, so the worker still showed as "Absent" instead
 * of "Excused" in the teams-overview breakdown.
 *
 * Run: npx tsx fix-excused-absences-in-summaries.ts
 */

import { prisma } from './src/config/prisma.js';
import { recalculateDailyTeamSummary } from './src/utils/daily-summary.js';
import { formatLocalDate, DEFAULT_TIMEZONE } from './src/utils/date-helpers.js';

async function fixExcusedAbsencesInSummaries() {
  console.log('='.repeat(60));
  console.log('Migration: Fix DailyTeamSummary for EXCUSED Absences');
  console.log('='.repeat(60));
  console.log('');

  // Get all EXCUSED absences
  const excusedAbsences = await prisma.absence.findMany({
    where: { status: 'EXCUSED' },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          teamId: true,
          company: { select: { timezone: true } },
        },
      },
    },
    orderBy: { absenceDate: 'asc' },
  });

  console.log(`Found ${excusedAbsences.length} EXCUSED absences to check.`);
  console.log('');

  if (excusedAbsences.length === 0) {
    console.log('No EXCUSED absences found. Nothing to fix.');
    return;
  }

  // Group by team and date to avoid recalculating the same summary multiple times
  const teamDatePairs = new Map<string, { teamId: string; date: Date; timezone: string }>();

  for (const absence of excusedAbsences) {
    if (!absence.user.teamId) continue;

    const key = `${absence.user.teamId}_${absence.absenceDate.toISOString()}`;
    if (!teamDatePairs.has(key)) {
      teamDatePairs.set(key, {
        teamId: absence.user.teamId,
        date: absence.absenceDate,
        timezone: absence.user.company?.timezone || DEFAULT_TIMEZONE,
      });
    }
  }

  console.log(`Unique team/date combinations to recalculate: ${teamDatePairs.size}`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const [key, { teamId, date, timezone }] of teamDatePairs) {
    const dateStr = formatLocalDate(date, timezone);

    try {
      // Get current summary for comparison
      const oldSummary = await prisma.dailyTeamSummary.findUnique({
        where: { teamId_date: { teamId, date } },
      });

      // Recalculate
      const newSummary = await recalculateDailyTeamSummary(teamId, date, timezone);

      // Check if anything changed
      const changed = oldSummary &&
        (oldSummary.onLeaveCount !== newSummary.onLeaveCount ||
         oldSummary.expectedToCheckIn !== newSummary.expectedToCheckIn);

      if (changed) {
        console.log(`✓ Updated team ${teamId.slice(0, 8)}... on ${dateStr}`);
        console.log(`  onLeaveCount: ${oldSummary.onLeaveCount} → ${newSummary.onLeaveCount}`);
        console.log(`  expectedToCheckIn: ${oldSummary.expectedToCheckIn} → ${newSummary.expectedToCheckIn}`);
      } else if (!oldSummary) {
        console.log(`✓ Created new summary for team ${teamId.slice(0, 8)}... on ${dateStr}`);
      } else {
        console.log(`- No changes for team ${teamId.slice(0, 8)}... on ${dateStr} (already correct)`);
      }

      successCount++;
    } catch (error) {
      console.error(`✗ Failed for team ${teamId.slice(0, 8)}... on ${dateStr}:`, error);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Complete');
  console.log('='.repeat(60));
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

fixExcusedAbsencesInSummaries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
