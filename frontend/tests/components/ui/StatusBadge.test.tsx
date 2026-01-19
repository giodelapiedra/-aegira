/**
 * StatusBadge Component Tests
 *
 * Tests for StatusBadge, ReadinessBadge, IncidentStatusBadge,
 * SeverityBadge, and ExceptionStatusBadge components.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StatusBadge,
  ReadinessBadge,
  IncidentStatusBadge,
  SeverityBadge,
  ExceptionStatusBadge,
} from '../../../src/components/ui/StatusBadge';

// ============================================
// STATUS BADGE TESTS
// ============================================

describe('StatusBadge - Rendering', () => {
  it('renders with status and type', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    expect(screen.getByText('Ready for Duty')).toBeInTheDocument();
  });

  it('renders as span element', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge.tagName).toBe('SPAN');
  });
});

describe('StatusBadge - Sizes', () => {
  it('renders small size', () => {
    render(<StatusBadge status="GREEN" type="readiness" size="sm" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  it('renders medium size (default)', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('px-2.5', 'py-1', 'text-xs');
  });

  it('renders large size', () => {
    render(<StatusBadge status="GREEN" type="readiness" size="lg" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });
});

describe('StatusBadge - Show Dot', () => {
  it('shows dot when showDot is true', () => {
    const { container } = render(
      <StatusBadge status="GREEN" type="readiness" showDot />
    );
    const dot = container.querySelector('.rounded-full.bg-success-500');
    expect(dot).toBeInTheDocument();
  });

  it('hides dot by default', () => {
    const { container } = render(
      <StatusBadge status="GREEN" type="readiness" />
    );
    // Should not have a small dot element (h-2 w-2 is dot size for md)
    const dots = container.querySelectorAll('.h-2.w-2');
    expect(dots.length).toBe(0);
  });
});

describe('StatusBadge - Show Icon', () => {
  it('shows icon when showIcon is true', () => {
    const { container } = render(
      <StatusBadge status="GREEN" type="readiness" showIcon />
    );
    // Icon should be present (h-3.5 w-3.5 is icon size for md)
    const icon = container.querySelector('.h-3\\.5');
    expect(icon).toBeInTheDocument();
  });

  it('hides icon by default', () => {
    const { container } = render(
      <StatusBadge status="GREEN" type="readiness" />
    );
    // Should not have icon element
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(0);
  });
});

describe('StatusBadge - Custom Class', () => {
  it('applies custom className', () => {
    render(
      <StatusBadge status="GREEN" type="readiness" className="custom-status" />
    );
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('custom-status');
  });
});

describe('StatusBadge - Unknown Status', () => {
  it('renders unknown status with default styling', () => {
    render(<StatusBadge status="UNKNOWN" type="readiness" />);
    const badge = screen.getByText('UNKNOWN');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
  });
});

// ============================================
// READINESS BADGE TESTS
// ============================================

describe('ReadinessBadge - Status Values', () => {
  it('renders GREEN status', () => {
    render(<ReadinessBadge status="GREEN" />);
    expect(screen.getByText('Ready for Duty')).toBeInTheDocument();
  });

  it('renders YELLOW status', () => {
    render(<ReadinessBadge status="YELLOW" />);
    expect(screen.getByText('Caution')).toBeInTheDocument();
  });

  it('renders RED status', () => {
    render(<ReadinessBadge status="RED" />);
    expect(screen.getByText('Not Ready')).toBeInTheDocument();
  });
});

describe('ReadinessBadge - Styling', () => {
  it('applies success styling for GREEN', () => {
    render(<ReadinessBadge status="GREEN" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('bg-success-50', 'text-success-700');
  });

  it('applies warning styling for YELLOW', () => {
    render(<ReadinessBadge status="YELLOW" />);
    const badge = screen.getByText('Caution');
    expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
  });

  it('applies danger styling for RED', () => {
    render(<ReadinessBadge status="RED" />);
    const badge = screen.getByText('Not Ready');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-700');
  });
});

describe('ReadinessBadge - Default Props', () => {
  it('shows icon by default', () => {
    const { container } = render(<ReadinessBadge status="GREEN" />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('uses md size by default', () => {
    render(<ReadinessBadge status="GREEN" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('px-2.5', 'py-1');
  });
});

// ============================================
// INCIDENT STATUS BADGE TESTS
// ============================================

describe('IncidentStatusBadge - Status Values', () => {
  it('renders OPEN status', () => {
    render(<IncidentStatusBadge status="OPEN" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders IN_PROGRESS status', () => {
    render(<IncidentStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders RESOLVED status', () => {
    render(<IncidentStatusBadge status="RESOLVED" />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders CLOSED status', () => {
    render(<IncidentStatusBadge status="CLOSED" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});

describe('IncidentStatusBadge - Styling', () => {
  it('applies danger styling for OPEN', () => {
    render(<IncidentStatusBadge status="OPEN" />);
    const badge = screen.getByText('Open');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-700');
  });

  it('applies warning styling for IN_PROGRESS', () => {
    render(<IncidentStatusBadge status="IN_PROGRESS" />);
    const badge = screen.getByText('In Progress');
    expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
  });

  it('applies success styling for RESOLVED', () => {
    render(<IncidentStatusBadge status="RESOLVED" />);
    const badge = screen.getByText('Resolved');
    expect(badge).toHaveClass('bg-success-50', 'text-success-700');
  });

  it('applies secondary styling for CLOSED', () => {
    render(<IncidentStatusBadge status="CLOSED" />);
    const badge = screen.getByText('Closed');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
  });
});

describe('IncidentStatusBadge - Default Props', () => {
  it('shows dot by default', () => {
    const { container } = render(<IncidentStatusBadge status="OPEN" />);
    // Check for dot element
    const dot = container.querySelector('.rounded-full.h-2.w-2');
    expect(dot).toBeInTheDocument();
  });
});

// ============================================
// SEVERITY BADGE TESTS
// ============================================

describe('SeverityBadge - Severity Values', () => {
  it('renders LOW severity', () => {
    render(<SeverityBadge severity="LOW" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders MEDIUM severity', () => {
    render(<SeverityBadge severity="MEDIUM" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders HIGH severity', () => {
    render(<SeverityBadge severity="HIGH" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders CRITICAL severity', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});

describe('SeverityBadge - Styling', () => {
  it('applies info styling for LOW', () => {
    render(<SeverityBadge severity="LOW" />);
    const badge = screen.getByText('Low');
    expect(badge).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('applies warning styling for MEDIUM', () => {
    render(<SeverityBadge severity="MEDIUM" />);
    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
  });

  it('applies danger styling for CRITICAL', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    const badge = screen.getByText('Critical');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-700');
  });
});

// ============================================
// EXCEPTION STATUS BADGE TESTS
// ============================================

describe('ExceptionStatusBadge - Status Values', () => {
  it('renders PENDING status', () => {
    render(<ExceptionStatusBadge status="PENDING" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders APPROVED status', () => {
    render(<ExceptionStatusBadge status="APPROVED" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders REJECTED status', () => {
    render(<ExceptionStatusBadge status="REJECTED" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});

describe('ExceptionStatusBadge - Styling', () => {
  it('applies warning styling for PENDING', () => {
    render(<ExceptionStatusBadge status="PENDING" />);
    const badge = screen.getByText('Pending Review');
    expect(badge).toHaveClass('bg-warning-50', 'text-warning-700');
  });

  it('applies success styling for APPROVED', () => {
    render(<ExceptionStatusBadge status="APPROVED" />);
    const badge = screen.getByText('Approved');
    expect(badge).toHaveClass('bg-success-50', 'text-success-700');
  });

  it('applies danger styling for REJECTED', () => {
    render(<ExceptionStatusBadge status="REJECTED" />);
    const badge = screen.getByText('Rejected');
    expect(badge).toHaveClass('bg-danger-50', 'text-danger-700');
  });
});

describe('ExceptionStatusBadge - Default Props', () => {
  it('shows icon by default', () => {
    const { container } = render(<ExceptionStatusBadge status="PENDING" />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});

// ============================================
// STRUCTURE VALIDATION TESTS
// ============================================

describe('StatusBadge Components - Structure', () => {
  it('all badges have rounded-full', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('rounded-full');
  });

  it('all badges have inline-flex', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('inline-flex', 'items-center');
  });

  it('all badges have gap for icon/dot spacing', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('gap-1.5');
  });

  it('all badges have font-medium', () => {
    render(<StatusBadge status="GREEN" type="readiness" />);
    const badge = screen.getByText('Ready for Duty');
    expect(badge).toHaveClass('font-medium');
  });
});
