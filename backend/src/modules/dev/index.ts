/**
 * Development/Debug Routes
 * Query analysis, performance testing, and debugging tools
 *
 * IMPORTANT: Only enable in development!
 */

import { Hono } from 'hono';
import type { AppContext } from '../../types/context.js';
import { prisma } from '../../config/prisma.js';
import { queryAnalyzer, benchmarkQuery } from '../../utils/query-analyzer.js';

const devRoutes = new Hono<AppContext>();

// ============================================
// QUERY ANALYSIS ENDPOINTS
// ============================================

/**
 * Start query analysis session
 * GET /dev/query-analysis/start?threshold=100
 */
devRoutes.get('/query-analysis/start', async (c) => {
  const threshold = parseInt(c.req.query('threshold') || '100');
  queryAnalyzer.enable(threshold);
  queryAnalyzer.clear();

  return c.json({
    message: 'Query analysis started',
    threshold: `${threshold}ms`,
    hint: 'Now make API calls, then GET /dev/query-analysis/report'
  });
});

/**
 * Get query analysis report
 * GET /dev/query-analysis/report
 */
devRoutes.get('/query-analysis/report', async (c) => {
  const stats = queryAnalyzer.printReport();

  return c.json({
    totalQueries: stats.totalQueries,
    totalDuration: `${stats.totalDuration.toFixed(2)}ms`,
    avgDuration: stats.totalQueries > 0
      ? `${(stats.totalDuration / stats.totalQueries).toFixed(2)}ms`
      : '0ms',
    slowQueries: stats.slowQueries.length,
    duplicateQueries: Object.fromEntries(stats.duplicateQueries),
    queriesByModel: Object.fromEntries(stats.queriesByModel),
  });
});

/**
 * Stop query analysis
 * GET /dev/query-analysis/stop
 */
devRoutes.get('/query-analysis/stop', async (c) => {
  queryAnalyzer.disable();
  return c.json({ message: 'Query analysis stopped' });
});

// ============================================
// BENCHMARK ENDPOINTS
// ============================================

/**
 * Benchmark common queries
 * GET /dev/benchmark/queries
 */
devRoutes.get('/benchmark/queries', async (c) => {
  const companyId = c.get('companyId');
  const results: Record<string, any> = {};

  // Test 1: Simple user count
  const userCount = await benchmarkQuery(
    'User count',
    () => prisma.user.count({ where: { companyId } }),
    3
  );
  results.userCount = { avg: userCount.avg, result: userCount.result };

  // Test 2: Users with team (join)
  const usersWithTeam = await benchmarkQuery(
    'Users with team (join)',
    () => prisma.user.findMany({
      where: { companyId },
      take: 20,
      include: { team: true }
    }),
    3
  );
  results.usersWithTeam = { avg: usersWithTeam.avg, count: usersWithTeam.result.length };

  // Test 3: Today's checkins
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCheckins = await benchmarkQuery(
    "Today's checkins",
    () => prisma.checkin.findMany({
      where: {
        companyId,
        createdAt: { gte: today, lt: tomorrow }
      },
      include: { user: { select: { firstName: true, lastName: true } } }
    }),
    3
  );
  results.todayCheckins = { avg: todayCheckins.avg, count: todayCheckins.result.length };

  // Test 4: Dashboard stats (complex)
  const dashboardStats = await benchmarkQuery(
    'Dashboard stats (multiple counts)',
    async () => {
      const [users, checkins, incidents, exceptions] = await Promise.all([
        prisma.user.count({ where: { companyId, isActive: true } }),
        prisma.checkin.count({ where: { companyId, createdAt: { gte: today } } }),
        prisma.incident.count({ where: { companyId, status: 'OPEN' } }),
        prisma.exception.count({ where: { companyId, status: 'PENDING' } }),
      ]);
      return { users, checkins, incidents, exceptions };
    },
    3
  );
  results.dashboardStats = { avg: dashboardStats.avg, result: dashboardStats.result };

  return c.json({
    message: 'Benchmark complete',
    results,
    summary: {
      fastest: Object.entries(results).sort((a, b) => a[1].avg - b[1].avg)[0][0],
      slowest: Object.entries(results).sort((a, b) => b[1].avg - a[1].avg)[0][0],
    }
  });
});

// ============================================
// DATABASE HEALTH CHECK
// ============================================

/**
 * Check database connection and basic health
 * GET /dev/db-health
 */
devRoutes.get('/db-health', async (c) => {
  const startTime = Date.now();

  try {
    // Simple connectivity test
    await prisma.$queryRaw`SELECT 1`;
    const connectTime = Date.now() - startTime;

    // Get table sizes
    const tableSizes = await prisma.$queryRaw<Array<{ table_name: string; row_count: bigint }>>`
      SELECT
        relname as table_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
      LIMIT 10
    `;

    // Check for missing indexes (tables with sequential scans > index scans)
    const indexUsage = await prisma.$queryRaw<Array<{ table: string; seq_scan: bigint; idx_scan: bigint }>>`
      SELECT
        relname as table,
        seq_scan,
        idx_scan
      FROM pg_stat_user_tables
      WHERE seq_scan > idx_scan
        AND n_live_tup > 1000
      ORDER BY seq_scan DESC
      LIMIT 5
    `;

    return c.json({
      status: 'healthy',
      connectionTime: `${connectTime}ms`,
      tableSizes: tableSizes.map(t => ({
        table: t.table_name,
        rows: Number(t.row_count)
      })),
      potentialIndexNeeded: indexUsage.map(i => ({
        table: i.table,
        seqScans: Number(i.seq_scan),
        indexScans: Number(i.idx_scan),
        recommendation: 'Consider adding index - high sequential scans'
      }))
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ============================================
// UNUSED QUERY DETECTION
// ============================================

/**
 * Find potentially unused or redundant queries in routes
 * GET /dev/analyze-routes
 */
devRoutes.get('/analyze-routes', async (c) => {
  // This would require static analysis - returning tips instead
  return c.json({
    tips: [
      {
        issue: 'N+1 Queries',
        description: 'Fetching related data in a loop instead of using include/join',
        solution: 'Use Prisma include: { relation: true } or select with nested relations',
        example: 'prisma.user.findMany({ include: { team: true } })'
      },
      {
        issue: 'Over-fetching',
        description: 'Selecting all fields when only a few are needed',
        solution: 'Use select: { field1: true, field2: true } instead of full object',
        example: 'prisma.user.findMany({ select: { id: true, email: true } })'
      },
      {
        issue: 'Missing pagination',
        description: 'Fetching all records without limit',
        solution: 'Always use take/skip for large tables',
        example: 'prisma.user.findMany({ take: 20, skip: 0 })'
      },
      {
        issue: 'Duplicate queries',
        description: 'Same query executed multiple times in one request',
        solution: 'Use Promise.all() or cache results in variables',
        example: 'const [users, teams] = await Promise.all([getUsers(), getTeams()])'
      },
      {
        issue: 'Missing indexes',
        description: 'Queries filtering on non-indexed columns',
        solution: 'Add @@index([column]) in Prisma schema for frequently filtered columns',
        example: '@@index([companyId, createdAt])'
      }
    ],
    howToTest: {
      step1: 'GET /dev/query-analysis/start',
      step2: 'Make your API calls (e.g., load dashboard)',
      step3: 'GET /dev/query-analysis/report',
      step4: 'Check for duplicates and slow queries'
    }
  });
});

export { devRoutes };
