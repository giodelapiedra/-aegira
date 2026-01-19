/**
 * Badge Component Tests
 *
 * Tests for the Badge component including variants and sizes.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../src/components/ui/Badge';

// ============================================
// RENDERING TESTS
// ============================================

describe('Badge - Rendering', () => {
  it('renders badge with children', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<Badge>Span</Badge>);
    const badge = screen.getByText('Span');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders with default variant (default)', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
  });

  it('renders with default size (md)', () => {
    render(<Badge>Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('px-2.5', 'py-0.5');
  });
});

// ============================================
// VARIANT TESTS
// ============================================

describe('Badge - Variants', () => {
  it('renders default variant', () => {
    render(<Badge variant="default">Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
  });

  it('renders success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-success-50', 'text-success-600');
  });

  it('renders warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-warning-50', 'text-warning-600');
  });

  it('renders danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText('Danger');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-600');
  });

  it('renders primary variant', () => {
    render(<Badge variant="primary">Primary</Badge>);
    const badge = screen.getByText('Primary');
    expect(badge).toHaveClass('bg-primary-50', 'text-primary-600');
  });

  it('renders secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText('Secondary');
    expect(badge).toHaveClass('bg-gray-200', 'text-gray-600');
  });

  it('renders info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-blue-50', 'text-blue-600');
  });
});

// ============================================
// SIZE TESTS
// ============================================

describe('Badge - Sizes', () => {
  it('renders small size', () => {
    render(<Badge size="sm">Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  it('renders medium size', () => {
    render(<Badge size="md">Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-xs');
  });
});

// ============================================
// CUSTOM CLASS TESTS
// ============================================

describe('Badge - Custom Classes', () => {
  it('applies custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-badge');
  });

  it('merges custom className with default classes', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-badge', 'inline-flex');
  });
});

// ============================================
// STRUCTURE TESTS
// ============================================

describe('Badge - Structure', () => {
  it('has inline-flex display', () => {
    render(<Badge>Flex</Badge>);
    const badge = screen.getByText('Flex');
    expect(badge).toHaveClass('inline-flex', 'items-center');
  });

  it('has font-medium', () => {
    render(<Badge>Medium Font</Badge>);
    const badge = screen.getByText('Medium Font');
    expect(badge).toHaveClass('font-medium');
  });

  it('has rounded-full', () => {
    render(<Badge>Rounded</Badge>);
    const badge = screen.getByText('Rounded');
    expect(badge).toHaveClass('rounded-full');
  });
});

// ============================================
// COMBINED PROPS TESTS
// ============================================

describe('Badge - Combined Props', () => {
  it('combines variant and size', () => {
    render(
      <Badge variant="success" size="sm">
        Combined
      </Badge>
    );
    const badge = screen.getByText('Combined');
    expect(badge).toHaveClass('bg-success-50', 'text-success-600');
    expect(badge).toHaveClass('px-2', 'py-0.5');
  });

  it('combines all props', () => {
    render(
      <Badge variant="danger" size="md" className="extra-class">
        All Props
      </Badge>
    );
    const badge = screen.getByText('All Props');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-600');
    expect(badge).toHaveClass('px-2.5', 'py-0.5');
    expect(badge).toHaveClass('extra-class');
  });
});

// ============================================
// CHILDREN CONTENT TESTS
// ============================================

describe('Badge - Children Content', () => {
  it('renders text children', () => {
    render(<Badge>Plain Text</Badge>);
    expect(screen.getByText('Plain Text')).toBeInTheDocument();
  });

  it('renders number children', () => {
    render(<Badge>{42}</Badge>);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders element children', () => {
    render(
      <Badge>
        <span data-testid="child">Child</span>
      </Badge>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <Badge>
        <span>Icon</span> Text
      </Badge>
    );
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });
});
