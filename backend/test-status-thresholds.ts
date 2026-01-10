/**
 * STATUS THRESHOLD INVESTIGATION
 *
 * Check what scores map to which status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testStatusThresholds() {
  console.log('='.repeat(70));
  console.log('STATUS THRESHOLD INVESTIGATION');
  console.log('='.repeat(70));
  console.log('');

  // Get all check-ins with their scores and status
  const checkins = await prisma.checkin.findMany({
    select: {
      readinessScore: true,
      readinessStatus: true,
    },
    orderBy: { readinessScore: 'desc' },
  });

  console.log(`Total check-ins: ${checkins.length}\n`);

  // Group by status
  const green = checkins.filter(c => c.readinessStatus === 'GREEN');
  const yellow = checkins.filter(c => c.readinessStatus === 'YELLOW');
  const red = checkins.filter(c => c.readinessStatus === 'RED');

  console.log('GREEN status check-ins:');
  if (green.length > 0) {
    const greenScores = green.map(c => c.readinessScore).sort((a, b) => b - a);
    console.log(`  Count: ${green.length}`);
    console.log(`  Score range: ${Math.min(...greenScores)}% - ${Math.max(...greenScores)}%`);
    console.log(`  Sample scores: ${greenScores.slice(0, 10).join(', ')}`);
  } else {
    console.log('  No GREEN check-ins found');
  }

  console.log('\nYELLOW status check-ins:');
  if (yellow.length > 0) {
    const yellowScores = yellow.map(c => c.readinessScore).sort((a, b) => b - a);
    console.log(`  Count: ${yellow.length}`);
    console.log(`  Score range: ${Math.min(...yellowScores)}% - ${Math.max(...yellowScores)}%`);
    console.log(`  Sample scores: ${yellowScores.slice(0, 10).join(', ')}`);

    // Check for scores outside expected range
    const outsideRange = yellow.filter(c => c.readinessScore < 50 || c.readinessScore >= 70);
    if (outsideRange.length > 0) {
      console.log(`  ⚠️ Scores outside 50-69 range: ${outsideRange.map(c => c.readinessScore).join(', ')}`);
    }
  } else {
    console.log('  No YELLOW check-ins found');
  }

  console.log('\nRED status check-ins:');
  if (red.length > 0) {
    const redScores = red.map(c => c.readinessScore).sort((a, b) => b - a);
    console.log(`  Count: ${red.length}`);
    console.log(`  Score range: ${Math.min(...redScores)}% - ${Math.max(...redScores)}%`);
    console.log(`  Sample scores: ${redScores.slice(0, 10).join(', ')}`);
  } else {
    console.log('  No RED check-ins found');
  }

  // Analyze actual thresholds
  console.log('\n' + '='.repeat(70));
  console.log('THRESHOLD ANALYSIS');
  console.log('='.repeat(70));

  // Find boundary cases
  if (green.length > 0) {
    const minGreen = Math.min(...green.map(c => c.readinessScore));
    console.log(`\nLowest GREEN score: ${minGreen}%`);
  }

  if (yellow.length > 0) {
    const minYellow = Math.min(...yellow.map(c => c.readinessScore));
    const maxYellow = Math.max(...yellow.map(c => c.readinessScore));
    console.log(`YELLOW range: ${minYellow}% - ${maxYellow}%`);
  }

  if (red.length > 0) {
    const maxRed = Math.max(...red.map(c => c.readinessScore));
    console.log(`Highest RED score: ${maxRed}%`);
  }

  // Determine actual thresholds
  console.log('\n' + '-'.repeat(40));
  console.log('DETECTED THRESHOLDS:');
  console.log('-'.repeat(40));

  const allScores = checkins.map(c => ({ score: c.readinessScore, status: c.readinessStatus }));

  // Find GREEN threshold
  const greenThreshold = green.length > 0 ? Math.min(...green.map(c => c.readinessScore)) : null;

  // Find RED threshold
  const redThreshold = red.length > 0 ? Math.max(...red.map(c => c.readinessScore)) : null;

  console.log(`  GREEN: score >= ${greenThreshold !== null ? greenThreshold : '?'}%`);
  console.log(`  YELLOW: ${redThreshold !== null ? redThreshold + 1 : '?'}% <= score < ${greenThreshold !== null ? greenThreshold : '?'}%`);
  console.log(`  RED: score <= ${redThreshold !== null ? redThreshold : '?'}%`);

  // Show distribution
  console.log('\n' + '='.repeat(70));
  console.log('SCORE DISTRIBUTION');
  console.log('='.repeat(70));

  const ranges = [
    { min: 90, max: 100, label: '90-100%' },
    { min: 80, max: 89, label: '80-89%' },
    { min: 70, max: 79, label: '70-79%' },
    { min: 60, max: 69, label: '60-69%' },
    { min: 50, max: 59, label: '50-59%' },
    { min: 40, max: 49, label: '40-49%' },
    { min: 30, max: 39, label: '30-39%' },
    { min: 0, max: 29, label: '0-29%' },
  ];

  console.log('\nScore Range  | Count | Status');
  console.log('-'.repeat(40));

  for (const range of ranges) {
    const inRange = checkins.filter(c => c.readinessScore >= range.min && c.readinessScore <= range.max);
    if (inRange.length > 0) {
      const statuses = [...new Set(inRange.map(c => c.readinessStatus))].join(', ');
      console.log(`${range.label.padEnd(12)} | ${String(inRange.length).padStart(5)} | ${statuses}`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

testStatusThresholds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
