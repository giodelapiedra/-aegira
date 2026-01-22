# Worker Pages Refactoring Plan

## Overview

**Date:** 2026-01-14
**Files to Refactor:**
- `frontend/src/pages/worker/checkin.page.tsx` (1,337 lines)
- `frontend/src/pages/worker/home.page.tsx` (1,233 lines)

**Goals:**
1. Split large files into smaller, focused components
2. Create reusable shared components
3. Extract heavy logic into custom hooks
4. Fix duplications and inconsistencies
5. Improve maintainability and testability

---

## CRITICAL ISSUES FOUND

### Issue 1: Query Key Inconsistency ⚠️
**Problem:** Same data fetched with different keys = duplicate API calls

| File | Query Key | Data |
|------|-----------|------|
| `home.page.tsx:114` | `['team', 'my']` | Team info |
| `checkin.page.tsx:543` | `['my-team']` | Team info (SAME!) |

**Fix:** Standardize to `['team', 'my']` in both files.

---

### Issue 2: Missing staleTime in home.page.tsx ⚠️
**Problem:** All queries in `home.page.tsx` have NO staleTime, causing unnecessary refetches.

```typescript
// home.page.tsx lines 103-127 - ALL MISSING staleTime!
const { data: todayCheckin } = useQuery({
  queryKey: ['checkin', 'today'],
  queryFn: () => checkinService.getTodayCheckin(),
  // NO staleTime! ❌
});
```

**Fix:** Add appropriate staleTime to all queries:
| Query | Recommended staleTime |
|-------|----------------------|
| `['checkin', 'today']` | 30 seconds |
| `['checkins', 'recent']` | 60 seconds |
| `['team', 'my']` | 5 minutes |
| `['exemptions', 'active']` | 5 minutes |
| `['absences', 'my-history']` | 5 minutes |

---

### Issue 3: STATUS_CONFIG Duplication ⚠️
**Problem:** Three different implementations of status styling!

| File | Implementation |
|------|----------------|
| `home.page.tsx:44-79` | Full `STATUS_CONFIG` object with `getStatusConfig()` |
| `checkin.page.tsx:786-811` | Separate functions: `getStatusColor()`, `getStatusBgGradient()`, `getStatusLabel()` |
| `request-exception.page.tsx:160` | Another `getStatusConfig()` implementation |

**Fix:** Create single shared `StatusConfig.ts` in `components/worker/`.

---

### Issue 4: Day Constants Duplication
**Problem:** Day name mappings defined in multiple places.

| File | Constants Used |
|------|----------------|
| `home.page.tsx` | `DAY_CODE_TO_NAME`, `DAY_CODE_TO_SHORT`, `DAY_INDEX_TO_CODE` from `lib/constants` |
| `checkin.page.tsx:73` | Local `dayNames` array |

**Fix:** Use shared constants from `lib/constants.ts` everywhere.

---

### Issue 5: Router Import Changes Required
**Problem:** `HomePage` and `CheckinPage` are EAGER imports in router.

```typescript
// router.tsx lines 30-31
import { HomePage } from '../pages/worker/home.page';
import { CheckinPage } from '../pages/worker/checkin.page';
```

**Fix:** After refactoring to folders, update to:
```typescript
import { HomePage } from '../pages/worker/home';
import { CheckinPage } from '../pages/worker/checkin';
```

---

## Current Analysis

### checkin.page.tsx (1,337 lines)

| Section | Lines | Description |
|---------|-------|-------------|
| Types & Interfaces | 53-126 (~75) | Team, CheckinAvailability, CheckinError |
| checkCheckinAvailability() | 72-121 (~50) | Utility function |
| ExemptionRequestModal | 132-296 (~165) | Modal component |
| LowScoreReasonModal | 298-426 (~130) | Modal component |
| CheckinErrorMessage | 428-506 (~80) | Error display component |
| CheckinPage (main) | 508-1337 (~830) | Main component |

**Conditional Renders in Main Component:**
- Loading state (~10 lines)
- Non-MEMBER role message (~30 lines)
- No team assigned message (~30 lines)
- Before start date message (~35 lines)
- On leave message (~40 lines)
- Already checked in dashboard (~330 lines) ⚠️ LARGE
- Check-in not available message (~50 lines)
- Check-in form (~165 lines)

### home.page.tsx (1,233 lines)

| Section | Lines | Description |
|---------|-------|-------------|
| STATUS_CONFIG | 40-80 (~40) | Status configuration (DUPLICATE) |
| Role redirects | 86-101 (~15) | Navigate based on role |
| Queries (NO staleTime!) | 103-127 (~25) | React Query calls |
| getNextCheckin() | 130-362 (~235) | Complex calculation ⚠️ VERY LARGE |
| isDateExempted() | 364-411 (~50) | Date check helper |
| getReturnToWorkDate() | 413-551 (~140) | Return date calculation |
| getWeekCalendar() | 553-637 (~85) | Week calendar builder |
| getDynamicTip() | 639-683 (~45) | Tip generator |
| Memoized values | 686-816 (~130) | useMemo calls |
| JSX Render | 818-1232 (~415) | UI rendering |

---

## Proposed Folder Structure

```
frontend/src/
├── components/worker/                    # SHARED COMPONENTS
│   ├── index.ts                          # Re-exports
│   ├── StatusConfig.ts                   # Unified status config (FIX Issue 3)
│   ├── StatusIndicator.tsx               # Reusable status badge
│   └── MetricDisplay.tsx                 # Single metric with icon
│
├── pages/worker/
│   ├── checkin/
│   │   ├── index.tsx                     # Main container (~150 lines)
│   │   ├── CheckinForm.tsx               # Check-in form (~200 lines)
│   │   ├── CheckinDashboard.tsx          # Post check-in view (~300 lines)
│   │   ├── components/
│   │   │   ├── ExemptionRequestModal.tsx # (~165 lines)
│   │   │   ├── LowScoreReasonModal.tsx   # (~130 lines)
│   │   │   ├── CheckinErrorMessage.tsx   # (~80 lines)
│   │   │   ├── MetricsGrid.tsx           # (~100 lines)
│   │   │   ├── WeekStatsCard.tsx         # (~80 lines)
│   │   │   ├── StreakCard.tsx            # (~50 lines)
│   │   │   └── RecentCheckinsCard.tsx    # (~60 lines)
│   │   ├── states/
│   │   │   ├── NoTeamState.tsx           # (~30 lines)
│   │   │   ├── OnLeaveState.tsx          # (~40 lines)
│   │   │   ├── NotWorkDayState.tsx       # (~50 lines)
│   │   │   ├── NotRequiredState.tsx      # (~30 lines)
│   │   │   └── WelcomeState.tsx          # (~35 lines)
│   │   ├── hooks/
│   │   │   ├── useCheckinQueries.ts      # Standardized query keys
│   │   │   └── useCheckinAvailability.ts
│   │   ├── types.ts
│   │   └── utils.ts                      # checkCheckinAvailability, formatExceptionType
│   │
│   └── home/
│       ├── index.tsx                     # Main container (~200 lines)
│       ├── components/
│       │   ├── WelcomeHero.tsx           # (~60 lines)
│       │   ├── ScheduleCard.tsx          # (~70 lines)
│       │   ├── NextCheckinCard.tsx       # (~120 lines)
│       │   ├── TodayStatusCard.tsx       # (~100 lines)
│       │   ├── WeekCalendar.tsx          # (~200 lines)
│       │   └── TipsCard.tsx              # (~70 lines)
│       ├── hooks/
│       │   ├── useHomeQueries.ts         # WITH staleTime! (FIX Issue 2)
│       │   ├── useScheduleCalculations.ts # Heavy logic (~300 lines)
│       │   └── useWeekCalendar.ts        # (~100 lines)
│       └── types.ts
```

---

## Implementation Phases

### Phase 0: Fix Critical Issues First
Before refactoring, fix these issues in existing files:

1. **Add staleTime to home.page.tsx queries** (5 minutes)
2. **Standardize query key** `['my-team']` → `['team', 'my']` (2 minutes)

### Phase 1: Create Shared Components
1. Create `components/worker/` folder
2. Create `StatusConfig.ts` (unified config)
3. Create `StatusIndicator.tsx`
4. Create `MetricDisplay.tsx`
5. Create `index.ts` exports

### Phase 2: Refactor checkin.page.tsx
1. Create folder structure
2. Move modal components
3. Create state components
4. Create dashboard components
5. Extract hooks
6. Create main index.tsx
7. Update router imports
8. Delete old file

### Phase 3: Refactor home.page.tsx
1. Create folder structure
2. Extract heavy hooks
3. Create UI components
4. Create main index.tsx
5. Update router imports
6. Delete old file

### Phase 4: Update Related Files
1. Update `request-exception.page.tsx` to use shared StatusConfig
2. Verify all query keys are consistent
3. Run full test

---

## Shared StatusConfig.ts (Detailed)

```typescript
// frontend/src/components/worker/StatusConfig.ts

export const STATUS_CONFIG = {
  GREEN: {
    label: 'Ready for Duty',
    emoji: '😊',
    color: 'bg-success-500',
    bgColor: 'bg-success-50',
    textColor: 'text-success-700',
    borderColor: 'border-success-200',
    gradientFrom: 'from-success-500',
    gradientTo: 'to-success-600',
    variant: 'success' as const,
  },
  YELLOW: {
    label: 'Limited Readiness',
    emoji: '😐',
    color: 'bg-warning-500',
    bgColor: 'bg-warning-50',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-200',
    gradientFrom: 'from-warning-500',
    gradientTo: 'to-warning-600',
    variant: 'warning' as const,
  },
  RED: {
    label: 'Not Ready',
    emoji: '😰',
    color: 'bg-danger-500',
    bgColor: 'bg-danger-50',
    textColor: 'text-danger-700',
    borderColor: 'border-danger-200',
    gradientFrom: 'from-danger-500',
    gradientTo: 'to-danger-600',
    variant: 'danger' as const,
  },
  DEFAULT: {
    label: 'Unknown',
    emoji: '😐',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    gradientFrom: 'from-gray-500',
    gradientTo: 'to-gray-600',
    variant: 'default' as const,
  },
} as const;

export type ReadinessStatus = keyof typeof STATUS_CONFIG;

export const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status as ReadinessStatus] || STATUS_CONFIG.DEFAULT;

// Helper functions for backwards compatibility
export const getStatusColor = (status: string) => getStatusConfig(status).color;
export const getStatusBgColor = (status: string) => getStatusConfig(status).bgColor;
export const getStatusTextColor = (status: string) => getStatusConfig(status).textColor;
export const getStatusBorderColor = (status: string) => getStatusConfig(status).borderColor;
export const getStatusLabel = (status: string) => getStatusConfig(status).label;
export const getStatusEmoji = (status: string) => getStatusConfig(status).emoji;
export const getStatusGradient = (status: string) =>
  `${getStatusConfig(status).gradientFrom} ${getStatusConfig(status).gradientTo}`;
```

---

## useHomeQueries.ts (With staleTime Fix)

```typescript
// frontend/src/pages/worker/home/hooks/useHomeQueries.ts

import { useQuery } from '@tanstack/react-query';
import { checkinService } from '@/services/checkin.service';
import { teamService } from '@/services/team.service';
import { getActiveExemptions } from '@/services/exemption.service';
import { absenceService } from '@/services/absence.service';

export function useHomeQueries() {
  const todayCheckin = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
    staleTime: 30 * 1000, // 30 seconds - check-in status can change
  });

  const recentCheckins = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 7 }),
    staleTime: 60 * 1000, // 1 minute
  });

  const myTeam = useQuery({
    queryKey: ['team', 'my'], // STANDARDIZED KEY
    queryFn: () => teamService.getMyTeam(),
    staleTime: 5 * 60 * 1000, // 5 minutes - team rarely changes
  });

  const activeExemptions = useQuery({
    queryKey: ['exemptions', 'active'],
    queryFn: () => getActiveExemptions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const absenceHistory = useQuery({
    queryKey: ['absences', 'my-history'],
    queryFn: () => absenceService.getMyHistory(14),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    todayCheckin,
    recentCheckins,
    myTeam,
    activeExemptions,
    absenceHistory,
    isLoading: todayCheckin.isLoading,
  };
}
```

---

## useCheckinQueries.ts (Standardized)

```typescript
// frontend/src/pages/worker/checkin/hooks/useCheckinQueries.ts

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { checkinService } from '@/services/checkin.service';
import { teamService } from '@/services/team.service';
import {
  hasExemptionForCheckin,
  getMyPendingExemption
} from '@/services/exemption.service';
import api from '@/services/api';

export function useCheckinQueries(currentUserId?: string, todayCheckinId?: string) {
  const currentUser = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => authService.getMe(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  const team = useQuery({
    queryKey: ['team', 'my'], // STANDARDIZED KEY (was ['my-team'])
    queryFn: async () => {
      const response = await api.get('/teams/my');
      return response.data;
    },
    enabled: !!currentUser.data?.teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const leaveStatus = useQuery({
    queryKey: ['leave-status'],
    queryFn: () => checkinService.getLeaveStatus(),
    enabled: !!currentUser.data?.teamId &&
             (currentUser.data?.role === 'MEMBER' || currentUser.data?.role === 'WORKER'),
    staleTime: 60 * 1000, // 1 minute
  });

  const todayCheckin = useQuery({
    queryKey: ['checkin', 'today'],
    queryFn: () => checkinService.getTodayCheckin(),
    enabled: !!currentUser.data?.teamId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const recentCheckins = useQuery({
    queryKey: ['checkins', 'recent'],
    queryFn: () => checkinService.getMyCheckins({ limit: 5 }),
    enabled: !!currentUser.data?.teamId,
    staleTime: 60 * 1000, // 1 minute
  });

  const weekStats = useQuery({
    queryKey: ['checkins', 'week-stats'],
    queryFn: () => checkinService.getWeekStats(),
    enabled: !!currentUser.data?.teamId && !!todayCheckin.data,
    staleTime: 60 * 1000, // 1 minute
  });

  const exemptionStatus = useQuery({
    queryKey: ['exemption-status', todayCheckinId],
    queryFn: () => hasExemptionForCheckin(todayCheckinId!),
    enabled: !!todayCheckin.data && todayCheckin.data.readinessStatus === 'RED',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const pendingExemption = useQuery({
    queryKey: ['my-pending-exemption'],
    queryFn: () => getMyPendingExemption(),
    enabled: !!todayCheckin.data && todayCheckin.data.readinessStatus === 'RED',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    currentUser,
    team,
    leaveStatus,
    todayCheckin,
    recentCheckins,
    weekStats,
    exemptionStatus,
    pendingExemption,
    isLoading: currentUser.isLoading || team.isLoading || leaveStatus.isLoading,
  };
}
```

---

## Checklist

### Phase 0: Critical Fixes
- [ ] Add staleTime to all queries in `home.page.tsx`
- [ ] Change `['my-team']` to `['team', 'my']` in `checkin.page.tsx`

### Phase 1: Shared Components
- [ ] Create `components/worker/` folder
- [ ] Create `StatusConfig.ts`
- [ ] Create `StatusIndicator.tsx`
- [ ] Create `MetricDisplay.tsx`
- [ ] Create `index.ts` exports
- [ ] Update `request-exception.page.tsx` to use shared StatusConfig

### Phase 2: checkin.page.tsx
- [ ] Create `pages/worker/checkin/` folder
- [ ] Create `types.ts`
- [ ] Create `utils.ts` (checkCheckinAvailability, formatExceptionType)
- [ ] Move `ExemptionRequestModal.tsx`
- [ ] Move `LowScoreReasonModal.tsx`
- [ ] Move `CheckinErrorMessage.tsx`
- [ ] Create `states/NoTeamState.tsx`
- [ ] Create `states/OnLeaveState.tsx`
- [ ] Create `states/NotWorkDayState.tsx`
- [ ] Create `states/NotRequiredState.tsx`
- [ ] Create `states/WelcomeState.tsx`
- [ ] Create `components/MetricsGrid.tsx`
- [ ] Create `components/WeekStatsCard.tsx`
- [ ] Create `components/StreakCard.tsx`
- [ ] Create `components/RecentCheckinsCard.tsx`
- [ ] Create `CheckinForm.tsx`
- [ ] Create `CheckinDashboard.tsx`
- [ ] Create `hooks/useCheckinQueries.ts`
- [ ] Create `hooks/useCheckinAvailability.ts`
- [ ] Create `index.tsx` (main)
- [ ] Update `router.tsx` imports
- [ ] Delete old `checkin.page.tsx`
- [ ] Test all functionality

### Phase 3: home.page.tsx
- [ ] Create `pages/worker/home/` folder
- [ ] Create `types.ts`
- [ ] Create `hooks/useHomeQueries.ts`
- [ ] Create `hooks/useScheduleCalculations.ts`
- [ ] Create `hooks/useWeekCalendar.ts`
- [ ] Create `components/WelcomeHero.tsx`
- [ ] Create `components/ScheduleCard.tsx`
- [ ] Create `components/NextCheckinCard.tsx`
- [ ] Create `components/TodayStatusCard.tsx`
- [ ] Create `components/WeekCalendar.tsx`
- [ ] Create `components/TipsCard.tsx`
- [ ] Create `index.tsx` (main)
- [ ] Update `router.tsx` imports
- [ ] Delete old `home.page.tsx`
- [ ] Test all functionality

### Phase 4: Final Verification
- [ ] Run TypeScript compile (`npm run build`)
- [ ] Test check-in flow (all scenarios)
- [ ] Test home page (all scenarios)
- [ ] Verify no console errors
- [ ] Verify no duplicate API calls (check Network tab)
- [ ] Verify staleTime working (no unnecessary refetches)

---

## Testing Plan

### Before Refactoring (Baseline)
1. Note current API call counts on page load
2. Document current functionality

### After Each Phase
1. TypeScript compile check
2. Visual comparison
3. Network tab API call count
4. Console error check

### Functional Tests
| Scenario | Expected |
|----------|----------|
| Worker check-in (normal) | Form submits, dashboard shows |
| Worker check-in (RED score) | LowScoreReasonModal appears |
| Worker already checked in | Dashboard view |
| Worker no team | NoTeamState message |
| Worker on leave | OnLeaveState with dates |
| Worker before shift | TooEarly message |
| Worker after shift | TooLate message |
| Worker not work day | NotWorkDay message |
| Worker new to team | WelcomeState message |
| Home page checked in | Status card green/yellow/red |
| Home page not checked in | CTA button |
| Home page on exemption | Return date shown |
| Week calendar accuracy | Correct days highlighted |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Test each phase before moving on |
| Query key change causing cache issues | Clear cache during transition |
| Import path changes breaking builds | Update all imports atomically |
| Missing edge cases | Document all conditional renders first |

---

## Status

| Phase | Status | Date |
|-------|--------|------|
| Analysis & Issue Discovery | COMPLETED | 2026-01-14 |
| Plan Creation | COMPLETED | 2026-01-14 |
| Phase 0: Critical Fixes | PENDING | - |
| Phase 1: Shared Components | PENDING | - |
| Phase 2: checkin.page.tsx | PENDING | - |
| Phase 3: home.page.tsx | PENDING | - |
| Phase 4: Final Verification | PENDING | - |

---

## Backend Verification ✓

All backend endpoints verified and working correctly:

| Frontend Service | Backend Endpoint | Status |
|------------------|-----------------|--------|
| `teamService.getMyTeam()` | `GET /teams/my` | ✓ |
| `checkinService.getTodayCheckin()` | `GET /checkins/today` | ✓ |
| `checkinService.getMyCheckins()` | `GET /checkins/my` | ✓ |
| `checkinService.getLeaveStatus()` | `GET /checkins/leave-status` | ✓ |
| `checkinService.getWeekStats()` | `GET /checkins/week-stats` | ✓ |
| `getActiveExemptions()` | `GET /exemptions/active` | ✓ |
| `getMyPendingExemption()` | `GET /exemptions/my-pending` | ✓ |
| `hasExemptionForCheckin()` | `GET /exemptions/check/:id` | ✓ |
| `absenceService.getMyHistory()` | `GET /absences/my-history` | ✓ |

**Conclusion:** Backend is clean. All issues are frontend-only.

---

## Additional Issue: Duplicate Team Type

**Problem:** `checkin.page.tsx` lines 53-64 has a local `Team` interface instead of using `TeamDetails` from `team.service.ts`.

```typescript
// checkin.page.tsx - LOCAL TYPE (BAD)
interface Team {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  workDays: string;
  company?: { ... };
}

// Should use from team.service.ts
import type { TeamDetails } from '../../services/team.service';
```

**Fix:** Remove local interface, use `TeamDetails` from service.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Initial plan created |
| 2026-01-14 | Discovered query key inconsistency issue |
| 2026-01-14 | Discovered missing staleTime in home.page.tsx |
| 2026-01-14 | Discovered STATUS_CONFIG duplication (3 files) |
| 2026-01-14 | Added Phase 0 for critical fixes |
| 2026-01-14 | Added detailed hook implementations |
| 2026-01-14 | Verified all backend endpoints - all OK |
| 2026-01-14 | Found duplicate Team interface in checkin.page.tsx |
