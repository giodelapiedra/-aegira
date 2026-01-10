import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.checkin.findFirst({
    where: { user: { email: 'christina.tan@aegira.com' } },
    orderBy: { createdAt: 'desc' },
    select: {
      mood: true,
      stress: true,
      sleep: true,
      physicalHealth: true,
      readinessScore: true,
      readinessStatus: true,
      createdAt: true
    }
  });

  console.log('='.repeat(50));
  console.log('Christina Tan - Latest Check-in');
  console.log('='.repeat(50));

  if (result) {
    console.log(`Mood:            ${result.mood}/10`);
    console.log(`Stress:          ${result.stress}/10`);
    console.log(`Sleep:           ${result.sleep}/10`);
    console.log(`Physical Health: ${result.physicalHealth}/10`);
    console.log('-'.repeat(50));
    console.log(`Readiness Score: ${result.readinessScore}%`);
    console.log(`Status:          ${result.readinessStatus}`);
    console.log(`Date:            ${result.createdAt}`);
    console.log('-'.repeat(50));

    // Manual calculation to verify
    const moodScore = (result.mood / 10) * 100;
    const stressScore = ((10 - result.stress) / 10) * 100;
    const sleepScore = (result.sleep / 10) * 100;
    const physicalScore = (result.physicalHealth / 10) * 100;
    const calculatedScore = Math.round((moodScore + stressScore + sleepScore + physicalScore) / 4);

    console.log('MANUAL VERIFICATION:');
    console.log(`  Mood Score:     ${moodScore}`);
    console.log(`  Stress Score:   ${stressScore} (inverted from ${result.stress})`);
    console.log(`  Sleep Score:    ${sleepScore}`);
    console.log(`  Physical Score: ${physicalScore}`);
    console.log(`  Calculated:     ${calculatedScore}%`);
    console.log(`  Stored:         ${result.readinessScore}%`);
    console.log(`  Match:          ${calculatedScore === result.readinessScore ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('No check-in found for Christina Tan');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
