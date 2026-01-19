/**
 * Query Performance Analyzer
 * Detects slow queries, N+1 problems, and provides timing metrics
 */

import { PrismaClient } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface QueryLog {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
  model?: string;
  operation?: string;
}

interface QueryStats {
  totalQueries: number;
  totalDuration: number;
  slowQueries: QueryLog[];
  duplicateQueries: Map<string, number>;
  queriesByModel: Map<string, number>;
}

// ============================================
// QUERY ANALYZER
// ============================================

class QueryAnalyzer {
  private logs: QueryLog[] = [];
  private isEnabled: boolean = false;
  private slowThreshold: number = 100; // ms

  enable(threshold: number = 100) {
    this.isEnabled = true;
    this.slowThreshold = threshold;
    this.logs = [];
    console.log(`\n📊 Query Analyzer ENABLED (slow threshold: ${threshold}ms)\n`);
  }

  disable() {
    this.isEnabled = false;
    console.log('\n📊 Query Analyzer DISABLED\n');
  }

  log(query: string, params: string, duration: number) {
    if (!this.isEnabled) return;

    const log: QueryLog = {
      query,
      params,
      duration,
      timestamp: new Date(),
      model: this.extractModel(query),
      operation: this.extractOperation(query),
    };

    this.logs.push(log);

    // Alert on slow queries immediately
    if (duration > this.slowThreshold) {
      console.log(`\n🐢 SLOW QUERY (${duration}ms):`);
      console.log(`   ${query.substring(0, 200)}...`);
      console.log(`   Model: ${log.model}, Operation: ${log.operation}\n`);
    }
  }

  private extractModel(query: string): string {
    const match = query.match(/FROM\s+"public"\."(\w+)"/i) ||
                  query.match(/INTO\s+"public"\."(\w+)"/i) ||
                  query.match(/UPDATE\s+"public"\."(\w+)"/i);
    return match ? match[1] : 'unknown';
  }

  private extractOperation(query: string): string {
    if (query.startsWith('SELECT')) return 'SELECT';
    if (query.startsWith('INSERT')) return 'INSERT';
    if (query.startsWith('UPDATE')) return 'UPDATE';
    if (query.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  getStats(): QueryStats {
    const stats: QueryStats = {
      totalQueries: this.logs.length,
      totalDuration: this.logs.reduce((sum, log) => sum + log.duration, 0),
      slowQueries: this.logs.filter(log => log.duration > this.slowThreshold),
      duplicateQueries: new Map(),
      queriesByModel: new Map(),
    };

    // Find duplicates (potential N+1)
    const queryCount = new Map<string, number>();
    this.logs.forEach(log => {
      const key = log.query.substring(0, 100);
      queryCount.set(key, (queryCount.get(key) || 0) + 1);
    });
    queryCount.forEach((count, query) => {
      if (count > 1) {
        stats.duplicateQueries.set(query, count);
      }
    });

    // Count by model
    this.logs.forEach(log => {
      if (log.model) {
        stats.queriesByModel.set(
          log.model,
          (stats.queriesByModel.get(log.model) || 0) + 1
        );
      }
    });

    return stats;
  }

  printReport() {
    const stats = this.getStats();

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    📊 QUERY ANALYSIS REPORT                ');
    console.log('═══════════════════════════════════════════════════════════');

    console.log(`\n📈 Summary:`);
    console.log(`   Total Queries: ${stats.totalQueries}`);
    console.log(`   Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
    console.log(`   Avg Duration: ${stats.totalQueries > 0 ? (stats.totalDuration / stats.totalQueries).toFixed(2) : 0}ms`);
    console.log(`   Slow Queries (>${this.slowThreshold}ms): ${stats.slowQueries.length}`);

    if (stats.duplicateQueries.size > 0) {
      console.log(`\n⚠️  Potential N+1 Problems (duplicate queries):`);
      stats.duplicateQueries.forEach((count, query) => {
        console.log(`   [${count}x] ${query.substring(0, 80)}...`);
      });
    } else {
      console.log(`\n✅ No duplicate queries detected`);
    }

    if (stats.queriesByModel.size > 0) {
      console.log(`\n📋 Queries by Model:`);
      const sorted = [...stats.queriesByModel.entries()].sort((a, b) => b[1] - a[1]);
      sorted.forEach(([model, count]) => {
        console.log(`   ${model}: ${count}`);
      });
    }

    if (stats.slowQueries.length > 0) {
      console.log(`\n🐢 Slow Queries:`);
      stats.slowQueries.forEach((log, i) => {
        console.log(`   ${i + 1}. [${log.duration}ms] ${log.model}.${log.operation}`);
        console.log(`      ${log.query.substring(0, 100)}...`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    return stats;
  }

  clear() {
    this.logs = [];
  }
}

export const queryAnalyzer = new QueryAnalyzer();

// ============================================
// PRISMA WITH QUERY LOGGING
// ============================================

export function createAnalyzedPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  // @ts-ignore - Prisma event typing
  prisma.$on('query', (e: any) => {
    queryAnalyzer.log(e.query, e.params, e.duration);
  });

  return prisma;
}

// ============================================
// ROUTE WRAPPER FOR ANALYSIS
// ============================================

/**
 * Wrap an async handler to analyze queries for that request
 * Usage: app.get('/test', analyzeQueries(async (c) => { ... }))
 */
export function analyzeQueries<T>(
  handler: (c: any) => Promise<T>,
  options: { threshold?: number; printReport?: boolean } = {}
) {
  return async (c: any): Promise<T> => {
    const { threshold = 50, printReport = true } = options;

    queryAnalyzer.enable(threshold);
    queryAnalyzer.clear();

    const startTime = Date.now();

    try {
      const result = await handler(c);

      const totalTime = Date.now() - startTime;
      console.log(`\n⏱️  Request completed in ${totalTime}ms`);

      if (printReport) {
        queryAnalyzer.printReport();
      }

      return result;
    } finally {
      queryAnalyzer.disable();
    }
  };
}

// ============================================
// MANUAL TESTING HELPERS
// ============================================

/**
 * Test a specific query and measure performance
 */
export async function benchmarkQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
  iterations: number = 5
): Promise<{ avg: number; min: number; max: number; result: T }> {
  const times: number[] = [];
  let result: T;

  console.log(`\n🔬 Benchmarking: ${name}`);

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = await queryFn();
    const duration = performance.now() - start;
    times.push(duration);
    console.log(`   Run ${i + 1}: ${duration.toFixed(2)}ms`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n📊 Results for "${name}":`);
  console.log(`   Avg: ${avg.toFixed(2)}ms`);
  console.log(`   Min: ${min.toFixed(2)}ms`);
  console.log(`   Max: ${max.toFixed(2)}ms`);

  return { avg, min, max, result: result! };
}
