/**
 * METRICS SCALE INVESTIGATION
 *
 * Check what scale the metrics are stored in vs displayed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMetricsScale() {
  console.log('='.repeat(70));
  console.log('METRICS SCALE INVESTIGATION');
  console.log('='.repeat(70));
  console.log('');

  // Get sample check-ins with raw values
  const checkins = await prisma.checkin.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      readinessScore: true,
      readinessStatus: true,
      user: { select: { firstName: true } },
    },
  });

  console.log('Raw Database Values (sample of 20 check-ins):');
  console.log('-'.repeat(70));
  console.log('Name          | Mood | Stress | Sleep | Physical | Score | Status');
  console.log('-'.repeat(70));

  for (const c of checkins) {
    console.log(`${c.user.firstName.padEnd(13)} | ${String(c.mood).padStart(4)} | ${String(c.stress).padStart(6)} | ${String(c.sleep).padStart(5)} | ${String(c.physicalHealth).padStart(8)} | ${String(c.readinessScore).padStart(5)}% | ${c.readinessStatus}`);
  }

  // Check min/max values
  const allCheckins = await prisma.checkin.findMany({
    select: {
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
    },
  });

  const moods = allCheckins.map(c => c.mood);
  const stresses = allCheckins.map(c => c.stress);
  const sleeps = allCheckins.map(c => c.sleep);
  const physicals = allCheckins.map(c => c.physicalHealth);

  console.log('\n');
  console.log('='.repeat(70));
  console.log('VALUE RANGES (from all check-ins)');
  console.log('='.repeat(70));
  console.log(`\nMood:            min=${Math.min(...moods)}, max=${Math.max(...moods)}`);
  console.log(`Stress:          min=${Math.min(...stresses)}, max=${Math.max(...stresses)}`);
  console.log(`Sleep:           min=${Math.min(...sleeps)}, max=${Math.max(...sleeps)}`);
  console.log(`Physical Health: min=${Math.min(...physicals)}, max=${Math.max(...physicals)}`);

  // Determine scale
  const maxValue = Math.max(
    Math.max(...moods),
    Math.max(...stresses),
    Math.max(...sleeps),
    Math.max(...physicals)
  );

  console.log(`\nDetected Scale: 1-${maxValue <= 5 ? '5' : '10'}`);

  // Calculate average in both scales
  const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
  const avgStress = stresses.reduce((a, b) => a + b, 0) / stresses.length;
  const avgSleep = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
  const avgPhysical = physicals.reduce((a, b) => a + b, 0) / physicals.length;

  console.log('\n');
  console.log('='.repeat(70));
  console.log('AVERAGE METRICS');
  console.log('='.repeat(70));
  console.log(`\nStored Scale (raw values):`);
  console.log(`  Mood:     ${avgMood.toFixed(2)}`);
  console.log(`  Stress:   ${avgStress.toFixed(2)}`);
  console.log(`  Sleep:    ${avgSleep.toFixed(2)}`);
  console.log(`  Physical: ${avgPhysical.toFixed(2)}`);

  if (maxValue <= 5) {
    console.log(`\nDisplayed as /5:`);
    console.log(`  Mood:     ${avgMood.toFixed(1)} / 5`);
    console.log(`  Stress:   ${avgStress.toFixed(1)} / 5`);
    console.log(`  Sleep:    ${avgSleep.toFixed(1)} / 5`);
    console.log(`  Physical: ${avgPhysical.toFixed(1)} / 5`);
  } else {
    console.log(`\nDisplayed as /10:`);
    console.log(`  Mood:     ${avgMood.toFixed(1)} / 10`);
    console.log(`  Stress:   ${avgStress.toFixed(1)} / 10`);
    console.log(`  Sleep:    ${avgSleep.toFixed(1)} / 10`);
    console.log(`  Physical: ${avgPhysical.toFixed(1)} / 10`);
  }

  // Check readiness calculation logic
  console.log('\n');
  console.log('='.repeat(70));
  console.log('READINESS CALCULATION CHECK');
  console.log('='.repeat(70));

  // Take one check-in and verify calculation
  const sample = checkins[0];
  console.log(`\nSample Check-in (${sample.user.firstName}):`);
  console.log(`  Raw values: mood=${sample.mood}, stress=${sample.stress}, sleep=${sample.sleep}, physical=${sample.physicalHealth}`);

  // Readiness formula (from readiness.ts - expects 1-10 scale)
  const moodScore = (sample.mood / 10) * 100;
  const stressScore = ((10 - sample.stress) / 10) * 100;
  const sleepScore = (sample.sleep / 10) * 100;
  const physicalScore = (sample.physicalHealth / 10) * 100;

  const calculatedScore = Math.round(
    moodScore * 0.25 +
    stressScore * 0.25 +
    sleepScore * 0.25 +
    physicalScore * 0.25
  );

  console.log(`\n  Readiness calculation (assuming 1-10 scale):`);
  console.log(`    moodScore = (${sample.mood} / 10) × 100 = ${moodScore.toFixed(1)}`);
  console.log(`    stressScore = ((10 - ${sample.stress}) / 10) × 100 = ${stressScore.toFixed(1)}`);
  console.log(`    sleepScore = (${sample.sleep} / 10) × 100 = ${sleepScore.toFixed(1)}`);
  console.log(`    physicalScore = (${sample.physicalHealth} / 10) × 100 = ${physicalScore.toFixed(1)}`);
  console.log(`    TOTAL = (${moodScore.toFixed(1)} + ${stressScore.toFixed(1)} + ${sleepScore.toFixed(1)} + ${physicalScore.toFixed(1)}) / 4 = ${calculatedScore}%`);
  console.log(`\n  Stored score: ${sample.readinessScore}%`);
  console.log(`  Calculation matches: ${calculatedScore === sample.readinessScore ? '✓ YES' : '✗ NO'}`);

  // AI concern detection
  console.log('\n');
  console.log('='.repeat(70));
  console.log('AI CONCERN DETECTION LOGIC');
  console.log('='.repeat(70));

  console.log(`
The AI uses these clinical indicators (expects 1-10 scale):
- High stress (7+/10) + poor sleep (<5/10) = burnout risk
- Mood < 5/10 = mood concern
- Physical health < 5/10 = physical concern

Current average values (raw):
- Stress: ${avgStress.toFixed(1)}${maxValue <= 5 ? ` (on 1-5 scale, would be ${(avgStress * 2).toFixed(1)} on 1-10)` : ''}
- Sleep:  ${avgSleep.toFixed(1)}${maxValue <= 5 ? ` (on 1-5 scale, would be ${(avgSleep * 2).toFixed(1)} on 1-10)` : ''}

PROBLEM IDENTIFIED:`);

  if (maxValue <= 5) {
    console.log(`
The data is stored on a 1-5 scale, but:
1. Readiness calculation divides by 10 (expecting 1-10)
2. AI prompts show values as "/10"
3. AI thresholds are based on 1-10 scale

This means:
- A "good" sleep of 4/5 becomes 40/100 in readiness calc (should be 80/100)
- AI sees sleep=4 and thinks it's 4/10 (poor) instead of 4/5 (good)

SOLUTION: Either convert values to 1-10 scale or adjust calculations.
`);
  } else {
    console.log(`
The data is stored on a 1-10 scale, which matches expectations.
If AI is flagging sleep as concern, check individual member values.
`);
  }

  console.log('='.repeat(70));
}

testMetricsScale()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
