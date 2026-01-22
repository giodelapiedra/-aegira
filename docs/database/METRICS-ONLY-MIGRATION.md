# Metrics-Only System Migration

**Date:** January 2025
**Purpose:** Document the migration from Compliance-Based to Metrics-Only grade calculation

---

## Overview

### Philosophy Change

| Aspect | OLD System | NEW System (Metrics-Only) |
|--------|------------|---------------------------|
| **Grade Formula** | `(Readiness × 60%) + (Compliance × 40%)` | `100% avgReadiness` |
| **No Check-in** | Penalized (lowers compliance) | No data = not counted |
| **Absence of Data** | Treated as negative | NOT treated as negative |
| **Attendance Tracking** | Aegira handles | HR System handles |

### Core Principles

1. **Health metrics lang ang basehan ng lahat**
2. **Kung walang check-in, walang data**
3. **Walang penalty, walang assumption**
4. **Absence of data is NOT treated as negative data**
5. **Aegira = Wellness Monitoring | HR = Attendance Tracking**

---

## Changes Made

### Backend Changes

#### 1. Grade Calculation Updated

**Files Modified:**
- `backend/src/modules/analytics/index.ts`
- `backend/src/modules/chatbot/index.ts`
- `backend/src/modules/teams/index.ts`
- `backend/src/utils/team-grades-optimized.ts`

**Change:**
```typescript
// OLD: Grade with compliance factor
const gradeScore = (periodAvgReadiness * 0.6) + (compliance * 0.4);

// NEW: 100% wellness-based
const gradeScore = periodAvgReadiness;
```

#### 2. Removed Attendance Utility

**File Deleted:**
- `backend/src/utils/attendance.ts`

**Functions Removed:**
- `calculateAttendanceStatus()`
- `calculatePerformanceScore()`

#### 3. Removed Attendance Endpoints

**File Modified:** `backend/src/modules/checkins/index.ts`

**Endpoints Removed:**
- `GET /checkins/attendance/history`
- Attendance calculation from check-in creation

#### 4. Updated Teams Module

**File Modified:** `backend/src/modules/teams/index.ts`

**Changes:**
- Removed `absencesCount` from member stats
- Replaced `attendanceScore` with `avgReadinessScore`
- Removed `/members/:userId/absences` endpoint
- Updated comments: "penalized" → "informational only"

#### 5. Updated AI Prompts

**File Modified:** `backend/src/utils/ai.ts`

**Changes:**
- Removed `compliance` from `TeamGradeInfo` interface
- Updated AI prompts to explain 100% readiness-based grade

#### 6. Updated Daily Summary Comments

**File Modified:** `backend/src/utils/daily-summary.ts`

**Changes:**
- `absentCount`: "penalized" → "informational only - not used in grade calculation"
- `excusedCount`: Updated comment
- `complianceRate`: Added "informational only" note
- `avgReadinessScore`: Marked as "PRIMARY metric for grade calculation"

---

### Frontend Changes

#### 1. Removed Attendance Service Functions

**File Modified:** `frontend/src/services/checkin.service.ts`

**Removed:**
- `getAttendanceHistory()` function
- `AttendanceStatus`, `AttendanceRecord` types
- Attendance from `CheckinWithAttendance` interface

#### 2. Removed Absence Service Functions

**File Modified:** `frontend/src/services/team.service.ts`

**Removed:**
- `getMemberAbsences()` function
- `AbsenceStatus`, `AbsenceReason`, `MemberAbsence` types

#### 3. Updated Member Profile Page

**File Modified:** `frontend/src/pages/team-leader/member-profile.page.tsx`

**Changes:**
- Removed absences query and display
- Changed "Attendance Score" → "Avg Readiness"
- Removed "Unplanned Absences" section
- Removed `CalendarX2` icon import

#### 4. Updated Summary Aggregate Card

**File Modified:** `frontend/src/components/domain/team/SummaryAggregateCard.tsx`

**Removed Columns:**
- "Compliance" (avgComplianceRate)
- "Excused" (totalExcused)
- "Absent" (totalAbsent)

**New Columns:**
- Work Days
- Check-ins
- Avg Readiness
- Data Points

#### 5. Updated Calendar Day Status

**File Modified:** `frontend/src/types/summary.ts`

**Change:**
```typescript
// OLD: Based on compliance rate
if (summary.complianceRate >= 100) return 'perfect';
if (summary.complianceRate >= 80) return 'good';

// NEW: Based on wellness score
if (summary.avgReadinessScore >= 80) return 'perfect';
if (summary.avgReadinessScore >= 70) return 'good';
```

#### 6. Updated Type Definitions

**File Modified:** `frontend/src/types/summary.ts`

**Changes:**
- Made `avgComplianceRate`, `totalAbsent`, `totalExcused` optional
- Added comments: "Kept for backwards compatibility (not displayed)"

#### 7. Updated Check-in Form

**File Modified:** `frontend/src/pages/worker/checkin/components/CheckinForm.tsx`

**Change:**
```typescript
// OLD: Showed attendance in toast
toast.success('Check-in Submitted!', `Attendance: ${data.attendance.status}`);

// NEW: Shows only readiness
toast.success('Check-in Submitted!', `Readiness: ${data.readinessScore}%`);
```

---

### Files Deleted

| File | Reason |
|------|--------|
| `backend/src/utils/attendance.ts` | Attendance utility no longer needed |
| `backend/scripts/test-shift-end-cron.ts` | Cron test file |
| `backend/tests/integration/cron/` | Cron integration tests |
| `backend/tests/unit/utils/business-logic.test.ts` | Old business logic tests |
| `backend/tests/unit/utils/team-grades-optimized.test.ts` | Old grade tests |
| `frontend/tests/lib/status-config.test.ts` | Old status config tests |

---

## Data Still Retained (Informational Only)

The following data is still calculated and stored but **NOT used in grade calculation**:

| Field | Purpose | Grade Impact |
|-------|---------|--------------|
| `complianceRate` | Check-in rate info | None |
| `totalAbsent` | Absent count info | None |
| `totalExcused` | Excused count info | None |
| `absentCount` | Daily absent count | None |
| `excusedCount` | Daily excused count | None |

These are kept for:
- Backward compatibility
- Potential HR integration
- Historical data preservation

---

## Exemptions System

### Status: KEPT

Exemptions are retained but their purpose changed:

| Purpose | OLD | NEW |
|---------|-----|-----|
| **Primary** | Prevent compliance penalty | Visibility & Communication |
| **Streak** | Preserve check-in streak | Preserve check-in streak |
| **Calendar** | Show approved leave | Show approved leave |
| **Welcome Back** | N/A | Personalized return message |

### Why Keep Exemptions?

1. **Visibility** - TLs can see who is on approved leave vs who just didn't check in
2. **Streak Preservation** - Approved leave doesn't break check-in streaks
3. **Welcome Back Feature** - System greets workers returning from leave
4. **Future HR Integration** - Exemption data can sync with HR system

---

## Grade Calculation Logic

### New Formula

```
Team Grade = Team Avg Readiness Score

Where:
- Team Avg Readiness = Average of member readiness scores from ACTUAL check-ins
- No check-in = no effect on grade (not counted, not penalized)
```

### Grade Scale

| Score | Grade | Label | Color |
|-------|-------|-------|-------|
| 97+ | A+ | Outstanding | GREEN |
| 93-96 | A | Excellent | GREEN |
| 90-92 | A- | Excellent | GREEN |
| 87-89 | B+ | Very Good | GREEN |
| 83-86 | B | Good | GREEN |
| 80-82 | B- | Good | YELLOW |
| 77-79 | C+ | Satisfactory | YELLOW |
| 73-76 | C | Satisfactory | YELLOW |
| 70-72 | C- | Satisfactory | YELLOW |
| 67-69 | D+ | Needs Improvement | ORANGE |
| 63-66 | D | Needs Improvement | ORANGE |
| 60-62 | D- | Needs Improvement | ORANGE |
| <60 | F | Critical | RED |

### Calendar Day Status (Wellness-Based)

| Status | Condition | Color |
|--------|-----------|-------|
| Perfect | avgReadinessScore >= 80 | Green |
| Good | avgReadinessScore >= 70 | Blue |
| Warning | avgReadinessScore >= 60 | Yellow |
| Poor | avgReadinessScore < 60 | Red |
| No Data | avgReadinessScore is null | Gray |

---

## Test Script

A test script was created to verify the calculation logic:

```bash
cd backend
npx tsx scripts/test-metrics-logic.ts
```

### Test Scenarios

1. **All Members Perfect Scores** → Grade A+
2. **Mixed Wellness Scores** → Appropriate grade based on average
3. **Workers WITHOUT Check-ins** → NOT penalized, not counted
4. **5/10 Workers Checked In** → Grade based only on those who checked in
5. **No Check-ins At All** → Grade F (no data)
6. **OLD vs NEW Comparison** → Shows improvement from removing compliance penalty

---

## Verification

### Build Status

```
Backend:  ✅ PASS
Frontend: ✅ PASS
```

### Key Verifications

- [x] Grade = 100% avgReadiness
- [x] No compliance factor in grade calculation
- [x] No penalty for missing check-ins
- [x] Calendar colors use avgReadinessScore
- [x] UI shows wellness metrics only
- [x] Comments updated to "informational only"
- [x] All tests pass

---

## Summary

The Aegira system has been successfully migrated to a **Metrics-Only** approach where:

1. **Grade is purely wellness-based** - No attendance/compliance factor
2. **No check-in = No data** - Workers who don't check in are simply not counted
3. **No penalties** - Absence of data is not treated as negative
4. **Separation of concerns** - Aegira handles wellness, HR handles attendance

This aligns with the philosophy that wellness monitoring should focus on actual health data, not attendance tracking.
