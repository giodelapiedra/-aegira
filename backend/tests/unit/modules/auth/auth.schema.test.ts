/**
 * Unit Tests for auth.schema.ts
 *
 * Tests authentication Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../../../src/modules/auth/auth.schema.js';

// ============================================
// registerSchema TESTS
// ============================================

describe('registerSchema', () => {
  describe('Valid registrations', () => {
    it('accepts valid registration data', () => {
      const data = {
        email: 'admin@company.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts various valid timezones', () => {
      const validTimezones = [
        'Asia/Manila',
        'America/New_York',
        'Europe/London',
        'Australia/Sydney',
        'Pacific/Auckland',
        'UTC',
      ];

      validTimezones.forEach(timezone => {
        const data = {
          email: 'test@example.com',
          password: 'SecurePass123',
          firstName: 'Test',
          lastName: 'User',
          companyName: 'Test Co',
          timezone,
        };
        const result = registerSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Email validation', () => {
    it('rejects invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const data = {
        email: '',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Password validation', () => {
    it('rejects password without uppercase', () => {
      const data = {
        email: 'test@example.com',
        password: 'securepass123', // No uppercase
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects password without lowercase', () => {
      const data = {
        email: 'test@example.com',
        password: 'SECUREPASS123', // No lowercase
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects password without number', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePassword', // No number
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const data = {
        email: 'test@example.com',
        password: 'Pass1', // Too short
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Name validation', () => {
    it('rejects empty firstName', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: '',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty lastName', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: '',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts single character names', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'J',
        lastName: 'D',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Company name validation', () => {
    it('rejects empty companyName', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: '',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts single character company name', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'X',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Timezone validation', () => {
    it('rejects empty timezone', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: '',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects invalid timezone', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Invalid/Timezone',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects made-up timezone', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Mars/Olympus',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Missing fields', () => {
    it('rejects missing email', () => {
      const data = {
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const data = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
        timezone: 'Asia/Manila',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects missing timezone', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// loginSchema TESTS
// ============================================

describe('loginSchema', () => {
  describe('Valid logins', () => {
    it('accepts valid login data', () => {
      const data = {
        email: 'user@company.com',
        password: 'anypassword',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('accepts any password (no strength requirements for login)', () => {
      const data = {
        email: 'user@company.com',
        password: 'a', // Single character - valid for login
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Email validation', () => {
    it('rejects invalid email', () => {
      const data = {
        email: 'not-an-email',
        password: 'password123',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const data = {
        email: '',
        password: 'password123',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts various email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test.io',
      ];

      validEmails.forEach(email => {
        const data = { email, password: 'test' };
        const result = loginSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Password validation', () => {
    it('rejects empty password', () => {
      const data = {
        email: 'user@example.com',
        password: '',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('accepts long passwords', () => {
      const data = {
        email: 'user@example.com',
        password: 'a'.repeat(1000),
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Missing fields', () => {
    it('rejects missing email', () => {
      const data = {
        password: 'password123',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const data = {
        email: 'user@example.com',
      };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
