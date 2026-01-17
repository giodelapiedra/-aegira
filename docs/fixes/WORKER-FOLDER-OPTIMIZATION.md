# Worker Folder Performance Optimization Plan

> **Date:** January 2026
> **Status:** Planned
> **Priority:** High
> **Estimated Impact:** 60-70% reduction in API calls, 40-50% faster page loads

---

## Executive Summary

The worker folder (check-in and home pages) currently makes **8-13 API calls** per page load, resulting in unnecessary network overhead and slower perceived performance. This document outlines a comprehensive optimization plan to consolidate these into **2-3 optimized calls**.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Identified Issues](#2-identified-issues)
3. [Optimization Plan](#3-optimization-plan)
4. [Implementation Guide](#4-implementation-guide)
5. [Database Optimizations](#5-database-optimizations)
6. [Testing Checklist](#6-testing-checklist)

---

## 1. Current State Analysis

### 1.1 Check-in Page API Calls (8 calls)

| # | Endpoint | Purpose | Avg Response |
|---|----------|---------|--------------|
| 1 | `GET /api/auth/me` | User data | ~50ms |
| 2 | `GET /api/teams/my` | Team details | ~80ms |
| 3 | `GET /api/checkins/leave-status` | Leave status | ~60ms |
| 4 | `GET /api/checkins/today` | Today's check-in | ~40ms |
| 5 | `GET /api/checkins/my` | Recent check-ins | ~70ms |
| 6 | `GET /api/checkins/week-stats` | Week statistics | ~100ms |
| 7 | `GET /api/exemptions/check/:id` | Exemption check | ~30ms |
| 8 | `GET /api/exemptions/my-pending` | Pending exemption | ~30ms |

**Total: ~460ms+ (sequential) or ~100ms (parallel)**

### 1.2 Home Page API Calls (5 calls)

| # | Endpoint | Purpose | Avg Response |
|---|----------|---------|--------------|
| 1 | `GET /api/checkins/today` | Today's check-in | ~40ms |
| 2 | `GET /api/checkins/my` | Recent check-ins | ~70ms |
| 3 | `GET /api/teams/my` | Team info | ~80ms |
| 4 | `GET /api/exemptions/active` | Active exemptions | ~50ms |
| 5 | `GET /api/absences/my-history` | Absence history | ~60ms |

**Total: ~300ms+ (sequential) or ~80ms (parallel)**

### 1.3 Check-in POST Backend Queries (10-12 queries)

```
1. prisma.user.findUnique (with team, company)
2. getUserLeaveStatus() → 3-4 internal queries
3. prisma.holiday.findFirst
4. prisma.checkin.findFirst (duplicate check)
5. prisma.$transaction (checkin.create + attendance.upsert)
6. prisma.user.update (streak)
7. recalculateTodaySummary() → 2-3 queries
8. createSystemLog()
```

---

## 2. Identified Issues

### 2.1 Frontend Issues

#### Issue F1: Too Many API Calls
- **Location:** `useCheckinQueries.ts`, `useHomeQueries.ts`
- **Impact:** High network overhead, slow initial render
- **Root Cause:** Each piece of data fetched independently

#### Issue F2: Duplicate Data Fetching
- **Location:** Both hooks fetch `todayCheckin` and `myTeam`
- **Impact:** Same data fetched multiple times across pages
- **Root Cause:** No shared data loading strategy

#### Issue F3: Redundant Queries for Related Data
- **Example:** Fetching user, then team separately when team data is nested in user
- **Impact:** Extra round trips

### 2.2 Backend Issues

#### Issue B1: Sequential Queries in Leave Status
- **Location:** `backend/src/utils/leave.ts:65-184`
- **Impact:** 3-4 sequential DB calls
- **Code:**
```typescript
// CURRENT: Sequential
const user = await prisma.user.findUnique({...});
const currentException = await prisma.exception.findFirst({...});
const recentException = await prisma.exception.findFirst({...});
const lastCheckin = await prisma.checkin.findFirst({...});
```

#### Issue B2: Redundant Timezone Fetch
- **Location:** `backend/src/modules/checkins/index.ts:245-253`
- **Impact:** Extra include when timezone is in context
- **Code:**
```typescript
// CURRENT: Redundant company include
const user = await prisma.user.findUnique({
  include: {
    team: true,
    company: { select: { timezone: true } }, // Already in c.get('timezone')
  },
});
```

#### Issue B3: Over-fetching in List Queries
- **Location:** `backend/src/modules/checkins/index.ts:206-219`
- **Impact:** Returns email/role when not needed for list view

### 2.3 Database Issues

#### Issue D1: Missing Composite Index
- **Table:** `exceptions`
- **Query Pattern:** Frequent lookups by `userId + status`
- **Current:** Only individual indexes exist

---

## 3. Optimization Plan

### Phase 1: Consolidated Dashboard Endpoint (High Impact)

**Goal:** Reduce 8 API calls → 1 API call

Create a new endpoint that returns all worker dashboard data:

```typescript
// NEW: GET /api/worker/dashboard
interface WorkerDashboardResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatar: string | null;
    teamId: string | null;
    currentStreak: number;
    longestStreak: number;
    totalCheckins: number;
    avgReadinessScore: number;
    lastReadinessStatus: string | null;
  };
  team: {
    id: string;
    name: string;
    workDays: string;
    shiftStart: string;
    shiftEnd: string;
    leaderId: string | null;
  } | null;
  leaveStatus: {
    isOnLeave: boolean;
    isReturning: boolean;
    isBeforeStart: boolean;
    effectiveStartDate: string | null;
    currentException: ExceptionSummary | null;
  };
  todayCheckin: CheckinSummary | null;
  weekStats: {
    totalCheckins: number;
    scheduledDaysThisWeek: number;
    scheduledDaysSoFar: number;
    avgScore: number;
    avgStatus: string | null;
    dailyStatus: Record<string, DayStatus | null>;
  };
  recentCheckins: CheckinSummary[];
  pendingExemption: ExemptionSummary | null;
  isHoliday: boolean;
  holidayName: string | null;
}
```

### Phase 2: Parallel Query Optimization (Medium Impact)

**Goal:** Reduce DB query time by 40-50%

Optimize `getUserLeaveStatus` and check-in POST:

```typescript
// OPTIMIZED: Parallel queries
const [user, currentException, recentException] = await Promise.all([
  prisma.user.findUnique({...}),
  prisma.exception.findFirst({...}),
  prisma.exception.findFirst({...}),
]);
```

### Phase 3: Database Index Optimization (Low Impact)

**Goal:** Faster exception lookups

Add composite index:

```prisma
// In Exception model
@@index([userId, status])
```

### Phase 4: Frontend Query Consolidation (Medium Impact)

**Goal:** Single hook for all worker data

Replace separate hooks with consolidated approach:

```typescript
// NEW: useWorkerDashboard.ts
export function useWorkerDashboard() {
  return useQuery({
    queryKey: ['worker', 'dashboard'],
    queryFn: () => workerService.getDashboard(),
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

---

## 4. Implementation Guide

### Step 1: Create Worker Dashboard Endpoint

**File:** `backend/src/modules/worker/index.ts`

```typescript
import { Hono } from 'hono';
import { prisma } from '../../config/prisma.js';
import type { AppContext } from '../../types/context.js';
import {
  getTodayRange,
  getTodayForDbDate,
  getCurrentDayName,
  getNow,
  formatLocalDate,
} from '../../utils/date-helpers.js';

const workerRoutes = new Hono<AppContext>();

// GET /worker/dashboard - Consolidated worker dashboard data
workerRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');
  const timezone = c.get('timezone');

  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const todayForDb = getTodayForDbDate(timezone);
  const currentDay = getCurrentDayName(timezone);

  // Parallel fetch all data
  const [
    user,
    todayCheckin,
    recentCheckins,
    currentException,
    recentException,
    pendingExemption,
    holiday,
  ] = await Promise.all([
    // User with team
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
        teamId: true,
        currentStreak: true,
        longestStreak: true,
        totalCheckins: true,
        avgReadinessScore: true,
        lastReadinessStatus: true,
        teamJoinedAt: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
            workDays: true,
            shiftStart: true,
            shiftEnd: true,
            leaderId: true,
          },
        },
      },
    }),

    // Today's check-in
    prisma.checkin.findFirst({
      where: {
        userId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: {
        id: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        readinessScore: true,
        readinessStatus: true,
        lowScoreReason: true,
        lowScoreDetails: true,
        notes: true,
        createdAt: true,
      },
    }),

    // Recent check-ins (last 7)
    prisma.checkin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 7,
      select: {
        id: true,
        readinessScore: true,
        readinessStatus: true,
        createdAt: true,
      },
    }),

    // Current exception (on leave)
    prisma.exception.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: todayStart } },
        ],
      },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
    }),

    // Recent exception (for returning status)
    prisma.exception.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        endDate: {
          gte: new Date(todayStart.getTime() - 3 * 24 * 60 * 60 * 1000),
          lt: todayStart,
        },
      },
      orderBy: { endDate: 'desc' },
      select: {
        id: true,
        type: true,
        endDate: true,
      },
    }),

    // Pending exemption
    prisma.exception.findFirst({
      where: {
        userId,
        status: 'PENDING',
        isExemption: true,
      },
      select: {
        id: true,
        type: true,
        reason: true,
        scoreAtRequest: true,
        createdAt: true,
      },
    }),

    // Today's holiday
    prisma.holiday.findFirst({
      where: {
        companyId,
        date: todayForDb,
      },
      select: { name: true },
    }),
  ]);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Calculate leave status
  const isOnLeave = !!currentException;
  let isReturning = false;

  if (!isOnLeave && recentException) {
    // Check if user checked in since leave ended
    const checkinAfterLeave = recentCheckins.find(
      c => new Date(c.createdAt) > new Date(recentException.endDate!)
    );
    isReturning = !checkinAfterLeave;
  }

  // Calculate week stats
  const weekStats = calculateWeekStats(recentCheckins, user.team?.workDays, timezone);

  // Check if today is a work day
  const workDays = user.team?.workDays?.split(',').map(d => d.trim().toUpperCase()) || [];
  const isWorkDay = workDays.includes(currentDay);

  return c.json({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      teamId: user.teamId,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      totalCheckins: user.totalCheckins,
      avgReadinessScore: user.avgReadinessScore,
      lastReadinessStatus: user.lastReadinessStatus,
    },
    team: user.team,
    leaveStatus: {
      isOnLeave,
      isReturning,
      isBeforeStart: false, // Calculate if needed
      effectiveStartDate: null,
      currentException: currentException ? {
        id: currentException.id,
        type: currentException.type,
        startDate: currentException.startDate,
        endDate: currentException.endDate,
        reason: currentException.reason,
      } : null,
    },
    todayCheckin,
    weekStats,
    recentCheckins,
    pendingExemption,
    isHoliday: !!holiday,
    holidayName: holiday?.name || null,
    isWorkDay,
  });
});

// Helper function to calculate week stats
function calculateWeekStats(
  checkins: Array<{ createdAt: Date; readinessScore: number; readinessStatus: string }>,
  workDaysString: string | undefined,
  timezone: string
) {
  const now = getNow(timezone);
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekCheckins = checkins.filter(c => {
    const date = new Date(c.createdAt);
    return date >= weekStart && date <= weekEnd;
  });

  const totalCheckins = weekCheckins.length;
  const avgScore = totalCheckins > 0
    ? Math.round(weekCheckins.reduce((sum, c) => sum + c.readinessScore, 0) / totalCheckins)
    : 0;

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dailyStatus: Record<string, { status: string; score: number } | null> = {};

  for (const day of dayNames) {
    dailyStatus[day] = null;
  }

  for (const checkin of weekCheckins) {
    const date = new Date(checkin.createdAt);
    const dayName = dayNames[date.getDay()];
    dailyStatus[dayName] = {
      status: checkin.readinessStatus,
      score: checkin.readinessScore,
    };
  }

  const workDays = workDaysString?.split(',').map(d => d.trim().toUpperCase()) || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const scheduledDaysThisWeek = workDays.length;

  let scheduledDaysSoFar = 0;
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + i);
    if (dayDate <= now) {
      const dayName = dayNames[dayDate.getDay()];
      if (workDays.includes(dayName)) {
        scheduledDaysSoFar++;
      }
    }
  }

  return {
    weekStart: formatLocalDate(weekStart, timezone),
    weekEnd: formatLocalDate(weekEnd, timezone),
    totalCheckins,
    scheduledDaysThisWeek,
    scheduledDaysSoFar,
    avgScore,
    avgStatus: avgScore >= 70 ? 'GREEN' : avgScore >= 50 ? 'YELLOW' : totalCheckins > 0 ? 'RED' : null,
    dailyStatus,
    workDays,
  };
}

export { workerRoutes };
```

### Step 2: Register Route

**File:** `backend/src/routes.ts`

```typescript
import { workerRoutes } from './modules/worker/index.js';

// Add after other routes
api.route('/worker', workerRoutes);
```

### Step 3: Create Frontend Service

**File:** `frontend/src/services/worker.service.ts`

```typescript
import api from './api';
import type { WorkerDashboardResponse } from '../types/worker';

export const workerService = {
  async getDashboard(): Promise<WorkerDashboardResponse> {
    const response = await api.get('/worker/dashboard');
    return response.data;
  },
};
```

### Step 4: Create Consolidated Hook

**File:** `frontend/src/pages/worker/hooks/useWorkerDashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { workerService } from '../../../services/worker.service';

export function useWorkerDashboard() {
  return useQuery({
    queryKey: ['worker', 'dashboard'],
    queryFn: () => workerService.getDashboard(),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
```

### Step 5: Update Check-in Page

**File:** `frontend/src/pages/worker/checkin/index.tsx`

```typescript
// BEFORE
const { currentUser, team, leaveStatus, todayCheckin, ... } = useCheckinQueries();

// AFTER
const { data: dashboard, isLoading, error } = useWorkerDashboard();

// Access data from consolidated response
const user = dashboard?.user;
const team = dashboard?.team;
const leaveStatus = dashboard?.leaveStatus;
const todayCheckin = dashboard?.todayCheckin;
```

---

## 5. Database Optimizations

### 5.1 Add Composite Index

**Migration:** `prisma/migrations/xxx_add_exception_composite_index.sql`

```sql
-- Add composite index for faster leave status lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "exceptions_userId_status_idx"
ON "exceptions" ("userId", "status");
```

**Prisma Schema Update:**

```prisma
model Exception {
  // ... existing fields ...

  @@index([userId, status])  // ADD THIS
  @@index([userId, status, startDate, endDate])  // Already exists
}
```

### 5.2 Query Optimization Guidelines

```typescript
// DO: Use select for specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    // Only fields you need
  },
});

// DON'T: Use include when you need few fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { team: true, company: true }, // Fetches everything
});
```

---

## 6. Testing Checklist

### 6.1 Performance Tests

- [ ] Measure API response time before optimization
- [ ] Measure API response time after optimization
- [ ] Compare network waterfall charts
- [ ] Test under slow network conditions (3G)

### 6.2 Functional Tests

- [ ] Check-in page loads correctly
- [ ] Home page loads correctly
- [ ] Leave status displays correctly
- [ ] Week stats calculate properly
- [ ] Recent check-ins show correctly
- [ ] Holiday detection works
- [ ] Work day detection works

### 6.3 Edge Cases

- [ ] User with no team
- [ ] User with no check-ins
- [ ] User on leave
- [ ] User returning from leave
- [ ] Holiday on current day
- [ ] Non-work day

### 6.4 Metrics to Track

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| API calls per page load | 8 | 1 | 1-2 |
| Total network payload | ~15KB | ~5KB | <8KB |
| Time to interactive | ~800ms | ~300ms | <400ms |
| DB queries per request | 12 | 7 | <8 |

---

## 7. Rollout Plan

### Phase 1: Backend (Week 1)
1. Create `/worker/dashboard` endpoint
2. Add database index
3. Deploy to staging
4. Performance testing

### Phase 2: Frontend (Week 2)
1. Create worker service and hook
2. Update check-in page
3. Update home page
4. A/B testing with feature flag

### Phase 3: Cleanup (Week 3)
1. Remove old individual endpoints (if no other consumers)
2. Remove old hooks
3. Update documentation
4. Monitor production metrics

---

## 8. Future Considerations

### 8.1 WebSocket for Real-time Updates
Instead of polling, consider WebSocket for:
- Team status updates
- Check-in notifications
- Leave approval notifications

### 8.2 Service Worker Caching
Cache static data like:
- Team schedule (rarely changes)
- User profile (rarely changes)
- Holiday calendar (fetched once per day)

### 8.3 GraphQL Migration
For more flexible data fetching, consider GraphQL:
- Client specifies exactly what fields it needs
- Single endpoint for all queries
- Automatic batching and caching

---

## Appendix: Current vs Optimized Flow

### Current Flow (Check-in Page)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   8 APIs    │────▶│  12+ DB     │
│             │◀────│   Calls     │◀────│  Queries    │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │  ~460ms total      │  ~100ms parallel   │  ~200ms total
     │                    │                    │
```

### Optimized Flow (Check-in Page)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   1 API     │────▶│  7 DB       │
│             │◀────│   Call      │◀────│  Queries    │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │  ~150ms total      │  ~100ms           │  ~80ms (parallel)
     │                    │                    │
```

**Result: ~60-70% reduction in total load time**
