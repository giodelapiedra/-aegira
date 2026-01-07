/**
 * Centralized pagination utilities
 * Consistent pagination handling across all API endpoints
 */

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================
// CONSTANTS
// ============================================

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// ============================================
// FUNCTIONS
// ============================================

/**
 * Parse and validate pagination parameters from query string
 */
export function parsePaginationParams(
  page?: string | number,
  limit?: string | number
): PaginationParams {
  const parsedPage = Math.max(1, parseInt(String(page || PAGINATION_DEFAULTS.PAGE), 10));
  const parsedLimit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(1, parseInt(String(limit || PAGINATION_DEFAULTS.LIMIT), 10))
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Create a paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(page, limit, total),
  };
}

/**
 * Helper for Prisma findMany with pagination
 * Returns both data and total count in parallel
 */
export async function paginatedQuery<T>(
  findMany: () => Promise<T[]>,
  count: () => Promise<number>,
  params: PaginationParams
): Promise<PaginatedResponse<T>> {
  const [data, total] = await Promise.all([findMany(), count()]);

  return createPaginatedResponse(data, params.page, params.limit, total);
}
