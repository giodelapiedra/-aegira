# Performance Optimization Plan

## Overview
Address performance issues related to **large files** and **aggressive refetching** in the frontend codebase.

**Current Rating:** 6/10
**Target Rating:** 8-9/10

---

## Issue 1: Large Files (Need Refactoring)

### Files >500 Lines (Should Be Split)

| # | File | Lines | Priority | Issue |
|---|------|-------|----------|-------|
| 1 | `worker/checkin.page.tsx` | 1,337 | HIGH | Massive monolithic component |
| 2 | `worker/home.page.tsx` | 1,250 | HIGH | Dashboard with multiple queries |
| 3 | `executive/teams.page.tsx` | 1,141 | MEDIUM | Team management with modals |
| 4 | `incidents/incident-detail.page.tsx` | 1,034 | MEDIUM | Complex incident details |
| 5 | `team-leader/member-profile.page.tsx` | 976 | HIGH | Multiple tabs |
| 6 | `team-leader/team-analytics.page.tsx` | 974 | MEDIUM | Complex analytics |
| 7 | `team-leader/ai-insights-detail.page.tsx` | 838 | LOW | AI insights |
| 8 | `team-leader/ai-chat.page.tsx` | 678 | LOW | Chat interface |
| 9 | `settings/profile.page.tsx` | 664 | LOW | User profile |
| 10 | `team-leader/team-overview.page.tsx` | 615 | MEDIUM | Team overview |
| 11 | `config/navigation.ts` | 604 | LOW | Not a component |
| 12 | `whs/visual-pdf-fill.page.tsx` | 590 | LOW | PDF form |
| 13 | `team-leader/approvals.page.tsx` | 556 | MEDIUM | Approvals |
| 14 | `services/daily-monitoring.service.ts` | 508 | LOW | Service file |

### Recommended Refactoring Structure

**Example: `checkin.page.tsx` (1,337 lines)**
```
frontend/src/pages/worker/checkin/
├── index.tsx                    # Main container (~100 lines)
├── CheckinForm.tsx              # Form UI (~300 lines)
├── CheckinValidation.tsx        # Availability checks (~150 lines)
├── ExemptionRequestModal.tsx    # Exemption handling (~200 lines)
├── LowScoreReasonModal.tsx      # Low score modal (~150 lines)
├── CheckinDashboard.tsx         # Post check-in view (~300 lines)
├── hooks/
│   ├── useCheckinAvailability.ts
│   ├── useCheckinMutation.ts
│   └── useExemptionRequest.ts
└── utils/
    └── checkin-helpers.ts
```

**Example: `member-profile.page.tsx` (976 lines)**
```
frontend/src/pages/team-leader/member-profile/
├── index.tsx                    # Container (~50 lines)
├── OverviewTab.tsx              # Overview tab (~200 lines)
├── CheckinsTab.tsx              # Checkins with pagination (~250 lines)
├── AttendanceTab.tsx            # Attendance/Exemptions (~200 lines)
├── IncidentsTab.tsx             # Incidents list (~150 lines)
└── hooks/
    ├── useMemberProfile.ts
    ├── useMemberCheckins.ts
    └── useMemberMutations.ts
```

---

## Issue 2: Aggressive Refetching

### Problem Areas

| # | File | Query | Current staleTime | Issue |
|---|------|-------|-------------------|-------|
| 1 | `supervisor/dashboard.page.tsx` | Stats | 60s + refetchInterval 60s | **Double refetch conflict** |
| 2 | `supervisor/dashboard.page.tsx` | Checkins | 30s + refetchInterval 60s | **Too aggressive** |
| 3 | `whs/dashboard.page.tsx` | Dashboard | None (only refetchInterval 60s) | **No caching** |
| 4 | `daily-monitoring/AbsencesTab.tsx` | Absences | None (only refetchInterval 60s) | **Constant polling** |
| 5 | `ai-insights-history.page.tsx` | Summaries | 0 (always stale) | **Forces refetch every mount** |
| 6 | `worker/checkin.page.tsx` | User profile | 30s | **Too aggressive for static data** |
| 7 | `worker/checkin.page.tsx` | Exemptions | 30s | **Too aggressive** |
| 8 | `admin/dashboard.page.tsx` | Recent logs | 30s | **Too aggressive** |

### Detailed Issues

#### A. Supervisor Dashboard - CONFLICTING SETTINGS
```typescript
// supervisor/dashboard.page.tsx (Lines 23-35)
// PROBLEM: Both staleTime AND refetchInterval active

const { data: stats } = useQuery({
  staleTime: 60 * 1000,       // Data "fresh" for 1 minute
  refetchInterval: 60 * 1000, // BUT also polls every 1 minute
  // Result: Constant API calls
});

const { data: recentCheckins } = useQuery({
  staleTime: 30 * 1000,       // 30 seconds - TOO SHORT
  refetchInterval: 60 * 1000, // Polls every minute
});
```

#### B. WHS Dashboard - NO CACHING
```typescript
// whs/dashboard.page.tsx (Lines 19-23)
// PROBLEM: Only refetchInterval, staleTime defaults to 0

const { data } = useQuery({
  queryKey: ['whs', 'dashboard'],
  queryFn: () => whsService.getDashboard(),
  refetchInterval: 60000, // Polls every minute
  // MISSING: staleTime - defaults to 0 (always stale)
  // Result: Refetches on EVERY mount + every minute
});
```

#### C. Absences Tab - UNNECESSARY POLLING
```typescript
// team-leader/daily-monitoring/tabs/AbsencesTab.tsx (Lines 16-20)
// PROBLEM: Constant polling for static data

const { data: pendingAbsences } = useQuery({
  queryKey: ['absences', 'team-pending'],
  queryFn: () => absenceService.getTeamPending(),
  refetchInterval: 60000, // Polls every minute
  // MISSING: staleTime
  // Absences don't change every minute!
});
```

#### D. AI Insights - ALWAYS REFETCHING
```typescript
// team-leader/ai-insights-history.page.tsx (Line 294)
// PROBLEM: Explicitly set to always be stale

staleTime: 0, // Forces immediate refetch on every mount
// Historical AI data doesn't change - should cache longer
```

---

## Recommended staleTime Values

| Data Type | Current | Recommended | Rationale |
|-----------|---------|-------------|-----------|
| User profile | 30s | **15-30 minutes** | Changes rarely during session |
| Team schedule | 5m | **1 hour** | Static configuration |
| Exemptions list | 30s | **5-10 minutes** | Changes infrequently |
| Dashboard stats | 30-60s | **2-5 minutes** | Not real-time critical |
| Absence records | 60s | **5-10 minutes** | Not time-sensitive |
| AI summaries | 0 (always) | **30-60 minutes** | Historical, doesn't change |
| Recent checkins | 30s | **1-2 minutes** | Acceptable for "recent" |
| System logs | 30s | **2-5 minutes** | Unless monitoring live |

---

## Implementation Plan

### Phase 1: Fix Aggressive Refetching (HIGH PRIORITY)
- [ ] `supervisor/dashboard.page.tsx` - Remove refetchInterval, increase staleTime
- [ ] `whs/dashboard.page.tsx` - Add staleTime, consider removing refetchInterval
- [ ] `daily-monitoring/AbsencesTab.tsx` - Add staleTime, remove refetchInterval
- [ ] `ai-insights-history.page.tsx` - Change staleTime from 0 to 30+ minutes
- [ ] `worker/checkin.page.tsx` - Increase staleTime for profile/exemptions

### Phase 2: Refactor Large Files (MEDIUM PRIORITY)
- [ ] `worker/checkin.page.tsx` (1,337 lines) - Split into folder structure
- [ ] `worker/home.page.tsx` (1,250 lines) - Extract components
- [ ] `team-leader/member-profile.page.tsx` (976 lines) - Split by tabs

### Phase 3: Other Large Files (LOW PRIORITY)
- [ ] `executive/teams.page.tsx` (1,141 lines)
- [ ] `incidents/incident-detail.page.tsx` (1,034 lines)
- [ ] `team-leader/team-analytics.page.tsx` (974 lines)

---

## Code Fixes

### Fix 1: Supervisor Dashboard
```typescript
// BEFORE (aggressive + conflicting)
const { data: stats } = useQuery({
  queryKey: ['stats'],
  queryFn: getStats,
  staleTime: 60 * 1000,
  refetchInterval: 60 * 1000,
});

// AFTER (optimized)
const { data: stats } = useQuery({
  queryKey: ['stats'],
  queryFn: getStats,
  staleTime: 5 * 60 * 1000, // 5 minutes
  // Remove refetchInterval - not real-time data
});
```

### Fix 2: WHS Dashboard
```typescript
// BEFORE (no caching)
const { data } = useQuery({
  queryKey: ['whs', 'dashboard'],
  queryFn: () => whsService.getDashboard(),
  refetchInterval: 60000,
});

// AFTER (proper caching)
const { data } = useQuery({
  queryKey: ['whs', 'dashboard'],
  queryFn: () => whsService.getDashboard(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  // Remove refetchInterval unless real-time needed
});
```

### Fix 3: Absences Tab
```typescript
// BEFORE (constant polling)
const { data: pendingAbsences } = useQuery({
  queryKey: ['absences', 'team-pending'],
  queryFn: () => absenceService.getTeamPending(),
  refetchInterval: 60000,
});

// AFTER (proper caching)
const { data: pendingAbsences } = useQuery({
  queryKey: ['absences', 'team-pending'],
  queryFn: () => absenceService.getTeamPending(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  // Remove refetchInterval - absences don't change every minute
});
```

### Fix 4: AI Insights History
```typescript
// BEFORE (always stale)
staleTime: 0,

// AFTER (proper caching)
staleTime: 30 * 60 * 1000, // 30 minutes - historical data
```

### Fix 5: Worker Checkin
```typescript
// BEFORE (too aggressive)
const { data: currentUser } = useQuery({
  queryKey: ['user', 'me'],
  queryFn: () => authService.getMe(),
  staleTime: 30 * 1000, // 30 seconds
});

// AFTER (optimized)
const { data: currentUser } = useQuery({
  queryKey: ['user', 'me'],
  queryFn: () => authService.getMe(),
  staleTime: 15 * 60 * 1000, // 15 minutes - profile rarely changes
});
```

---

## Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls (per session) | ~100-150 | ~40-60 | **40-60% reduction** |
| Network bandwidth | High | Low | **Significant reduction** |
| Server load | High | Moderate | **Better scalability** |
| Page load time | Slower | Faster | **Less re-renders** |
| Battery usage (mobile) | High | Low | **Better for mobile** |

---

## Testing Checklist

### After Refetching Fixes
- [ ] Dashboard loads without multiple API calls
- [ ] Tab switching doesn't trigger unnecessary refetches
- [ ] Background tabs don't poll constantly
- [ ] Data still updates when expected (manual refresh, mutation)

### After File Refactoring
- [ ] All functionality preserved
- [ ] No regression in features
- [ ] Bundle size similar or smaller
- [ ] Better code navigation/maintainability

---

## Issue 3: Backend Query Optimization

### HIGH Priority

#### A. N+1 Team Lookup Problem
**Impact:** 10+ modules affected, extra DB query per request for TEAM_LEAD users

**Affected Files:**
| File | Line | Query |
|------|------|-------|
| `modules/checkins/index.ts` | 164-167 | `findFirst({ leaderId, companyId, isActive })` |
| `modules/analytics/index.ts` | 55-62 | Same pattern |
| `modules/analytics/index.ts` | 175-182 | Same pattern |
| `modules/analytics/index.ts` | 242-249 | Same pattern |
| `modules/users/index.ts` | 436-439 | Same pattern |
| `modules/incidents/index.ts` | 98-101 | Same pattern |
| `modules/exceptions/index.ts` | 92-95 | Same pattern |
| `modules/teams/index.ts` | 88-91 | Same pattern |

**Fix:** Add `teamId` to auth context middleware - query once, use everywhere

#### B. Large In-Memory Aggregations
**File:** `modules/analytics/index.ts:703-845`

**Problem:**
```typescript
// Loads ALL checkins into memory, then loops per member
const checkinsByUser = new Map();
for (const checkin of allCheckins) { ... }
const memberAnalytics = team.members.map((member) => { ... });
```

**Fix:** Use Prisma `groupBy()` for database-level aggregation

#### C. Inefficient Case Number Generation
**File:** `modules/incidents/index.ts:11-56`

**Problem:** Up to 11 DB queries per incident creation (1 findFirst + 10 retries)

**Fix:** Use database sequence or atomic counter table

---

### MEDIUM Priority

#### D. Missing Composite Indexes

| Table | Current Index | Recommended | Query Pattern |
|-------|--------------|-------------|---------------|
| Team | `@@index([leaderId])` | `@@index([leaderId, companyId, isActive])` | Team lookup by leader |
| Checkin | `@@index([userId])`, `@@index([createdAt])` | `@@index([userId, createdAt])` | Date range queries |

#### E. Redundant Holiday Queries
**File:** `modules/analytics/index.ts`
- Line 597-606: Fetches current period holidays
- Line 960-970: Fetches previous period holidays

**Fix:** Single query for entire year, filter in-memory

#### F. Duplicate Team Member Queries
**File:** `modules/daily-monitoring/index.ts:100-150`

**Problem:** Fetches user's team, then queries for different team again

#### G. Exception Fetching Without Limits
**File:** `modules/analytics/index.ts:610-623`

**Problem:** Fetches ALL exceptions for ALL team members without pagination

---

### LOW Priority

#### H. Missing Pagination - Absences Team Pending
**File:** `modules/absences/index.ts:254-268`

**Problem:** Hard-coded `take: 100`, no offset/skip support

---

## Issue 4: Frontend Query Optimization (Additional)

### HIGH Priority

#### A. Duplicate Tab Queries
**Files:**
- `pages/team-leader/daily-monitoring/tabs/CheckinsTab.tsx`
- `pages/team-leader/daily-monitoring/tabs/ExemptionsTab.tsx`

**Problem:** Each tab makes 2+ separate API calls on switch

**Fix:** Batch queries or use parallel fetching

---

### MEDIUM Priority

#### B. Exception Counts Fetch
**File:** `pages/team-leader/approvals.page.tsx:58-61`

```typescript
// Fetches 500 records just for tab count badges!
const { data: allExceptions } = useQuery({
  queryKey: ['exceptions', 'counts'],
  queryFn: () => exceptionService.getAll({ page: 1, limit: 500 }),
});
```

**Fix:** Get counts from main query pagination response

#### C. Waterfall Request Pattern
**File:** `pages/worker/checkin/hooks/useCheckinQueries.ts:59-70`

```typescript
const weekStats = useQuery({
  enabled: !!todayCheckin.data, // Waits for today's checkin
});
```

**Fix:** Fetch independently - week stats don't need today's checkin

#### D. Overly Aggressive Query Invalidation
**File:** `pages/team-leader/daily-monitoring/hooks/useExemptionMutations.ts:37-43`

**Problem:** Invalidates 5 queries on every mutation

**Fix:** Targeted invalidation per action type

#### E. Double Client-Side Filtering
**File:** `pages/team-leader/daily-monitoring/tabs/CheckinsTab.tsx:40-49`

**Problem:** Backend filters by search, then frontend filters again

**Fix:** Remove redundant client-side filter

#### F. Redundant User Fetch
**File:** `pages/worker/checkin/hooks/useCheckinQueries.ts:24-28`

**Problem:** Fetches user data already in Zustand auth store

**Fix:** Use auth store first, fetch only if needed

---

## Implementation Plan (Updated)

### Phase 1: Quick Wins (LOW EFFORT, HIGH IMPACT)
- [ ] Add `teamId` to auth context middleware
- [ ] Add composite index `[leaderId, companyId, isActive]` to Team
- [ ] Add composite index `[userId, createdAt]` to Checkin
- [ ] Remove redundant client-side search filter
- [ ] Combine holiday queries into single yearly fetch

### Phase 2: Fix Aggressive Refetching
- [ ] `supervisor/dashboard.page.tsx` - Remove refetchInterval, increase staleTime
- [ ] `whs/dashboard.page.tsx` - Add staleTime, consider removing refetchInterval
- [ ] `daily-monitoring/AbsencesTab.tsx` - Add staleTime, remove refetchInterval
- [ ] `ai-insights-history.page.tsx` - Change staleTime from 0 to 30+ minutes
- [ ] `worker/checkin.page.tsx` - Increase staleTime for profile/exemptions

### Phase 3: Backend Query Optimization
- [ ] Replace in-memory aggregations with Prisma `groupBy()`
- [ ] Implement DB sequence for case number generation
- [ ] Add pagination to exception fetching
- [ ] Fix duplicate team member queries

### Phase 4: Frontend Query Optimization
- [ ] Use counts from main query instead of separate fetch
- [ ] Remove waterfall dependencies where data is independent
- [ ] Implement targeted query invalidation
- [ ] Batch tab queries

### Phase 5: Refactor Large Files
- [ ] `worker/checkin.page.tsx` (1,337 lines) - Split into folder structure
- [ ] `worker/home.page.tsx` (1,250 lines) - Extract components
- [ ] `team-leader/member-profile.page.tsx` (976 lines) - Split by tabs

---

## Status

| Phase | Status | Date |
|-------|--------|------|
| Analysis | COMPLETED | 2026-01-14 |
| Backend Analysis | COMPLETED | 2026-01-16 |
| Phase 1 (Quick Wins) | PENDING | - |
| Phase 2 (Refetching) | PENDING | - |
| Phase 3 (Backend Queries) | PENDING | - |
| Phase 4 (Frontend Queries) | PENDING | - |
| Phase 5 (Large Files) | PENDING | - |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Initial performance analysis |
| 2026-01-14 | Identified 14 large files |
| 2026-01-14 | Identified 8 aggressive refetching issues |
| 2026-01-14 | Created fix recommendations |
| 2026-01-16 | Added backend query optimization analysis |
| 2026-01-16 | Identified 14 backend issues (3 HIGH, 10 MEDIUM, 1 LOW) |
| 2026-01-16 | Identified 6 additional frontend query issues |
| 2026-01-16 | Updated implementation plan with 5 phases |
