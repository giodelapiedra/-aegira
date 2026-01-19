/**
 * Global test setup for Vitest
 *
 * This file runs once before all tests.
 */

export default async function setup() {
  // Set timezone for consistent testing
  process.env.TZ = 'UTC';

  // Set test environment
  process.env.NODE_ENV = 'test';

  console.log('🧪 Test environment initialized');
}
