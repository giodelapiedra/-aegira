import { Context } from 'hono';
import { AuthUser } from '../middlewares/auth.middleware.js';

export interface AppContext {
  Variables: {
    user: AuthUser;
    userId: string;
    companyId: string;
    timezone: string; // Company timezone - fetched once in auth middleware, available everywhere
  };
}

export interface RequestWithUser {
  user: AuthUser;
}

export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  code?: string;
};

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
