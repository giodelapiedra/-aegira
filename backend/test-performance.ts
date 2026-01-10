/**
 * Performance Test: API Query Analysis
 *
 * Tests and compares query performance between original and optimized implementations.
 * Run with: npx tsx test-performance.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateTeamsOverview } from './src/utils/team-grades.js';
import { calculateTeamsOverviewOptimized } from './src/utils/team-grades-optimized.js';

const prisma = new PrismaClient({
  log: ['query'], // Enable query logging
});

async function main() {
  console.log('==========================================');
  console.log('  PERFORMANCE TEST');
  console.log('==========================================\n');

  // Get company
  const company = await prisma.company.findFirst({
    select: { id: true, name: true, timezone: true },
  });

  if (!company) {
    console.log('❌ No company found');
    return;
  }

  console.log(`📍 Company: ${company.name}\n`);

  // Count data
  const [teamCount, memberCount, checkinCount, attendanceCount] = await Promise.all([
    prisma.team.count({ where: { companyId: company.id, isActive: true } }),
    prisma.user.count({ where: { companyId: company.id, isActive: true, role: { in: ['MEMBER', 'WORKER'] } } }),
    prisma.checkin.count({ where: { companyId: company.id } }),
    prisma.dailyAttendance.count({ where: { companyId: company.id } }),
  ]);

  console.log('📊 Data Size:');
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Members: ${memberCount}`);
  console.log(`   Check-ins: ${checkinCount}`);
  console.log(`   Attendance Records: ${attendanceCount}`);
  console.log('');

  // ==========================================
  // TEST 1: Original vs Optimized Teams Overview
  // ==========================================
  console.log('==========================================');
  console.log('  TEST 1: Teams Overview Performance');
  console.log('==========================================\n');

  // Test ORIGINAL (N+1 queries)
  console.log('🐢 Testing ORIGINAL implementation...');
  const startOriginal = performance.now();

  try {
    await calculateTeamsOverview({
      companyId: company.id,
      days: 30,
      timezone: company.timezone,
    });
    const endOriginal = performance.now();
    console.log(`   ⏱️  Time: ${(endOriginal - startOriginal).toFixed(2)}ms`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // Test OPTIMIZED (batched queries)
  console.log('🚀 Testing OPTIMIZED implementation...');
  const startOptimized = performance.now();

  try {
    await calculateTeamsOverviewOptimized({
      companyId: company.id,
      days: 30,
      timezone: company.timezone,
    });
    const endOptimized = performance.now();
    console.log(`   ⏱️  Time: ${(endOptimized - startOptimized).toFixed(2)}ms`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // ==========================================
  // TEST 2: Common Slow Queries
  // ==========================================
  console.log('\n==========================================');
  console.log('  TEST 2: Common API Query Performance');
  console.log('==========================================\n');

  const tests = [
    {
      name: 'Dashboard Stats',
      fn: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        await Promise.all([
          prisma.user.count({
            where: { companyId: company.id, isActive: true, role: { in: ['MEMBER', 'WORKER'] } },
          }),
          prisma.checkin.findMany({
            where: { companyId: company.id, createdAt: { gte: today, lt: tomorrow } },
            select: { readinessStatus: true },
          }),
          prisma.exception.count({
            where: { companyId: company.id, status: 'PENDING' },
          }),
          prisma.incident.count({
            where: { companyId: company.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          }),
        ]);
      },
    },
    {
      name: 'Team Members with Details',
      fn: async () => {
        const team = await prisma.team.findFirst({
          where: { companyId: company.id, isActive: true },
        });
        if (team) {
          await prisma.user.findMany({
            where: { teamId: team.id, isActive: true },
            include: {
              checkins: {
                take: 7,
                orderBy: { createdAt: 'desc' },
              },
            },
          });
        }
      },
    },
    {
      name: 'Analytics - Last 30 Days',
      fn: async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await prisma.checkin.groupBy({
          by: ['readinessStatus'],
          where: {
            companyId: company.id,
            createdAt: { gte: thirtyDaysAgo },
          },
          _count: true,
        });
      },
    },
    {
      name: 'User List with Teams',
      fn: async () => {
        await prisma.user.findMany({
          where: { companyId: company.id },
          take: 50,
          include: {
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    },
    {
      name: 'Exceptions with User Details',
      fn: async () => {
        await prisma.exception.findMany({
          where: { companyId: company.id },
          take: 20,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    },
    {
      name: 'Incidents with Relations',
      fn: async () => {
        await prisma.incident.findMany({
          where: { companyId: company.id },
          take: 20,
          include: {
            reporter: { select: { id: true, firstName: true, lastName: true } },
            assignee: { select: { id: true, firstName: true, lastName: true } },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
    },
    {
      name: 'Daily Attendance Records',
      fn: async () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        await prisma.dailyAttendance.findMany({
          where: {
            companyId: company.id,
            date: { gte: sevenDaysAgo },
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
        });
      },
    },
  ];

  const results: { name: string; time: number; status: string }[] = [];

  for (const test of tests) {
    const start = performance.now();
    try {
      await test.fn();
      const end = performance.now();
      const time = end - start;
      const status = time > 1000 ? '🔴 SLOW' : time > 500 ? '🟡 MEDIUM' : '🟢 FAST';
      results.push({ name: test.name, time, status });
      console.log(`${status} ${test.name}: ${time.toFixed(2)}ms`);
    } catch (error) {
      results.push({ name: test.name, time: -1, status: '❌ ERROR' });
      console.log(`❌ ${test.name}: ERROR - ${error}`);
    }
  }

  // ==========================================
  // SUMMARY & RECOMMENDATIONS
  // ==========================================
  console.log('\n==========================================');
  console.log('  SUMMARY & RECOMMENDATIONS');
  console.log('==========================================\n');

  const slowQueries = results.filter(r => r.time > 500);

  if (slowQueries.length === 0) {
    console.log('✅ All queries are performing well!\n');
  } else {
    console.log('⚠️  Slow Queries Found:\n');
    slowQueries.forEach(q => {
      console.log(`   - ${q.name}: ${q.time.toFixed(2)}ms`);
    });
    console.log('');
  }

  console.log('💡 OPTIMIZATION RECOMMENDATIONS:\n');
  console.log('1. ✅ Teams Overview - Already using optimized version');
  console.log('   - Uses batched queries (5 queries total)');
  console.log('   - In-memory calculation instead of N+1 queries');
  console.log('');
  console.log('2. 📌 Database Indexes - Check these indexes exist:');
  console.log('   - checkins: (companyId, createdAt)');
  console.log('   - checkins: (userId, createdAt)');
  console.log('   - daily_attendance: (companyId, date)');
  console.log('   - daily_attendance: (userId, date)');
  console.log('   - exceptions: (companyId, status)');
  console.log('');
  console.log('3. 🔄 Caching Recommendations:');
  console.log('   - Dashboard stats: Cache for 1 minute');
  console.log('   - Team grades: Cache for 5 minutes');
  console.log('   - User lists: Cache for 30 seconds');
  console.log('');
  console.log('4. 📊 Pagination:');
  console.log('   - Always use LIMIT for list queries');
  console.log('   - Maximum 100 items per page');
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
