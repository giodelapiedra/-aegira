import type { Context, Next } from 'hono';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// For production with multiple servers, replace with Redis
const stores = new Map<string, Map<string, RateLimitStore>>();

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
  message?: string;  // Custom error message
  keyGenerator?: (c: Context) => string; // Custom key generator
}

function getStore(name: string): Map<string, RateLimitStore> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

// Clean up expired entries periodically
function cleanupStore(store: Map<string, RateLimitStore>) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(() => {
  for (const store of stores.values()) {
    cleanupStore(store);
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 */
export function rateLimiter(name: string, config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    keyGenerator = (c: Context) => {
      // Use X-Forwarded-For header or fall back to a default
      const forwarded = c.req.header('x-forwarded-for');
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      // Fallback to a combination of user-agent and other headers
      return c.req.header('user-agent') || 'unknown';
    },
  } = config;

  const store = getStore(name);

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let record = store.get(key);

    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    } else {
      // Increment count
      record.count++;
    }

    // Set rate limit headers
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (record.count > max) {
      c.header('Retry-After', String(resetSeconds));
      return c.json(
        {
          error: message,
          retryAfter: resetSeconds,
        },
        429
      );
    }

    await next();
  };
}

// Pre-configured rate limiters for common use cases

/**
 * Strict rate limiter for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimiter('login', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

/**
 * Rate limiter for registration
 * 3 registrations per hour per IP
 */
export const registerRateLimiter = rateLimiter('register', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many registration attempts. Please try again later.',
});

/**
 * Rate limiter for password reset requests
 * 3 requests per hour per IP
 */
export const passwordResetRateLimiter = rateLimiter('password-reset', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset requests. Please try again later.',
});

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimiter('api', {
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests. Please slow down.',
});
