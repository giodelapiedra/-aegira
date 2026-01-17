import { PrismaClient } from '@prisma/client';
import { queryAnalyzer } from '../utils/query-analyzer.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Only log queries if explicitly enabled via DEBUG_PRISMA=true
// This reduces noise in development - set DEBUG_PRISMA=true to see queries
const shouldLogQueries = process.env.DEBUG_PRISMA === 'true';

// Create Prisma client with event-based logging for query analysis
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: shouldLogQueries
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : ['error', 'warn'],
  });

  // Hook into query events for analysis (only when DEBUG_PRISMA=true)
  if (shouldLogQueries) {
    // @ts-ignore - Prisma event typing
    client.$on('query', (e: { query: string; params: string; duration: number }) => {
      // Log to analyzer
      queryAnalyzer.log(e.query, e.params, e.duration);

      // Also console log if very slow (>200ms)
      if (e.duration > 200) {
        console.log(`🐢 Slow query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
      }
    });
  }

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
