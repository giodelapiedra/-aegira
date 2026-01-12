import { PrismaClient } from '@prisma/client';
import { calculateSingleTeamGradeOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient();

async function check() {
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Alpha' } }
  });

  if (!team) {
    console.log('Team not found');
    return;
  }

  console.log('=== Calling calculateSingleTeamGradeOptimized for Alpha Team ===\n');

  const result = await calculateSingleTeamGradeOptimized(team.id, { days: 7 });

  console.log('Overall Score:', result?.score);
  console.log('Grade:', result?.grade, '-', result?.gradeLabel);
  console.log('Attendance Rate (Compliance):', result?.attendanceRate, '%');
  console.log('On-Time Rate:', result?.onTimeRate, '%');
  console.log('');
  console.log('Breakdown:', result?.breakdown);
  console.log('');
  console.log('Included members:', result?.includedMemberCount);
  console.log('Onboarding members:', result?.onboardingCount);
  console.log('');
  console.log('Full result:', JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

check().catch(console.error);
