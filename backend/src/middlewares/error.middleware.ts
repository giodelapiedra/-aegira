import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, c: Context) {
  logger.error({ err, path: c.req.path, method: c.req.method }, 'Error occurred');

  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
      },
      err.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
      },
      err.status
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation error',
        details: err.issues,
      },
      400
    );
  }

  return c.json(
    {
      error: 'Internal server error',
    },
    500
  );
}
