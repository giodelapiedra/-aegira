import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Only log queries if explicitly enabled via DEBUG_PRISMA=true
// This reduces noise in development - set DEBUG_PRISMA=true to see queries
const shouldLogQueries = process.env.DEBUG_PRISMA === 'true';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: shouldLogQueries
      ? ['query', 'error', 'warn']
      : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
