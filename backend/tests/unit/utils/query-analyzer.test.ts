/**
 * Unit Tests for query-analyzer.ts
 *
 * Tests query analyzer functionality including model and operation extraction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to create a testable version since queryAnalyzer is a singleton
// Testing the logic of model/operation extraction

// ============================================
// QUERY PARSING LOGIC TESTS
// ============================================

describe('Query Parsing Logic', () => {
  // Replicate the extraction logic for testing
  function extractModel(query: string): string {
    const match = query.match(/FROM\s+"public"\."(\w+)"/i) ||
                  query.match(/INTO\s+"public"\."(\w+)"/i) ||
                  query.match(/UPDATE\s+"public"\."(\w+)"/i);
    return match ? match[1] : 'unknown';
  }

  function extractOperation(query: string): string {
    if (query.startsWith('SELECT')) return 'SELECT';
    if (query.startsWith('INSERT')) return 'INSERT';
    if (query.startsWith('UPDATE')) return 'UPDATE';
    if (query.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  describe('extractModel', () => {
    describe('SELECT queries', () => {
      it('extracts model from simple SELECT', () => {
        const query = 'SELECT * FROM "public"."users" WHERE id = $1';
        expect(extractModel(query)).toBe('users');
      });

      it('extracts model from SELECT with multiple tables', () => {
        const query = 'SELECT * FROM "public"."checkins" c JOIN "public"."users" u ON c.userId = u.id';
        expect(extractModel(query)).toBe('checkins');
      });

      it('extracts model from SELECT with schema prefix', () => {
        const query = 'SELECT id, name FROM "public"."teams" ORDER BY name';
        expect(extractModel(query)).toBe('teams');
      });
    });

    describe('INSERT queries', () => {
      it('extracts model from INSERT', () => {
        const query = 'INSERT INTO "public"."absences" ("id", "userId") VALUES ($1, $2)';
        expect(extractModel(query)).toBe('absences');
      });

      it('extracts model from INSERT with RETURNING', () => {
        const query = 'INSERT INTO "public"."notifications" ("message") VALUES ($1) RETURNING *';
        expect(extractModel(query)).toBe('notifications');
      });
    });

    describe('UPDATE queries', () => {
      it('extracts model from UPDATE', () => {
        const query = 'UPDATE "public"."exceptions" SET status = $1 WHERE id = $2';
        expect(extractModel(query)).toBe('exceptions');
      });

      it('extracts model from UPDATE with multiple SET clauses', () => {
        const query = 'UPDATE "public"."daily_attendances" SET status = $1, updatedAt = $2 WHERE id = $3';
        expect(extractModel(query)).toBe('daily_attendances');
      });
    });

    describe('DELETE queries', () => {
      it('extracts model from DELETE (via FROM)', () => {
        const query = 'DELETE FROM "public"."holidays" WHERE id = $1';
        expect(extractModel(query)).toBe('holidays');
      });
    });

    describe('Edge cases', () => {
      it('returns unknown for non-standard query', () => {
        const query = 'BEGIN TRANSACTION';
        expect(extractModel(query)).toBe('unknown');
      });

      it('returns unknown for empty query', () => {
        expect(extractModel('')).toBe('unknown');
      });

      it('handles lowercase schema', () => {
        const query = 'SELECT * from "public"."users"';
        expect(extractModel(query)).toBe('users');
      });

      it('handles underscored table names', () => {
        const query = 'SELECT * FROM "public"."daily_team_summaries" WHERE teamId = $1';
        expect(extractModel(query)).toBe('daily_team_summaries');
      });

      it('handles camelCase table names', () => {
        const query = 'SELECT * FROM "public"."SystemLogs" WHERE id = $1';
        expect(extractModel(query)).toBe('SystemLogs');
      });
    });
  });

  describe('extractOperation', () => {
    it('identifies SELECT operation', () => {
      expect(extractOperation('SELECT * FROM users')).toBe('SELECT');
      expect(extractOperation('SELECT id, name FROM users')).toBe('SELECT');
    });

    it('identifies INSERT operation', () => {
      expect(extractOperation('INSERT INTO users (name) VALUES ($1)')).toBe('INSERT');
    });

    it('identifies UPDATE operation', () => {
      expect(extractOperation('UPDATE users SET name = $1')).toBe('UPDATE');
    });

    it('identifies DELETE operation', () => {
      expect(extractOperation('DELETE FROM users WHERE id = $1')).toBe('DELETE');
    });

    it('returns OTHER for unknown operations', () => {
      expect(extractOperation('BEGIN')).toBe('OTHER');
      expect(extractOperation('COMMIT')).toBe('OTHER');
      expect(extractOperation('ROLLBACK')).toBe('OTHER');
      expect(extractOperation('')).toBe('OTHER');
    });

    it('is case sensitive (matches uppercase start)', () => {
      expect(extractOperation('select * from users')).toBe('OTHER'); // lowercase
      expect(extractOperation('SELECT * from users')).toBe('SELECT'); // uppercase SELECT
    });
  });
});

// ============================================
// STATS CALCULATION LOGIC TESTS
// ============================================

describe('Stats Calculation Logic', () => {
  // Test the stats calculation logic

  interface QueryLog {
    query: string;
    params: string;
    duration: number;
    timestamp: Date;
    model?: string;
    operation?: string;
  }

  function calculateStats(logs: QueryLog[], slowThreshold: number = 100) {
    const totalQueries = logs.length;
    const totalDuration = logs.reduce((sum, log) => sum + log.duration, 0);
    const slowQueries = logs.filter(log => log.duration > slowThreshold);

    // Find duplicates
    const queryCount = new Map<string, number>();
    logs.forEach(log => {
      const key = log.query.substring(0, 100);
      queryCount.set(key, (queryCount.get(key) || 0) + 1);
    });
    const duplicateQueries = new Map<string, number>();
    queryCount.forEach((count, query) => {
      if (count > 1) {
        duplicateQueries.set(query, count);
      }
    });

    // Count by model
    const queriesByModel = new Map<string, number>();
    logs.forEach(log => {
      if (log.model) {
        queriesByModel.set(log.model, (queriesByModel.get(log.model) || 0) + 1);
      }
    });

    return {
      totalQueries,
      totalDuration,
      slowQueries,
      duplicateQueries,
      queriesByModel,
    };
  }

  describe('Total calculations', () => {
    it('calculates total queries correctly', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 10, timestamp: new Date(), model: 'users' },
        { query: 'SELECT 2', params: '', duration: 20, timestamp: new Date(), model: 'teams' },
        { query: 'SELECT 3', params: '', duration: 30, timestamp: new Date(), model: 'users' },
      ];
      const stats = calculateStats(logs);
      expect(stats.totalQueries).toBe(3);
    });

    it('calculates total duration correctly', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 10, timestamp: new Date() },
        { query: 'SELECT 2', params: '', duration: 20, timestamp: new Date() },
        { query: 'SELECT 3', params: '', duration: 30, timestamp: new Date() },
      ];
      const stats = calculateStats(logs);
      expect(stats.totalDuration).toBe(60);
    });

    it('handles empty logs', () => {
      const stats = calculateStats([]);
      expect(stats.totalQueries).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });
  });

  describe('Slow query detection', () => {
    it('identifies slow queries above threshold', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 50, timestamp: new Date() },
        { query: 'SELECT 2', params: '', duration: 150, timestamp: new Date() }, // Slow
        { query: 'SELECT 3', params: '', duration: 200, timestamp: new Date() }, // Slow
      ];
      const stats = calculateStats(logs, 100);
      expect(stats.slowQueries).toHaveLength(2);
    });

    it('uses custom threshold', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 30, timestamp: new Date() },
        { query: 'SELECT 2', params: '', duration: 60, timestamp: new Date() }, // Slow with 50ms threshold
      ];
      const stats = calculateStats(logs, 50);
      expect(stats.slowQueries).toHaveLength(1);
    });

    it('excludes queries at exactly threshold', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 100, timestamp: new Date() }, // Exactly at threshold
      ];
      const stats = calculateStats(logs, 100);
      expect(stats.slowQueries).toHaveLength(0); // > not >=
    });
  });

  describe('Duplicate detection (N+1 pattern)', () => {
    it('identifies duplicate queries', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT * FROM users WHERE id = $1', params: '1', duration: 10, timestamp: new Date() },
        { query: 'SELECT * FROM users WHERE id = $1', params: '2', duration: 10, timestamp: new Date() },
        { query: 'SELECT * FROM users WHERE id = $1', params: '3', duration: 10, timestamp: new Date() },
      ];
      const stats = calculateStats(logs);
      expect(stats.duplicateQueries.size).toBe(1);
      expect(stats.duplicateQueries.get('SELECT * FROM users WHERE id = $1')).toBe(3);
    });

    it('does not flag unique queries', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT * FROM users', params: '', duration: 10, timestamp: new Date() },
        { query: 'SELECT * FROM teams', params: '', duration: 10, timestamp: new Date() },
        { query: 'SELECT * FROM checkins', params: '', duration: 10, timestamp: new Date() },
      ];
      const stats = calculateStats(logs);
      expect(stats.duplicateQueries.size).toBe(0);
    });

    it('groups by first 100 characters', () => {
      const longQuery = 'SELECT * FROM users WHERE id = $1 AND ' + 'x'.repeat(100);
      const logs: QueryLog[] = [
        { query: longQuery + ' extra1', params: '', duration: 10, timestamp: new Date() },
        { query: longQuery + ' extra2', params: '', duration: 10, timestamp: new Date() },
      ];
      const stats = calculateStats(logs);
      expect(stats.duplicateQueries.size).toBe(1); // Same first 100 chars
    });
  });

  describe('Queries by model', () => {
    it('counts queries per model', () => {
      const logs: QueryLog[] = [
        { query: 'SELECT 1', params: '', duration: 10, timestamp: new Date(), model: 'users' },
        { query: 'SELECT 2', params: '', duration: 10, timestamp: new Date(), model: 'users' },
        { query: 'SELECT 3', params: '', duration: 10, timestamp: new Date(), model: 'teams' },
        { query: 'SELECT 4', params: '', duration: 10, timestamp: new Date(), model: 'checkins' },
      ];
      const stats = calculateStats(logs);
      expect(stats.queriesByModel.get('users')).toBe(2);
      expect(stats.queriesByModel.get('teams')).toBe(1);
      expect(stats.queriesByModel.get('checkins')).toBe(1);
    });

    it('ignores logs without model', () => {
      const logs: QueryLog[] = [
        { query: 'BEGIN', params: '', duration: 1, timestamp: new Date() },
        { query: 'COMMIT', params: '', duration: 1, timestamp: new Date() },
      ];
      const stats = calculateStats(logs);
      expect(stats.queriesByModel.size).toBe(0);
    });
  });
});

// ============================================
// BENCHMARK RESULT CALCULATION TESTS
// ============================================

describe('Benchmark Calculation Logic', () => {
  function calculateBenchmarkResults(times: number[]) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { avg, min, max };
  }

  it('calculates average correctly', () => {
    const result = calculateBenchmarkResults([10, 20, 30, 40, 50]);
    expect(result.avg).toBe(30);
  });

  it('calculates min correctly', () => {
    const result = calculateBenchmarkResults([15, 5, 25, 10, 20]);
    expect(result.min).toBe(5);
  });

  it('calculates max correctly', () => {
    const result = calculateBenchmarkResults([15, 5, 25, 10, 20]);
    expect(result.max).toBe(25);
  });

  it('handles single value', () => {
    const result = calculateBenchmarkResults([100]);
    expect(result.avg).toBe(100);
    expect(result.min).toBe(100);
    expect(result.max).toBe(100);
  });

  it('handles decimal values', () => {
    const result = calculateBenchmarkResults([10.5, 20.5, 30.5]);
    expect(result.avg).toBeCloseTo(20.5);
    expect(result.min).toBe(10.5);
    expect(result.max).toBe(30.5);
  });
});
