# Remove Late/YELLOW Attendance Logic

## Goal
Simplify attendance - basta naka-check-in within team shift hours = GREEN.

---

## Key Insight

**TWO SEPARATE SYSTEMS:**

| System | Data | YELLOW meaning | Change? |
|--------|------|----------------|---------|
| **Readiness** | mood, stress, sleep, physical | Caution (score 40-69) | ❌ NO |
| **Attendance** | check-in time | Late arrival | ✅ REMOVE |

**Metrics (yellowCount, redCount) = Readiness = NOT AFFECTED**

---

## New Logic

```
OLD:
├── Check in within grace period → GREEN (100)
├── Check in after grace period  → YELLOW (75)  ← REMOVE
└── No check in                  → ABSENT (0)

NEW:
├── Check in within shift hours  → GREEN (100)
└── No check in                  → ABSENT (0)
```

---

## Files to Change (3 Core Files)

### 1. `backend/src/utils/attendance.ts`

**Change `calculateAttendanceStatus()` function:**

```typescript
// OLD (~line 88-122)
export function calculateAttendanceStatus(
  checkInTime: Date,
  scheduledStart: string,
  gracePeriodMins: number = 15,
  timezone: string = DEFAULT_TIMEZONE
): AttendanceResult {
  const [schedHour, schedMin] = scheduledStart.split(':').map(Number);
  const scheduledMinutes = schedHour * 60 + schedMin;
  const graceEndMinutes = scheduledMinutes + gracePeriodMins;

  const { hour: checkInHour, minute: checkInMin } = getTimeInTimezone(checkInTime, timezone);
  const checkInMinutes = checkInHour * 60 + checkInMin;

  const minutesLate = Math.max(0, checkInMinutes - graceEndMinutes);

  if (checkInMinutes <= graceEndMinutes) {
    return {
      status: 'GREEN',
      score: ATTENDANCE_SCORES.GREEN,
      isCounted: true,
      minutesLate: 0,
    };
  }

  return {
    status: 'YELLOW',
    score: ATTENDANCE_SCORES.YELLOW,
    isCounted: true,
    minutesLate,
  };
}
```

```typescript
// NEW - Simplified
export function calculateAttendanceStatus(
  checkInTime: Date,
  shiftStart: string,
  shiftEnd: string,
  timezone: string = DEFAULT_TIMEZONE
): AttendanceResult {
  // If they're checking in, they're within shift (validation already blocks outside)
  // Always GREEN - no more late penalty
  return {
    status: 'GREEN',
    score: ATTENDANCE_SCORES.GREEN,
    isCounted: true,
    minutesLate: 0, // Deprecated, kept for compatibility
  };
}
```

**Also update ATTENDANCE_SCORES:**
```typescript
// OLD
export const ATTENDANCE_SCORES = {
  GREEN: 100,
  YELLOW: 75,  // ← REMOVE or keep but unused
  ABSENT: 0,
  EXCUSED: null,
} as const;

// NEW
export const ATTENDANCE_SCORES = {
  GREEN: 100,
  // YELLOW removed - no more late penalty
  ABSENT: 0,
  EXCUSED: null,
} as const;
```

---

### 2. `backend/src/modules/checkins/index.ts`

**Change 1: Line ~383 - Update function call:**
```typescript
// OLD
const attendanceResult = calculateAttendanceStatus(now, team.shiftStart, GRACE_PERIOD_MINUTES, timezone);

// NEW
const attendanceResult = calculateAttendanceStatus(now, team.shiftStart, team.shiftEnd, timezone);
```

**Change 2: Line ~504 - Remove "mins late" from system log:**
```typescript
// OLD
description: `${user.firstName} ${user.lastName} submitted daily check-in (Readiness: ${status}, Attendance: ${attendanceResult.status}${attendanceResult.minutesLate > 0 ? `, ${attendanceResult.minutesLate} mins late` : ''})${isReturning ? ' - returning from leave' : ''}`,

// NEW
description: `${user.firstName} ${user.lastName} submitted daily check-in (Readiness: ${status}, Attendance: ${attendanceResult.status})${isReturning ? ' - returning from leave' : ''}`,
```

**Note:** Keep `GRACE_PERIOD_MINUTES` - still used for allowing early check-in before shift starts.

---

### 3. `frontend/src/pages/worker/checkin/components/CheckinForm.tsx`

**Change: Line ~57 - Remove "mins late" display:**
```typescript
// OLD
? ` | Attendance: ${data.attendance.status}${data.attendance.minutesLate > 0 ? ` (${data.attendance.minutesLate} mins late)` : ''}`

// NEW
? ` | Attendance: ${data.attendance.status}`
```

---

## Optional Changes (Low Priority)

| File | Change | Priority |
|------|--------|----------|
| `checkin.service.ts` | Remove YELLOW from type | Optional |
| `schema.prisma` | Update comment | Optional |
| `seed.ts` files | Remove late logic | Optional |
| `date-helpers.ts` | Remove `calculateMinutesLate()` | Optional |

---

## What NOT to Change

| Item | Reason |
|------|--------|
| `DailyAttendance.minutesLate` field | Keep in DB, just ignore |
| `DailyAttendance.gracePeriodMins` field | Keep in DB, just ignore |
| `AttendanceStatus.YELLOW` enum | Keep for existing data compatibility |
| Readiness YELLOW | Different system, untouched |
| `yellowCount` in analytics | Readiness data, untouched |
| Performance score calculation | Already handles GREEN/ABSENT correctly |
| Attendance history display | Will show existing YELLOWs, new ones all GREEN |

---

## Validation Still Works

```
Check-in Window Validation (UNCHANGED):
├── Before (shiftStart - 15 mins) → BLOCKED "Not yet available"
├── Within shift hours            → ALLOWED → GREEN
└── After shiftEnd                → BLOCKED "Shift has ended"
```

The existing validation in `checkins/index.ts` (~line 330-345) already blocks check-ins outside shift window. We're just removing the YELLOW penalty for "late but within shift" check-ins.

---

## Testing Checklist

- [ ] Check in at shift start (8:00) → GREEN
- [ ] Check in mid-shift (12:00) → GREEN
- [ ] Check in near shift end (16:59) → GREEN
- [ ] Check in before window → Blocked (existing validation)
- [ ] Check in after shift → Blocked (existing validation)
- [ ] Old YELLOW records still display in history
- [ ] Readiness metrics unchanged (yellowCount still works)

---

## Summary

**3 files, ~15 lines changed:**

1. `attendance.ts` - Simplify to always return GREEN
2. `checkins/index.ts` - Update function call + remove log text
3. `CheckinForm.tsx` - Remove "mins late" display

**Zero impact on:**
- Wellness/Readiness metrics
- Analytics dashboards
- Performance scores
- Database schema
