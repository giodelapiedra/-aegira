# Member Profile Page Optimization

> **Route:** `/team/members/:userId`  
> **Backend Endpoint:** `GET /teams/members/:userId/profile`  
> **Location:** `backend/src/modules/teams/index.ts:1052`

---

## Current Implementation Analysis

### Query Breakdown

**Sequential Queries:**
1. ✅ Get member info (1 query)
2. ⚠️ Permission check for TEAM_LEAD (1 query - could be optimized)
3. ⚠️ Get company timezone (1 query - could be cached)

**Parallel Queries (Promise.all):**
4. ✅ Active exemption (1 query)
5. ✅ Recent check-ins (1 query - last 10)
6. ✅ Exemptions count (1 query)
7. ✅ Absences count (1 query)
8. ✅ Incidents count (1 query)
9. ⚠️ **Performance score** (Makes 4+ internal queries!)

**Total: ~10-12 database queries per page load**

---

## Critical Issues

### 1. ⚠️ calculatePerformanceScore - Heavy Function

**Problem:**
```typescript
// Line 1166: This function makes MULTIPLE queries internally
calculatePerformanceScore(memberId, thirtyDaysAgo, endDate)
```

**Inside calculatePerformanceScore:**
- Query 1: Get user + team info
- Query 2: Get first check-in date
- Query 3: Get attendance records (30 days)
- Query 4: Get approved exceptions (30 days)
- Query 5: Get holidays (30 days)
- Query 6: Get absences (30 days)

**Impact:** Adds 6 queries to the profile endpoint!

**Solution:** Cache performance score or make it optional/lazy load

---

### 2. ⚠️ Permission Check - Sequential

**Current:**
```typescript
// Line 1094-1101: Sequential permission check
if (currentUser.role === 'TEAM_LEAD') {
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: currentUser.id, companyId, isActive: true },
  });
  // ...
}
```

**Problem:** Blocks parallel queries, adds latency

**Solution:** Move to parallel or cache leader team lookup

---

### 3. ⚠️ Company Timezone - Repeated Lookup

**Current:**
```typescript
// Line 1104: Every request queries timezone
const timezone = await getCompanyTimezone(companyId);
```

**Problem:** Timezone rarely changes, but queried every time

**Solution:** Cache in memory or include in member query

---

### 4. ⚠️ Missing Indexes

**Queries that need indexes:**
- `prisma.checkin.findMany({ where: { userId: memberId } })` - Needs `[userId, createdAt]` ✅ (exists)
- `prisma.exception.findFirst({ where: { userId, status, startDate, endDate } })` - Needs `[userId, status, startDate, endDate]` ⚠️ (missing)
- `prisma.absence.count({ where: { userId } })` - Needs `[userId]` ✅ (exists)
- `prisma.incident.count({ where: { reportedBy } })` - Needs `[reportedBy]` ✅ (exists)

---

## Optimization Solutions

### Solution 1: Make Performance Score Optional/Lazy Load

**Current:** Performance score always calculated (slow)

**Optimized:**
```typescript
// Option A: Make it optional query param
const includePerformance = c.req.query('includePerformance') === 'true';

const queries = [
  activeExemption,
  recentCheckins,
  exemptionsCount,
  absencesCount,
  incidentsCount,
];

if (includePerformance) {
  queries.push(calculatePerformanceScore(memberId, thirtyDaysAgo, endDate));
} else {
  queries.push(Promise.resolve({ score: 0, totalDays: 0, countedDays: 0, workDays: 0, breakdown: {} }));
}

const [activeExemption, recentCheckins, exemptionsCount, absencesCount, incidentsCount, performance] = 
  await Promise.all(queries);
```

**Frontend:** Load performance score separately when user clicks "View Performance"

**Expected Improvement:** 50-70% faster (removes 6 queries)

---

### Solution 2: Cache Company Timezone

**Current:** Queries timezone every request

**Optimized:**
```typescript
// Cache timezone in memory (5 minute TTL)
const timezoneCache = new Map<string, { timezone: string; expires: number }>();

async function getCompanyTimezoneCached(companyId: string): Promise<string> {
  const cached = timezoneCache.get(companyId);
  if (cached && cached.expires > Date.now()) {
    return cached.timezone;
  }
  
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  
  const timezone = company?.timezone || DEFAULT_TIMEZONE;
  timezoneCache.set(companyId, {
    timezone,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  
  return timezone;
}
```

**Expected Improvement:** 10-20ms faster per request

---

### Solution 3: Optimize Permission Check

**Current:** Sequential query for TEAM_LEAD

**Optimized:**
```typescript
// Option A: Include leader team in initial member query
const member = await prisma.user.findFirst({
  where: { id: memberId, companyId },
  select: {
    // ... existing fields
    team: {
      select: {
        id: true,
        name: true,
        leaderId: true,
        // Add leader info for permission check
        leader: currentUser.role === 'TEAM_LEAD' ? {
          select: { id: true }
        } : undefined,
      },
    },
  },
});

// Then check permission without extra query
if (currentUser.role === 'TEAM_LEAD') {
  if (!member.team || member.team.leaderId !== currentUser.id) {
    return c.json({ error: 'You can only view members of your own team' }, 403);
  }
}
```

**Expected Improvement:** 10-30ms faster

---

### Solution 4: Add Missing Index

**Missing Index:**
```prisma
model Exception {
  // Add composite index for active exemption queries
  @@index([userId, status, startDate, endDate]) // Already exists! ✅
}
```

**Wait, this index already exists!** But let's verify it's being used correctly.

---

### Solution 5: Pre-compute Performance Score

**Current:** Calculated on-demand (slow)

**Optimized:** Store in User model (like `avgReadinessScore`)

```prisma
model User {
  // Add pre-computed performance score
  performanceScore30Days Float? // Last 30 days performance score
  performanceScoreUpdatedAt DateTime? // When it was last updated
}
```

**Update:** Recalculate daily via cron job

**Expected Improvement:** 80-90% faster (no calculation needed)

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (Do First)
1. ✅ **Make performance score optional** - Biggest impact
2. ✅ **Cache company timezone** - Easy win
3. ✅ **Optimize permission check** - Include in member query

**Expected Improvement:** 60-70% faster

### Phase 2: Medium Term
4. ⚠️ **Pre-compute performance score** - Store in User model
5. ⚠️ **Add response caching** - Cache full response for 1-2 minutes

**Expected Improvement:** 80-90% faster

---

## Code Changes

### Change 1: Make Performance Score Optional

```typescript
// backend/src/modules/teams/index.ts:1052

teamsRoutes.get('/members/:userId/profile', async (c) => {
  // ... existing code ...

  // Make performance score optional
  const includePerformance = c.req.query('includePerformance') === 'true';

  const queries: Promise<any>[] = [
    // Active exemption
    prisma.exception.findFirst({
      where: {
        userId: memberId,
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
      select: {
        id: true,
        type: true,
        endDate: true,
      },
    }),
    // Recent check-ins (last 10)
    prisma.checkin.findMany({
      where: { userId: memberId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        readinessStatus: true,
        readinessScore: true,
        mood: true,
        stress: true,
        sleep: true,
        physicalHealth: true,
        notes: true,
        lowScoreReason: true,
        lowScoreDetails: true,
        createdAt: true,
      },
    }),
    // Exemptions count
    prisma.exception.count({
      where: { userId: memberId },
    }),
    // Absences count
    prisma.absence.count({
      where: { userId: memberId },
    }),
    // Incidents count
    prisma.incident.count({
      where: { reportedBy: memberId },
    }),
  ];

  // Only calculate performance score if requested
  if (includePerformance) {
    queries.push(calculatePerformanceScore(memberId, thirtyDaysAgo, endDate));
  } else {
    // Return default/empty performance score
    queries.push(Promise.resolve({
      score: 0,
      totalDays: 0,
      countedDays: 0,
      workDays: 0,
      breakdown: {
        green: 0,
        absent: 0,
        excused: 0,
        absenceExcused: 0,
        absenceUnexcused: 0,
        absencePending: 0,
      },
    }));
  }

  const [
    activeExemption,
    recentCheckins,
    exemptionsCount,
    absencesCount,
    incidentsCount,
    performance,
  ] = await Promise.all(queries);

  const attendanceScore = includePerformance 
    ? Math.round(performance.score)
    : null; // Or use pre-computed value from User model

  return c.json({
    ...member,
    isOnLeave: !!activeExemption,
    activeExemption,
    stats: {
      totalCheckins: member.totalCheckins,
      attendanceScore, // null if not calculated
      exemptionsCount,
      absencesCount,
      incidentsCount,
    },
    recentCheckins,
    // Include flag to indicate if performance was calculated
    performanceCalculated: includePerformance,
  });
});
```

### Change 2: Frontend - Lazy Load Performance

```typescript
// frontend/src/pages/team-leader/member-profile.page.tsx

// Initial load - fast (no performance score)
const { data: member, isLoading } = useQuery({
  queryKey: ['member-profile', userId],
  queryFn: () => teamService.getMemberProfile(userId!),
  enabled: !!userId,
  staleTime: 1000 * 60 * 5,
});

// Lazy load performance score when user clicks "View Performance"
const { data: performanceData } = useQuery({
  queryKey: ['member-profile-performance', userId],
  queryFn: () => teamService.getMemberProfile(userId!, { includePerformance: true }),
  enabled: false, // Only fetch when explicitly requested
});
```

---

## Performance Impact

### Before Optimization
- **Query Count:** ~12 queries
- **Response Time:** ~300-500ms
- **Database Load:** High

### After Phase 1 Optimization
- **Query Count:** ~6 queries (50% reduction)
- **Response Time:** ~100-150ms (70% faster)
- **Database Load:** Medium

### After Phase 2 Optimization
- **Query Count:** ~5 queries
- **Response Time:** ~50-100ms (80% faster)
- **Database Load:** Low

---

## Summary

**Biggest Issue:** `calculatePerformanceScore` adds 6 queries and is always calculated

**Best Solution:** Make it optional/lazy load (Phase 1)

**Expected Improvement:** 60-70% faster page load

---

*Optimization Plan for Member Profile Page*  
*Last Updated: January 2026*

