/**
 * Utils Tests
 *
 * Tests for core utility functions.
 */

import { describe, it, expect } from 'vitest';
import { cn, getInitials } from '../../src/lib/utils';

// ============================================
// CN (CLASS NAMES) TESTS
// ============================================

describe('cn - Class Name Merging', () => {
  it('merges string class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles undefined values', () => {
    const result = cn('foo', undefined, 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles null values', () => {
    const result = cn('foo', null, 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles false values', () => {
    const result = cn('foo', false, 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base active');
  });

  it('handles conditional classes when false', () => {
    const isActive = false;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base');
  });

  it('handles arrays', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('handles objects', () => {
    const result = cn({ foo: true, bar: false, baz: true });
    expect(result).toBe('foo baz');
  });

  it('handles mixed inputs', () => {
    const result = cn('foo', ['bar', 'baz'], { qux: true });
    expect(result).toBe('foo bar baz qux');
  });

  it('returns empty string for no arguments', () => {
    const result = cn();
    expect(result).toBe('');
  });
});

// ============================================
// GET INITIALS TESTS
// ============================================

describe('getInitials', () => {
  it('returns initials from first and last name', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
  });

  it('returns uppercase initials', () => {
    expect(getInitials('john', 'doe')).toBe('JD');
  });

  it('handles mixed case names', () => {
    expect(getInitials('jOhn', 'dOE')).toBe('JD');
  });

  it('handles single character names', () => {
    expect(getInitials('A', 'B')).toBe('AB');
  });

  it('handles long names', () => {
    expect(getInitials('Christopher', 'Wellington')).toBe('CW');
  });

  it('handles names with special characters', () => {
    expect(getInitials('María', 'García')).toBe('MG');
  });

  it('handles empty strings gracefully', () => {
    // Returns empty initials for empty strings
    expect(getInitials('', '')).toBe('');
  });

  it('handles first name with only first character', () => {
    expect(getInitials('A', 'Smith')).toBe('AS');
  });
});

// ============================================
// COMBINED USAGE TESTS
// ============================================

describe('Utils - Combined Usage', () => {
  it('cn can be used for component styling', () => {
    const variant = 'primary';
    const size = 'lg';
    const disabled = false;

    const result = cn(
      'base-class',
      variant === 'primary' && 'bg-blue-500',
      variant === 'secondary' && 'bg-gray-500',
      size === 'lg' && 'text-lg',
      disabled && 'opacity-50'
    );

    expect(result).toBe('base-class bg-blue-500 text-lg');
  });

  it('getInitials can be used for avatar display', () => {
    const user = { firstName: 'Jane', lastName: 'Smith' };
    const initials = getInitials(user.firstName, user.lastName);
    expect(initials).toBe('JS');
  });
});
