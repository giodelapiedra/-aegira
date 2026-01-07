/**
 * Simple in-memory token blacklist for logout functionality.
 * Tokens are stored with their expiry time and auto-cleaned.
 *
 * NOTE: For multi-server deployments, replace this with Redis.
 */

interface BlacklistedToken {
  expiresAt: number; // Unix timestamp
}

// In-memory store
const blacklist = new Map<string, BlacklistedToken>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Auto-cleanup expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of blacklist.entries()) {
    if (data.expiresAt < now) {
      blacklist.delete(token);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Add a token to the blacklist
 * @param token - The JWT token to blacklist
 * @param expiresInMs - How long until the token expires (default: 7 days for refresh tokens)
 */
export function blacklistToken(token: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): void {
  blacklist.set(token, {
    expiresAt: Date.now() + expiresInMs,
  });
}

/**
 * Check if a token is blacklisted
 * @param token - The JWT token to check
 * @returns true if blacklisted, false otherwise
 */
export function isTokenBlacklisted(token: string): boolean {
  const data = blacklist.get(token);
  if (!data) return false;

  // Auto-clean if expired
  if (data.expiresAt < Date.now()) {
    blacklist.delete(token);
    return false;
  }

  return true;
}

/**
 * Get blacklist size (for monitoring)
 */
export function getBlacklistSize(): number {
  return blacklist.size;
}
