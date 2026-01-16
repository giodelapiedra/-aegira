# Company Timezone Optimization

> **Problem:** Company timezone is queried from database EVERY TIME per endpoint/tab  
> **Solution:** Fetch once in auth middleware, store in context, use everywhere

---

## Current Problem

### What's Happening Now:
```typescript
// EVERY endpoint calls this (queries DB every time!)
const timezone = await getCompanyTimezone(companyId);

// Inside getCompanyTimezone:
async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || DEFAULT_TIMEZONE;
}
```

**Impact:**
- ❌ Queries database EVERY request
- ❌ ~40+ calls per page load (if multiple tabs/endpoints)
- ❌ Adds 10-30ms latency per query
- ❌ Wastes database connections

---

## Solution: Add Timezone to Context

### Step 1: Update Context Type

```typescript
// backend/src/types/context.ts
export interface AppContext {
  Variables: {
    user: AuthUser;
    userId: string;
    companyId: string;
    timezone: string; // ✅ ADD THIS
  };
}
```

### Step 2: Fetch Timezone in Auth Middleware

```typescript
// backend/src/middlewares/auth.middleware.ts

export async function authMiddleware(c: Context, next: Next) {
  // ... existing code ...

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      companyId: true,
      teamId: true,
      isActive: true,
      // ✅ ADD: Include company timezone in user query
      company: {
        select: {
          timezone: true,
        },
      },
    },
  });

  if (!user) {
    return c.json({ error: 'Unauthorized: User not found' }, 401);
  }

  if (!user.isActive) {
    return c.json({ error: 'Unauthorized: Account is deactivated' }, 401);
  }

  // ✅ Get timezone from company (fetched above, no extra query!)
  const timezone = user.company?.timezone || DEFAULT_TIMEZONE;

  c.set('user', user);
  c.set('userId', user.id);
  c.set('companyId', user.companyId);
  c.set('timezone', timezone); // ✅ ADD THIS - Available everywhere!

  await next();
}
```

### Step 3: Update All getCompanyTimezone Calls

**Option A: Use Context Directly (Best)**
```typescript
// OLD (queries DB):
const timezone = await getCompanyTimezone(companyId);

// NEW (from context, no query!):
const timezone = c.get('timezone');
```

**Option B: Create Helper That Uses Context**
```typescript
// backend/src/utils/timezone.ts
import type { AppContext } from '../types/context.js';
import { DEFAULT_TIMEZONE } from './date-helpers.js';

export function getTimezoneFromContext(c: AppContext): string {
  return c.get('timezone') || DEFAULT_TIMEZONE;
}
```

---

## Implementation Plan

### Phase 1: Add to Context (Do First)
1. ✅ Update `AppContext` type to include `timezone`
2. ✅ Update `auth.middleware.ts` to fetch and set timezone
3. ✅ Test that timezone is available in all endpoints

### Phase 2: Update All Endpoints (Gradual)
4. ⚠️ Replace `await getCompanyTimezone(companyId)` with `c.get('timezone')`
5. ⚠️ Remove duplicate `getCompanyTimezone` functions from modules
6. ⚠️ Keep one shared function for edge cases (if needed)

---

## Files to Update

### Critical (Must Update)
1. `backend/src/types/context.ts` - Add timezone to interface
2. `backend/src/middlewares/auth.middleware.ts` - Fetch and set timezone

### High Priority (Update Gradually)
3. `backend/src/modules/teams/index.ts` - ~10 calls
4. `backend/src/modules/daily-monitoring/index.ts` - ~7 calls
5. `backend/src/modules/analytics/index.ts` - ~8 calls
6. `backend/src/modules/checkins/index.ts` - ~5 calls
7. Other modules - ~20+ calls total

---

## Benefits

### Before Optimization
- **Queries per page load:** 40+ timezone queries
- **Latency added:** 400-1200ms total
- **Database load:** High

### After Optimization
- **Queries per page load:** 1 timezone query (in auth middleware)
- **Latency added:** 10-30ms (one-time)
- **Database load:** Low

**Expected Improvement:** 95%+ reduction in timezone queries!

---

## Edge Cases

### What if timezone changes?
- ✅ Timezone is fetched fresh on every login (auth middleware runs every request)
- ✅ If admin changes timezone, next request will use new timezone
- ✅ No stale data issues

### What if company doesn't have timezone?
- ✅ Falls back to `DEFAULT_TIMEZONE` ('Asia/Manila')
- ✅ Same behavior as before

---

## Code Example

### Before (Current):
```typescript
// backend/src/modules/teams/index.ts:1104
teamsRoutes.get('/members/:userId/profile', async (c) => {
  const companyId = c.get('companyId');
  
  // ❌ Queries DB every time
  const timezone = await getCompanyTimezone(companyId);
  
  // ... rest of code
});
```

### After (Optimized):
```typescript
// backend/src/modules/teams/index.ts:1104
teamsRoutes.get('/members/:userId/profile', async (c) => {
  // ✅ From context, no query!
  const timezone = c.get('timezone');
  
  // ... rest of code
});
```

---

## Migration Strategy

### Step 1: Add to Context (Non-Breaking)
- Add timezone to context
- Keep old `getCompanyTimezone` functions (backward compatible)
- Test that everything still works

### Step 2: Gradual Migration
- Update endpoints one module at a time
- Test each module after update
- Remove old functions when all updated

### Step 3: Cleanup
- Remove all `getCompanyTimezone` helper functions
- Keep one shared utility if needed for edge cases

---

## Testing Checklist

- [ ] Timezone is available in context after login
- [ ] All endpoints can access `c.get('timezone')`
- [ ] Default timezone works if company has no timezone
- [ ] Timezone updates when admin changes it (next request)
- [ ] No performance regression

---

*Timezone Optimization Plan*  
*Last Updated: January 2026*

