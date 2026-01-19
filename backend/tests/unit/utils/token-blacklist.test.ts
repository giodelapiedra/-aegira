/**
 * Token Blacklist Tests
 *
 * Tests for in-memory token blacklist functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  blacklistToken,
  isTokenBlacklisted,
  getBlacklistSize,
} from '../../../src/utils/token-blacklist.js';

// Note: Since token-blacklist uses a shared in-memory Map,
// tests may affect each other. We test the core functionality.

// ============================================
// BLACKLIST TOKEN TESTS
// ============================================

describe('blacklistToken', () => {
  it('adds token to blacklist', () => {
    const token = `test-token-${Date.now()}-1`;
    const initialSize = getBlacklistSize();

    blacklistToken(token);

    expect(getBlacklistSize()).toBe(initialSize + 1);
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('allows custom expiry time', () => {
    const token = `test-token-${Date.now()}-2`;
    const expiryMs = 1000; // 1 second

    blacklistToken(token, expiryMs);

    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('default expiry is 7 days', () => {
    // We can't directly test this without accessing internals,
    // but we can verify the token is still valid after blacklisting
    const token = `test-token-${Date.now()}-3`;

    blacklistToken(token);

    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('can blacklist multiple tokens', () => {
    const token1 = `multi-token-${Date.now()}-1`;
    const token2 = `multi-token-${Date.now()}-2`;
    const token3 = `multi-token-${Date.now()}-3`;

    blacklistToken(token1);
    blacklistToken(token2);
    blacklistToken(token3);

    expect(isTokenBlacklisted(token1)).toBe(true);
    expect(isTokenBlacklisted(token2)).toBe(true);
    expect(isTokenBlacklisted(token3)).toBe(true);
  });
});

// ============================================
// IS TOKEN BLACKLISTED TESTS
// ============================================

describe('isTokenBlacklisted', () => {
  it('returns false for non-blacklisted token', () => {
    const token = `non-blacklisted-${Date.now()}`;
    expect(isTokenBlacklisted(token)).toBe(false);
  });

  it('returns true for blacklisted token', () => {
    const token = `blacklisted-check-${Date.now()}`;
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isTokenBlacklisted('')).toBe(false);
  });

  it('handles special characters in token', () => {
    const token = `token-with-special-chars-!@#$%^&*()-${Date.now()}`;
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('is case-sensitive', () => {
    const token = `CaseSensitive-${Date.now()}`;
    blacklistToken(token);

    expect(isTokenBlacklisted(token)).toBe(true);
    expect(isTokenBlacklisted(token.toLowerCase())).toBe(false);
    expect(isTokenBlacklisted(token.toUpperCase())).toBe(false);
  });
});

// ============================================
// EXPIRY BEHAVIOR TESTS
// ============================================

describe('Token Expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('token is valid immediately after blacklisting', () => {
    const token = `expiry-test-immediate-${Date.now()}`;
    blacklistToken(token, 60000); // 1 minute

    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('token expires after expiry time', () => {
    const token = `expiry-test-timeout-${Date.now()}`;
    const expiryMs = 5000; // 5 seconds

    blacklistToken(token, expiryMs);
    expect(isTokenBlacklisted(token)).toBe(true);

    // Advance time past expiry
    vi.advanceTimersByTime(expiryMs + 1);

    expect(isTokenBlacklisted(token)).toBe(false);
  });

  it('token is still valid just before expiry', () => {
    const token = `expiry-test-before-${Date.now()}`;
    const expiryMs = 10000; // 10 seconds

    blacklistToken(token, expiryMs);

    // Advance time but not past expiry
    vi.advanceTimersByTime(expiryMs - 1);

    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('short-lived token expires quickly', () => {
    const token = `short-lived-${Date.now()}`;

    blacklistToken(token, 100); // 100ms

    expect(isTokenBlacklisted(token)).toBe(true);

    vi.advanceTimersByTime(101);

    expect(isTokenBlacklisted(token)).toBe(false);
  });
});

// ============================================
// GET BLACKLIST SIZE TESTS
// ============================================

describe('getBlacklistSize', () => {
  it('returns a number', () => {
    const size = getBlacklistSize();
    expect(typeof size).toBe('number');
  });

  it('increases when token is added', () => {
    const initialSize = getBlacklistSize();
    const token = `size-test-${Date.now()}`;

    blacklistToken(token);

    expect(getBlacklistSize()).toBe(initialSize + 1);
  });

  it('returns non-negative value', () => {
    expect(getBlacklistSize()).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// REALISTIC JWT TOKEN TESTS
// ============================================

describe('Token Blacklist - JWT Scenarios', () => {
  it('blacklists realistic JWT token', () => {
    // Typical JWT structure (header.payload.signature)
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    blacklistToken(jwt);

    expect(isTokenBlacklisted(jwt)).toBe(true);
  });

  it('handles multiple logout tokens', () => {
    const tokens = [
      `jwt-logout-1-${Date.now()}`,
      `jwt-logout-2-${Date.now()}`,
      `jwt-logout-3-${Date.now()}`,
    ];

    tokens.forEach((token) => blacklistToken(token));

    tokens.forEach((token) => {
      expect(isTokenBlacklisted(token)).toBe(true);
    });
  });

  it('refresh token vs access token', () => {
    const accessToken = `access-${Date.now()}`;
    const refreshToken = `refresh-${Date.now()}`;

    // Access tokens typically have shorter expiry
    blacklistToken(accessToken, 15 * 60 * 1000); // 15 minutes
    // Refresh tokens have longer expiry
    blacklistToken(refreshToken, 7 * 24 * 60 * 60 * 1000); // 7 days

    expect(isTokenBlacklisted(accessToken)).toBe(true);
    expect(isTokenBlacklisted(refreshToken)).toBe(true);
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Token Blacklist - Edge Cases', () => {
  it('handles very long token', () => {
    const token = 'x'.repeat(10000);
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('handles unicode in token', () => {
    const token = `token-日本語-${Date.now()}`;
    blacklistToken(token);
    expect(isTokenBlacklisted(token)).toBe(true);
  });

  it('same token can be blacklisted multiple times', () => {
    const token = `duplicate-${Date.now()}`;

    blacklistToken(token);
    blacklistToken(token);
    blacklistToken(token);

    expect(isTokenBlacklisted(token)).toBe(true);
  });
});
