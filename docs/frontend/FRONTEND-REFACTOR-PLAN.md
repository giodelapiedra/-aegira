# Frontend Refactor Implementation Plan

**Date:** January 13, 2026
**Status:** Ready for Implementation

---

## Overview

This document details the exact changes needed for Phase 1 (Quick Fixes) and Phase 2 (Type Consolidation). Each change includes:
- Exact file paths and line numbers
- Current code vs. new code
- Files that will be affected
- Testing checklist

---

## Phase 1: Critical Bug Fixes

### 1.1 Fix holiday.service.ts Return Values

**File:** `D:/Aegira/frontend/src/services/holiday.service.ts`

**Problem:** Functions return `response` instead of `response.data`

#### Change 1: checkHoliday (Lines 16-19)

**Current Code:**
```typescript
export async function checkHoliday(date: string): Promise<{ isHoliday: boolean; holiday: Holiday | null }> {
  const response = await api.get<{ isHoliday: boolean; holiday: Holiday | null }>(`/holidays/check/${date}`);
  return response;  // BUG: Returns AxiosResponse, not data
}
```

**New Code:**
```typescript
export async function checkHoliday(date: string): Promise<{ isHoliday: boolean; holiday: Holiday | null }> {
  const response = await api.get<{ isHoliday: boolean; holiday: Holiday | null }>(`/holidays/check/${date}`);
  return response.data;  // FIX: Return data property
}
```

#### Change 2: addHoliday (Lines 22-25)

**Current Code:**
```typescript
export async function addHoliday(date: string, name: string): Promise<Holiday> {
  const response = await api.post<Holiday>('/holidays', { date, name });
  return response;  // BUG: Returns AxiosResponse, not data
}
```

**New Code:**
```typescript
export async function addHoliday(date: string, name: string): Promise<Holiday> {
  const response = await api.post<Holiday>('/holidays', { date, name });
  return response.data;  // FIX: Return data property
}
```

**Files Using These Functions:**
| File | Function | Impact |
|------|----------|--------|
| `pages/executive/company-calendar.page.tsx` | `addHoliday` (line 49) | Used in mutation - return value not directly used, safe |
| `pages/executive/company-calendar.page.tsx` | `checkHoliday` | NOT USED in this file |

**Note:** `checkHoliday` and `removeHolidayByDate` are NOT used anywhere in the frontend, but should still be fixed for future use.

**Testing Checklist:**
- [ ] Navigate to Executive > Company Calendar
- [ ] Add a new holiday - should succeed
- [ ] Remove a holiday - should succeed
- [ ] Verify holidays appear in the calendar

---

### 1.2 Fix whs.service.ts `any` Types

**File:** `D:/Aegira/frontend/src/services/whs.service.ts`

**Problem:** Lines 40 uses `any` type which breaks type safety

#### Change: getSafetyIncidents (Lines 34-43)

**Current Code:**
```typescript
getSafetyIncidents: async (params?: {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: any[]; pagination: any }> => {
  const response = await api.get('/whs/incidents', { params });
  return response.data;
},
```

**New Code:**
```typescript
getSafetyIncidents: async (params?: {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: WHSSafetyIncident[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await api.get('/whs/incidents', { params });
  return response.data;
},
```

**Add New Interface (after line 25):**
```typescript
export interface WHSSafetyIncident {
  id: string;
  caseNumber: string;
  title: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  reporter: string;
  team: string;
  createdAt: string;
  description?: string;
  location?: string;
}
```

**Files Using This:**
| File | Usage | Impact |
|------|-------|--------|
| `pages/whs/dashboard.page.tsx` | Uses `whsService.getDashboard()` | Not affected |
| Any WHS incident list page | May use `getSafetyIncidents` | Now has proper types |

**Testing Checklist:**
- [ ] Navigate to WHS Dashboard
- [ ] If there's an incidents list, verify it loads correctly
- [ ] TypeScript should compile without errors

---

### 1.3 Add `role="dialog"` to Modal Components

#### 1.3.1 ConfirmModal.tsx

**File:** `D:/Aegira/frontend/src/components/ui/ConfirmModal.tsx`

**Current Code (Line 84):**
```tsx
<div className="bg-white rounded-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
```

**New Code:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-modal-title"
  className="bg-white rounded-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
>
```

**Also update the title element to have id (find the title h3/h2):**
```tsx
<h3 id="confirm-modal-title" className="...">
```

---

#### 1.3.2 IncidentDetailModal.tsx

**File:** `D:/Aegira/frontend/src/components/incidents/IncidentDetailModal.tsx`

**Current Code (Line 144):**
```tsx
<div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
```

**New Code:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="incident-modal-title"
  className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
>
```

---

#### 1.3.3 AbsenceJustificationModal.tsx

**File:** `D:/Aegira/frontend/src/components/absences/AbsenceJustificationModal.tsx`

**Current Code (Line 149):**
```tsx
<div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
```

**New Code:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="absence-modal-title"
  className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
>
```

**Testing Checklist:**
- [ ] Open any confirmation modal - verify it still works
- [ ] Open incident detail modal - verify it still works
- [ ] Trigger absence justification modal - verify it still works
- [ ] Screen reader test (optional): Modal should announce as dialog

---

### 1.4 Fix AbsenceStatus Type Mismatch

**Problem:** Two different definitions of `AbsenceStatus`

**Location 1:** `D:/Aegira/frontend/src/types/absence.ts` (Line 13-16)
```typescript
export type AbsenceStatus =
  | 'PENDING_JUSTIFICATION'
  | 'EXCUSED'
  | 'UNEXCUSED';
```

**Location 2:** `D:/Aegira/frontend/src/services/team.service.ts` (Line 53)
```typescript
export type AbsenceStatus = 'PENDING_JUSTIFICATION' | 'PENDING_REVIEW' | 'EXCUSED' | 'UNEXCUSED';
```

**Issue:** `team.service.ts` has `'PENDING_REVIEW'` which is missing from `absence.ts`

#### Fix: Update types/absence.ts (Line 13-16)

**Current Code:**
```typescript
export type AbsenceStatus =
  | 'PENDING_JUSTIFICATION'
  | 'EXCUSED'
  | 'UNEXCUSED';
```

**New Code:**
```typescript
export type AbsenceStatus =
  | 'PENDING_JUSTIFICATION'
  | 'PENDING_REVIEW'
  | 'EXCUSED'
  | 'UNEXCUSED';
```

#### Fix: Update ABSENCE_STATUS_LABELS in types/absence.ts (Line 113-117)

**Current Code:**
```typescript
export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'Pending',
  EXCUSED: 'Excused',
  UNEXCUSED: 'Unexcused',
};
```

**New Code:**
```typescript
export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'Pending Justification',
  PENDING_REVIEW: 'Pending Review',
  EXCUSED: 'Excused',
  UNEXCUSED: 'Unexcused',
};
```

#### Fix: Update ABSENCE_STATUS_COLORS in types/absence.ts (Line 119-123)

**Current Code:**
```typescript
export const ABSENCE_STATUS_COLORS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'yellow',
  EXCUSED: 'green',
  UNEXCUSED: 'red',
};
```

**New Code:**
```typescript
export const ABSENCE_STATUS_COLORS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'yellow',
  PENDING_REVIEW: 'orange',
  EXCUSED: 'green',
  UNEXCUSED: 'red',
};
```

#### Fix: Remove duplicate from team.service.ts (Line 53-54)

**Current Code:**
```typescript
export type AbsenceStatus = 'PENDING_JUSTIFICATION' | 'PENDING_REVIEW' | 'EXCUSED' | 'UNEXCUSED';
export type AbsenceReason = 'SICK' | 'FAMILY_EMERGENCY' | 'PERSONAL' | 'TRANSPORTATION' | 'WEATHER' | 'OTHER';
```

**New Code:**
```typescript
import type { AbsenceStatus } from '../types/absence';
// Remove the duplicate AbsenceStatus line, keep AbsenceReason
export type AbsenceReason = 'SICK' | 'FAMILY_EMERGENCY' | 'PERSONAL' | 'TRANSPORTATION' | 'WEATHER' | 'OTHER';
```

**Note:** Need to add import at top of team.service.ts

**Testing Checklist:**
- [ ] TypeScript compiles without errors
- [ ] Absence list displays correct status colors
- [ ] Member profile absence tab works correctly

---

## Phase 2: Type Consolidation

### 2.1 Consolidate LowScoreReason

**Single Source of Truth:** `D:/Aegira/frontend/src/types/user.ts` (Lines 84-92)

**Files with duplicate definitions to REMOVE:**

#### 2.1.1 Remove from checkin.service.ts

**File:** `D:/Aegira/frontend/src/services/checkin.service.ts`

**Find and Remove (Lines 52-60):**
```typescript
export type LowScoreReason =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'POOR_SLEEP'
  | 'HIGH_STRESS'
  | 'PERSONAL_ISSUES'
  | 'FAMILY_EMERGENCY'
  | 'WORK_RELATED'
  | 'OTHER';
```

**Add Import at top:**
```typescript
import type { LowScoreReason } from '../types/user';
```

#### 2.1.2 Remove from daily-monitoring.service.ts

**File:** `D:/Aegira/frontend/src/services/daily-monitoring.service.ts`

**Find and Remove (Lines 140-148):**
```typescript
export type LowScoreReason =
  | 'PHYSICAL_INJURY'
  | 'ILLNESS_SICKNESS'
  | 'POOR_SLEEP'
  | 'HIGH_STRESS'
  | 'PERSONAL_ISSUES'
  | 'FAMILY_EMERGENCY'
  | 'WORK_RELATED'
  | 'OTHER';
```

**Add Import at top:**
```typescript
import type { LowScoreReason } from '../types/user';
```

**Files importing LowScoreReason (need to update import path):**

| File | Current Import | New Import |
|------|----------------|------------|
| `pages/worker/my-history.page.tsx:10` | `from '../../types/user'` | No change needed |
| `pages/worker/checkin.page.tsx:8` | `from '../../services/checkin.service'` | Change to `from '../../types/user'` |

---

### 2.2 Consolidate ReadinessStatus

**Single Source of Truth:** `D:/Aegira/frontend/src/types/user.ts` (Line 11)

**Files with duplicate definitions to REMOVE:**

#### 2.2.1 Remove from daily-monitoring.service.ts

**File:** `D:/Aegira/frontend/src/services/daily-monitoring.service.ts`

**Find and Remove (Line 13):**
```typescript
export type ReadinessStatus = 'GREEN' | 'YELLOW' | 'RED';
```

**Add Import at top:**
```typescript
import type { ReadinessStatus } from '../types/user';
```

**Files importing ReadinessStatus (need to update import path):**

| File | Current Import | New Import |
|------|----------------|------------|
| `components/monitoring/SuddenChangeCard.tsx:15` | `from '../../services/daily-monitoring.service'` | Change to `from '../../types/user'` |
| `pages/team-leader/daily-monitoring/hooks/useCheckins.ts:9` | `from '../../../../services/daily-monitoring.service'` | Change to `from '../../../../types/user'` |

---

### 2.3 Create Shared PaginatedResponse Type

**Create New File:** `D:/Aegira/frontend/src/types/api.ts`

```typescript
/**
 * Shared API Types
 */

/**
 * Generic paginated response wrapper
 * Use this for all paginated API responses
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Generic API error response
 */
export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Generic success response
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}
```

**Update user.service.ts to use shared type:**

**File:** `D:/Aegira/frontend/src/services/user.service.ts`

**Remove (Lines 30-38):**
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Add Import:**
```typescript
import type { PaginatedResponse } from '../types/api';
```

---

### 2.4 Standardize ExceptionType Imports

**Single Source of Truth:** `D:/Aegira/frontend/src/services/exemption.service.ts` (Lines 13-18)

This is already the primary source. Just verify all imports point here.

**Files importing ExceptionType:**
| File | Current Import | Status |
|------|----------------|--------|
| `services/team.service.ts:3` | `from './exemption.service'` | OK |
| `pages/team-leader/daily-monitoring/types.ts:7` | `from '../../../services/exemption.service'` | OK |
| `pages/team-leader/daily-monitoring/components/CreateExemptionModal.tsx:10` | `from '../../../../services/exemption.service'` | OK |
| `pages/worker/checkin.page.tsx:16` | `from '../../services/exemption.service'` | OK |
| `pages/team-leader/daily-monitoring/hooks/useExemptionMutations.ts:12` | `from '../../../../services/exemption.service'` | OK |

No changes needed for ExceptionType.

---

## Summary of All Changes

### Phase 1 Files to Modify:

| File | Changes |
|------|---------|
| `services/holiday.service.ts` | Fix return values (lines 18, 24) |
| `services/whs.service.ts` | Add interface, fix return type (lines 26-37, 40) |
| `components/ui/ConfirmModal.tsx` | Add role="dialog" (line 84) |
| `components/incidents/IncidentDetailModal.tsx` | Add role="dialog" (line 144) |
| `components/absences/AbsenceJustificationModal.tsx` | Add role="dialog" (line 149) |
| `types/absence.ts` | Add PENDING_REVIEW status (lines 13-16, 113-117, 119-123) |
| `services/team.service.ts` | Remove duplicate AbsenceStatus, add import (line 53) |

### Phase 2 Files to Modify:

| File | Changes |
|------|---------|
| `types/api.ts` | CREATE NEW FILE |
| `services/checkin.service.ts` | Remove LowScoreReason, add import |
| `services/daily-monitoring.service.ts` | Remove LowScoreReason & ReadinessStatus, add imports |
| `services/user.service.ts` | Remove PaginatedResponse, add import |
| `pages/worker/checkin.page.tsx` | Update LowScoreReason import |
| `components/monitoring/SuddenChangeCard.tsx` | Update ReadinessStatus import |
| `pages/team-leader/daily-monitoring/hooks/useCheckins.ts` | Update ReadinessStatus import |

---

## Pre-Implementation Checklist

- [ ] Backup current code or ensure git is clean
- [ ] Run `npm run build` to verify current state compiles
- [ ] Run application to verify current functionality

## Post-Implementation Checklist

- [ ] Run `npm run build` - should compile without errors
- [ ] Run `npm run dev` - application should start
- [ ] Test all modified features:
  - [ ] Holiday calendar (add/remove holidays)
  - [ ] WHS dashboard
  - [ ] Confirmation modals
  - [ ] Incident detail modal
  - [ ] Absence justification modal
  - [ ] Check-in flow
  - [ ] Member profile with absences

---

## Risk Assessment

| Change | Risk Level | Rollback Plan |
|--------|------------|---------------|
| holiday.service.ts fix | LOW | Git revert |
| whs.service.ts types | LOW | Git revert |
| Modal accessibility | LOW | Git revert |
| AbsenceStatus fix | MEDIUM | Git revert, check backend enum |
| Type consolidation | LOW | Git revert |

---

## Notes

1. **Backend Verification Needed:** Confirm backend supports `PENDING_REVIEW` status for absences
2. **No Breaking Changes:** All changes are backward compatible
3. **Testing Priority:** Focus on check-in flow and absence justification as these are critical paths

---

**Ready for Implementation:** YES

**Estimated Time:** 2-3 hours

**Recommendation:** Implement Phase 1 first, verify, then implement Phase 2
