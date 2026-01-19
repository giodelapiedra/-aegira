/**
 * Button Component Tests
 *
 * Tests for the Button component including variants, sizes, states, and icons.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../../src/components/ui/Button';
import { Search, ArrowRight } from 'lucide-react';

// ============================================
// RENDERING TESTS
// ============================================

describe('Button - Rendering', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('renders button with default variant (primary)', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary-500');
  });

  it('renders button with default size (md)', () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'py-2');
  });
});

// ============================================
// VARIANT TESTS
// ============================================

describe('Button - Variants', () => {
  it('renders primary variant', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary-500', 'text-white');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-200', 'text-gray-700');
  });

  it('renders danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-danger-500', 'text-white');
  });

  it('renders success variant', () => {
    render(<Button variant="success">Success</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-success-500', 'text-white');
  });

  it('renders warning variant', () => {
    render(<Button variant="warning">Warning</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-warning-500', 'text-white');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent', 'text-gray-700');
  });
});

// ============================================
// SIZE TESTS
// ============================================

describe('Button - Sizes', () => {
  it('renders small size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('renders medium size', () => {
    render(<Button size="md">Medium</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
  });

  it('renders large size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-5', 'py-2.5', 'text-base');
  });
});

// ============================================
// LOADING STATE TESTS
// ============================================

describe('Button - Loading State', () => {
  it('disables button when loading', () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole('button');
    // Loader2 has animate-spin class
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('hides leftIcon when loading', () => {
    render(
      <Button isLoading leftIcon={<Search data-testid="left-icon" />}>
        Search
      </Button>
    );
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
  });

  it('hides rightIcon when loading', () => {
    render(
      <Button isLoading rightIcon={<ArrowRight data-testid="right-icon" />}>
        Next
      </Button>
    );
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
  });
});

// ============================================
// DISABLED STATE TESTS
// ============================================

describe('Button - Disabled State', () => {
  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies disabled styles', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click
      </Button>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

// ============================================
// ICON TESTS
// ============================================

describe('Button - Icons', () => {
  it('renders leftIcon', () => {
    render(
      <Button leftIcon={<Search data-testid="left-icon" />}>Search</Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders rightIcon', () => {
    render(
      <Button rightIcon={<ArrowRight data-testid="right-icon" />}>Next</Button>
    );
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('renders both leftIcon and rightIcon', () => {
    render(
      <Button
        leftIcon={<Search data-testid="left-icon" />}
        rightIcon={<ArrowRight data-testid="right-icon" />}
      >
        Action
      </Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });
});

// ============================================
// EVENT HANDLING TESTS
// ============================================

describe('Button - Event Handling', () => {
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('passes event to onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
  });
});

// ============================================
// CUSTOM CLASS TESTS
// ============================================

describe('Button - Custom Classes', () => {
  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('merges custom className with default classes', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class', 'bg-primary-500');
  });
});

// ============================================
// HTML ATTRIBUTE TESTS
// ============================================

describe('Button - HTML Attributes', () => {
  it('supports type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('supports data attributes', () => {
    render(<Button data-testid="test-button">Test</Button>);
    expect(screen.getByTestId('test-button')).toBeInTheDocument();
  });

  it('supports aria attributes', () => {
    render(<Button aria-label="Close dialog">X</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
  });
});

// ============================================
// REF FORWARDING TESTS
// ============================================

describe('Button - Ref Forwarding', () => {
  it('forwards ref to button element', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });
});

// ============================================
// ACCESSIBILITY TESTS
// ============================================

describe('Button - Accessibility', () => {
  it('has correct role', () => {
    render(<Button>Accessible</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is focusable when enabled', () => {
    render(<Button>Focus me</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('has focus ring classes', () => {
    render(<Button>Focus</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:ring-2', 'focus:ring-primary-500');
  });
});

// ============================================
// SNAPSHOT TESTS (STRUCTURE VALIDATION)
// ============================================

describe('Button - Structure Validation', () => {
  it('has inline-flex display', () => {
    render(<Button>Flex</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
  });

  it('has gap for icon spacing', () => {
    render(<Button>Gap</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('gap-2');
  });

  it('has transition classes', () => {
    render(<Button>Transition</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('transition-all');
  });

  it('has rounded corners', () => {
    render(<Button>Rounded</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('rounded');
  });
});
