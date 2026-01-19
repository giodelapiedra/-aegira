# Aegira System Flow Chart - Complete Documentation

> Complete system flow chart para sa Aegira Attendance & Wellness Management System

**Last Updated:** January 2026
**Version:** 3.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Worker Check-in Flow](#2-worker-check-in-flow)
3. [Attendance & Scoring System](#3-attendance--scoring-system)
4. [Cron Jobs - Automated Processing](#4-cron-jobs---automated-processing)
5. [Absence Justification Flow](#5-absence-justification-flow)
6. [Exception/Leave Request Flow](#6-exceptionleave-request-flow)
7. [Team Lead Daily Monitoring](#7-team-lead-daily-monitoring)
8. [Performance Score Calculation](#8-performance-score-calculation)
9. [Complete Daily Timeline](#9-complete-daily-timeline)

---

## 1. System Overview

### 1.1 Core Concepts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AEGIRA CORE CONCEPTS                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CHECK-IN (Wellness)           │  ATTENDANCE (Presence)                     │
│  ────────────────────────────  │  ────────────────────────────────────────  │
│  • Mood (1-10)                 │  • GREEN = Checked in (100 pts)            │
│  • Stress (1-10, inverted)     │  • ABSENT = No check-in (0 pts)            │
│  • Sleep (1-10)                │  • EXCUSED = On approved leave (not counted)│
│  • Physical (1-10)             │                                            │
│                                │                                            │
│  Readiness Score:              │  NO LATE PENALTY!                          │
│  • GREEN ≥ 70%                 │  Basta within shift = GREEN                │
│  • CAUTION 40-69%              │                                            │
│  • RED < 40%                   │                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ROLE HIERARCHY                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    ADMIN (Level 6) ─────────────────────────────────────────────────────────┐
    │   System-wide access                                                    │
    │                                                                         │
    EXECUTIVE (Level 5) ─────────────────────────────────────────────────────┤
    │   Company-wide control                                                  │
    │   • User management                                                     │
    │   • Team management                                                     │
    │   • Company settings                                                    │
    │                                                                         │
    SUPERVISOR (Level 4) ────────────────────────────────────────────────────┤
    │   View all teams                                                        │
    │   • Cross-team analytics                                                │
    │                                                                         │
    TEAM_LEAD (Level 3) ─────────────────────────────────────────────────────┤
    │   Own team only                                                         │
    │   • Daily monitoring                                                    │
    │   • Approve leave/absences                                              │
    │   • AI insights                                                         │
    │                                                                         │
    WORKER/MEMBER (Level 2) ─────────────────────────────────────────────────┘
        Own data only
        • Daily check-in
        • Request leave
        • Justify absences
```

---

## 2. Worker Check-in Flow

### 2.1 Check-in Eligibility Validation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKER OPENS APP - CHECK-IN PAGE                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                    ELIGIBILITY CHECKS                              │
        │  ──────────────────────────────────────────────────────────────── │
        │  1. Role = WORKER or MEMBER?                                       │
        │  2. Has team assigned?                                             │
        │  3. Today is a work day? (based on team schedule)                  │
        │  4. Not a company holiday?                                         │
        │  5. Not on approved leave?                                         │
        │  6. Within shift window? (shiftStart - 15min → shiftEnd)          │
        │  7. Not already checked in today?                                  │
        └───────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐        ┌───────────────┐           ┌───────────────┐
│  ON_LEAVE     │        │  ELIGIBLE     │           │  BLOCKED      │
│               │        │               │           │               │
│  "You are on  │        │  Show check-  │           │  TOO_EARLY    │
│  approved     │        │  in form      │           │  TOO_LATE     │
│  sick leave"  │        │               │           │  HOLIDAY      │
│               │        │               │           │  NOT_WORK_DAY │
│  ✓ No action  │        │  ┌─────────┐  │           │  ALREADY_IN   │
│    needed     │        │  │ SUBMIT  │  │           │  NO_TEAM      │
└───────────────┘        │  └─────────┘  │           └───────────────┘
                         └───────┬───────┘
                                 │
                                 ▼
```

### 2.2 Check-in Form Submission

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHECK-IN FORM                                       │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  How are you feeling today?                                          │
    │                                                                      │
    │  Mood:        [1]────────────────────[10]     (Higher = Better)     │
    │  Stress:      [1]────────────────────[10]     (Higher = More Stress)│
    │  Sleep:       [1]────────────────────[10]     (Higher = Better)     │
    │  Physical:    [1]────────────────────[10]     (Higher = Better)     │
    │                                                                      │
    │  Notes:       [________________________________]  (Optional)         │
    │                                                                      │
    │                     [ SUBMIT CHECK-IN ]                              │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  1. RE-VALIDATE eligibility (security - don't trust frontend)              │
│                                                                             │
│  2. CALCULATE Readiness Score:                                              │
│     ┌─────────────────────────────────────────────────────────────────┐   │
│     │  invertedStress = 11 - stress                                    │   │
│     │  rawScore = (mood + invertedStress + sleep + physical) / 4      │   │
│     │  readinessScore = rawScore × 10                                  │   │
│     │                                                                  │   │
│     │  Example: mood=7, stress=3, sleep=8, physical=7                  │   │
│     │           invStress = 11-3 = 8                                   │   │
│     │           raw = (7+8+8+7)/4 = 7.5                                │   │
│     │           score = 7.5 × 10 = 75%                                 │   │
│     └─────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3. DETERMINE Readiness Status:                                            │
│     • score ≥ 70  →  GREEN (Ready for Duty)                               │
│     • score 40-69 →  YELLOW (Caution)                                     │
│     • score < 40  →  RED (Not Ready)                                      │
│                                                                             │
│  4. CALCULATE Attendance Status:                                           │
│     • Within shift hours = GREEN (100 pts)                                 │
│     • NO LATE PENALTY - basta nag-check-in = GREEN                        │
│                                                                             │
│  5. CREATE Records (Transaction):                                          │
│     • Checkin record (wellness data)                                       │
│     • DailyAttendance record (attendance status)                          │
│                                                                             │
│  6. UPDATE User Stats:                                                     │
│     • currentStreak++                                                      │
│     • totalCheckins++                                                      │
│     • avgReadinessScore (running average)                                  │
│     • lastReadinessStatus                                                  │
│                                                                             │
│  7. RECALCULATE Daily Team Summary (for analytics)                         │
│                                                                             │
│  8. LOG to SystemLog (audit trail)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐        ┌───────────────┐           ┌───────────────────────┐
│    GREEN      │        │    YELLOW     │           │         RED           │
│   (≥ 70%)     │        │   (40-69%)    │           │        (< 40%)        │
│               │        │               │           │                       │
│  Show success │        │  Show low     │           │  REQUIRE low score    │
│  → Dashboard  │        │  score modal  │           │  reason (MANDATORY)   │
│               │        │  (optional    │           │                       │
│               │        │   reason)     │           │  Options:             │
│               │        │  → Dashboard  │           │  • Physical Injury    │
│               │        │               │           │  • Illness/Sickness   │
└───────────────┘        └───────────────┘           │  • Poor Sleep         │
                                                     │  • High Stress        │
                                                     │  • Personal Issues    │
                                                     │  • Family Emergency   │
                                                     │  • Work-Related       │
                                                     │  • Other              │
                                                     │                       │
                                                     │  → Notify Team Lead   │
                                                     └───────────────────────┘
```

---

## 3. Attendance & Scoring System

### 3.1 Attendance Status Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE STATUS TYPES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STATUS      │  SCORE  │  COUNTED?  │  DESCRIPTION                         │
│──────────────│─────────│────────────│─────────────────────────────────────  │
│  GREEN       │  100    │  YES       │  Nag-check-in within shift hours     │
│  ABSENT      │  0      │  YES       │  Hindi nag-check-in (cron created)   │
│  EXCUSED     │  null   │  NO        │  On approved leave (not counted)     │
└─────────────────────────────────────────────────────────────────────────────┘

IMPORTANT: Walang LATE/YELLOW sa attendance!
           Basta nag-check-in within shift = GREEN = 100 pts
```

### 3.2 Attendance Scoring Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE SCORING LOGIC                                 │
│                    (backend/src/utils/attendance.ts)                        │
└─────────────────────────────────────────────────────────────────────────────┘

    Team Schedule: shiftStart = "08:00", shiftEnd = "17:00"
    Grace Period: 15 minutes before shift start

    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │   07:45        08:00                                      17:00     │
    │     │            │                                          │       │
    │     ▼            ▼                                          ▼       │
    │  ───┼────────────┼──────────────────────────────────────────┼───   │
    │     │◄─ GRACE ─►│◄────────── SHIFT HOURS ─────────────────►│       │
    │     │   (15min)  │                                          │       │
    │                                                                      │
    │  Before 07:45 → TOO_EARLY (cannot check in)                         │
    │  07:45 - 17:00 → GREEN (100 pts)                                    │
    │  After 17:00   → TOO_LATE (cannot check in, marked ABSENT by cron) │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Cron Jobs - Automated Processing

### 4.1 Cron Schedule Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CRON JOBS SCHEDULE                                       │
│                    (backend/src/cron/attendance-finalizer.ts)               │
└─────────────────────────────────────────────────────────────────────────────┘

    HOURLY CRON (runs at minute 0 of every hour)
    ├── 5 AM Check (per company timezone)
    │   └── Process YESTERDAY's absences (safety net)
    │
    └── Shift-End Check (per team)
        └── Process TODAY's absences for teams whose shift just ended
```

### 4.2 5 AM Yesterday Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    5 AM YESTERDAY CHECK                                     │
│                    (Safety net - catches any missed)                        │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────┐
                    │  CRON runs at 5:00 AM         │
                    │  (company local time)         │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Get all active companies     │
                    │  where local time = 5 AM      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
            FOR EACH COMPANY (where hour = 5):
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Calculate "yesterday" in     │
                    │  company's timezone           │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Is yesterday a holiday?      │
                    │  ─────────────────────────    │
                    │  YES → Skip company           │
                    │  NO  → Continue               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Get all WORKER/MEMBER users  │
                    │  with active teams            │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
            FOR EACH WORKER:
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│  SKIP CONDITIONS  │    │  CHECK #1:        │    │  CHECK #2:        │
│  ─────────────────│    │  Already has      │    │  On approved      │
│  • Team inactive  │    │  attendance?      │    │  leave?           │
│  • Not work day   │    │  ───────────────  │    │  ───────────────  │
│  • Before baseline│    │  YES → Skip       │    │  YES → Skip       │
│                   │    │  (already GREEN)  │    │  (will be EXCUSED)│
└───────────────────┘    └───────────────────┘    └───────────────────┘
                                    │
                                    │ All checks passed = ABSENT
                                    ▼
                    ┌───────────────────────────────┐
                    │  CREATE (Transaction):        │
                    │  ────────────────────────     │
                    │  1. DailyAttendance           │
                    │     • status: ABSENT          │
                    │     • score: 0                │
                    │     • isCounted: true         │
                    │                               │
                    │  2. Absence                   │
                    │     • status: PENDING_        │
                    │       JUSTIFICATION           │
                    │     • (Worker must justify)   │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Recalculate Team Summary     │
                    │  (for analytics)              │
                    └───────────────────────────────┘
```

### 4.3 Shift-End Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHIFT-END CHECK                                          │
│                    (Same-day absence detection)                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────┐
                    │  CRON runs every hour         │
                    │  (at minute 0)                │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Get teams where              │
                    │  shiftEnd hour = current hour │
                    │                               │
                    │  Example: shiftEnd = "17:00"  │
                    │  Current = 17:00 → Process    │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
            FOR EACH TEAM (shift just ended):
                                    │
                    ┌───────────────────────────────┐
                    │  Same checks as 5 AM:         │
                    │  • Is today a work day?       │
                    │  • Is today a holiday?        │
                    │  • Worker has attendance?     │
                    │  • Worker on leave?           │
                    │  • Worker before baseline?    │
                    └───────────────┬───────────────┘
                                    │
                                    │ No check-in = ABSENT
                                    ▼
                    ┌───────────────────────────────┐
                    │  CREATE DailyAttendance +     │
                    │  Absence (same as 5 AM)       │
                    │                               │
                    │  Benefit: Same-day detection! │
                    │  Worker sees absence TODAY,   │
                    │  not tomorrow.                │
                    └───────────────────────────────┘
```

### 4.4 Baseline Date Logic

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BASELINE DATE LOGIC                                      │
│                    (When does check-in requirement start?)                  │
└─────────────────────────────────────────────────────────────────────────────┘

    PRIORITY ORDER:
    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │  1. First check-in date (if exists)                                 │
    │     └── Worker who already checked in once = requirement started    │
    │                                                                      │
    │  2. Next day after teamJoinedAt                                     │
    │     └── Give worker 1 day to settle before requiring check-in       │
    │                                                                      │
    │  3. Next day after createdAt (fallback)                             │
    │     └── Account creation date + 1 day                               │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

    EXAMPLE:
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Worker joins team on Jan 15, 2026                                  │
    │  Baseline = Jan 16, 2026                                            │
    │  Jan 15 absence → SKIPPED (before baseline)                         │
    │  Jan 16 absence → CREATED (baseline met)                            │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Absence Justification Flow

### 5.1 Complete Absence Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ABSENCE JUSTIFICATION FLOW                               │
│                    (backend/src/modules/absences/index.ts)                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CRON CREATES ABSENCE                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        5 AM or Shift-End cron      │
        creates Absence record      │
        status: PENDING_JUSTIFICATION
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: WORKER SEES PENDING ABSENCES                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    WORKER APP - BLOCKING POPUP                       │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  ⚠️  You have 2 pending absences to justify                         │
    │                                                                      │
    │  ┌─────────────────────────────────────────────────────────────┐   │
    │  │  Jan 14, 2026 (Tuesday)                                      │   │
    │  │  Reason: [ Select reason ▼ ]                                 │   │
    │  │          • Sick                                              │   │
    │  │          • Emergency                                         │   │
    │  │          • Personal                                          │   │
    │  │          • Forgot to check in                                │   │
    │  │          • Technical issue                                   │   │
    │  │          • Other                                             │   │
    │  │  Explanation: [_________________________________]            │   │
    │  └─────────────────────────────────────────────────────────────┘   │
    │                                                                      │
    │  ┌─────────────────────────────────────────────────────────────┐   │
    │  │  Jan 13, 2026 (Monday)                                       │   │
    │  │  Reason: [ Select reason ▼ ]                                 │   │
    │  │  Explanation: [_________________________________]            │   │
    │  └─────────────────────────────────────────────────────────────┘   │
    │                                                                      │
    │                     [ SUBMIT JUSTIFICATIONS ]                        │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  POST /api/absences/justify
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: JUSTIFICATION SUBMITTED                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
    • Absence.justifiedAt = NOW     │
    • Absence.reasonCategory = ...  │
    • Absence.explanation = ...     │
    • Status remains PENDING_JUSTIFICATION (waiting for TL review)
    • Notify Team Lead              │
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: TEAM LEAD REVIEWS                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    TEAM LEAD - PENDING REVIEWS                       │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  Juan dela Cruz - Jan 14, 2026                                      │
    │  Reason: Sick                                                        │
    │  Explanation: "Lagnat at sipon, hindi makaalis ng bahay"            │
    │                                                                      │
    │       [ ✓ EXCUSE ]                    [ ✗ UNEXCUSE ]                │
    │       (No penalty)                    (0 points)                    │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
        ▼                                                       ▼
┌───────────────────────┐                       ┌───────────────────────┐
│  EXCUSED              │                       │  UNEXCUSED            │
│  ─────────────────────│                       │  ─────────────────────│
│  • Absence.status =   │                       │  • Absence.status =   │
│    EXCUSED            │                       │    UNEXCUSED          │
│                       │                       │                       │
│  • DailyAttendance:   │                       │  • DailyAttendance:   │
│    status = EXCUSED   │                       │    status = ABSENT    │
│    score = null       │                       │    score = 0          │
│    isCounted = false  │                       │    isCounted = true   │
│                       │                       │                       │
│  • NOT counted in     │                       │  • COUNTED in         │
│    performance score  │                       │    performance score  │
│                       │                       │                       │
│  • Notify worker:     │                       │  • Notify worker:     │
│    "Excused"          │                       │    "Unexcused"        │
└───────────────────────┘                       └───────────────────────┘
```

---

## 6. Exception/Leave Request Flow

### 6.1 Leave Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXCEPTION/LEAVE REQUEST FLOW                             │
│                    (backend/src/modules/exceptions/index.ts)                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: WORKER REQUESTS LEAVE                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    REQUEST EXCEPTION FORM                            │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  Type: [ Select type ▼ ]                                            │
    │        • Sick Leave                                                  │
    │        • Personal Leave                                              │
    │        • Medical Appointment                                         │
    │        • Family Emergency                                            │
    │        • Other                                                       │
    │                                                                      │
    │  Start Date: [ Jan 15, 2026 ]                                       │
    │  End Date:   [ Jan 17, 2026 ]                                       │
    │                                                                      │
    │  Reason: [_________________________________________________]        │
    │                                                                      │
    │                     [ SUBMIT REQUEST ]                               │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  POST /api/exceptions
                                    │  status: PENDING
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: TEAM LEAD REVIEWS                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
        ▼                                                       ▼
┌───────────────────────┐                       ┌───────────────────────┐
│  APPROVE              │                       │  REJECT               │
│  ─────────────────────│                       │  ─────────────────────│
│  PUT /api/exceptions/ │                       │  PUT /api/exceptions/ │
│  :id/approve          │                       │  :id/reject           │
└───────────────────────┘                       └───────────────────────┘
        │                                                       │
        ▼                                                       ▼
┌───────────────────────────────────────┐       ┌───────────────────────┐
│  ON APPROVAL:                         │       │  ON REJECTION:        │
│  ─────────────────────────────────────│       │  ─────────────────────│
│  1. Exception.status = APPROVED       │       │  • Exception.status = │
│                                       │       │    REJECTED           │
│  2. For EACH day in leave range:      │       │                       │
│     CREATE DailyAttendance            │       │  • Notify worker      │
│     • status: EXCUSED                 │       │                       │
│     • score: null                     │       │  • Worker must work   │
│     • isCounted: false                │       │    or will be ABSENT  │
│                                       │       │                       │
│  3. Block check-ins during leave      │       │                       │
│     (check-in returns ON_LEAVE code)  │       │                       │
│                                       │       │                       │
│  4. Notify worker                     │       │                       │
└───────────────────────────────────────┘       └───────────────────────┘
```

### 6.2 Leave Impact on Check-in

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LEAVE IMPACT ON CHECK-IN                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    Worker with approved leave (Jan 15-17):

    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │  Jan 14        Jan 15         Jan 16         Jan 17        Jan 18  │
    │    │             │              │              │              │     │
    │    ▼             ▼              ▼              ▼              ▼     │
    │  ─────────────────────────────────────────────────────────────────  │
    │  Normal     │◄─────────── ON LEAVE ────────────►│    Normal     │
    │  Check-in   │         Check-in BLOCKED          │    Check-in   │
    │             │         (EXCUSED status)          │    Required   │
    │             │                                   │               │
    │  GREEN/     │         Shows: "You are on        │    GREEN/     │
    │  ABSENT     │         approved sick leave"      │    ABSENT     │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

    DailyAttendance records:
    • Jan 14 → GREEN (checked in) or ABSENT (missed)
    • Jan 15 → EXCUSED (leave day 1)
    • Jan 16 → EXCUSED (leave day 2)
    • Jan 17 → EXCUSED (leave day 3)
    • Jan 18 → GREEN (checked in) or ABSENT (missed)
```

---

## 7. Team Lead Daily Monitoring

### 7.1 Daily Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEAM LEAD DAILY MONITORING                               │
│                    (GET /api/daily-monitoring)                              │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                    TODAY'S OVERVIEW                                  │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  Check-in Rate: ████████░░ 8/10 (80%)                              │
    │                                                                      │
    │  🟢 Ready: 5     🟡 Caution: 2     🔴 Not Ready: 1     ⬜ Leave: 1  │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
    │
    │
    ┌─────────────────────────────────────────────────────────────────────┐
    │  ⚠️  SUDDEN CHANGES (Alert!)                                        │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  🔴 CRITICAL: Juan dela Cruz                                        │
    │     Today: 35%  →  7-Day Avg: 78%  (Drop: -43%)                    │
    │     Reason: Illness/Sickness                                        │
    │     [ View Profile ] [ Send Message ]                               │
    │                                                                      │
    │  🟠 SIGNIFICANT: Maria Santos                                       │
    │     Today: 55%  →  7-Day Avg: 80%  (Drop: -25%)                    │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
    │
    │
    ┌─────────────────────────────────────────────────────────────────────┐
    │  📋 PENDING REVIEWS                                                  │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  Leave Requests:                                                     │
    │  • Pedro Reyes - Sick Leave (Jan 20-22)  [ Review ]                │
    │                                                                      │
    │  Absence Justifications:                                             │
    │  • Ana Garcia - Jan 19 (Forgot to check in)  [ Review ]            │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
    │
    │
    ┌─────────────────────────────────────────────────────────────────────┐
    │  ❓ NOT YET CHECKED IN                                               │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  ⏳ Carlos Reyes - Expected by 17:00                                │
    │     [ Send Reminder ]                                                │
    │                                                                      │
    │  ⏳ Lisa Santos - Expected by 17:00                                 │
    │     [ Send Reminder ]                                                │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
    │
    │
    ┌─────────────────────────────────────────────────────────────────────┐
    │  ✅ TODAY'S CHECK-INS                                                │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │  Name             Time      Status    Score  Mood Stress Sleep Phys │
    │  ────────────────────────────────────────────────────────────────── │
    │  Juan dela Cruz   8:02 AM   🟢 Ready   85%    8    2      8     8  │
    │  Maria Santos     8:05 AM   🟡 Caution 58%    5    6      5     6  │
    │  Pedro Reyes      8:15 AM   🔴 Not     35%    3    8      2     3  │
    │                                Ready                                 │
    │  (Click row to view details or send message)                        │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Performance Score Calculation

### 8.1 Performance Score Formula

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE SCORE CALCULATION                            │
│                    (backend/src/utils/attendance.ts)                        │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │  FORMULA:                                                            │
    │  ─────────────────────────────────────────────────────────────────  │
    │                                                                      │
    │                    Total GREEN Points                                │
    │  Performance = ─────────────────────────── × 100%                   │
    │                Total Counted Days × 100                              │
    │                                                                      │
    │                                                                      │
    │  WHERE:                                                              │
    │  • GREEN = 100 points (checked in)                                  │
    │  • ABSENT = 0 points (missed)                                       │
    │  • EXCUSED = NOT COUNTED (on leave)                                 │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘

    EXAMPLE:
    ┌─────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │  Last 10 work days:                                                 │
    │  • 7 days GREEN (checked in)  = 7 × 100 = 700 points               │
    │  • 2 days ABSENT (missed)     = 2 × 0   = 0 points                 │
    │  • 1 day EXCUSED (sick leave) = NOT COUNTED                        │
    │                                                                      │
    │  Total Points = 700                                                  │
    │  Counted Days = 9 (excluding 1 excused)                             │
    │  Max Possible = 9 × 100 = 900                                       │
    │                                                                      │
    │  Performance = 700 / 900 × 100% = 77.8%                            │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Performance Grades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE GRADES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  GRADE  │  SCORE RANGE  │  LABEL                                    │
    │─────────│───────────────│─────────────────────────────────────────  │
    │    A    │   ≥ 90%       │  Excellent                                │
    │    B    │   80% - 89%   │  Good                                     │
    │    C    │   70% - 79%   │  Satisfactory                             │
    │    D    │   < 70%       │  Needs Improvement                        │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Complete Daily Timeline

### 9.1 Full Day Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DAILY TIMELINE                                  │
│                    (Example: Team shift 08:00 - 17:00)                      │
└─────────────────────────────────────────────────────────────────────────────┘

    05:00 ──────────────────────────────────────────────────────────────────
           │
           │  CRON: 5 AM Check
           │  • Process YESTERDAY's absences
           │  • Create Absence records for workers who didn't check in
           │  • Workers will see pending justifications when they open app
           │
    07:45 ──────────────────────────────────────────────────────────────────
           │
           │  CHECK-IN WINDOW OPENS (15 min grace period)
           │  • Workers can start checking in
           │
    08:00 ──────────────────────────────────────────────────────────────────
           │
           │  SHIFT STARTS
           │  • Team Lead opens Daily Monitoring dashboard
           │  • Views yesterday's summary
           │  • Sees who hasn't checked in yet
           │
    08:00 - 17:00 ─────────────────────────────────────────────────────────
           │
           │  THROUGHOUT THE DAY:
           │
           │  WORKERS:
           │  • Check in (anytime during shift = GREEN)
           │  • Justify pending absences
           │  • Request leave
           │
           │  TEAM LEAD:
           │  • Monitor check-ins in real-time
           │  • Review leave requests → Approve/Reject
           │  • Review absence justifications → Excuse/Unexcuse
           │  • Send reminders to workers who haven't checked in
           │  • View sudden changes (score drops)
           │  • Generate AI insights
           │
    17:00 ──────────────────────────────────────────────────────────────────
           │
           │  SHIFT ENDS
           │  • Check-in window closes
           │  • Workers who didn't check in → TOO_LATE error
           │
           │  CRON: Shift-End Check
           │  • Immediately mark ABSENT for workers who didn't check in
           │  • Create Absence records (same-day detection!)
           │  • Workers will see pending justifications right away
           │
    17:00+ ─────────────────────────────────────────────────────────────────
           │
           │  END OF DAY:
           │  • Daily team summaries finalized
           │  • Analytics updated
           │  • Ready for next day
           │
    ────────────────────────────────────────────────────────────────────────
```

---

## Summary

### Key Points:

1. **Check-in = Wellness Assessment**
   - 4 metrics: Mood, Stress, Sleep, Physical
   - Score: GREEN (≥70%), CAUTION (40-69%), RED (<40%)

2. **Attendance = Simple**
   - GREEN = Checked in (100 pts)
   - ABSENT = Missed (0 pts)
   - EXCUSED = On leave (not counted)
   - **NO LATE PENALTY** - basta within shift = GREEN

3. **Cron Jobs = Automated**
   - 5 AM: Process yesterday's absences
   - Hourly: Process shift-end absences (same-day detection)

4. **Absence Justification = Required**
   - Worker must justify why they were absent
   - Team Lead reviews: Excuse (no penalty) or Unexcuse (0 pts)

5. **Leave Request = Pre-approved**
   - Worker requests leave before the date
   - Team Lead approves → Creates EXCUSED attendance for each day

6. **Performance Score = Fair**
   - Only counts GREEN and ABSENT days
   - EXCUSED days not counted (fair to those on leave)

---

*Documentation para sa Aegira Attendance & Wellness Management System*
*Version 3.0 - January 2026*








