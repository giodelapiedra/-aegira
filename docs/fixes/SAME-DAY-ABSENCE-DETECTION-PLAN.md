# Same-Day Absence Detection Plan

## Overview
Update the absence detection system to show the justification popup on the **same day** after shift ends, instead of waiting until the next day.

---

## Current System Assessment

### ✅ What's Already Working Well

| Aspect | Status | Notes |
|--------|--------|-------|
| On-demand detection | ✅ Excellent | No cron jobs, runs when worker opens app |
| No duplicates | ✅ Excellent | Checks `absenceDates.has(dateStr)` before creating |
| Holiday handling | ✅ Excellent | Auto-skip company holidays |
| Rest day handling | ✅ Excellent | Respects team work schedule |
| Exemption handling | ✅ Excellent | Auto-skip approved exemptions |
| Blocking popup | ✅ Excellent | Worker can't escape justification |
| Batch justify | ✅ Excellent | "Same reason for all" option |
| TL Review flow | ✅ Excellent | EXCUSED/UNEXCUSED decision |

### How Absences Accumulate (Current Behavior)

```
Example: Worker absent for 1 week, has holiday on Wed, rest days Sat-Sun

         Mon     Tue     Wed      Thu     Fri     Sat     Sun
         Jan 6   Jan 7   Jan 8    Jan 9   Jan 10  Jan 11  Jan 12
         ─────   ─────   ─────    ─────   ─────   ─────   ─────
Work Day? ✓       ✓       ✓        ✓       ✓       ✗       ✗
Holiday?  ✗       ✗       ✓        ✗       ✗       ✗       ✗
         ─────   ─────   ─────    ─────   ─────   ─────   ─────
Result:  ABSENT  ABSENT  SKIP     ABSENT  ABSENT  SKIP    SKIP
                         (holiday)                (rest)  (rest)

Total Absences: 4 (Mon, Tue, Thu, Fri)
NOT 7 - system is smart enough to skip holidays and rest days
```

### Skip Rules (Already Implemented)

| Day Type | Create Absence? | Code Location |
|----------|-----------------|---------------|
| Work day + No check-in + No exemption | ✅ YES | Line 148-157 |
| Work day + Has check-in | ❌ NO | Line 138 `checkinDates.has()` |
| Work day + Has exemption | ❌ NO | Line 140 `isDateExempted()` |
| Company Holiday | ❌ NO | Line 139 `holidayDates.has()` |
| Rest day (team schedule) | ❌ NO | Line 131-134 `!teamWorkDays.includes()` |
| Already has absence record | ❌ NO | Line 141 `absenceDates.has()` |

---

## Current Behavior

```
Timeline:
─────────────────────────────────────────────────────────────────
Day 1 (Monday)          │  Day 2 (Tuesday)
────────────────────────│────────────────────────────────────────
Shift: 8AM - 5PM        │  Worker opens app
Worker misses check-in  │  → detectAndCreateAbsences() runs
Nothing happens         │  → Creates Absence for Monday
                        │  → Popup appears asking for justification
```

**Problem:** Delayed feedback - worker has to wait until next day to justify.

---

## Proposed Behavior

```
Timeline:
─────────────────────────────────────────────────────────────────
Day 1 (Monday)
────────────────────────────────────────────────────────────────
Shift: 8AM - 5PM
Worker misses check-in
5:01 PM - Worker opens app
  → detectAndCreateAbsences() runs
  → Detects shift has ended + no check-in
  → Creates Absence for TODAY (Monday)
  → Popup appears immediately asking for justification
```

**Benefit:** Immediate feedback - worker can justify while memory is fresh.

---

## Files to Modify

### 1. Backend: `backend/src/utils/absence.ts`

**Function:** `detectAndCreateAbsences()`

**Current Logic (line 78-83):**
```typescript
// Only checks YESTERDAY and before
const nowInTz = getNowDT(tz);
const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');
// ...
while (current <= yesterdayInTz) { ... }
```

**New Logic:**
```typescript
// Check if TODAY's shift has ended
const nowInTz = getNowDT(tz);
const todayInTz = nowInTz.startOf('day');
const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');

// Get team shift end time
const [shiftEndHour, shiftEndMin] = user.team.shiftEnd.split(':').map(Number);
const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
const currentMinutes = nowInTz.hour * 60 + nowInTz.minute;

// Determine check-until date
// If shift ended today AND today is a work day, include today
const todayDayName = DAY_NAMES[getDayOfWeekInTimezone(todayInTz.toJSDate(), tz)];
const isTodayWorkDay = teamWorkDays.includes(todayDayName);
const shiftEndedToday = currentMinutes > shiftEndMinutes;

const checkUntilDate = (isTodayWorkDay && shiftEndedToday) ? todayInTz : yesterdayInTz;

// ...
while (current <= checkUntilDate) { ... }
```

### 2. Backend: `backend/src/modules/absences/index.ts`

**No changes needed** - the `/my-pending` endpoint already calls `detectAndCreateAbsences()`.

### 3. Frontend: No changes needed

**Files already correct:**
- `frontend/src/components/layout/AppLayout.tsx` - Already checks for pending absences on load
- `frontend/src/components/absences/AbsenceJustificationModal.tsx` - Already displays blocking modal

---

## Implementation Steps

### Step 1: Update `detectAndCreateAbsences()` function
- [ ] Add shift end time check
- [ ] Add today's work day check
- [ ] Update the loop condition to include today if shift ended
- [ ] Handle edge case: user on exemption today (should still skip)

### Step 2: Test Scenarios
- [ ] Test: Shift ended, no check-in → Should show popup today
- [ ] Test: Shift not ended yet, no check-in → Should NOT show popup yet
- [ ] Test: Shift ended, has check-in → Should NOT show popup
- [ ] Test: Shift ended, has exemption today → Should NOT show popup
- [ ] Test: Today is rest day → Should NOT create absence
- [ ] Test: Today is holiday → Should NOT create absence
- [ ] Test: Multiple missed days (yesterday + today after shift) → Should show all

### Step 3: Edge Cases to Handle
- [ ] User's team has no shift times set (fallback to default 8AM-5PM)
- [ ] User opened app exactly at shift end time (use > not >=)
- [ ] Timezone edge cases (ensure all comparisons use company timezone)

---

## Detailed Code Changes

### File: `backend/src/utils/absence.ts`

**Before (lines 35-163):**
```typescript
export async function detectAndCreateAbsences(
  userId: string,
  companyId: string,
  timezone: string = DEFAULT_TIMEZONE
) {
  // ... existing code ...

  // 4. Get yesterday in COMPANY TIMEZONE (not UTC!)
  const nowInTz = getNowDT(tz);
  const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');
  const baselineDateInTz = toDateTime(baselineDate, tz).startOf('day');

  // 5. If no gap, return early
  if (baselineDateInTz >= yesterdayInTz) return [];

  // ... rest of code checking until yesterdayInTz ...
}
```

**After:**
```typescript
export async function detectAndCreateAbsences(
  userId: string,
  companyId: string,
  timezone: string = DEFAULT_TIMEZONE
) {
  // ... existing code until step 3 ...

  // 4. Calculate check-until date (yesterday OR today if shift ended)
  const nowInTz = getNowDT(tz);
  const todayInTz = nowInTz.startOf('day');
  const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');
  const baselineDateInTz = toDateTime(baselineDate, tz).startOf('day');

  // Check if today's shift has ended
  const shiftEnd = user.team.shiftEnd || '17:00'; // Default 5 PM
  const [shiftEndHour, shiftEndMin] = shiftEnd.split(':').map(Number);
  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
  const currentMinutes = nowInTz.hour * 60 + nowInTz.minute;
  const shiftEndedToday = currentMinutes > shiftEndMinutes;

  // Check if today is a work day
  const todayDayName = DAY_NAMES[getDayOfWeekInTimezone(todayInTz.toJSDate(), tz)];
  const isTodayWorkDay = teamWorkDays.includes(todayDayName);

  // Determine the check-until date
  // Include today only if: it's a work day AND shift has ended
  const checkUntilDate = (isTodayWorkDay && shiftEndedToday) ? todayInTz : yesterdayInTz;

  // 5. If no gap, return early
  if (baselineDateInTz > checkUntilDate) return [];

  // ... rest of code, but change yesterdayInTz to checkUntilDate ...

  while (current <= checkUntilDate) {
    // ... existing loop logic ...
  }
}
```

---

## Testing Checklist

### Manual Testing

| # | Scenario | Expected Result | Status |
|---|----------|-----------------|--------|
| 1 | Worker opens app at 5:01 PM, no check-in today | Popup appears for today | [ ] |
| 2 | Worker opens app at 4:59 PM, no check-in today | NO popup (shift not ended) | [ ] |
| 3 | Worker opens app at 5:01 PM, already checked in | NO popup | [ ] |
| 4 | Worker opens app at 5:01 PM, has exemption today | NO popup | [ ] |
| 5 | Worker opens app on Saturday (rest day) | NO popup for Saturday | [ ] |
| 6 | Worker opens app on Holiday | NO popup for holiday | [ ] |
| 7 | Worker missed yesterday + today (after shift) | Popup shows BOTH days | [ ] |
| 8 | Worker's team shift is 6AM-2PM, opens at 3PM | Popup appears | [ ] |
| 9 | Worker's team has no shiftEnd set | Uses default 5PM | [ ] |

### Edge Cases

| # | Edge Case | Handling | Status |
|---|-----------|----------|--------|
| 1 | Team shiftEnd is null | Default to '17:00' | [ ] |
| 2 | Exact shift end time (5:00 PM) | Use `>` not `>=`, no popup yet | [ ] |
| 3 | Cross-timezone (UTC vs Asia/Manila) | All dates in company TZ | [ ] |
| 4 | New worker (joined today) | No absence for today | [ ] |
| 5 | Worker on exemption that starts today | Skip today | [ ] |

---

## Rollback Plan

If issues are found, revert to original behavior:
1. Change `checkUntilDate` back to always use `yesterdayInTz`
2. Or: Add feature flag to toggle same-day detection

---

## Timeline

- [ ] **Step 1:** Update `detectAndCreateAbsences()` - ~15 mins
- [ ] **Step 2:** Manual testing all scenarios - ~20 mins
- [ ] **Step 3:** Code review & cleanup - ~5 mins

---

## ADDITIONAL FIX: Auto-Cleanup Absences When Exemption Approved

### Problem Scenario

```
Timeline:
─────────────────────────────────────────────────────────────────
Jan 8 (Wed)             │  Jan 9 (Thu)
────────────────────────│───────────────────────────
Worker gets sick        │  Worker opens app
Doesn't check in        │  → Absence created (Jan 8)
No exemption yet        │  → Popup appears
                        │
                        │  Worker submits justification "sick"
                        │
                        │  LATER: TL creates exemption for Jan 8-9
                        │
                        │  PROBLEM: Absence record still exists!
```

### Solution

When TL approves an exemption, auto-delete or auto-update any overlapping absences.

### Files to Modify

**File:** `backend/src/modules/exemptions/index.ts`

**Location:** In the exemption approval endpoint (POST `/exemptions/:id/approve` or similar)

**Add this logic after exemption is approved:**
```typescript
// After exemption is approved, clean up any overlapping absences
if (exemption.status === 'APPROVED' && exemption.startDate && exemption.endDate) {
  // Find absences that fall within this exemption period
  const overlappingAbsences = await prisma.absence.findMany({
    where: {
      userId: exemption.userId,
      absenceDate: {
        gte: exemption.startDate,
        lte: exemption.endDate,
      },
      status: 'PENDING_JUSTIFICATION', // Only pending ones
    },
  });

  // Option A: Delete them (cleaner)
  if (overlappingAbsences.length > 0) {
    await prisma.absence.deleteMany({
      where: {
        id: { in: overlappingAbsences.map(a => a.id) },
      },
    });
  }

  // Option B: Update to EXCUSED (keeps record)
  // await prisma.absence.updateMany({
  //   where: { id: { in: overlappingAbsences.map(a => a.id) } },
  //   data: { status: 'EXCUSED', reviewedBy: userId, reviewedAt: new Date() },
  // });
}
```

### Implementation Steps for This Fix

- [ ] Find exemption approval endpoint
- [ ] Add auto-cleanup logic after approval
- [ ] Test: Create absence, then approve exemption → absence should be deleted
- [ ] Test: Exemption approved first, then check → no absence created (existing logic)

---

## Summary of ALL Changes

| # | Change | File | Purpose |
|---|--------|------|---------|
| 1 | Same-day detection | `backend/src/utils/absence.ts` | Show popup same day after shift ends |
| 2 | Auto-cleanup absences | `backend/src/modules/exemptions/index.ts` | Delete absences when exemption approved |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ABSENCE DETECTION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Worker Opens App                                                   │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  detectAndCreateAbsences()          │                            │
│  │  Check: baseline → checkUntilDate   │                            │
│  └─────────────────────────────────────┘                            │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  For each date in range:            │                            │
│  │  ├─ Has check-in? → SKIP            │                            │
│  │  ├─ Has exemption? → SKIP           │  ← Existing logic          │
│  │  ├─ Is holiday? → SKIP              │                            │
│  │  ├─ Is rest day? → SKIP             │                            │
│  │  ├─ Already has absence? → SKIP     │                            │
│  │  └─ Otherwise → CREATE Absence      │                            │
│  └─────────────────────────────────────┘                            │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  Has pending absences?              │                            │
│  │  YES → Show AbsenceJustificationModal│                            │
│  │  NO  → Continue to app              │                            │
│  └─────────────────────────────────────┘                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        EXEMPTION APPROVAL FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TL Approves Exemption (Jan 8-9)                                    │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  Update exemption status: APPROVED  │                            │
│  └─────────────────────────────────────┘                            │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  Find absences within Jan 8-9       │  ← NEW: Auto-cleanup       │
│  │  that are PENDING_JUSTIFICATION     │                            │
│  └─────────────────────────────────────┘                            │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                            │
│  │  Delete overlapping absences        │  ← NEW: Auto-cleanup       │
│  │  (or mark as EXCUSED)               │                            │
│  └─────────────────────────────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Notes

- This change affects **ALL workers** in the system
- No database migration needed
- No frontend changes needed
- Backward compatible (just extends detection window)

---

## Edge Cases to Consider

### 1. Worker Doesn't Submit Justification (Ignores Popup)

```
Scenario: Worker closes app without submitting justification

Day 1 (Monday) - 5:01 PM:
├─► Worker opens app, no check-in
├─► Absence #1 created (Monday)
├─► Popup appears: "1 absence to justify"
└─► Worker CLOSES APP without submitting

Day 2 (Tuesday) - 5:01 PM:
├─► Worker opens app, no check-in again
├─► Check Monday: Has absence? YES → SKIP (no duplicate)
├─► Check Tuesday: Has absence? NO → CREATE Absence #2
├─► Now: 2 absences in database
└─► Popup: "2 absences to justify" (Mon + Tue)

Day 3 (Wednesday) - 5:01 PM:
├─► Worker opens app, no check-in again
├─► Monday: Has absence → SKIP
├─► Tuesday: Has absence → SKIP
├─► Wednesday: No absence → CREATE Absence #3
└─► Popup: "3 absences to justify" (Mon + Tue + Wed)

Result: Absences accumulate until worker submits ALL justifications
```

### 2. Exemption Approved BEFORE Absence Detection

```
Scenario: TL approves leave in advance

Jan 7 - TL approves exemption for Jan 8-9
Jan 8 - Worker doesn't check in (on leave)
Jan 9 - Worker doesn't check in (on leave)
Jan 10 - Worker opens app
  ├─► Check Jan 8: Has exemption? YES → SKIP
  ├─► Check Jan 9: Has exemption? YES → SKIP
  └─► No absences created → No popup

Result: ✅ Already handled correctly by existing code
```

### 3. Absence Created BEFORE Exemption Approved (GAP - Need Fix)

```
Scenario: Worker gets sick, absence created, THEN TL creates exemption

Jan 8 - Worker doesn't check in (sick)
Jan 8, 5:01 PM - Worker opens app
  └─► Absence #1 created for Jan 8

Jan 9 - TL creates and approves exemption for Jan 8-9
  └─► PROBLEM: Absence #1 still exists!

Result: ❌ Need to add auto-cleanup when exemption approved
```

### 4. Worker Transferred to Different Team

```
Scenario: Worker changes teams mid-period

Jan 6-8 - Worker in Team A (Mon-Fri schedule), didn't check in
Jan 9 - Worker transferred to Team B (Mon-Wed-Fri schedule)
Jan 10 - Worker opens app

Current behavior: Uses CURRENT team schedule (Team B)
- If Jan 7 (Tuesday) was work day in Team A but rest day in Team B
- System uses current team schedule

Decision: ✅ This is acceptable - use current team schedule
```

### 5. TL Never Reviews Justified Absence

```
Scenario: Worker submits justification, TL forgets to review

Jan 8 - Worker submits justification
Jan 9, 10, 11... - TL never reviews
Absence stays in PENDING_JUSTIFICATION with justifiedAt set

Current: No timeout or escalation
Future consideration: Add reminder notification to TL after X days
```

### 6. Grade Calculation with Absences

```
Absence Status → Grade Impact:

| Status | Justified? | Reviewed? | Grade Impact |
|--------|------------|-----------|--------------|
| PENDING_JUSTIFICATION | NO | NO | 0 points (ABSENT) |
| PENDING_JUSTIFICATION | YES | NO | 0 points until reviewed |
| EXCUSED | YES | YES | EXCLUDED (not counted) |
| UNEXCUSED | YES | YES | 0 points |

Important: Make sure grade calculation respects these rules
```

---

## Complete System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE ABSENCE SYSTEM FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   WORKER    │    │   SYSTEM    │    │     TL      │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         │  Opens app       │                  │                         │
│         │─────────────────►│                  │                         │
│         │                  │                  │                         │
│         │                  │ detectAndCreate  │                         │
│         │                  │ Absences()       │                         │
│         │                  │                  │                         │
│         │                  │ Check each day:  │                         │
│         │                  │ ├─ Has check-in? SKIP                      │
│         │                  │ ├─ Holiday? SKIP │                         │
│         │                  │ ├─ Rest day? SKIP│                         │
│         │                  │ ├─ Exemption? SKIP                         │
│         │                  │ ├─ Has absence? SKIP                       │
│         │                  │ └─ Otherwise: CREATE                       │
│         │                  │                  │                         │
│         │◄─────────────────│                  │                         │
│         │  Show popup      │                  │                         │
│         │  (if any)        │                  │                         │
│         │                  │                  │                         │
│         │  Submit          │                  │                         │
│         │  justification   │                  │                         │
│         │─────────────────►│                  │                         │
│         │                  │                  │                         │
│         │                  │  Notify TL       │                         │
│         │                  │─────────────────►│                         │
│         │                  │                  │                         │
│         │                  │                  │ Review                  │
│         │                  │                  │ (EXCUSED/UNEXCUSED)     │
│         │                  │◄─────────────────│                         │
│         │                  │                  │                         │
│         │◄─────────────────│  Notify worker   │                         │
│         │                  │                  │                         │
│         │                  │  Update grades   │                         │
│         │                  │                  │                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    EXEMPTION APPROVAL FLOW (NEW)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TL Approves Exemption (Jan 8-9)                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────┐                                │
│  │  Update exemption status: APPROVED  │                                │
│  └─────────────────────────────────────┘                                │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────┐                                │
│  │  NEW: Auto-cleanup overlapping      │                                │
│  │  absences (PENDING_JUSTIFICATION)   │                                │
│  │  for Jan 8-9                        │                                │
│  └─────────────────────────────────────┘                                │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────┐                                │
│  │  Worker opens app → No popup        │                                │
│  │  (absences were deleted/cleaned)    │                                │
│  └─────────────────────────────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary of ALL Changes to Implement

| # | Change | File | Purpose | Priority |
|---|--------|------|---------|----------|
| 1 | Same-day detection | `backend/src/utils/absence.ts` | Show popup same day after shift ends | HIGH |
| 2 | Auto-cleanup absences | `backend/src/modules/exemptions/index.ts` | Delete absences when exemption approved | HIGH |

---

## Final System Rating

| Category | Rating | Comment |
|----------|--------|---------|
| **Logic** | ⭐⭐⭐⭐⭐ | Solid, covers all cases |
| **Accuracy** | ⭐⭐⭐⭐⭐ | Correct handling of holidays, rest days, exemptions |
| **UX** | ⭐⭐⭐⭐ | Good, will be better with same-day detection |
| **Data Integrity** | ⭐⭐⭐⭐ | Good, will be better with auto-cleanup |
| **Scalability** | ⭐⭐⭐⭐⭐ | On-demand, no cron jobs needed |

---

## Status

| Phase | Status | Date |
|-------|--------|------|
| Planning | COMPLETED | 2026-01-13 |
| Implementation | PENDING | - |
| Testing | PENDING | - |
| Deployed | PENDING | - |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-13 | Initial plan created |
| 2026-01-13 | Added current system assessment |
| 2026-01-13 | Added edge cases documentation |
| 2026-01-13 | Added auto-cleanup for exemption approval |
| 2026-01-13 | Added complete flow diagrams |
