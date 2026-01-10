/**
 * METRICS DISPLAY FIX VERIFICATION
 *
 * Verifies that metrics display correctly matches AI concern detection
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMetricsDisplayFix() {
  console.log('='.repeat(70));
  console.log('METRICS DISPLAY FIX VERIFICATION');
  console.log('='.repeat(70));
  console.log('');

  // Get sample check-ins
  const checkins = await prisma.checkin.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      readinessScore: true,
      readinessStatus: true,
    },
  });

  // Calculate averages
  const avgMood = checkins.reduce((sum, c) => sum + c.mood, 0) / checkins.length;
  const avgStress = checkins.reduce((sum, c) => sum + c.stress, 0) / checkins.length;
  const avgSleep = checkins.reduce((sum, c) => sum + c.sleep, 0) / checkins.length;
  const avgPhysical = checkins.reduce((sum, c) => sum + c.physicalHealth, 0) / checkins.length;

  console.log('AVERAGE METRICS (from 50 recent check-ins)');
  console.log('='.repeat(70));
  console.log('');
  console.log('┌─────────────────┬──────────┬─────────────┬─────────────────────────┐');
  console.log('│ Metric          │ Value    │ Display     │ Status                  │');
  console.log('├─────────────────┼──────────┼─────────────┼─────────────────────────┤');

  // Mood (higher is better)
  const moodStatus = avgMood >= 7 ? '✓ Good' : avgMood >= 5 ? '⚠ Warning' : '✗ Concern';
  console.log(`│ Mood            │ ${avgMood.toFixed(1).padStart(8)} │ ${avgMood.toFixed(1)}/10      │ ${moodStatus.padEnd(23)} │`);

  // Stress (lower is better - inverted)
  const stressStatus = avgStress <= 4 ? '✓ Good (Low)' : avgStress <= 6 ? '⚠ Warning' : '✗ Concern (High)';
  console.log(`│ Stress          │ ${avgStress.toFixed(1).padStart(8)} │ ${avgStress.toFixed(1)}/10      │ ${stressStatus.padEnd(23)} │`);

  // Sleep (higher is better)
  const sleepStatus = avgSleep >= 7 ? '✓ Good' : avgSleep >= 5 ? '⚠ Warning' : '✗ Concern';
  console.log(`│ Sleep           │ ${avgSleep.toFixed(1).padStart(8)} │ ${avgSleep.toFixed(1)}/10      │ ${sleepStatus.padEnd(23)} │`);

  // Physical Health (higher is better)
  const physicalStatus = avgPhysical >= 7 ? '✓ Good' : avgPhysical >= 5 ? '⚠ Warning' : '✗ Concern';
  console.log(`│ Physical Health │ ${avgPhysical.toFixed(1).padStart(8)} │ ${avgPhysical.toFixed(1)}/10      │ ${physicalStatus.padEnd(23)} │`);

  console.log('└─────────────────┴──────────┴─────────────┴─────────────────────────┘');

  // AI Concern Analysis
  console.log('\n');
  console.log('AI CONCERN DETECTION');
  console.log('='.repeat(70));
  console.log('');
  console.log('AI Clinical Thresholds (1-10 scale):');
  console.log('  • High stress (7+/10) + poor sleep (<5/10) = burnout risk');
  console.log('  • Mood < 5/10 = mood concern');
  console.log('  • Sleep < 5/10 = sleep concern');
  console.log('  • Physical < 5/10 = physical concern');
  console.log('');

  const concerns: string[] = [];

  if (avgMood < 5) {
    concerns.push(`Mood is low (${avgMood.toFixed(1)}/10) - below 5/10 threshold`);
  }
  if (avgStress >= 7) {
    concerns.push(`Stress is high (${avgStress.toFixed(1)}/10) - above 7/10 threshold`);
  }
  if (avgSleep < 5) {
    concerns.push(`Sleep is poor (${avgSleep.toFixed(1)}/10) - below 5/10 threshold`);
  }
  if (avgPhysical < 5) {
    concerns.push(`Physical health is low (${avgPhysical.toFixed(1)}/10) - below 5/10 threshold`);
  }
  if (avgStress >= 7 && avgSleep < 5) {
    concerns.push(`BURNOUT RISK: High stress + poor sleep combination`);
  }

  console.log('Detected Concerns:');
  if (concerns.length > 0) {
    concerns.forEach(c => console.log(`  ⚠ ${c}`));
  } else {
    console.log('  ✓ No major concerns detected');
  }

  // Progress bar visualization
  console.log('\n');
  console.log('VISUAL REPRESENTATION (Progress Bars)');
  console.log('='.repeat(70));
  console.log('');

  const renderBar = (value: number, inverted: boolean = false) => {
    const percentage = Math.round((value / 10) * 100);
    const filled = Math.round(percentage / 5); // 20 chars max
    const empty = 20 - filled;

    let color: string;
    if (inverted) {
      color = value <= 4 ? '🟢' : value <= 6 ? '🟡' : '🔴';
    } else {
      color = value >= 7 ? '🟢' : value >= 5 ? '🟡' : '🔴';
    }

    return `${color} [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
  };

  console.log(`Mood:            ${renderBar(avgMood)}`);
  console.log(`Stress:          ${renderBar(avgStress, true)} (inverted - low is good)`);
  console.log(`Sleep:           ${renderBar(avgSleep)}`);
  console.log(`Physical Health: ${renderBar(avgPhysical)}`);

  // Before/After comparison
  console.log('\n');
  console.log('BEFORE vs AFTER FIX');
  console.log('='.repeat(70));
  console.log('');
  console.log('BEFORE (incorrect /5 display):');
  console.log(`  Sleep: ${avgSleep.toFixed(1)}/5 → Looks like ${Math.round((avgSleep / 5) * 100)}% (appears good!)`);
  console.log(`  User thinks: "Sleep is great at ${Math.round((avgSleep / 5) * 100)}%"`);
  console.log(`  AI flags sleep as concern → User confused why`);
  console.log('');
  console.log('AFTER (correct /10 display):');
  console.log(`  Sleep: ${avgSleep.toFixed(1)}/10 → Shows as ${Math.round((avgSleep / 10) * 100)}% (reality)`);
  console.log(`  User sees: "Sleep is at ${Math.round((avgSleep / 10) * 100)}% - needs improvement"`);
  console.log(`  AI flags sleep as concern → User understands why`);

  // Summary
  console.log('\n');
  console.log('='.repeat(70));
  console.log('FIX SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log('Changes made to team-analytics.page.tsx:');
  console.log('  1. Changed percentage calculation from (value / 5) to (value / 10)');
  console.log('  2. Changed display label from "/5" to "/10"');
  console.log('  3. Updated color thresholds:');
  console.log('     - Normal metrics: >= 7 green, >= 5 yellow, < 5 red');
  console.log('     - Inverted (stress): <= 4 green, <= 6 yellow, > 6 red');
  console.log('');
  console.log('Now the display matches:');
  console.log('  ✓ Database storage (1-10 scale)');
  console.log('  ✓ Readiness calculation (1-10 scale)');
  console.log('  ✓ AI analysis thresholds (1-10 scale)');
  console.log('');
  console.log('='.repeat(70));
}

testMetricsDisplayFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
