# Incident Config Centralization Plan

## Overview
Consolidate all incident-related configs (status, severity, type) into the existing centralized `/lib/status-config.ts` to eliminate duplication and ensure consistency.

---

## Current State Analysis

### Centralized Config (Already Exists)
**File:** `frontend/src/lib/status-config.ts`

| Config | Status |
|--------|--------|
| `incidentStatusConfig` | ✅ EXISTS - OPEN, IN_PROGRESS, RESOLVED, CLOSED |
| `incidentSeverityConfig` | ✅ EXISTS - LOW, MEDIUM, HIGH, CRITICAL |
| `incidentTypeConfig` | ✅ EXISTS - INJURY, ILLNESS, etc. |
| `getStatusConfig()` | ✅ EXISTS - Helper function |

### Files with Duplicated Configs

| File | Duplicated Configs | Extra Fields Needed |
|------|-------------------|---------------------|
| `pages/supervisor/dashboard.page.tsx` | severityConfig, typeLabels, statusConfig | Badge `variant` mapping |
| `pages/supervisor/incidents-assignment.page.tsx` | severityConfig, incidentTypeLabels | `priority` for sorting |
| `pages/incidents/incident-detail.page.tsx` | statusConfig, severityConfig, typeConfig | `description` field, icons |
| `pages/team-leader/team-incidents.page.tsx` | statusConfig, severityConfig, incidentTypeLabels | `priority` for sorting |
| `pages/whs/my-incidents.page.tsx` | statusConfig, severityConfig | - |
| `pages/worker/my-incidents.page.tsx` | severityColors | - |
| `components/incidents/IncidentDetailModal.tsx` | typeLabels, statusColors, severityColors | - |

### Files Already Using Centralized Config (OK)
| File | Uses |
|------|------|
| `components/monitoring/SuddenChangeCard.tsx` | `getSeverityColor()` ✅ |
| `pages/team-leader/member-profile.page.tsx` | `getStatusConfig()` ✅ |
| `pages/team-leader/daily-monitoring/components/*` | `getStatusColor()` ✅ |

### Files with Different Domain Configs (NOT incident-related)
| File | Config Type | Notes |
|------|-------------|-------|
| `components/charts/ReadinessTrendChart.tsx` | GREEN/YELLOW/RED readiness | Different domain |
| `components/ui/Avatar.tsx` | online/offline status | Different domain |
| `pages/team-leader/ai-insights-detail.page.tsx` | healthy/mild/severe | AI insights domain |

---

## Target State

### 1. Add Missing Helper Functions to `status-config.ts`

```typescript
// Add after existing helper functions

/**
 * Get incident type label
 */
export function getIncidentTypeLabel(type: string): string {
  return incidentTypeConfig[type]?.label || type;
}

/**
 * Get incident type description
 */
export function getIncidentTypeDescription(type: string): string {
  return incidentTypeConfig[type]?.description || '';
}

/**
 * Get severity priority for sorting (higher = more urgent)
 */
export function getSeverityPriority(severity: string): number {
  const priorities: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return priorities[severity] || 0;
}

/**
 * Get severity badge variant for Badge component
 */
export function getSeverityBadgeVariant(severity: string): 'danger' | 'warning' | 'default' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'danger';
    case 'MEDIUM':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Get incident status badge variant for Badge component
 */
export function getIncidentStatusBadgeVariant(status: string): 'danger' | 'warning' | 'success' | 'default' {
  switch (status) {
    case 'OPEN':
      return 'danger';
    case 'IN_PROGRESS':
      return 'warning';
    case 'RESOLVED':
      return 'success';
    default:
      return 'default';
  }
}

/**
 * Check if severity is urgent (HIGH or CRITICAL)
 */
export function isUrgentSeverity(severity: string): boolean {
  return severity === 'CRITICAL' || severity === 'HIGH';
}
```

---

## Migration Steps

### Phase 1: Add Helper Functions (No Breaking Changes)

**File:** `frontend/src/lib/status-config.ts`

- [ ] Add `getIncidentTypeLabel()`
- [ ] Add `getIncidentTypeDescription()`
- [ ] Add `getSeverityPriority()`
- [ ] Add `getSeverityBadgeVariant()`
- [ ] Add `getIncidentStatusBadgeVariant()`
- [ ] Add `isUrgentSeverity()`

**Estimated time:** 10 minutes

---

### Phase 2: Update supervisor/dashboard.page.tsx

**Current local configs to remove:**
```typescript
// REMOVE these
const severityConfig: Record<string, { label: string; variant: 'danger' | 'warning' | 'default' }> = {...};
const typeLabels: Record<string, string> = {...};
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {...};
```

**Replace with imports:**
```typescript
import {
  incidentSeverityConfig,
  incidentStatusConfig,
  getIncidentTypeLabel,
  getSeverityBadgeVariant,
  isUrgentSeverity,
} from '../../lib/status-config';
```

**Code changes:**
```typescript
// BEFORE
const severity = severityConfig[incident.severity] || severityConfig.LOW;
<Badge variant={severity.variant}>{severity.label}</Badge>

// AFTER
const severityConfig = incidentSeverityConfig[incident.severity];
<Badge variant={getSeverityBadgeVariant(incident.severity)}>{severityConfig?.label || incident.severity}</Badge>
```

```typescript
// BEFORE
{typeLabels[incident.type] || incident.type}

// AFTER
{getIncidentTypeLabel(incident.type)}
```

```typescript
// BEFORE
const isUrgent = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';

// AFTER
const isUrgent = isUrgentSeverity(incident.severity);
```

**Estimated time:** 15 minutes

---

### Phase 3: Update supervisor/incidents-assignment.page.tsx

**Current local configs to remove:**
```typescript
const severityConfig: Record<string, { color: string; bg: string; dotColor: string; label: string; priority: number }> = {...};
const incidentTypeLabels: Record<string, string> = {...};
```

**Replace with imports:**
```typescript
import {
  incidentSeverityConfig,
  getIncidentTypeLabel,
  getSeverityPriority,
  isUrgentSeverity,
} from '../../lib/status-config';
```

**Code changes:**
```typescript
// BEFORE - sorting by priority
incidents.sort((a, b) => severityConfig[b.severity].priority - severityConfig[a.severity].priority);

// AFTER
incidents.sort((a, b) => getSeverityPriority(b.severity) - getSeverityPriority(a.severity));
```

**Estimated time:** 20 minutes

---

### Phase 4: Update incidents/incident-detail.page.tsx

**Current local configs to remove:**
```typescript
const statusConfig: Record<string, {...}> = {...};
const severityConfig: Record<string, {...}> = {...};
const typeConfig: Record<string, { label: string }> = {...};
```

**Note:** This file has `activityConfig` which is UNIQUE - keep it local or move to status-config.ts

**Replace with imports:**
```typescript
import {
  incidentStatusConfig,
  incidentSeverityConfig,
  incidentTypeConfig,
  getIncidentTypeLabel,
} from '../../lib/status-config';
```

**Estimated time:** 25 minutes

---

### Phase 5: Update team-leader/team-incidents.page.tsx

**Current local configs to remove:**
```typescript
const statusConfig: Record<string, {...}> = {...};
const severityConfig: Record<string, {...}> = {...};
const incidentTypeLabels: Record<string, string> = {...};
```

**Replace with imports:**
```typescript
import {
  incidentStatusConfig,
  incidentSeverityConfig,
  getIncidentTypeLabel,
  getSeverityPriority,
  isUrgentSeverity,
} from '../../lib/status-config';
```

**Estimated time:** 20 minutes

---

### Phase 6: Update whs/my-incidents.page.tsx

**Current local configs to remove:**
```typescript
const statusConfig: Record<string, {...}> = {...};
const severityConfig: Record<string, {...}> = {...};
```

**Replace with imports:**
```typescript
import {
  incidentStatusConfig,
  incidentSeverityConfig,
} from '../../lib/status-config';
```

**Estimated time:** 15 minutes

---

### Phase 7: Update components/incidents/IncidentDetailModal.tsx

**Current local configs to remove:**
```typescript
const typeLabels: Record<string, string> = {...};
const statusColors: Record<string, string> = {...};
const severityColors: Record<string, string> = {...};
```

**Replace with imports:**
```typescript
import {
  incidentStatusConfig,
  incidentSeverityConfig,
  getIncidentTypeLabel,
} from '../../lib/status-config';
```

**Estimated time:** 15 minutes

---

### Phase 8: Update worker/my-incidents.page.tsx

**Current local configs to remove:**
```typescript
const severityColors: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  LOW: { bg: 'bg-blue-100', text: 'text-blue-700' },
};
```

**Replace with imports:**
```typescript
import { incidentSeverityConfig } from '../../lib/status-config';
```

**Code changes:**
```typescript
// BEFORE
const colors = severityColors[incident.severity] || severityColors.LOW;
<span className={cn(colors.bg, colors.text)}>

// AFTER
const severity = incidentSeverityConfig[incident.severity] || incidentSeverityConfig.LOW;
<span className={cn(severity.bgColor, severity.textColor)}>
```

**Estimated time:** 10 minutes

---

## Testing Checklist

After each phase, verify:

### Supervisor Dashboard (`/supervisor/dashboard`)
- [ ] Stats cards show correct counts
- [ ] Pending incidents table displays correctly
- [ ] Severity badges show correct colors (Critical/High = red, Medium = yellow, Low = gray)
- [ ] Type labels display correctly
- [ ] Recently assigned table shows correct status colors
- [ ] Urgent indicator (pulsing dot) shows for HIGH/CRITICAL

### Supervisor Incidents Assignment (`/supervisor/incidents-assignment`)
- [ ] Pending tab shows incidents
- [ ] Assigned tab shows incidents
- [ ] Severity badges colored correctly
- [ ] Incidents sorted by severity (CRITICAL first)
- [ ] Type labels display correctly

### Incident Detail (`/incidents/:id`)
- [ ] Status badge shows correctly
- [ ] Severity badge shows correctly
- [ ] Type displays correctly
- [ ] Status dropdown works
- [ ] Activity timeline displays correctly

### Team Leader Incidents (`/team-leader/team-incidents`)
- [ ] All incidents display
- [ ] Status badges colored correctly
- [ ] Severity badges colored correctly
- [ ] Sorting by severity works

### WHS My Incidents (`/whs/my-incidents`)
- [ ] Assigned incidents display
- [ ] Status badges colored correctly
- [ ] Severity badges colored correctly

### Incident Detail Modal
- [ ] Type label displays correctly
- [ ] Status color displays correctly
- [ ] Severity color displays correctly

### Worker My Incidents (`/worker/my-incidents`)
- [ ] Incident cards display correctly
- [ ] Severity colors show correctly (Critical=red, High=orange, Medium=yellow, Low=blue)
- [ ] Type icons and labels display correctly

---

## Rollback Plan

If something breaks:

1. **Git revert** - Each phase should be a separate commit
2. **Keep old code commented** - During migration, comment out old code instead of deleting
3. **Test after each phase** - Don't move to next phase until current phase is tested

---

## Total Estimated Time

| Phase | File | Time |
|-------|------|------|
| Phase 1 | Add helpers to status-config.ts | 10 min |
| Phase 2 | supervisor/dashboard.page.tsx | 15 min |
| Phase 3 | supervisor/incidents-assignment.page.tsx | 20 min |
| Phase 4 | incidents/incident-detail.page.tsx | 25 min |
| Phase 5 | team-leader/team-incidents.page.tsx | 20 min |
| Phase 6 | whs/my-incidents.page.tsx | 15 min |
| Phase 7 | components/incidents/IncidentDetailModal.tsx | 15 min |
| Phase 8 | worker/my-incidents.page.tsx | 10 min |
| **Total** | **8 files** | **~2.5 hours** |

---

## Decision

**Priority:** LOW - Current code works, this is code hygiene

**When to do:**
- During refactoring sprint
- When there's a bug related to inconsistent labels/colors
- When onboarding new developer

**Skip if:**
- Busy with feature work
- No reported issues with current configs

---

## Notes

- `activityConfig` in incident-detail.page.tsx is UNIQUE - decide whether to centralize or keep local
- Color class consistency: centralized uses `bg-danger-50`, some pages use `bg-status-red-50` - verify Tailwind config has both
- Badge component accepts: 'danger' | 'warning' | 'success' | 'default' - map accordingly
