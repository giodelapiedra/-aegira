# Master Refactoring Plan

## Overview

This document consolidates all identified issues and planned fixes for the Aegira codebase.

**Date Created:** 2026-01-14
**Last Updated:** 2026-01-14

---

## Summary of All Issues

| # | Category | Issue | Priority | Status |
|---|----------|-------|----------|--------|
| 1 | Performance | Aggressive refetching (React Query) | HIGH | PENDING |
| 2 | Performance | Large monolithic files | MEDIUM | PENDING |
| 3 | Functionality | Same-day absence detection | HIGH | PENDING |
| 4 | Data Integrity | Auto-cleanup absences on exemption approval | HIGH | PENDING |

---

## PART 1: Performance - Aggressive Refetching

### Verified Issues (From Code Analysis)

| # | File | Line | Current Setting | Problem |
|---|------|------|-----------------|---------|
| 1 | `supervisor/dashboard.page.tsx` | 26-27 | `staleTime: 60s` + `refetchInterval: 60s` | **Conflict** - both active |
| 2 | `supervisor/dashboard.page.tsx` | 33-34 | `staleTime: 30s` + `refetchInterval: 60s` | **Conflict** - both active |
| 3 | `whs/dashboard.page.tsx` | 22 | `refetchInterval: 60s` only | **No staleTime** - defaults to 0 |
| 4 | `ai-insights-history.page.tsx` | 294 | `staleTime: 0` | **Always stale** - refetch every mount |
| 5 | `daily-monitoring/tabs/AbsencesTab.tsx` | 19 | `refetchInterval: 60s` only | **No staleTime** |
| 6 | `daily-monitoring/hooks/useCheckins.ts` | 38-39 | `staleTime: 30s` + `refetchInterval: 60s` | Both active |
| 7 | `daily-monitoring/hooks/useSuddenChanges.ts` | 38-39 | `staleTime: 30s` + `refetchInterval: 60s` | Both active |
| 8 | `daily-monitoring/hooks/useDailyMonitoringStats.ts` | 23-24 | `staleTime: 30s` + `refetchInterval: 60s` | Both active |
| 9 | `daily-monitoring/hooks/useExemptions.ts` | 42-43 | `staleTime: 30s` + `refetchInterval: 60s` | Both active |
| 10 | `daily-monitoring/hooks/useNotCheckedIn.ts` | 35-36 | `staleTime: 30s` + `refetchInterval: 60s` | Both active |
| 11 | `worker/checkin.page.tsx` | 531 | `staleTime: 30s` | Too aggressive for user profile |
| 12 | `worker/checkin.page.tsx` | 564, 593, 601 | `staleTime: 30s` | Too aggressive for exemptions |
| 13 | `admin/dashboard.page.tsx` | 108, 122 | `staleTime: 30s` | Too aggressive |
| 14 | `worker/my-history.page.tsx` | 90 | `staleTime: 30s` | Too aggressive |

### Decision: Daily Monitoring Hooks

The `daily-monitoring` hooks have `refetchInterval: 60s` which makes sense for a **real-time monitoring dashboard**. However, we should:
- Keep `refetchInterval` for real-time monitoring pages
- Remove it from pages that don't need real-time updates
- Ensure `staleTime` is always set when using `refetchInterval`

### Fixes to Apply

#### Fix 1: supervisor/dashboard.page.tsx
```typescript
// Lines 26-27 - BEFORE
staleTime: 60 * 1000,
refetchInterval: 60 * 1000,

// AFTER - Remove refetchInterval, increase staleTime
staleTime: 5 * 60 * 1000, // 5 minutes
// Remove refetchInterval
```

```typescript
// Lines 33-34 - BEFORE
staleTime: 30 * 1000,
refetchInterval: 60 * 1000,

// AFTER
staleTime: 2 * 60 * 1000, // 2 minutes
// Remove refetchInterval
```

#### Fix 2: whs/dashboard.page.tsx
```typescript
// Line 22 - BEFORE
refetchInterval: 60000,

// AFTER - Add staleTime
staleTime: 5 * 60 * 1000, // 5 minutes
// Remove refetchInterval (not real-time critical)
```

#### Fix 3: ai-insights-history.page.tsx
```typescript
// Line 294 - BEFORE
staleTime: 0,

// AFTER - Historical data doesn't change
staleTime: 30 * 60 * 1000, // 30 minutes
```

#### Fix 4: daily-monitoring/tabs/AbsencesTab.tsx
```typescript
// Line 19 - BEFORE
refetchInterval: REFETCH_INTERVAL,

// AFTER - Add staleTime
staleTime: 60 * 1000, // 1 minute
refetchInterval: REFETCH_INTERVAL, // Keep for real-time
```

#### Fix 5: worker/checkin.page.tsx (Multiple)
```typescript
// Line 531 - User profile - BEFORE
staleTime: 30 * 1000,

// AFTER - User profile rarely changes
staleTime: 15 * 60 * 1000, // 15 minutes
```

```typescript
// Lines 564, 593, 601 - Exemptions - BEFORE
staleTime: 30 * 1000,

// AFTER
staleTime: 5 * 60 * 1000, // 5 minutes
```

#### Fix 6: admin/dashboard.page.tsx
```typescript
// Lines 108, 122 - BEFORE
staleTime: 30 * 1000,

// AFTER
staleTime: 2 * 60 * 1000, // 2 minutes
```

#### Fix 7: worker/my-history.page.tsx
```typescript
// Line 90 - BEFORE
staleTime: 30000,

// AFTER - History doesn't change frequently
staleTime: 5 * 60 * 1000, // 5 minutes
```

### Checklist - Refetching Fixes

- [ ] `supervisor/dashboard.page.tsx` - Remove refetchInterval, increase staleTime
- [ ] `whs/dashboard.page.tsx` - Add staleTime, remove refetchInterval
- [ ] `ai-insights-history.page.tsx` - Change staleTime from 0 to 30 minutes
- [ ] `daily-monitoring/tabs/AbsencesTab.tsx` - Add staleTime
- [ ] `worker/checkin.page.tsx` - Increase staleTime for user profile (line 531)
- [ ] `worker/checkin.page.tsx` - Increase staleTime for exemptions (lines 564, 593, 601)
- [ ] `admin/dashboard.page.tsx` - Increase staleTime (lines 108, 122)
- [ ] `worker/my-history.page.tsx` - Increase staleTime (line 90)

---

## PART 2: Performance - Large Files

### Verified File Sizes

| # | File | Lines | Priority | Action |
|---|------|-------|----------|--------|
| 1 | `worker/checkin.page.tsx` | 1,337 | HIGH | Split into folder |
| 2 | `worker/home.page.tsx` | 1,250 | HIGH | Split into folder |
| 3 | `executive/teams.page.tsx` | 1,141 | MEDIUM | Split into folder |
| 4 | `team-leader/member-profile.page.tsx` | 976 | HIGH | Split by tabs |
| 5 | `admin/dashboard.page.tsx` | 506 | LOW | Consider splitting |

### Refactoring Plan: checkin.page.tsx (1,337 lines)

**Current:** Single monolithic file

**Proposed Structure:**
```
frontend/src/pages/worker/checkin/
├── index.tsx                      # Main container & routing (~100 lines)
├── CheckinForm.tsx                # Check-in form UI (~250 lines)
├── CheckinDashboard.tsx           # Post check-in dashboard (~300 lines)
├── CheckinAvailability.tsx        # Availability display (~100 lines)
├── components/
│   ├── LowScoreReasonModal.tsx    # Low score modal (~150 lines)
│   ├── ExemptionRequestModal.tsx  # Exemption request (~200 lines)
│   └── StatusCards.tsx            # Status display cards (~100 lines)
├── hooks/
│   ├── useCheckinForm.ts          # Form state & submission
│   ├── useCheckinAvailability.ts  # Availability checks
│   └── useCheckinQueries.ts       # React Query hooks
└── utils/
    └── checkin-helpers.ts         # Helper functions
```

### Refactoring Plan: home.page.tsx (1,250 lines)

**Proposed Structure:**
```
frontend/src/pages/worker/home/
├── index.tsx                      # Main container (~100 lines)
├── TodayStatus.tsx                # Today's check-in status (~200 lines)
├── WeekCalendar.tsx               # Week calendar view (~250 lines)
├── PerformanceCard.tsx            # Performance metrics (~150 lines)
├── QuickActions.tsx               # Quick action buttons (~100 lines)
├── components/
│   ├── StatusBadge.tsx
│   ├── DayCell.tsx
│   └── MetricCard.tsx
└── hooks/
    └── useHomeData.ts
```

### Refactoring Plan: member-profile.page.tsx (976 lines)

**Proposed Structure:**
```
frontend/src/pages/team-leader/member-profile/
├── index.tsx                      # Container with tabs (~100 lines)
├── tabs/
│   ├── OverviewTab.tsx            # Overview tab (~200 lines)
│   ├── CheckinsTab.tsx            # Check-ins history (~200 lines)
│   ├── AttendanceTab.tsx          # Attendance/exemptions (~200 lines)
│   └── IncidentsTab.tsx           # Incidents list (~150 lines)
└── hooks/
    ├── useMemberProfile.ts
    └── useMemberMutations.ts
```

### Checklist - File Refactoring

Phase 2A (HIGH Priority):
- [ ] `worker/checkin.page.tsx` - Split into folder structure
- [ ] `team-leader/member-profile.page.tsx` - Split by tabs

Phase 2B (MEDIUM Priority):
- [ ] `worker/home.page.tsx` - Split into folder structure
- [ ] `executive/teams.page.tsx` - Split into folder structure

---

## PART 3: Functionality - Same-Day Absence Detection

### Current Behavior
- Absences detected only for YESTERDAY and before
- Worker must wait until next day to see popup

### Proposed Behavior
- If shift has ended today, include TODAY in detection
- Worker sees popup immediately after shift ends

### File to Modify
`backend/src/utils/absence.ts` - Function: `detectAndCreateAbsences()`

### Code Change
```typescript
// Add after line 78
const shiftEnd = user.team.shiftEnd || '17:00';
const [shiftEndHour, shiftEndMin] = shiftEnd.split(':').map(Number);
const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
const currentMinutes = nowInTz.hour * 60 + nowInTz.minute;
const shiftEndedToday = currentMinutes > shiftEndMinutes;

const todayDayName = DAY_NAMES[getDayOfWeekInTimezone(todayInTz.toJSDate(), tz)];
const isTodayWorkDay = teamWorkDays.includes(todayDayName);

const checkUntilDate = (isTodayWorkDay && shiftEndedToday) ? todayInTz : yesterdayInTz;
```

### Checklist - Absence Detection
- [ ] Update `detectAndCreateAbsences()` to include today if shift ended
- [ ] Test: Worker opens app after shift → popup appears same day
- [ ] Test: Worker opens app before shift ends → no popup yet
- [ ] Test: Worker has exemption today → no popup

---

## PART 4: Data Integrity - Auto-Cleanup Absences

### Problem
If absence is created BEFORE exemption is approved, the absence record remains orphaned.

### Solution
When exemption is approved, auto-delete any overlapping pending absences.

### File to Modify
`backend/src/modules/exemptions/index.ts` - In approval endpoint

### Code Change
```typescript
// After exemption is approved
if (exemption.status === 'APPROVED' && exemption.startDate && exemption.endDate) {
  const overlappingAbsences = await prisma.absence.findMany({
    where: {
      userId: exemption.userId,
      absenceDate: {
        gte: exemption.startDate,
        lte: exemption.endDate,
      },
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: null, // Only delete un-justified ones
    },
  });

  if (overlappingAbsences.length > 0) {
    await prisma.absence.deleteMany({
      where: {
        id: { in: overlappingAbsences.map(a => a.id) },
      },
    });
  }
}
```

### Checklist - Auto-Cleanup
- [ ] Find exemption approval endpoint
- [ ] Add auto-cleanup logic after approval
- [ ] Test: Create absence → approve exemption → absence deleted
- [ ] Test: Exemption approved first → no absence created (existing)

---

## Implementation Order

### Priority Order (Recommended)

| Order | Task | Category | Effort | Impact |
|-------|------|----------|--------|--------|
| 1 | Fix aggressive refetching | Performance | LOW | HIGH |
| 2 | Same-day absence detection | Functionality | LOW | HIGH |
| 3 | Auto-cleanup absences | Data Integrity | LOW | MEDIUM |
| 4 | Refactor checkin.page.tsx | Performance | HIGH | MEDIUM |
| 5 | Refactor member-profile.page.tsx | Performance | MEDIUM | MEDIUM |
| 6 | Refactor home.page.tsx | Performance | HIGH | LOW |
| 7 | Refactor teams.page.tsx | Performance | MEDIUM | LOW |

### Quick Wins (Do First)
1. **Refetching fixes** - Simple config changes, big impact
2. **Same-day absence** - Small code change, better UX
3. **Auto-cleanup** - Small code change, data integrity

### Bigger Tasks (Do Later)
4-7. File refactoring - More effort, needs testing

---

## Testing Plan

### After Refetching Fixes
- [ ] Open DevTools Network tab
- [ ] Load dashboard pages
- [ ] Verify no duplicate API calls on mount
- [ ] Verify no constant polling (unless real-time page)
- [ ] Tab switch doesn't trigger refetch if data fresh

### After Absence Detection Fix
- [ ] Worker misses check-in today
- [ ] After shift ends, opens app
- [ ] Popup appears immediately (not next day)
- [ ] Holiday/rest day - no popup
- [ ] Has exemption - no popup

### After Auto-Cleanup Fix
- [ ] Create absence for Jan 8
- [ ] Approve exemption for Jan 8
- [ ] Absence record deleted
- [ ] Worker sees no popup

### After File Refactoring
- [ ] All functionality works same as before
- [ ] No console errors
- [ ] Page loads successfully
- [ ] All buttons/forms work

---

## Status Tracker

| Task | Status | Date Started | Date Completed |
|------|--------|--------------|----------------|
| Plan creation | COMPLETED | 2026-01-14 | 2026-01-14 |
| Fix refetching issues | COMPLETED | 2026-01-14 | 2026-01-14 |
| Same-day absence detection | COMPLETED | 2026-01-14 | 2026-01-14 |
| Auto-cleanup absences | COMPLETED | 2026-01-14 | 2026-01-14 (already implemented) |
| Refactor checkin.page.tsx | PENDING | - | - |
| Refactor member-profile.page.tsx | SKIPPED | - | - (already well-structured, uses shared hooks) |
| Refactor home.page.tsx | PENDING | - | - |
| Refactor teams.page.tsx | PENDING | - | - |

---

## Files Created/Modified

### Plan Documents
- `docs/fixes/MASTER-REFACTORING-PLAN.md` (this file)
- `docs/fixes/SAME-DAY-ABSENCE-DETECTION-PLAN.md`
- `docs/fixes/PERFORMANCE-OPTIMIZATION-PLAN.md`

### Files to Modify (Implementation)
1. `frontend/src/pages/supervisor/dashboard.page.tsx`
2. `frontend/src/pages/whs/dashboard.page.tsx`
3. `frontend/src/pages/team-leader/ai-insights-history.page.tsx`
4. `frontend/src/pages/team-leader/daily-monitoring/tabs/AbsencesTab.tsx`
5. `frontend/src/pages/worker/checkin.page.tsx`
6. `frontend/src/pages/admin/dashboard.page.tsx`
7. `frontend/src/pages/worker/my-history.page.tsx`
8. `backend/src/utils/absence.ts`
9. `backend/src/modules/exemptions/index.ts`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Created master plan |
| 2026-01-14 | Verified all file line counts |
| 2026-01-14 | Verified all staleTime/refetchInterval issues |
| 2026-01-14 | Consolidated all tasks with priority order |
| 2026-01-14 | Implemented same-day absence detection in `backend/src/utils/absence.ts` |
| 2026-01-14 | Verified auto-cleanup absences already implemented in exemptions module |
| 2026-01-14 | Verified member-profile.page.tsx already uses shared hooks (no refactor needed) |
