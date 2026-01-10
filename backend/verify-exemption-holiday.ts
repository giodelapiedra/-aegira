import { PrismaClient } from '@prisma/client';
import { calculatePerformanceScore } from './src/utils/attendance.js';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== EXEMPTION & HOLIDAY VERIFICATION ===\n');

  const now = new Date();
  const tz = 'Asia/Manila';
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz });

  // Get David who has exemption
  const david = await prisma.user.findFirst({
    where: { email: 'david.gonzales@aegira.com' },
    include: {
      exceptions: { where: { status: 'APPROVED' } },
      team: true,
    },
  });

  if (!david) {
    console.log('David not found');
    return;
  }

  console.log('DAVID GONZALES:');
  console.log('Exemptions:');
  for (const e of david.exceptions) {
    const start = e.startDate ? formatter.format(e.startDate) : 'N/A';
    const end = e.endDate ? formatter.format(e.endDate) : 'N/A';
    console.log(`  ${e.type}: ${start} to ${end}`);
  }

  // Get holidays
  const holidays = await prisma.holiday.findMany({
    where: { companyId: david.companyId },
    orderBy: { date: 'asc' },
  });

  console.log('\nCOMPANY HOLIDAYS:');
  for (const h of holidays) {
    console.log(`  ${formatter.format(h.date)}: ${h.name}`);
  }

  // Calculate performance
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const perf = await calculatePerformanceScore(david.id, thirtyDaysAgo, now, tz);

  console.log('\n=== PERFORMANCE SCORE ===');
  console.log(`Work Days in Period: ${perf.workDays}`);
  console.log(`\nBreakdown:`);
  console.log(`  GREEN:   ${perf.breakdown.green} days (score 100 each)`);
  console.log(`  YELLOW:  ${perf.breakdown.yellow} days (score 75 each)`);
  console.log(`  ABSENT:  ${perf.breakdown.absent} days (score 0 each)`);
  console.log(`  EXCUSED: ${perf.breakdown.excused} days (NOT counted - exemption/holiday)`);
  console.log(`\nCounted Days: ${perf.countedDays} (GREEN + YELLOW + ABSENT only)`);
  console.log(`Final Score: ${perf.score}%`);

  // Manual verification
  const expectedTotal = perf.breakdown.green * 100 + perf.breakdown.yellow * 75;
  const expectedScore = perf.countedDays > 0 ? Math.round((expectedTotal / perf.countedDays) * 10) / 10 : 0;

  console.log('\n=== FORMULA VERIFICATION ===');
  console.log(`Formula: (GREEN*100 + YELLOW*75) / countedDays`);
  console.log(`= (${perf.breakdown.green}*100 + ${perf.breakdown.yellow}*75) / ${perf.countedDays}`);
  console.log(`= ${expectedTotal} / ${perf.countedDays}`);
  console.log(`= ${expectedScore}%`);

  const match = Math.abs(perf.score - expectedScore) < 1;
  console.log(`\nScore Match: ${match ? 'YES ✓' : 'NO ✗'}`);

  console.log('\n=== CONCLUSION ===');
  if (perf.breakdown.excused > 0) {
    console.log(`✓ ${perf.breakdown.excused} EXCUSED days (exemption/holiday) are:`);
    console.log('  - NOT counted as ABSENT');
    console.log('  - NOT included in score calculation');
    console.log('  - Worker NOT penalized for these days');
  } else {
    console.log('No exemption/holiday days in this period');
  }

  // Show other workers too
  console.log('\n=== ALL WORKERS SUMMARY ===');

  const workers = await prisma.user.findMany({
    where: { role: { in: ['MEMBER', 'WORKER'] }, teamId: { not: null }, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  for (const w of workers) {
    const p = await calculatePerformanceScore(w.id, thirtyDaysAgo, now, tz);
    if (p.breakdown.excused > 0) {
      console.log(`${w.firstName} ${w.lastName}: ${p.breakdown.excused} EXCUSED days excluded, Score: ${p.score}%`);
    }
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
