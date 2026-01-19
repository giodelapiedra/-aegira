/**
 * Status Config Tests
 *
 * Tests for status configuration helpers used across the app.
 */

import { describe, it, expect } from 'vitest';
import {
  getStatusConfig,
  getScoreColor,
  getScoreBgColor,
  getReadinessStatusFromScore,
  getVariantClasses,
  getComplianceTextColor,
  getComplianceColorClasses,
  getComplianceGradientClasses,
  readinessStatusConfig,
  exceptionStatusConfig,
  incidentStatusConfig,
  incidentSeverityConfig,
  exceptionTypeConfig,
  incidentTypeConfig,
} from '../../src/lib/status-config';

// ============================================
// GET STATUS CONFIG TESTS
// ============================================

describe('getStatusConfig - Readiness', () => {
  it('returns GREEN config', () => {
    const config = getStatusConfig('readiness', 'GREEN');
    expect(config.label).toBe('Ready for Duty');
    expect(config.variant).toBe('success');
  });

  it('returns YELLOW config', () => {
    const config = getStatusConfig('readiness', 'YELLOW');
    expect(config.label).toBe('Caution');
    expect(config.variant).toBe('warning');
  });

  it('returns RED config', () => {
    const config = getStatusConfig('readiness', 'RED');
    expect(config.label).toBe('Not Ready');
    expect(config.variant).toBe('danger');
  });

  it('returns default config for unknown status', () => {
    const config = getStatusConfig('readiness', 'UNKNOWN');
    expect(config.label).toBe('UNKNOWN');
    expect(config.variant).toBe('secondary');
  });
});

describe('getStatusConfig - Exception', () => {
  it('returns PENDING config', () => {
    const config = getStatusConfig('exception', 'PENDING');
    expect(config.label).toBe('Pending Review');
    expect(config.variant).toBe('warning');
  });

  it('returns APPROVED config', () => {
    const config = getStatusConfig('exception', 'APPROVED');
    expect(config.label).toBe('Approved');
    expect(config.variant).toBe('success');
  });

  it('returns REJECTED config', () => {
    const config = getStatusConfig('exception', 'REJECTED');
    expect(config.label).toBe('Rejected');
    expect(config.variant).toBe('danger');
  });
});

describe('getStatusConfig - Incident', () => {
  it('returns OPEN config', () => {
    const config = getStatusConfig('incident', 'OPEN');
    expect(config.label).toBe('Open');
    expect(config.variant).toBe('danger');
  });

  it('returns IN_PROGRESS config', () => {
    const config = getStatusConfig('incident', 'IN_PROGRESS');
    expect(config.label).toBe('In Progress');
    expect(config.variant).toBe('warning');
  });

  it('returns RESOLVED config', () => {
    const config = getStatusConfig('incident', 'RESOLVED');
    expect(config.label).toBe('Resolved');
    expect(config.variant).toBe('success');
  });

  it('returns CLOSED config', () => {
    const config = getStatusConfig('incident', 'CLOSED');
    expect(config.label).toBe('Closed');
    expect(config.variant).toBe('secondary');
  });
});

describe('getStatusConfig - Severity', () => {
  it('returns LOW config', () => {
    const config = getStatusConfig('severity', 'LOW');
    expect(config.label).toBe('Low');
    expect(config.variant).toBe('info');
  });

  it('returns MEDIUM config', () => {
    const config = getStatusConfig('severity', 'MEDIUM');
    expect(config.label).toBe('Medium');
    expect(config.variant).toBe('warning');
  });

  it('returns HIGH config', () => {
    const config = getStatusConfig('severity', 'HIGH');
    expect(config.label).toBe('High');
    expect(config.variant).toBe('danger');
  });

  it('returns CRITICAL config', () => {
    const config = getStatusConfig('severity', 'CRITICAL');
    expect(config.label).toBe('Critical');
    expect(config.variant).toBe('danger');
  });
});

// ============================================
// GET SCORE COLOR TESTS
// ============================================

describe('getScoreColor - Normal (Higher is Better)', () => {
  it('returns success for score >= 7', () => {
    expect(getScoreColor(7)).toBe('text-success-600');
    expect(getScoreColor(8)).toBe('text-success-600');
    expect(getScoreColor(10)).toBe('text-success-600');
  });

  it('returns warning for score 4-6', () => {
    expect(getScoreColor(4)).toBe('text-warning-600');
    expect(getScoreColor(5)).toBe('text-warning-600');
    expect(getScoreColor(6)).toBe('text-warning-600');
  });

  it('returns danger for score < 4', () => {
    expect(getScoreColor(1)).toBe('text-danger-600');
    expect(getScoreColor(2)).toBe('text-danger-600');
    expect(getScoreColor(3)).toBe('text-danger-600');
  });
});

describe('getScoreColor - Inverted (Lower is Better)', () => {
  it('returns success for score <= 3', () => {
    expect(getScoreColor(1, true)).toBe('text-success-600');
    expect(getScoreColor(2, true)).toBe('text-success-600');
    expect(getScoreColor(3, true)).toBe('text-success-600');
  });

  it('returns warning for score 4-6', () => {
    expect(getScoreColor(4, true)).toBe('text-warning-600');
    expect(getScoreColor(5, true)).toBe('text-warning-600');
    expect(getScoreColor(6, true)).toBe('text-warning-600');
  });

  it('returns danger for score > 6', () => {
    expect(getScoreColor(7, true)).toBe('text-danger-600');
    expect(getScoreColor(8, true)).toBe('text-danger-600');
    expect(getScoreColor(10, true)).toBe('text-danger-600');
  });
});

// ============================================
// GET SCORE BG COLOR TESTS
// ============================================

describe('getScoreBgColor - Normal', () => {
  it('returns success bg for score >= 7', () => {
    expect(getScoreBgColor(7)).toBe('bg-success-50');
    expect(getScoreBgColor(10)).toBe('bg-success-50');
  });

  it('returns warning bg for score 4-6', () => {
    expect(getScoreBgColor(4)).toBe('bg-warning-50');
    expect(getScoreBgColor(6)).toBe('bg-warning-50');
  });

  it('returns danger bg for score < 4', () => {
    expect(getScoreBgColor(1)).toBe('bg-danger-50');
    expect(getScoreBgColor(3)).toBe('bg-danger-50');
  });
});

describe('getScoreBgColor - Inverted', () => {
  it('returns success bg for score <= 3', () => {
    expect(getScoreBgColor(1, true)).toBe('bg-success-50');
    expect(getScoreBgColor(3, true)).toBe('bg-success-50');
  });

  it('returns warning bg for score 4-6', () => {
    expect(getScoreBgColor(4, true)).toBe('bg-warning-50');
    expect(getScoreBgColor(6, true)).toBe('bg-warning-50');
  });

  it('returns danger bg for score > 6', () => {
    expect(getScoreBgColor(7, true)).toBe('bg-danger-50');
    expect(getScoreBgColor(10, true)).toBe('bg-danger-50');
  });
});

// ============================================
// GET READINESS STATUS FROM SCORE TESTS
// ============================================

describe('getReadinessStatusFromScore', () => {
  it('returns GREEN for score >= 70', () => {
    expect(getReadinessStatusFromScore(70)).toBe('GREEN');
    expect(getReadinessStatusFromScore(85)).toBe('GREEN');
    expect(getReadinessStatusFromScore(100)).toBe('GREEN');
  });

  it('returns YELLOW for score 40-69', () => {
    expect(getReadinessStatusFromScore(40)).toBe('YELLOW');
    expect(getReadinessStatusFromScore(50)).toBe('YELLOW');
    expect(getReadinessStatusFromScore(69)).toBe('YELLOW');
  });

  it('returns RED for score < 40', () => {
    expect(getReadinessStatusFromScore(0)).toBe('RED');
    expect(getReadinessStatusFromScore(20)).toBe('RED');
    expect(getReadinessStatusFromScore(39)).toBe('RED');
  });
});

// ============================================
// GET VARIANT CLASSES TESTS
// ============================================

describe('getVariantClasses', () => {
  it('returns success variant classes', () => {
    const classes = getVariantClasses('success');
    expect(classes.bg).toBe('bg-success-50');
    expect(classes.text).toBe('text-success-700');
    expect(classes.border).toBe('border-success-200');
    expect(classes.hover).toBe('hover:bg-success-100');
  });

  it('returns warning variant classes', () => {
    const classes = getVariantClasses('warning');
    expect(classes.bg).toBe('bg-warning-50');
    expect(classes.text).toBe('text-warning-700');
  });

  it('returns danger variant classes', () => {
    const classes = getVariantClasses('danger');
    expect(classes.bg).toBe('bg-danger-50');
    expect(classes.text).toBe('text-danger-700');
  });

  it('returns primary variant classes', () => {
    const classes = getVariantClasses('primary');
    expect(classes.bg).toBe('bg-primary-50');
    expect(classes.text).toBe('text-primary-700');
  });

  it('returns secondary variant classes', () => {
    const classes = getVariantClasses('secondary');
    expect(classes.bg).toBe('bg-gray-50');
    expect(classes.text).toBe('text-gray-700');
  });

  it('returns info variant classes', () => {
    const classes = getVariantClasses('info');
    expect(classes.bg).toBe('bg-blue-50');
    expect(classes.text).toBe('text-blue-700');
  });
});

// ============================================
// GET COMPLIANCE TEXT COLOR TESTS
// ============================================

describe('getComplianceTextColor', () => {
  it('returns gray for null', () => {
    expect(getComplianceTextColor(null)).toBe('text-gray-500');
  });

  it('returns green for perfect compliance (>= 100)', () => {
    expect(getComplianceTextColor(100)).toBe('text-green-600');
    expect(getComplianceTextColor(105)).toBe('text-green-600');
  });

  it('returns blue for good compliance (>= 80)', () => {
    expect(getComplianceTextColor(80)).toBe('text-blue-600');
    expect(getComplianceTextColor(95)).toBe('text-blue-600');
  });

  it('returns yellow for warning compliance (>= 60)', () => {
    expect(getComplianceTextColor(60)).toBe('text-yellow-600');
    expect(getComplianceTextColor(75)).toBe('text-yellow-600');
  });

  it('returns red for poor compliance (< 60)', () => {
    expect(getComplianceTextColor(0)).toBe('text-red-600');
    expect(getComplianceTextColor(50)).toBe('text-red-600');
    expect(getComplianceTextColor(59)).toBe('text-red-600');
  });
});

// ============================================
// GET COMPLIANCE COLOR CLASSES TESTS
// ============================================

describe('getComplianceColorClasses', () => {
  it('returns gray classes for null', () => {
    const classes = getComplianceColorClasses(null);
    expect(classes.bg).toBe('bg-gray-50');
    expect(classes.text).toBe('text-gray-500');
  });

  it('returns green classes for perfect compliance', () => {
    const classes = getComplianceColorClasses(100);
    expect(classes.bg).toBe('bg-green-50');
    expect(classes.text).toBe('text-green-700');
    expect(classes.icon).toBe('text-green-600');
  });

  it('returns blue classes for good compliance', () => {
    const classes = getComplianceColorClasses(85);
    expect(classes.bg).toBe('bg-blue-50');
    expect(classes.text).toBe('text-blue-700');
  });

  it('returns yellow classes for warning compliance', () => {
    const classes = getComplianceColorClasses(65);
    expect(classes.bg).toBe('bg-yellow-50');
    expect(classes.text).toBe('text-yellow-700');
  });

  it('returns red classes for poor compliance', () => {
    const classes = getComplianceColorClasses(50);
    expect(classes.bg).toBe('bg-red-50');
    expect(classes.text).toBe('text-red-700');
  });
});

// ============================================
// GET COMPLIANCE GRADIENT CLASSES TESTS
// ============================================

describe('getComplianceGradientClasses', () => {
  it('returns gray gradient for null', () => {
    const classes = getComplianceGradientClasses(null);
    expect(classes.bg).toContain('gray');
    expect(classes.border).toBe('border-gray-200');
  });

  it('returns green gradient for perfect compliance', () => {
    const classes = getComplianceGradientClasses(100);
    expect(classes.bg).toContain('green');
    expect(classes.border).toBe('border-green-200');
  });

  it('returns blue gradient for good compliance', () => {
    const classes = getComplianceGradientClasses(85);
    expect(classes.bg).toContain('blue');
    expect(classes.border).toBe('border-blue-200');
  });

  it('returns yellow gradient for warning compliance', () => {
    const classes = getComplianceGradientClasses(65);
    expect(classes.bg).toContain('yellow');
    expect(classes.border).toBe('border-yellow-200');
  });

  it('returns red gradient for poor compliance', () => {
    const classes = getComplianceGradientClasses(50);
    expect(classes.bg).toContain('red');
    expect(classes.border).toBe('border-red-200');
  });
});

// ============================================
// CONFIG OBJECT TESTS
// ============================================

describe('readinessStatusConfig', () => {
  it('has GREEN status', () => {
    expect(readinessStatusConfig.GREEN).toBeDefined();
    expect(readinessStatusConfig.GREEN.variant).toBe('success');
  });

  it('has YELLOW status', () => {
    expect(readinessStatusConfig.YELLOW).toBeDefined();
    expect(readinessStatusConfig.YELLOW.variant).toBe('warning');
  });

  it('has RED status', () => {
    expect(readinessStatusConfig.RED).toBeDefined();
    expect(readinessStatusConfig.RED.variant).toBe('danger');
  });
});

describe('exceptionStatusConfig', () => {
  it('has PENDING status', () => {
    expect(exceptionStatusConfig.PENDING).toBeDefined();
  });

  it('has APPROVED status', () => {
    expect(exceptionStatusConfig.APPROVED).toBeDefined();
  });

  it('has REJECTED status', () => {
    expect(exceptionStatusConfig.REJECTED).toBeDefined();
  });
});

describe('incidentStatusConfig', () => {
  it('has all incident statuses', () => {
    expect(incidentStatusConfig.OPEN).toBeDefined();
    expect(incidentStatusConfig.IN_PROGRESS).toBeDefined();
    expect(incidentStatusConfig.RESOLVED).toBeDefined();
    expect(incidentStatusConfig.CLOSED).toBeDefined();
  });
});

describe('incidentSeverityConfig', () => {
  it('has all severity levels', () => {
    expect(incidentSeverityConfig.LOW).toBeDefined();
    expect(incidentSeverityConfig.MEDIUM).toBeDefined();
    expect(incidentSeverityConfig.HIGH).toBeDefined();
    expect(incidentSeverityConfig.CRITICAL).toBeDefined();
  });
});

describe('exceptionTypeConfig', () => {
  it('has all exception types', () => {
    expect(exceptionTypeConfig.SICK_LEAVE).toBeDefined();
    expect(exceptionTypeConfig.PERSONAL_LEAVE).toBeDefined();
    expect(exceptionTypeConfig.MEDICAL_APPOINTMENT).toBeDefined();
    expect(exceptionTypeConfig.FAMILY_EMERGENCY).toBeDefined();
    expect(exceptionTypeConfig.OTHER).toBeDefined();
  });

  it('has label and description for each type', () => {
    Object.values(exceptionTypeConfig).forEach((config) => {
      expect(config.label).toBeDefined();
      expect(config.description).toBeDefined();
    });
  });
});

describe('incidentTypeConfig', () => {
  it('has all incident types', () => {
    expect(incidentTypeConfig.INJURY).toBeDefined();
    expect(incidentTypeConfig.ILLNESS).toBeDefined();
    expect(incidentTypeConfig.MENTAL_HEALTH).toBeDefined();
    expect(incidentTypeConfig.MEDICAL_EMERGENCY).toBeDefined();
    expect(incidentTypeConfig.HEALTH_SAFETY).toBeDefined();
    expect(incidentTypeConfig.OTHER).toBeDefined();
  });
});
